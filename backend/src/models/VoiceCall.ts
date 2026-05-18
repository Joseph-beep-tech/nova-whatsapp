import mongoose, { Schema } from 'mongoose';

interface IVoiceCall extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  phoneNumber: string;
  promptId: mongoose.Types.ObjectId;
  duration: number;
  cost: number;
  status: 'completed' | 'failed' | 'ongoing';
  recording?: string;
  transcript?: string;
  callSid: string;
  createdAt: Date;
  updatedAt: Date;
}

const voiceCallSchema = new Schema<IVoiceCall>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    promptId: {
      type: Schema.Types.ObjectId,
      ref: 'Prompt',
    },
    duration: {
      type: Number,
      default: 0,
    },
    cost: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['completed', 'failed', 'ongoing'],
      default: 'ongoing',
    },
    recording: String,
    transcript: String,
    callSid: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

voiceCallSchema.index({ userId: 1, createdAt: -1 });
voiceCallSchema.index({ userId: 1, status: 1 });
voiceCallSchema.index({ callSid: 1 }, { unique: true, sparse: true });

export default mongoose.model<IVoiceCall>('VoiceCall', voiceCallSchema);
