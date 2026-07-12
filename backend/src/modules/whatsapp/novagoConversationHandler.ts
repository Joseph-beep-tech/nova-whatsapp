/**
 * NovaGo Conversation Handler
 *
 * Full state machine for restaurant WhatsApp ordering:
 *   GREETING → BROWSING → CART → ADDRESS → CONFIRM → PAYMENT → ORDERED
 *   (and TRACKING at any point)
 *
 * The LLM is given a strict, fully-grounded system prompt and must respond in
 * structured JSON.  Every cart mutation is validated against DB menu data so
 * hallucinated item names or prices can never enter a real order.
 *
 * Cart state lives in-process (Map).  30-minute inactivity TTL resets the cart.
 * For production scale, replace the Map with Redis.
 */

import OpenAI from 'openai';
import { buildNovaGoContext, NovaGoContext } from './novagoContextBuilder';
import { placeWhatsAppOrder } from './novagoOrderBridge';
import { prisma } from '../../lib/prisma';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;    // DB price at time of add — never from LLM
  quantity: number;
  notes?: string;
}

type ConversationStep =
  | 'GREETING'
  | 'BROWSING'
  | 'CART'
  | 'ADDRESS'
  | 'CONFIRM'
  | 'PAYMENT'
  | 'ORDERED'
  | 'TRACKING';

interface ConversationState {
  step: ConversationStep;
  restaurantId: string;
  cart: CartItem[];
  deliveryAddress?: string;
  deliveryLocLat?: number;
  deliveryLocLng?: number;
  customerName?: string;
  // The customer's *confirmed* M-Pesa-reachable phone — distinct from the raw
  // WhatsApp JID-derived value, which isn't a real phone number at all for
  // "@lid" (Linked ID / privacy-mode) chats.
  customerPhone?: string;
  paymentMethod?: 'mpesa' | 'cash';
  lastUpdated: Date;
}

interface LLMAction {
  reply: string;
  intent?: string;
  // Cart mutations — validated against real DB before applying
  addToCart?: Array<{ itemId: string; itemName: string; quantity: number; notes?: string }>;
  removeFromCart?: string[];  // item names to remove
  clearCart?: boolean;
  // Checkout flow
  setDeliveryAddress?: string | null;
  setCustomerName?: string | null;
  setCustomerPhone?: string | null;
  setPaymentMethod?: 'mpesa' | 'cash' | null;
  confirmOrder?: boolean;
  requestTracking?: boolean;
}

