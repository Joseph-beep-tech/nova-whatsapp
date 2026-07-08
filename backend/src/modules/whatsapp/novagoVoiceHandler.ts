/**
 * NovaGo Voice Handler
 *
 * Builds grounded, voice-optimised system instructions for OpenAI Realtime calls
 * by pulling real restaurant data through the same NovaGo context builder used
 * for WhatsApp.  The result is an instruction string suitable for the `instructions`
 * field in an OpenAI Realtime conversation session config.
 *
 * Voice-specific constraints applied here:
 *  - No markdown (*bold*, bullet lists) — spoken text only
 *  - Short sentences — phone call pace
 *  - Same anti-hallucination rules as WhatsApp (data from DB only)
 */

import { buildNovaGoContext } from './novagoContextBuilder';
import { prisma } from '../../lib/prisma';

export async function buildVoiceInstructions(
  restaurantId: string,
  callerPhone: string,
): Promise<string | null> {
  const ctx = await buildNovaGoContext(restaurantId, callerPhone, '');
  if (!ctx) return null;

  const { restaurant: r, menu, aiConfig, kbChunks, customerHistory: ch } = ctx;

  const menuText = menu
    .map((cat) => {
      const items = cat.items.map((i) => `${i.name} at ${r.currencySymbol}${i.price}`).join(', ');
      return `${cat.category}: ${items}`;
    })
    .join('. ');

  const kbText = kbChunks.length
    ? `Additional information: ${kbChunks.map((c) => c.text).join(' ')}`
    : '';

  const customerGreeting = ch.orderCount > 0 && ch.name
    ? `This is a returning customer named ${ch.name}. They have ordered ${ch.orderCount} times before. Their favourite items are ${ch.favouriteItems.join(' and ')}.`
    : 'This is a new caller.';

  const reorderHint = ch.orderCount > 0 && ch.favouriteItems.length > 0
    ? `After greeting, naturally ask: "Would you like to order your usual ${ch.favouriteItems[0]}?"`
    : '';

  return [
    `You are the voice AI agent for ${r.name}, a ${r.cuisine} restaurant.`,
    `Your persona: ${aiConfig.persona}.`,
    '',
    'CRITICAL RULES — never break these:',
    `One: Only mention menu items and prices that are listed below. Never invent items, prices, or availability.`,
    `Two: Answer questions about the restaurant only from the information below. If you do not know, say you will check and follow up.`,
    `Three: Keep all responses short — this is a phone call. Maximum two sentences per turn.`,
    `Four: Speak naturally. No bullet points. No asterisks. No markdown.`,
    `Five: If the restaurant is currently closed, say so and do not take orders.`,
    '',
    `RESTAURANT: ${r.name}. Cuisine: ${r.cuisine}. Hours: ${r.hours}. Address: ${r.address}. Currently ${r.isOpen ? 'open' : 'closed'}.`,
    `Delivery fee: ${r.currencySymbol}${r.deliveryFee}. Minimum order: ${r.currencySymbol}${r.minOrder}. Delivery time: ${r.deliveryTimeMin} to ${r.deliveryTimeMax} minutes.`,
    '',
    `FULL MENU: ${menuText}`,
    kbText ? `\n${kbText}` : '',
    '',
    `CUSTOMER: ${customerGreeting}`,
    reorderHint ? reorderHint : '',
    '',
    `Open with a warm greeting and introduce yourself as the AI assistant for ${r.name}. Ask how you can help.`,
    `If the caller wants to place an order, collect: which items, delivery address, name, and payment method (M-Pesa or cash on delivery).`,
    `When you have all details, confirm the order back to the caller including total cost and estimated delivery time.`,
    `For order tracking, ask for the order number or the phone number used to place the order.`,
  ].filter(Boolean).join('\n');
}

export async function logVoiceInteraction(args: {
  restaurantId: string;
  callSid: string;
  callerPhone: string;
  summary: string;
  latencyMs?: number;
}): Promise<void> {
  await prisma.aIInteractionLog.create({ data: {
    restaurantId: args.restaurantId,
    channel: 'voice',
    sessionId: args.callSid,
    customerPhone: args.callerPhone,
    userMessage: '(voice call)',
    aiResponse: args.summary,
    intent: 'general',
    retrievedChunks: [],
    latencyMs: args.latencyMs,
    escalated: false,
  } }).catch(console.error);
}
