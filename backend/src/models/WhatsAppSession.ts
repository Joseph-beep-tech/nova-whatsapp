import mongoose, { Schema } from 'mongoose';

export type WASessionStatus =
  | 'initializing'
  | 'qr_pending'
  | 'authenticated'
  | 'connected'
  | 'disconnected'
  | 'auth_failed';

export interface IWhatsAppSession extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  name: string;
  phone: string | null;
  pushname: string | null;
  status: WASessionStatus;
  promptId: mongoose.Types.ObjectId | null;
  lastActiveAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappSessionSchema = new Schema<IWhatsAppSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    phone: { type: String, default: null },
    pushname: { type: String, default: null },
    status: {
      type: String,
      enum: ['initializing', 'qr_pending', 'authenticated', 'connected', 'disconnected', 'auth_failed'],
      default: 'initializing',
    },
    promptId: { type: Schema.Types.ObjectId, ref: 'Prompt', default: null },
    lastActiveAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

whatsappSessionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IWhatsAppSession>('WhatsAppSession', whatsappSessionSchema);
