import api from './api';
import { User } from '../types';

export const userService = {
  async getAll(): Promise<User[]> {
    const response = await api.get<User[]>('/api/users');
    return response.data;
  },

  async getById(id: string): Promise<User> {
    const response = await api.get<User>(`/api/users/${id}`);
    return response.data;
  },

  async create(data: {
    email: string;
    name: string;
    password: string;
    role: User['role'];
    restaurantId?: string;
  }): Promise<User> {
    const response = await api.post<User>('/api/users', data);
    return response.data;
  },

  async update(id: string, data: Partial<User>): Promise<User> {
    const response = await api.patch<User>(`/api/users/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/users/${id}`);
  },

  async updateRole(id: string, role: User['role']): Promise<User> {
    const response = await api.patch<User>(`/api/users/${id}/role`, { role });
    return response.data;
  },

  async toggleActive(id: string, isActive: boolean): Promise<User> {
    const response = await api.patch<User>(`/api/users/${id}/active`, { isActive });
    return response.data;
  },
};

