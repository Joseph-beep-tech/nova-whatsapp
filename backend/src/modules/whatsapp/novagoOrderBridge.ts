/**
 * NovaGo Order Bridge
 *
 * Converts a confirmed WhatsApp cart into a real Order document.
 * Prices are ALWAYS re-validated against the live database — the LLM's cart
 * prices are discarded and replaced with authoritative DB values.
 */

import { prisma } from '../../lib/prisma';
import type { CartItem } from './novagoConversationHandler';
import { Prisma } from '@prisma/client';
import { stkPush } from '../../services/mpesa';

export interface PlacedOrderResult {
  orderId: string;
  orderNumber: string;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  etaMinutes: number;
  paymentMethod: 'mpesa' | 'cash';
  stkSent: boolean;
}

export async function placeWhatsAppOrder(args: {
  restaurantId: string;
  sessionId: string;
  chatId: string;
  cart: CartItem[];
  deliveryAddress: string;
  deliveryLocLat?: number;
  deliveryLocLng?: number;
  customerPhone: string;
  customerName: string;
  paymentMethod: 'mpesa' | 'cash';
  specialInstructions?: string;
}): Promise<PlacedOrderResult> {
  const {
    restaurantId, sessionId, chatId, cart, deliveryAddress, deliveryLocLat, deliveryLocLng,
    customerPhone, customerName, paymentMethod, specialInstructions,
  } = args;

  if (!cart.length) throw new Error('Cart is empty');

  const menuItemIds = cart.map((c) => c.menuItemId);
  const dbItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId, isAvailable: true },
  });

  const unavailable = cart.filter((c) => !dbItems.find((d) => d.id === c.menuItemId));
  if (unavailable.length) {
    throw new Error(`Item(s) no longer available: ${unavailable.map((u) => u.name).join(', ')}`);
  }

  const orderItems = cart.map((c) => {
    const dbItem = dbItems.find((d) => d.id === c.menuItemId)!;
    return { menuItemId: dbItem.id, name: dbItem.name, quantity: c.quantity, price: dbItem.price, notes: c.notes };
  });

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new Error('Restaurant not found');

  const subtotal    = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = restaurant.deliveryFee;
  const tax         = Math.round(subtotal * 0.16 * 100) / 100;
  const total       = subtotal + deliveryFee + tax;
  const etaMinutes  = restaurant.deliveryTimeMinutesMax;

  const statusHistory: Prisma.InputJsonValue = [{ status: 'pending', message: 'Order placed via WhatsApp.', timestamp: new Date().toISOString() }];

  const order = await prisma.order.create({
    data: {
      restaurantId,
      restaurantLocAddr: restaurant.address,
      restaurantLocLat: restaurant.locationLat,
      restaurantLocLng: restaurant.locationLng,
      items: orderItems as unknown as Prisma.InputJsonValue,
      subtotal, deliveryFee, tax, total,
      status: 'pending',
      customerName, customerPhone, deliveryAddress,
      deliveryLocLat, deliveryLocLng,
      paymentMethod, paymentStatus: 'pending',
      source: 'whatsapp', etaMinutes,
      specialInstructions,
      statusHistory,
      whatsappSessionId: sessionId,
      whatsappChatId: chatId,
    },
  });

  const orderNumber = order.id.slice(-6).toUpperCase();

  const payment = await prisma.orderPayment.create({
    data: { orderId: order.id, amount: total, method: paymentMethod, status: 'pending' },
  });

  let stkSent = false;
  if (paymentMethod === 'mpesa') {
    try {
      const stk = await stkPush({
        phoneNumber: customerPhone,
        amount: total,
        accountReference: `NovaGo-${orderNumber}`,
        transactionDesc: `Order payment for ${customerName}`,
      });
      await prisma.orderPayment.update({
        where: { id: payment.id },
        data: { reference: stk.CheckoutRequestID },
      });
      stkSent = true;
    } catch (err) {
      console.error(`[novagoOrderBridge] STK push failed for order ${order.id}:`, err instanceof Error ? err.message : err);
    }
  }

  return { orderId: order.id, orderNumber, subtotal, deliveryFee, tax, total, etaMinutes, paymentMethod, stkSent };
}
