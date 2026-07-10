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

export type WaDirection = 'in' | 'out';
export type WaReplyKind = 'ai' | 'keyword' | 'manual' | null;

export interface WaChat {
  chatId: string;
  isGroup: boolean;
  aiPaused: boolean;
  lastMessage: {
    body: string;
    direction: WaDirection;
    timestamp: string;
    replyKind: WaReplyKind;
    hasMedia: boolean;
  };
  messageCount: number;
  inboundCount: number;
}

export interface WaChatMessage {
  id: string;
  chatId: string;
  direction: WaDirection;
  fromMe: boolean;
  author: string | null;
  body: string;
  hasMedia: boolean;
  replyKind: WaReplyKind;
  timestamp: string;
}

export interface WaLead {
  id: string;
  sessionId: string;
  chatId: string;
  phone: string | null;
  name: string | null;
  location: string | null;
  requirement: string | null;
  turns: number;
  lastInteractionAt: string | null;
  createdAt: string;
}

export const whatsappService = {
  async getSessions(): Promise<WaSession[]> {
    const r = await api.get('/whatsapp/sessions');
    return r.data;
  },

  async linkRestaurant(sessionId: string, restaurantId: string | null): Promise<void> {
    await api.patch(`/whatsapp/sessions/${sessionId}/restaurant`, { restaurantId });
  },

  async getChats(sessionId: string): Promise<WaChat[]> {
    const r = await api.get(`/whatsapp/sessions/${sessionId}/chats`);
    return r.data;
  },

  async getMessages(sessionId: string, chatId: string): Promise<WaChatMessage[]> {
    const r = await api.get(`/whatsapp/sessions/${sessionId}/chats/${encodeURIComponent(chatId)}/messages`);
    return r.data;
  },

  async getLead(sessionId: string, chatId: string): Promise<WaLead | null> {
    try {
      const r = await api.get(`/whatsapp/sessions/${sessionId}/chats/${encodeURIComponent(chatId)}/lead`);
      return r.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },

  async resumeAi(sessionId: string, chatId: string): Promise<void> {
    await api.post(`/whatsapp/sessions/${sessionId}/chats/${encodeURIComponent(chatId)}/resume-ai`);
  },

  async sendMessage(sessionId: string, to: string, text: string): Promise<void> {
    await api.post(`/whatsapp/sessions/${sessionId}/messages`, { to, text });
  },

  async getLeads(sessionId?: string): Promise<WaLead[]> {
    const r = await api.get('/whatsapp/leads', { params: sessionId ? { sessionId } : {} });
    return r.data;
  },
};
