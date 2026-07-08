import { Prisma } from '@prisma/client';

export type AIChannel = 'whatsapp' | 'voice';
export type AIIntentType = 'order' | 'reservation' | 'faq' | 'menu_query' | 'hours' | 'location' | 'complaint' | 'general';

export interface IRetrievedChunk {
  kbDocId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

export interface IAIInteractionLog {
  id: string;
  restaurantId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  channel: string;
  customerPhone?: string | null;
  userMessage: string;
  aiResponse: string;
  intent?: string | null;
  tokensUsed: number;
  latencyMs: number;
  retrievedChunks?: Prisma.JsonValue | null;
  orderPlaced: boolean;
  orderId?: string | null;
  escalated: boolean;
  createdAt: Date;
}
