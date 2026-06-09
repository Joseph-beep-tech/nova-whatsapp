import mongoose, { Document, Schema } from 'mongoose';

export type KBDocType = 'menu' | 'faq' | 'location' | 'hours' | 'pricing' | 'policy' | 'promotion' | 'general';
export type KBStatus = 'active' | 'processing' | 'error' | 'archived';

export interface IKnowledgeChunk {
  chunkIndex: number;
  text: string;
  embedding?: number[];
  tokens: number;
}

export interface IKnowledgeBase extends Document {
  restaurantId: mongoose.Types.ObjectId;
  title: string;
  docType: KBDocType;
  status: KBStatus;
  rawContent: string;
  chunks: IKnowledgeChunk[];
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  wordCount: number;
  errorMessage?: string;
  vectorisedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChunkSchema = new Schema<IKnowledgeChunk>({
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], select: false }, // large; exclude by default
  tokens: { type: Number, default: 0 },
}, { _id: false });

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>({
  restaurantId: { type: Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true, trim: true },
  docType: {
    type: String,
    enum: ['menu', 'faq', 'location', 'hours', 'pricing', 'policy', 'promotion', 'general'],
    default: 'general',
  },
  status: { type: String, enum: ['active', 'processing', 'error', 'archived'], default: 'processing' },
  rawContent: { type: String, required: true },
  chunks: [ChunkSchema],
  fileUrl: String,
  fileName: String,
  mimeType: String,
  wordCount: { type: Number, default: 0 },
  errorMessage: String,
  vectorisedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });

export default mongoose.model<IKnowledgeBase>('KnowledgeBase', KnowledgeBaseSchema);
