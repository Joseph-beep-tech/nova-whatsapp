import mongoose, { Schema } from 'mongoose';

export type WAMessageDirection = 'in' | 'out';
export type WAReplyKind = 'ai' | 'keyword' | 'manual' | null;

export interface IWhatsAppMessage extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  sessionId: string;
  chatId: string;             // e.g. "2547xxxxxxx@c.us" or "<group>@g.us"
  isGroup: boolean;
  fromMe: boolean;            // mirror of WhatsApp's fromMe flag
  direction: WAMessageDirection;
  author: string | null;      // sender id within a group, if any
  body: string;
  hasMedia: boolean;
  messageId: string | null;   // wwebjs message _serialized id
  replyKind: WAReplyKind;     // for outbound: how the reply was generated
  timestamp: Date;            // wall-clock time of the WA event
  createdAt: Date;
  updatedAt: Date;
}

const whatsappMessageSchema = new Schema<IWhatsAppMessage>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    chatId: { type: String, required: true, index: true },
    isGroup: { type: Boolean, default: false },
    fromMe: { type: Boolean, default: false },
    direction: { type: String, enum: ['in', 'out'], required: true },
    author: { type: String, default: null },
    body: { type: String, default: '' },
    hasMedia: { type: Boolean, default: false },
    messageId: { type: String, default: null, index: true },
    replyKind: { type: String, enum: ['ai', 'keyword', 'manual', null], default: null },
    timestamp: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

whatsappMessageSchema.index({ sessionId: 1, chatId: 1, timestamp: 1 });
whatsappMessageSchema.index({ sessionId: 1, timestamp: -1 });

export default mongoose.model<IWhatsAppMessage>('WhatsAppMessage', whatsappMessageSchema);
