import api from './api';

export interface WaSession {
  id: string;
  sessionId: string;
  name: string;
  phone: string | null;
  pushname: string | null;
  status: string;
  promptId: string | null;
  restaurantId: string | null;
  lastActiveAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export const whatsappService = {
  async getSessions(): Promise<WaSession[]> {
    const r = await api.get('/api/whatsapp/sessions');
    return r.data;
  },

  async linkRestaurant(sessionId: string, restaurantId: string | null): Promise<void> {
    await api.patch(`/api/whatsapp/sessions/${sessionId}/restaurant`, { restaurantId });
  },
};
