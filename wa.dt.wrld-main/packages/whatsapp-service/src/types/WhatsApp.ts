// Re-export types to avoid direct @types imports
import type { Message } from 'whatsapp-web.js';

export interface WhatsAppConfig {
  sessionName: string;
  headless: boolean;
  puppeteerArgs: string[];
  webhookUrl?: string;
  n8nWebhookUrl?: string;
}

export interface MessageData {
  id: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: number;
  fromMe: boolean;
  hasMedia: boolean;
  isGroup: boolean;
  deviceType: string;
  contact: ContactInfo;
  sessionId?: string; // Session identifier for multi-session support
  group?: GroupInfo;
  media?: MediaInfo;
  quotedMessage?: QuotedMessageInfo;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

export interface ContactInfo {
  id: string;
  name?: string;
  number: string;
  isBlocked: boolean;
  isBusiness: boolean;
}

export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  participantCount: number;
  isReadOnly: boolean;
  participants?: ParticipantInfo[];
}

export interface MediaInfo {
  mimetype: string;
  filename?: string;
  filesize: number;
  hasData: boolean;
  error?: string;
}

export interface QuotedMessageInfo {
  id: string;
  body: string;
  from: string;
  type: string;
}

export interface ParticipantInfo {
  id: string;
  name?: string;
  number: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isNew?: boolean;
  removed?: boolean;
}

export interface GroupEventData {
  groupId: string;
  groupName: string;
  action: 'user_joined' | 'user_left' | 'settings_changed';
  timestamp: number;
  participants: ParticipantInfo[];
  sessionId?: string; // Session identifier for multi-session support
  changes?: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

export interface N8nWebhookData {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface WebhookRequest {
  action: 'send_message' | 'send_media' | 'get_groups' | 'get_session_info' | 'reset_session' | 'get_media_stats' | 'cleanup_media';
  data: SendMessageData | SendMediaData | Record<string, unknown>;
}

export interface SendMessageData {
  to: string;
  message: string;
  options?: MessageOptions;
}

export interface SendMediaData {
  to: string;
  media: MediaData;
  options?: MessageOptions;
}

export interface MediaData {
  path?: string;
  url?: string;
  mimetype?: string;
  data?: string;
  filename?: string;
}

export interface MessageOptions {
  quotedMessageId?: string;
  mentions?: string[];
  caption?: string;
}

export interface GroupManagementAction {
  action: 'add_participant' | 'remove_participant' | 'promote_participant' | 
           'demote_participant' | 'update_description' | 'update_subject' | 'leave_group';
  participantId?: string;
  description?: string;
  subject?: string;
}

export interface BotStatus {
  status: 'healthy' | 'unhealthy';
  ready: boolean;
  timestamp: string;
  uptime?: number;
  memoryUsage?: number;
}

export interface LegacySessionInfo {
  name: string;
  path: string;
  exists: boolean;
  lastModified: Date | null;
  size?: number;
  [key: string]: unknown;
}

export interface SessionBackup {
  sessionName: string;
  backupPath: string;
  timestamp: Date;
  size: number;
  [key: string]: unknown;
}

export interface CommandHandler {
  command: string;
  description: string;
  handler: (message: Message, client: unknown, notifyN8N: (data: unknown) => Promise<void>) => Promise<void>;
}

export interface BotConfig {
  whatsapp: WhatsAppConfig;
  api: {
    port: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  auth: {
    apiKey: string;
    qrAuthUsername?: string;
    qrAuthPassword?: string;
  };
  redis: {
    url: string;
  };
  logging: {
    level: string;
    file: string;
  };
  features: {
    enableGroupResponses: boolean;
    enableWelcomeMessage: boolean;
    enableFarewellMessage: boolean;
    maxGroupMembers: number;
  };
  media: {
    maxFileSize: number;
    allowedTypes: string[];
  };
  monitoring: {
    healthCheckInterval: number;
    reconnectionTimeout: number;
  };
  multiSession: {
    enabled: boolean;
    maxSessions: number;
    sessionsPath: string;
    recoverSessions: boolean;
    sessionTimeoutDays: number;
    legacySingleSession: boolean;
    defaultSessionId: string;
    recoveryMaxRetries: number;
    recoveryBaseDelay: number;
    adminWebhookUrl?: string;
    baseWebhookUrl?: string;
  };
}