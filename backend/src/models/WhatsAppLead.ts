export interface IWhatsAppLead {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  chatId: string;
  name?: string | null;
  phone?: string | null;
  location?: string | null;
  requirement?: string | null;
  turns: number;
  restaurantId?: string | null;
  source: string;
  lastInteractionAt?: Date | null;
  createdAt: Date;
}
