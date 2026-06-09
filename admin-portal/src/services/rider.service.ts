import api from './api';
import { Rider } from '../types';

export const riderService = {
  async getAll(): Promise<Rider[]> {
    const response = await api.get<Rider[]>('/api/riders');
    return response.data;
  },

  async updateStatus(id: string, status: Rider['status']): Promise<Rider> {
    const response = await api.patch<Rider>(`/api/riders/${id}/status`, { status });
    return response.data;
  },

  async updateLocation(id: string, location: { lat: number; lng: number }) {
    const response = await api.patch<Rider>(`/api/riders/${id}/location`, location);
    return response.data;
  },
};

