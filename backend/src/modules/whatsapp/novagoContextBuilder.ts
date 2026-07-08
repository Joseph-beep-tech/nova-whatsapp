/**
 * NovaGo Context Builder
 *
 * The heart of the anti-hallucination engine.  Every LLM call passes through
 * this module, which assembles a structured context object from real MongoDB
 * data — menu, restaurant profile, knowledge-base chunks, and customer history.
 * The LLM is only ever shown data that actually exists in the database.
 */

import OpenAI from 'openai';
import { IMenuItem } from '../../models/MenuItem';
import { prisma } from '../../lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MenuEntry {
  id: string;
  name: string;
  description: string;
  price: number;
  isVegetarian: boolean;
  prepTimeMinutes: number;
  allergens: string[];
}

export interface MenuCategory {
  category: string;
  items: MenuEntry[];
}

export interface CustomerHistory {
  name: string | null;
  orderCount: number;
  favouriteItems: string[];
  lastOrderDate: Date | null;
  lastDeliveryAddress: string | null;
}

export interface RetrievedKBChunk {
  kbDocId: string;
  chunkIndex: number;
  score: number;
  text: string;
  docType: string;
  title: string;
}

export interface UpsellRule {
  triggerItem: string;
  suggestItem: string;
  message?: string;
}

export interface NovaGoContext {
  restaurant: {
    id: string;
    name: string;
    description: string;
    cuisine: string;
    hours: string;
    address: string;
    phone: string;
    deliveryFee: number;
    minOrder: number;
    currencySymbol: string;
    isOpen: boolean;
    deliveryTimeMin: number;
    deliveryTimeMax: number;
    features: string[];
  };
  menu: MenuCategory[];
  aiConfig: {
    persona: string;
    greeting: string;
    orderConfirmMsg: string;
    autoConfirmOrders: boolean;
    mpesaEnabled: boolean;
    mpesaPaybill: string | null;
    mpesaTillNumber: string | null;
    ragEnabled: boolean;
    ragTopK: number;
    ragScoreThreshold: number;
    upsellRules: UpsellRule[];
  };
  kbChunks: RetrievedKBChunk[];
  customerHistory: CustomerHistory;
}

// ── Embedding client (server-level key for RAG operations) ────────────────────

let _embeddingClient: OpenAI | null = null;
function getEmbeddingClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_embeddingClient) {
    _embeddingClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _embeddingClient;
}

