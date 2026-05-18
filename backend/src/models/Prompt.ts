import mongoose, { Schema } from 'mongoose';

interface IPrompt extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  content: string;
  status: 'active' | 'inactive' | 'draft';
  phoneNumber?: string;
  whatsappStatus?: 'connected' | 'disconnected';
  fileUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const promptSchema = new Schema<IPrompt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'draft',
    },
    phoneNumber: {
      type: String,
    },
    whatsappStatus: {
      type: String,
      enum: ['connected', 'disconnected'],
      default: 'disconnected',
    },
    fileUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

promptSchema.index({ userId: 1, createdAt: -1 });
promptSchema.index({ userId: 1, status: 1 });

export default mongoose.model<IPrompt>('Prompt', promptSchema);
