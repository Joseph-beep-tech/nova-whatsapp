import api from './api';
import { Payment } from '../types';

export const paymentService = {
  async getAll(): Promise<Payment[]> {
    const response = await api.get<Payment[]>('/api/payments');
    return response.data;
  },

  async getByRestaurant(restaurantId: string): Promise<Payment[]> {
    const response = await api.get<Payment[]>(`/api/payments/restaurant/${restaurantId}`);
    return response.data;
  },

  async getByOrder(orderId: string): Promise<Payment> {
    const response = await api.get<Payment>(`/api/payments/order/${orderId}`);
    return response.data;
  },
};

