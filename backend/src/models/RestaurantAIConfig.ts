import { Prisma } from '@prisma/client';

export interface IUpsellRule {
  triggerItem: string;
  suggestItem: string;
  message?: string;
}

export interface IRestaurantAIConfig {
  id: string;
  restaurantId: string;
  upsellRules: Prisma.JsonValue;
  voiceEnabled: boolean;
  voicePersona: string;
  voiceLanguages: string[];
  voiceGreeting: string;
  voiceFallbackMessage: string;
  waEnabled: boolean;
  waPersona: string;
  waGreeting: string;
  waOrderConfirmationMsg: string;
  waDeliveryUpdateMsg: string;
  autoConfirmOrders: boolean;
  maxOrdersPerHour?: number | null;
  orderClosingTime?: string | null;
  ragEnabled: boolean;
  ragTopK: number;
  ragScoreThreshold: number;
  mpesaEnabled: boolean;
  mpesaPaybill?: string | null;
  mpesaTillNumber?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
