import api from './api';
import { Restaurant } from '../types';

export const restaurantService = {
  async getAll(): Promise<Restaurant[]> {
    const response = await api.get<Restaurant[]>('/api/restaurants');
    return response.data;
  },

  async getById(id: string): Promise<Restaurant> {
    const response = await api.get<Restaurant>(`/api/restaurants/${id}`);
    return response.data;
  },

  async create(data: FormData): Promise<Restaurant> {
    const response = await api.post<Restaurant>('/api/restaurants', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async update(id: string, data: FormData): Promise<Restaurant> {
    const response = await api.put<Restaurant>(`/api/restaurants/${id}`, data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/restaurants/${id}`);
  },
};

