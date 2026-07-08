export type WASessionStatus =
  | 'initializing'
  | 'qr_pending'
  | 'authenticated'
  | 'connected'
  | 'disconnected'
  | 'auth_failed';

export interface IWhatsAppSession {
  id: string;
  userId: string;
  sessionId: string;
  name: string;
  phone?: string | null;
  pushname?: string | null;
  status: string;
  promptId?: string | null;
  restaurantId?: string | null;
  lastActiveAt?: Date | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
