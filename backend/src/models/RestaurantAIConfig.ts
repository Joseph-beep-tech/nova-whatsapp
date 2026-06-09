import mongoose, { Document, Schema } from 'mongoose';

export interface IRestaurantAIConfig extends Document {
  restaurantId: mongoose.Types.ObjectId;
  // Voice AI
  voiceEnabled: boolean;
  voicePersona: string;          // e.g. "Amina, friendly receptionist at Java House"
  voiceLanguages: string[];       // ['en', 'sw']  Kiswahili + English
  voiceGreeting: string;
  voiceFallbackMessage: string;
  // WhatsApp AI
  waEnabled: boolean;
  waPersona: string;
  waGreeting: string;
  waOrderConfirmationMsg: string;
  waDeliveryUpdateMsg: string;
  // Ordering rules
  autoConfirmOrders: boolean;
  maxOrdersPerHour?: number;
  orderClosingTime?: string;      // "22:00"
  // RAG
  ragEnabled: boolean;
  ragTopK: number;                // number of chunks to retrieve
  ragScoreThreshold: number;      // cosine similarity floor (0-1)
  // M-Pesa
  mpesaEnabled: boolean;
  mpesaPaybill?: string;
  mpesaTillNumber?: string;
  // Misc
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantAIConfigSchema = new Schema<IRestaurantAIConfig>({
  restaurantId: { type: Schema.Types.ObjectId, required: true, unique: true },
  voiceEnabled: { type: Boolean, default: false },
  voicePersona: { type: String, default: 'Friendly AI assistant' },
  voiceLanguages: { type: [String], default: ['en'] },
  voiceGreeting: { type: String, default: 'Hello! Welcome. How can I help you today?' },
  voiceFallbackMessage: { type: String, default: "I'm sorry, let me connect you to a human agent." },
  waEnabled: { type: Boolean, default: false },
  waPersona: { type: String, default: 'Helpful WhatsApp assistant' },
  waGreeting: { type: String, default: 'Hi! 👋 Welcome. How can I assist you?' },
  waOrderConfirmationMsg: { type: String, default: 'Your order #{orderId} has been confirmed! 🎉 Estimated delivery: {eta} mins.' },
  waDeliveryUpdateMsg: { type: String, default: 'Update on order #{orderId}: {status}. {message}' },
  autoConfirmOrders: { type: Boolean, default: false },
  maxOrdersPerHour: Number,
  orderClosingTime: String,
  ragEnabled: { type: Boolean, default: true },
  ragTopK: { type: Number, default: 5 },
  ragScoreThreshold: { type: Number, default: 0.72 },
  mpesaEnabled: { type: Boolean, default: false },
  mpesaPaybill: String,
  mpesaTillNumber: String,
  updatedBy: Schema.Types.ObjectId,
}, { timestamps: true });

export default mongoose.model<IRestaurantAIConfig>('RestaurantAIConfig', RestaurantAIConfigSchema);
