import api from './api';
import { Rider } from '../types';

export interface CreateRiderInput {
  name: string;
  phone: string;
  email?: string;
  vehicleType?: string;
  password?: string;
}

export const riderService = {
  async getAll(): Promise<Rider[]> {
    const response = await api.get<Rider[]>('/riders');
    return response.data;
  },

  async create(data: CreateRiderInput): Promise<Rider> {
    const response = await api.post<Rider>('/riders', data);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/riders/${id}`);
  },

  async updateStatus(id: string, status: Rider['status']): Promise<Rider> {
    const response = await api.patch<Rider>(`/riders/${id}/status`, { status });
    return response.data;
  },

  async updateLocation(id: string, location: { lat: number; lng: number }) {
    const response = await api.patch<Rider>(`/riders/${id}/location`, location);
    return response.data;
  },
};

