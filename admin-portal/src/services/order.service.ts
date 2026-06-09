import api from './api';
import { Order, OrderTrackingSnapshot } from '../types';

export const orderService = {
  async getAll(): Promise<Order[]> {
    const response = await api.get<Order[]>('/api/orders');
    return response.data;
  },

  async getByRestaurant(restaurantId: string): Promise<Order[]> {
    const response = await api.get<Order[]>(`/api/orders/restaurant/${restaurantId}`);
    return response.data;
  },

  async getById(id: string): Promise<Order> {
    const response = await api.get<Order>(`/api/orders/${id}`);
    return response.data;
  },

  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    const response = await api.patch<Order>(`/api/orders/${id}/status`, { status });
    return response.data;
  },

  async assignRider(id: string, riderId: string): Promise<{ order: Order }> {
    const response = await api.patch<{ order: Order }>(`/api/orders/${id}/assign-rider`, {
      riderId,
    });
    return response.data;
  },

  async getTracking(id: string): Promise<OrderTrackingSnapshot> {
    const response = await api.get<OrderTrackingSnapshot>(`/api/orders/${id}/tracking`);
    return response.data;
  },
};

