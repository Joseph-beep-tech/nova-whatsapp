import { Prisma } from '@prisma/client';

export type KBDocType = 'menu' | 'faq' | 'location' | 'hours' | 'pricing' | 'policy' | 'promotion' | 'general';
export type KBStatus = 'active' | 'processing' | 'error' | 'archived';

export interface IKnowledgeChunk {
  chunkIndex: number;
  text: string;
  embedding?: number[];
  tokens: number;
}

export interface IKnowledgeBase {
  id: string;
  restaurantId: string;
  title: string;
  docType: string;
  status: string;
  rawContent: string;
  chunks: Prisma.JsonValue;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  wordCount: number;
  errorMessage?: string | null;
  vectorisedAt?: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
