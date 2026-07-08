export type WAMessageDirection = 'in' | 'out';
export type WAReplyKind = 'ai' | 'keyword' | 'manual' | null;

export interface IWhatsAppMessage {
  id: string;
  userId?: string | null;
  sessionId: string;
  chatId: string;
  from: string;
  to?: string | null;
  body: string;
  direction: string;
  fromMe: boolean;
  isGroup: boolean;
  author?: string | null;
  hasMedia: boolean;
  replyKind?: string | null;
  messageId?: string | null;
  timestamp: Date;
  metadata?: unknown | null;
}
