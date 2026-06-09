import mongoose, { Document, Schema } from 'mongoose';

export type AIChannel = 'whatsapp' | 'voice';
export type AIIntentType = 'order' | 'reservation' | 'faq' | 'menu_query' | 'hours' | 'location' | 'complaint' | 'general';

export interface IRetrievedChunk {
  kbDocId: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

export interface IAIInteractionLog extends Document {
  restaurantId: mongoose.Types.ObjectId;
  channel: AIChannel;
  sessionId: string;            // WA session or Twilio call SID
  customerPhone?: string;
  customerName?: string;
  userQuery: string;
  aiResponse: string;
  intent?: AIIntentType;
  retrievedChunks: IRetrievedChunk[];
  tokensUsed?: number;
  latencyMs?: number;
  wasEscalated: boolean;
  escalatedReason?: string;
  createdAt: Date;
}

const RetrievedChunkSchema = new Schema<IRetrievedChunk>({
  kbDocId: String,
  chunkIndex: Number,
  score: Number,
  snippet: { type: String, maxlength: 300 },
}, { _id: false });

const AIInteractionLogSchema = new Schema<IAIInteractionLog>({
  restaurantId: { type: Schema.Types.ObjectId, required: true, index: true },
  channel: { type: String, enum: ['whatsapp', 'voice'], required: true },
  sessionId: { type: String, required: true },
  customerPhone: String,
  customerName: String,
  userQuery: { type: String, required: true },
  aiResponse: { type: String, required: true },
  intent: { type: String, enum: ['order', 'reservation', 'faq', 'menu_query', 'hours', 'location', 'complaint', 'general'] },
  retrievedChunks: [RetrievedChunkSchema],
  tokensUsed: Number,
  latencyMs: Number,
  wasEscalated: { type: Boolean, default: false },
  escalatedReason: String,
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.model<IAIInteractionLog>('AIInteractionLog', AIInteractionLogSchema);
