import api from './api';

// ── Knowledge Base ─────────────────────────────────────────────────────────────
export const kbService = {
  async getAll(restaurantId: string) {
    const r = await api.get(`/restaurant-ai/knowledge/${restaurantId}`);
    return r.data;
  },
  async create(data: FormData) {
    const r = await api.post('/restaurant-ai/knowledge', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },
  async update(id: string, body: Record<string, any>) {
    const r = await api.put(`/restaurant-ai/knowledge/${id}`, body);
    return r.data;
  },
  async remove(id: string) {
    await api.delete(`/restaurant-ai/knowledge/${id}`);
  },
  async reprocess(id: string) {
    const r = await api.post(`/restaurant-ai/knowledge/${id}/reprocess`);
    return r.data;
  },
  async query(restaurantId: string, query: string, topK = 5) {
    const r = await api.post('/restaurant-ai/knowledge/query', { restaurantId, query, topK });
    return r.data;
  },
};

// ── AI Config ──────────────────────────────────────────────────────────────────
export const aiConfigService = {
  async get(restaurantId: string) {
    const r = await api.get(`/restaurant-ai/config/${restaurantId}`);
    return r.data;
  },
  async update(restaurantId: string, data: Record<string, any>) {
    const r = await api.put(`/restaurant-ai/config/${restaurantId}`, data);
    return r.data;
  },
};

// ── AI Interaction Logs ────────────────────────────────────────────────────────
export const aiLogService = {
  async getLogs(restaurantId: string, params?: Record<string, any>) {
    const r = await api.get(`/restaurant-ai/interactions/${restaurantId}`, { params });
    return r.data;
  },
  async getStats(restaurantId: string) {
    const r = await api.get(`/restaurant-ai/interactions/${restaurantId}/stats`);
    return r.data;
  },
};

// ── Restaurant Analytics ───────────────────────────────────────────────────────
export const restaurantAnalyticsService = {
  async getPopularItems(restaurantId: string) {
    const r = await api.get(`/restaurant-ai/analytics/${restaurantId}/popular-items`);
    return r.data as Array<{ name: string; totalQty: number; totalRevenue: number }>;
  },
  async getDemand(restaurantId: string) {
    const r = await api.get(`/restaurant-ai/analytics/${restaurantId}/demand`);
    return r.data as Array<{ hour: number; dayOfWeek: number; orders: number; revenue: number }>;
  },
  async getCustomers(restaurantId: string) {
    const r = await api.get(`/restaurant-ai/analytics/${restaurantId}/customers`);
    return r.data as {
      topCustomers: Array<{ phone: string; customerName: string; orderCount: number; totalSpend: number; avgOrderValue: number }>;
      last30Days: { uniqueCustomers: number; returningCustomers: number; newCustomers: number; retentionRate: number };
    };
  },
};

// ── Reservations ───────────────────────────────────────────────────────────────
export const reservationService = {
  async getAll(restaurantId: string, params?: Record<string, any>) {
    const r = await api.get(`/restaurant-ai/reservations/${restaurantId}`, { params });
    return r.data;
  },
  async create(data: Record<string, any>) {
    const r = await api.post('/restaurant-ai/reservations', data);
    return r.data;
  },
  async update(id: string, data: Record<string, any>) {
    const r = await api.put(`/restaurant-ai/reservations/${id}`, data);
    return r.data;
  },
  async cancel(id: string) {
    await api.delete(`/restaurant-ai/reservations/${id}`);
  },
};
