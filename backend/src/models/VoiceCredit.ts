import mongoose, { Schema } from 'mongoose';

interface ITransaction {
  date: Date;
  type: 'fund' | 'charge' | 'refund';
  amount: number;
  balance: number;
  description: string;
  channel: 'mpesa' | 'airtel' | 'voice_call' | 'whatsapp' | 'phone_number' | 'card' | 'system';
  phoneNumber?: string;
  duration?: number;
  reference?: string;
  status: 'completed' | 'pending' | 'failed';
}

interface IVoiceCredit extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  availableCredits: number;
  totalFunded: number;
  totalUsed: number;
  transactions: ITransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const voiceCreditSchema = new Schema<IVoiceCredit>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    availableCredits: {
      type: Number,
      default: 0,
    },
    totalFunded: {
      type: Number,
      default: 0,
    },
    totalUsed: {
      type: Number,
      default: 0,
    },
    transactions: [
      {
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ['fund', 'charge', 'refund'] },
        amount: Number,
        balance: Number,
        description: String,
        channel: {
          type: String,
          enum: ['mpesa', 'airtel', 'voice_call', 'whatsapp', 'phone_number', 'card', 'system'],
          default: 'system',
        },
        phoneNumber: String,
        duration: Number,
        reference: String,
        status: {
          type: String,
          enum: ['completed', 'pending', 'failed'],
          default: 'completed',
        },
      },
    ],
  },
  { timestamps: true }
);

voiceCreditSchema.index({ userId: 1 }, { unique: true });

export default mongoose.model<IVoiceCredit>('VoiceCredit', voiceCreditSchema);