// A WhatsApp chat JID only carries a real phone number for regular ("@s.whatsapp.net")
// chats — "@lid" (Linked ID / privacy mode) chats never expose one, so it must be
// asked for and confirmed in conversation before M-Pesa can be used.
function isValidKenyanPhone(phone: string): boolean {
  return /^254(7|1)\d{8}$/.test(phone);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 60 * 1_000;

function cartTotal(cart: CartItem[]): number {
  return cart.reduce((s, i) => s + i.price * i.quantity, 0);
}

function formatCart(cart: CartItem[], sym: string): string {
  if (!cart.length) return 'Your cart is empty.';
  const lines = cart.map((i) => `• ${i.name} ×${i.quantity} = ${sym}${(i.price * i.quantity).toFixed(0)}`);
  lines.push(`\n*Subtotal: ${sym}${cartTotal(cart).toFixed(0)}*`);
  return lines.join('\n');
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(ctx: NovaGoContext, state: ConversationState): string {
  const { restaurant: r, menu, aiConfig, kbChunks, customerHistory: ch } = ctx;

  // Compact menu JSON — omit empty description to save tokens
  const menuJson = JSON.stringify(
    menu.map((cat) => ({
      category: cat.category,
      items: cat.items.map((i) => ({
        id:    i.id,
        name:  i.name,
        price: i.price,
        ...(i.description ? { desc: i.description } : {}),
        ...(i.isVegetarian ? { veg: true } : {}),
      })),
    })),
  );

  const cartBlock = formatCart(state.cart, r.currencySymbol);

  const customerBlock = ch.orderCount > 0
    ? [
        `Returning customer — ${ch.orderCount} previous order(s).`,
        ch.name                     ? `Name: ${ch.name}.`                                : '',
        ch.favouriteItems.length    ? `Favourites: ${ch.favouriteItems.join(', ')}.`      : '',
        ch.lastDeliveryAddress      ? `Last address: ${ch.lastDeliveryAddress}.`          : '',
      ].filter(Boolean).join(' ')
    : 'New customer — first interaction.';

  const kbBlock = kbChunks.length
    ? `\n--- KNOWLEDGE BASE (answer FAQs ONLY from this text) ---\n${kbChunks.map((c) => c.text).join('\n\n')}\n--- END ---`
    : '';

  const upsellBlock = aiConfig.upsellRules.length
    ? `\nUPSELL RULES — apply these naturally, once per cart addition:\n${aiConfig.upsellRules.map((u) => `• Customer orders "${u.triggerItem}" → suggest "${u.suggestItem}"${u.message ? ` — say: "${u.message}"` : ''}`).join('\n')}`
    : '';

  const reorderHint = ch.orderCount > 0 && ch.favouriteItems.length > 0
    ? ` After greeting, proactively suggest: "Would you like to reorder your usual — ${ch.favouriteItems.slice(0, 2).join(' and ')}?" — make it feel natural, not scripted.`
    : '';

  const stepGuide: Record<ConversationStep, string> = {
    GREETING: `Greet the customer warmly${ch.name ? ` — their name is ${ch.name}` : ''}. Briefly say what you can help with (order food, browse menu, track orders).${reorderHint}`,
    BROWSING: 'Help them browse the menu. Show categories or specific items when asked. Answer menu questions with exact prices from the menu JSON.',
    CART: `Items in cart:\n${cartBlock}\n\nOffer to add/remove items, or guide them to checkout by asking for their delivery address.`,
    ADDRESS: `Cart ready:\n${cartBlock}\n\nAsk the customer for their delivery address${ch.lastDeliveryAddress ? ` (suggest previous: ${ch.lastDeliveryAddress})` : ''}.`,
    CONFIRM: !state.customerPhone
      ? `We don't yet have a valid phone number for this customer (WhatsApp privacy settings can hide it). Before anything else, politely ask for their M-Pesa-reachable phone number (e.g. 07XXXXXXXX) — do not proceed to order confirmation until you have it.`
      : !state.paymentMethod
      ? `Confirm the full order AND the customer's details AND ask their payment preference, together in one message:\n${cartBlock}\nDelivery to: ${state.deliveryAddress}\nDelivery fee: ${r.currencySymbol}${r.deliveryFee}\nName: ${state.customerName || 'not yet given — politely ask for it as part of this confirmation'}\nPhone: ${state.customerPhone}\n\nAsk the customer to confirm the order AND that their name and phone are correct, AND ask whether they'll pay via M-Pesa${aiConfig.mpesaPaybill ? ` (Paybill ${aiConfig.mpesaPaybill})` : ''} or Cash on Delivery. Do not set "confirmOrder": true until a payment method is chosen and everything is explicitly confirmed.`
      : `The customer already chose to pay via ${state.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash on Delivery'}. Set "confirmOrder": true now to finalize this order — do not ask again.`,
    PAYMENT: state.paymentMethod
      ? `The customer already chose to pay via ${state.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash on Delivery'}. Set "confirmOrder": true now to finalize this order — do not ask again.`
      : `Ask whether to pay via M-Pesa${aiConfig.mpesaPaybill ? ` (Paybill ${aiConfig.mpesaPaybill})` : ''} or Cash on Delivery.`,
    ORDERED: 'Order is placed. Share the order number and ETA. Thank the customer.',
    TRACKING: 'Customer is asking about order status. Report the latest status retrieved.',
  };

  return [
    `You are the official WhatsApp ordering agent for *${r.name}* (${r.cuisine}).`,
    `Persona: ${aiConfig.persona}`,
    '',
    '⚠️ RULES — NEVER BREAK THESE:',
    '1. Only name items and prices that appear in the MENU JSON below. Never invent items, prices, or availability.',
    '2. When adding to cart, output the exact "id" field from the menu JSON.',
    '3. Answer FAQs only from the KNOWLEDGE BASE block. If not there, say you do not know.',
    '4. Prices in your reply must match menu JSON exactly — no rounding, no estimation.',
    '5. If the restaurant is closed, inform the customer and do not process new orders.',
    '6. Only set "confirmOrder": true after the customer has explicitly confirmed their name, phone, delivery address, and order are all correct.',
    '',
    `RESTAURANT: ${r.name} | ${r.cuisine} | Hours: ${r.hours}`,
    `Address: ${r.address} | Delivery fee: ${r.currencySymbol}${r.deliveryFee} | Min order: ${r.currencySymbol}${r.minOrder}`,
    `ETA: ${r.deliveryTimeMin}–${r.deliveryTimeMax} mins | Status: ${r.isOpen ? '✅ OPEN' : '❌ CLOSED'}`,
    '',
    `MENU JSON (your ONLY source for item names, ids, and prices):`,
    menuJson,
    kbBlock,
    upsellBlock,
    '',
    `CUSTOMER: ${customerBlock}`,
    '',
    `CONVERSATION STATE: ${state.step}`,
    `YOUR TASK: ${stepGuide[state.step]}`,
    '',
    'Respond ONLY with valid JSON — no markdown fences, no extra text:',
    '{',
    '  "reply": "<WhatsApp message — use *bold*, \\n for newlines>",',
    '  "intent": "<greeting|menu_query|add_to_cart|view_cart|remove_from_cart|checkout|set_address|confirm_order|set_payment|track_order|faq|complaint|other>",',
    '  "addToCart": [{"itemId":"<exact id>","itemName":"<exact name>","quantity":<n>}],',
    '  "removeFromCart": ["<name to remove>"],',
    '  "clearCart": false,',
    '  "setDeliveryAddress": "<address string or null>",',
    '  "setCustomerName": "<name or null>",',
    '  "setCustomerPhone": "<254XXXXXXXXX formatted phone, or null>",',
    '  "setPaymentMethod": "<mpesa|cash|null>",',
    '  "confirmOrder": false,',
    '  "requestTracking": false',
    '}',
    'Omit keys that are null/false/empty.',
  ].join('\n');
}

// ── Conversation Handler ──────────────────────────────────────────────────────

class NovaGoConversationHandler {
  private states = new Map<string, ConversationState>();

  private getState(chatId: string, restaurantId: string): ConversationState {
    const s = this.states.get(chatId);
    if (s && s.restaurantId === restaurantId) {
      if (Date.now() - s.lastUpdated.getTime() < SESSION_TTL_MS) return s;
    }
    const fresh: ConversationState = {
      step: 'GREETING',
      restaurantId,
      cart: [],
      lastUpdated: new Date(),
    };
    this.states.set(chatId, fresh);
    return fresh;
  }

  private touch(state: ConversationState): void {
    state.lastUpdated = new Date();
  }

  // ── LLM call ──────────────────────────────────────────────────────────────

  private async callLLM(
    apiKey: string,
    systemPrompt: string,
    priorHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    userMessage: string,
  ): Promise<{ action: LLMAction; tokensUsed: number }> {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...priorHistory.slice(-8),
        { role: 'user', content: userMessage },
      ],
      temperature: 0.35,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const tokensUsed = completion.usage?.total_tokens ?? 0;
    try {
      return { action: JSON.parse(raw) as LLMAction, tokensUsed };
    } catch {
      return { action: { reply: raw }, tokensUsed };
    }
  }

  // ── Cart mutations (always validated against ctx.menu) ────────────────────

  private applyCartMutations(state: ConversationState, action: LLMAction, ctx: NovaGoContext): void {
    if (action.clearCart) {
      state.cart = [];
    }

    if (action.removeFromCart?.length) {
      for (const name of action.removeFromCart) {
        const idx = state.cart.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
        if (idx !== -1) state.cart.splice(idx, 1);
      }
    }

    if (action.addToCart?.length) {
      const allItems = ctx.menu.flatMap((c) => c.items);
      for (const req of action.addToCart) {
        // Match by ID first, then fall back to name — handles LLM inconsistency
        const dbItem = allItems.find((i) => i.id === req.itemId)
          ?? allItems.find((i) => i.name.toLowerCase() === req.itemName?.toLowerCase());
        if (!dbItem) {
          console.warn(`[NovaGoHandler] LLM requested unknown item "${req.itemName}" (id: ${req.itemId}) — skipped`);
          continue;
        }
        const existing = state.cart.find((c) => c.menuItemId === dbItem.id);
        if (existing) {
          existing.quantity += Math.max(1, req.quantity);
        } else {
          state.cart.push({
            menuItemId: dbItem.id,
            name:       dbItem.name,
            price:      dbItem.price, // DB price — never LLM price
            quantity:   Math.max(1, req.quantity),
          });
        }
      }
    }
  }

  // ── State transitions ─────────────────────────────────────────────────────

  private advanceState(state: ConversationState, action: LLMAction): void {
    if (action.setCustomerName) state.customerName = action.setCustomerName;

    if (action.setCustomerPhone) {
      const cleaned = action.setCustomerPhone.replace(/[\s+-]/g, '');
      const normalized = cleaned.startsWith('0') ? `254${cleaned.slice(1)}` : cleaned;
      if (isValidKenyanPhone(normalized)) state.customerPhone = normalized;
    }

    if (action.setDeliveryAddress) {
      state.deliveryAddress = action.setDeliveryAddress;
    }

    if (action.setPaymentMethod) {
      state.paymentMethod = action.setPaymentMethod;
    }

    // Transition logic
    if (state.step === 'GREETING') state.step = 'BROWSING';

    if (state.cart.length > 0 && state.step === 'BROWSING') state.step = 'CART';
    if (state.cart.length === 0 && state.step === 'CART')    state.step = 'BROWSING';

    if (state.deliveryAddress && state.step === 'CART')    state.step = 'CONFIRM';
    if (state.paymentMethod   && state.step === 'CONFIRM') state.step = 'PAYMENT';

    if (action.requestTracking) state.step = 'TRACKING';
  }

  // ── Order tracking ────────────────────────────────────────────────────────

  private async getTrackingReply(customerPhone: string, restaurantId: string, sym: string): Promise<string> {
    const tail = customerPhone.replace(/\D/g, '').slice(-9);
    const order = await prisma.order.findFirst({
      where: {
        restaurantId,
        customerPhone: { contains: tail, mode: 'insensitive' },
        NOT: { status: { in: ['delivered', 'cancelled'] } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      return "I couldn't find an active order for your number. Your last order may have already been delivered.";
    }

    const emoji: Record<string, string> = {
      pending: '⏳', confirmed: '✅', preparing: '👨‍🍳',
      ready: '📦', assigned: '🚴', picked_up: '🚴', on_the_way: '🛵', delivered: '✅',
    };
    const status = (order.status as string).replace(/_/g, ' ').toUpperCase();
    return [
      `📍 *Order Update*`,
      `Order #${order.id.slice(-6).toUpperCase()}`,
      `Status: ${emoji[order.status] ?? '📋'} ${status}`,
      order.etaMinutes ? `ETA: ~${order.etaMinutes} mins` : '',
      `Total: ${sym}${(order.total ?? 0).toFixed(0)}`,
    ].filter(Boolean).join('\n');
  }

  // ── Main entry point ──────────────────────────────────────────────────────

  async handleMessage(args: {
    restaurantId: string;
    sessionId: string;
    chatId: string;
    customerPhone: string;
    messageBody: string;
    apiKey: string;
    priorHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
    location?: { lat: number; lng: number; address: string };
    pushName?: string | null;
  }): Promise<string | null> {
    const { restaurantId, sessionId, chatId, customerPhone, messageBody, apiKey, priorHistory, location, pushName } = args;
    const startMs = Date.now();

    const state = this.getState(chatId, restaurantId);

    // The common case (regular "@s.whatsapp.net" chats) already has a real,
    // usable phone number from the JID — seed it immediately so there's no
    // extra question. "@lid" chats fail this check and get asked explicitly
    // in the CONFIRM step guide instead.
    if (!state.customerPhone && isValidKenyanPhone(customerPhone)) {
      state.customerPhone = customerPhone;
    }

    // A shared WhatsApp location sets the delivery address deterministically —
    // the LLM only ever sees the human-readable address text (in messageBody),
    // never raw coordinates, so it converses about it naturally.
    if (location) {
      state.deliveryAddress = location.address;
      state.deliveryLocLat = location.lat;
      state.deliveryLocLng = location.lng;
    }

    // Build fully-grounded context from DB
    const ctx = await buildNovaGoContext(restaurantId, customerPhone, messageBody);
    if (!ctx) return 'This restaurant is not available at the moment. Please try again later.';

    // Seed customer name — a confirmed name from a past order is authoritative;
    // otherwise fall back to the WhatsApp profile display name, which is always
    // available (even for "@lid" chats that hide the real phone number) and
    // only ever needs confirming, never asking for from scratch.
    if (!state.customerName && ctx.customerHistory.name) {
      state.customerName = ctx.customerHistory.name;
    }
    if (!state.customerName && pushName) {
      state.customerName = pushName;
    }

    // Check for simple track request before calling LLM
    const trackKeywords = /\b(track|status|where.*(order|food)|order.*(status|update))\b/i;
    if (trackKeywords.test(messageBody)) {
      const trackReply = await this.getTrackingReply(customerPhone, restaurantId, ctx.restaurant.currencySymbol);
      this.touch(state);

      prisma.aIInteractionLog.create({ data: {
        restaurantId, channel: 'whatsapp', sessionId,
        customerPhone,
        userMessage: messageBody, aiResponse: trackReply,
        intent: 'track_order', retrievedChunks: [],
        latencyMs: Date.now() - startMs, escalated: false,
      } }).catch(console.error);

      return trackReply;
    }

    const systemPrompt = buildSystemPrompt(ctx, state);

    // Call LLM
    let action: LLMAction = { reply: '' };
    let tokensUsed = 0;
    try {
      ({ action, tokensUsed } = await this.callLLM(apiKey, systemPrompt, priorHistory, messageBody));
    } catch (err) {
      console.error(`[NovaGoHandler][${sessionId}] LLM error:`, err);
      return 'I encountered an error. Please try again or contact us directly.';
    }

    // Apply cart mutations (with DB validation — no hallucinated items enter)
    this.applyCartMutations(state, action, ctx);

    // Advance conversation state
    this.advanceState(state, action);

    let finalReply = action.reply || null;

    // The LLM can decide to finalize (confirmOrder:true) without ever having
    // actually asked about payment method — that must never silently default
    // to cash. Force the question explicitly instead of placing the order.
    if (action.confirmOrder && state.cart.length > 0 && state.deliveryAddress && state.customerPhone && !state.paymentMethod) {
      finalReply = 'Before I place your order — how would you like to pay: *M-Pesa* or *Cash on Delivery*?';
      action.confirmOrder = false;
    }

    // Place order when customer confirms (customerPhone must be a confirmed, valid
    // number — never the raw JID, which isn't a real phone for "@lid" chats)
    if (action.confirmOrder && state.cart.length > 0 && state.deliveryAddress && state.customerPhone && state.paymentMethod) {
      try {
        const pm = state.paymentMethod;
        const placed = await placeWhatsAppOrder({
          restaurantId,
          sessionId,
          chatId,
          cart:              state.cart,
          deliveryAddress:   state.deliveryAddress,
          deliveryLocLat:    state.deliveryLocLat,
          deliveryLocLng:    state.deliveryLocLng,
          customerPhone:     state.customerPhone,
          customerName:      state.customerName ?? 'WhatsApp Customer',
          paymentMethod:     pm,
        });

        const confirmTemplate = ctx.aiConfig.orderConfirmMsg
          .replace('{orderId}', placed.orderNumber)
          .replace('{eta}',    String(placed.etaMinutes));

        const sym = ctx.restaurant.currencySymbol;
        finalReply = [
          confirmTemplate,
          `\n📋 *Order #${placed.orderNumber}*`,
          `Subtotal: ${sym}${placed.subtotal.toFixed(0)}`,
          `Delivery: ${sym}${placed.deliveryFee.toFixed(0)}`,
          `Tax (16%): ${sym}${placed.tax.toFixed(0)}`,
          `*Total: ${sym}${placed.total.toFixed(0)}*`,
          `🕐 Estimated delivery: ${placed.etaMinutes} mins`,
          pm === 'mpesa' && placed.stkSent
            ? `\n📲 We've sent an M-Pesa prompt to your phone — enter your PIN to complete payment of ${sym}${placed.total.toFixed(0)}.`
            : pm === 'mpesa' && ctx.aiConfig.mpesaPaybill
            ? `\n💳 Pay via M-Pesa Paybill *${ctx.aiConfig.mpesaPaybill}*`
            : pm === 'mpesa' && ctx.aiConfig.mpesaTillNumber
            ? `\n💳 Pay via M-Pesa Till *${ctx.aiConfig.mpesaTillNumber}*`
            : '',
          '\nReply *track* anytime to check your order status.',
        ].filter(Boolean).join('\n');

        // Reset cart state after successful order
        state.cart             = [];
        state.deliveryAddress  = undefined;
        state.paymentMethod    = undefined;
        state.step             = 'ORDERED';
      } catch (err: any) {
        console.error(`[NovaGoHandler][${sessionId}] order placement failed:`, err);
        finalReply = `Sorry, I couldn't place your order: ${err.message}. Please try again or call us directly.`;
      }
    }

    this.touch(state);

    // Async log
    prisma.aIInteractionLog.create({ data: {
      restaurantId, channel: 'whatsapp', sessionId,
      customerPhone,
      userMessage: messageBody, aiResponse: finalReply ?? '',
      intent: action.intent,
      retrievedChunks: ctx.kbChunks.map((c) => ({
        kbDocId: c.kbDocId, chunkIndex: c.chunkIndex, score: c.score,
        snippet: c.text.slice(0, 300),
      })),
      tokensUsed,
      latencyMs: Date.now() - startMs,
      escalated: false,
    } }).catch(console.error);

    return finalReply;
  }

  clearSession(chatId: string): void {
    this.states.delete(chatId);
  }
}

export const novaGoHandler = new NovaGoConversationHandler();
