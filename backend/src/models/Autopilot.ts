import mongoose, { Schema } from 'mongoose';

interface IAutopilot extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  promptId?: mongoose.Types.ObjectId;
  enabled: boolean;
  autoReply: boolean;
  replyToGroups: boolean;
  replyDelaySeconds: number;
  keywordTriggers: string[];
  excludedKeywords: string[];
  businessHoursOnly: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const autopilotSchema = new Schema<IAutopilot>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    promptId: {
      type: Schema.Types.ObjectId,
      ref: 'Prompt',
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    autoReply: {
      type: Boolean,
      default: true,
    },
    replyToGroups: {
      type: Boolean,
      default: false,
    },
    replyDelaySeconds: {
      type: Number,
      default: 5,
    },
    keywordTriggers: {
      type: [String],
      default: [],
    },
    excludedKeywords: {
      type: [String],
      default: [],
    },
    businessHoursOnly: {
      type: Boolean,
      default: false,
    },
    startTime: {
      type: String,
      default: '09:00',
    },
    endTime: {
      type: String,
      default: '18:00',
    },
    timezone: {
      type: String,
      default: 'Africa/Nairobi',
    },
  },
  { timestamps: true }
);

export default mongoose.model<IAutopilot>('Autopilot', autopilotSchema);
