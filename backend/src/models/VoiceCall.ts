export interface IVoiceCall {
  id: string;
  userId?: string | null;
  from: string;
  to: string;
  status: string;
  duration: number;
  recordingUrl?: string | null;
  createdAt: Date;
}