async function embedQuery(text: string): Promise<number[] | null> {
  const client = getEmbeddingClient();
  if (!client) return null;
  try {
    const resp = await client.embeddings.create({ model: 'text-embedding-3-small', input: [text] });
    return resp.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn('[NovaGoContextBuilder] embedding failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Cosine similarity ─────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
}

// ── Knowledge-base RAG search ─────────────────────────────────────────────────

async function searchKnowledgeBase(
  restaurantId: string,
  query: string,
  topK: number,
  scoreThreshold: number,
): Promise<RetrievedKBChunk[]> {
  const queryEmbed = await embedQuery(query);
  if (!queryEmbed) return [];

  const docs = await prisma.knowledgeBase.findMany({ where: { restaurantId, status: 'active' } });
  const scored: RetrievedKBChunk[] = [];

  type KBChunk = { chunkIndex: number; text: string; embedding?: number[]; tokens: number };
  for (const doc of docs) {
    for (const chunk of (doc.chunks as unknown as KBChunk[])) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue;
      const score = cosineSimilarity(queryEmbed, chunk.embedding);
      if (score >= scoreThreshold) {
        scored.push({
          kbDocId: doc.id,
          chunkIndex: chunk.chunkIndex,
          score,
          text: chunk.text,
          docType: doc.docType,
          title: doc.title,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// ── Menu grouping ─────────────────────────────────────────────────────────────

function groupMenu(items: IMenuItem[]): MenuCategory[] {
  const map = new Map<string, MenuCategory>();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, { category: item.category, items: [] });
    map.get(item.category)!.items.push({
      id: item.id,
      name: item.name,
      description: item.description || '',
      price: item.price,
      isVegetarian: item.isVegetarian,
      prepTimeMinutes: item.prepTimeMinutes,
      allergens: item.allergens,
    });
  }
  return Array.from(map.values());
}

// ── Customer order history ────────────────────────────────────────────────────

async function getCustomerHistory(customerPhone: string, restaurantId: string): Promise<CustomerHistory> {
  const digits = customerPhone.replace(/\D/g, '');
  const tail = digits.slice(-9);

  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      customerPhone: { contains: tail, mode: 'insensitive' },
      NOT: { status: 'cancelled' },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!orders.length) {
    return { name: null, orderCount: 0, favouriteItems: [], lastOrderDate: null, lastDeliveryAddress: null };
  }

  type OItem = { name: string; quantity: number };
  const itemCounts = new Map<string, number>();
  for (const o of orders) {
    for (const item of (o.items as unknown as OItem[])) {
      itemCounts.set(item.name, (itemCounts.get(item.name) ?? 0) + item.quantity);
    }
  }
  const favouriteItems = [...itemCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return {
    name: orders[0].customerName || null,
    orderCount: orders.length,
    favouriteItems,
    lastOrderDate: orders[0].createdAt as Date,
    lastDeliveryAddress: orders[0].deliveryAddress || null,
  };
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Build a fully-grounded NovaGo context for the LLM.
 * Returns null if the restaurantId does not exist in the database.
 */
export async function buildNovaGoContext(
  restaurantId: string,
  customerPhone: string,
  userQuery: string,
): Promise<NovaGoContext | null> {
  const [restaurant, menuItems, aiConfig] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId } }),
    prisma.menuItem.findMany({ where: { restaurantId, isAvailable: true }, orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.restaurantAIConfig.findFirst({ where: { restaurantId } }),
  ]);

  if (!restaurant) return null;

  const cfg = aiConfig ?? {};
  const ragEnabled    = (cfg as any).ragEnabled    !== false;
  const ragTopK       = (cfg as any).ragTopK       ?? 5;
  const ragScoreThreshold = (cfg as any).ragScoreThreshold ?? 0.72;

  const [kbChunks, customerHistory] = await Promise.all([
    ragEnabled && userQuery.trim()
      ? searchKnowledgeBase(restaurantId, userQuery, ragTopK, ragScoreThreshold)
      : Promise.resolve([] as RetrievedKBChunk[]),
    getCustomerHistory(customerPhone, restaurantId),
  ]);

  return {
    restaurant: {
      id:              restaurant.id,
      name:            restaurant.name,
      description:     restaurant.description ?? '',
      cuisine:         restaurant.cuisine,
      hours:           restaurant.hours ?? 'Mon–Sun 08:00–22:00',
      address:         restaurant.address,
      phone:           restaurant.phone ?? '',
      deliveryFee:     restaurant.deliveryFee,
      minOrder:        restaurant.minOrder,
      currencySymbol:  restaurant.currencySymbol,
      isOpen:          restaurant.isOpen,
      deliveryTimeMin: restaurant.deliveryTimeMinutesMin,
      deliveryTimeMax: restaurant.deliveryTimeMinutesMax,
      features:        restaurant.features,
    },
    menu: groupMenu(menuItems as IMenuItem[]),
    aiConfig: {
      persona:           (cfg as any).waPersona            ?? `Helpful AI assistant for ${restaurant.name}`,
      greeting:          (cfg as any).waGreeting            ?? `Hi! 👋 Welcome to *${restaurant.name}*. How can I help you?`,
      orderConfirmMsg:   (cfg as any).waOrderConfirmationMsg ?? 'Your order #{orderId} has been confirmed! 🎉 Estimated delivery: {eta} mins.',
      autoConfirmOrders: (cfg as any).autoConfirmOrders     ?? false,
      mpesaEnabled:      (cfg as any).mpesaEnabled          ?? false,
      mpesaPaybill:      (cfg as any).mpesaPaybill          ?? null,
      mpesaTillNumber:   (cfg as any).mpesaTillNumber       ?? null,
      ragEnabled,
      ragTopK,
      ragScoreThreshold,
      upsellRules:       (cfg as any).upsellRules           ?? [],
    },
    kbChunks,
    customerHistory,
  };
}
