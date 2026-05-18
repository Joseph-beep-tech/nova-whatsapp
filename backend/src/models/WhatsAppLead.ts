import mongoose, { Schema } from 'mongoose';

export interface IWhatsAppLead extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  chatId: string;             // unique per (sessionId, chatId)
  phone: string | null;       // best-effort number derived from chatId (null for @lid)
  name: string | null;
  location: string | null;
  requirement: string | null;
  summary: string | null;     // optional running summary for context compression later
  turns: number;              // number of inbound user messages handled
  lastInteractionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const whatsappLeadSchema = new Schema<IWhatsAppLead>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    chatId: { type: String, required: true },
    phone: { type: String, default: null },
    name: { type: String, default: null },
    location: { type: String, default: null },
    requirement: { type: String, default: null },
    summary: { type: String, default: null },
    turns: { type: Number, default: 0 },
    lastInteractionAt: { type: Date, default: null },
  },
  { timestamps: true }
);

whatsappLeadSchema.index({ sessionId: 1, chatId: 1 }, { unique: true });
whatsappLeadSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model<IWhatsAppLead>('WhatsAppLead', whatsappLeadSchema);
