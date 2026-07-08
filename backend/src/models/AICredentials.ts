export interface IAICredentials {
  id: string;
  userId: string;
  openaiApiKey?: string | null;
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  twilioPhoneNumber?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
