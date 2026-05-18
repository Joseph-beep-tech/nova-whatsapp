import mongoose, { Schema } from 'mongoose';

interface IPhoneNumber extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  phoneNumber: string;
  label: string;
  status: 'assigned' | 'pending' | 'unassigned';
  sipUri: string;
  webhookUrl: string;
  promptId?: mongoose.Types.ObjectId;
  noiseFilter: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const phoneNumberSchema = new Schema<IPhoneNumber>(
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
    label: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['assigned', 'pending', 'unassigned'],
      default: 'unassigned',
    },
    sipUri: {
      type: String,
    },
    webhookUrl: {
      type: String,
    },
    promptId: {
      type: Schema.Types.ObjectId,
      ref: 'Prompt',
    },
    noiseFilter: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

phoneNumberSchema.index({ userId: 1, createdAt: -1 });
phoneNumberSchema.index({ userId: 1, status: 1 });

export default mongoose.model<IPhoneNumber>('PhoneNumber', phoneNumberSchema);
