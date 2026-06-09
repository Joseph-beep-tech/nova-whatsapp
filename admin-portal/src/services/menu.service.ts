import api from './api';
import { MenuItem } from '../types';

export const menuService = {
  async getByRestaurant(restaurantId: string): Promise<MenuItem[]> {
    const response = await api.get<MenuItem[]>(`/api/menus/restaurant/${restaurantId}`);
    return response.data;
  },

  async getById(id: string): Promise<MenuItem> {
    const response = await api.get<MenuItem>(`/api/menus/${id}`);
    return response.data;
  },

  async create(data: FormData): Promise<MenuItem> {
    const response = await api.post<MenuItem>('/api/menus', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async update(id: string, data: FormData): Promise<MenuItem> {
    const response = await api.put<MenuItem>(`/api/menus/${id}`, data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/menus/${id}`);
  },
};

