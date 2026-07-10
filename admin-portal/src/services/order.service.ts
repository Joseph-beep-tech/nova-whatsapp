import api from './api';
import { Order, OrderTrackingSnapshot } from '../types';

export const orderService = {
  async getAll(): Promise<Order[]> {
    const response = await api.get<Order[]>('/orders');
    return response.data;
  },

  async getByRestaurant(restaurantId: string): Promise<Order[]> {
    const response = await api.get<Order[]>(`/orders/restaurant/${restaurantId}`);
    return response.data;
  },

  async getById(id: string): Promise<Order> {
    const response = await api.get<Order>(`/orders/${id}`);
    return response.data;
  },

  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    const response = await api.patch<Order>(`/orders/${id}/status`, { status });
    return response.data;
  },

  async assignRider(id: string, riderId: string): Promise<{ order: Order }> {
    const response = await api.patch<{ order: Order }>(`/orders/${id}/assign-rider`, {
      riderId,
    });
    return response.data;
  },

  async getTracking(id: string): Promise<OrderTrackingSnapshot> {
    const response = await api.get<OrderTrackingSnapshot>(`/orders/${id}/tracking`);
    return response.data;
  },
};

