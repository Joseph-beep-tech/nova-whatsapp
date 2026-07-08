import { Prisma } from '@prisma/client';

export type OrderStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'ready'
  | 'assigned' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';

export interface IOrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface ITrackingStep {
  status: string;
  message: string;
  timestamp: Date | string;
}

export interface IOrder {
  id: string;
  restaurantId: string;
  restaurantLocLat?: number | null;
  restaurantLocLng?: number | null;
  restaurantLocAddr?: string | null;
  items: Prisma.JsonValue;
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  status: string;
  customerName: string;
  customerPhone?: string | null;
  customerId?: string | null;
  deliveryAddress: string;
  deliveryLocLat?: number | null;
  deliveryLocLng?: number | null;
  driverId?: string | null;
  etaMinutes?: number | null;
  specialInstructions?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  statusHistory: Prisma.JsonValue;
  source: string;
  cancellationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
