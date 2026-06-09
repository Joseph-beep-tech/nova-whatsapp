import api from './api';

// ── Knowledge Base ─────────────────────────────────────────────────────────────
export const kbService = {
  async getAll(restaurantId: string) {
    const r = await api.get(`/api/restaurant-ai/knowledge/${restaurantId}`);
    return r.data;
  },
  async create(data: FormData) {
    const r = await api.post('/api/restaurant-ai/knowledge', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },
  async update(id: string, body: Record<string, any>) {
    const r = await api.put(`/api/restaurant-ai/knowledge/${id}`, body);
    return r.data;
  },
  async remove(id: string) {
    await api.delete(`/api/restaurant-ai/knowledge/${id}`);
  },
  async reprocess(id: string) {
    const r = await api.post(`/api/restaurant-ai/knowledge/${id}/reprocess`);
    return r.data;
  },
  async query(restaurantId: string, query: string, topK = 5) {
    const r = await api.post('/api/restaurant-ai/knowledge/query', { restaurantId, query, topK });
    return r.data;
  },
};

// ── AI Config ──────────────────────────────────────────────────────────────────
export const aiConfigService = {
  async get(restaurantId: string) {
    const r = await api.get(`/api/restaurant-ai/config/${restaurantId}`);
    return r.data;
  },
  async update(restaurantId: string, data: Record<string, any>) {
    const r = await api.put(`/api/restaurant-ai/config/${restaurantId}`, data);
    return r.data;
  },
};

// ── AI Interaction Logs ────────────────────────────────────────────────────────
export const aiLogService = {
  async getLogs(restaurantId: string, params?: Record<string, any>) {
    const r = await api.get(`/api/restaurant-ai/interactions/${restaurantId}`, { params });
    return r.data;
  },
  async getStats(restaurantId: string) {
    const r = await api.get(`/api/restaurant-ai/interactions/${restaurantId}/stats`);
    return r.data;
  },
};

// ── Reservations ───────────────────────────────────────────────────────────────
export const reservationService = {
  async getAll(restaurantId: string, params?: Record<string, any>) {
    const r = await api.get(`/api/restaurant-ai/reservations/${restaurantId}`, { params });
    return r.data;
  },
  async create(data: Record<string, any>) {
    const r = await api.post('/api/restaurant-ai/reservations', data);
    return r.data;
  },
  async update(id: string, data: Record<string, any>) {
    const r = await api.put(`/api/restaurant-ai/reservations/${id}`, data);
    return r.data;
  },
  async cancel(id: string) {
    await api.delete(`/api/restaurant-ai/reservations/${id}`);
  },
};
