import mongoose, { Schema } from 'mongoose';

interface IAICredentials extends mongoose.Document {
  userId: string;
  openaiApiKey: string;
  openaiSigningSecret: string;
  openaiProjectId: string;
  gcpServiceAccount: Record<string, any>;
  gcpDriveFolderId: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiCredentialsSchema = new Schema<IAICredentials>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    openaiApiKey: {
      type: String,
      default: '',
    },
    openaiSigningSecret: {
      type: String,
      default: '',
    },
    openaiProjectId: {
      type: String,
      default: '',
    },
    gcpServiceAccount: {
      type: Schema.Types.Mixed,
      default: {},
    },
    gcpDriveFolderId: {
      type: String,
      default: '',
    },
    twilioAccountSid: {
      type: String,
      default: '',
    },
    twilioAuthToken: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model<IAICredentials>('AICredentials', aiCredentialsSchema);
