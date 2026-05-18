// Export all WhatsApp types
export * from './WhatsApp';

// Export session types
export * from './session';

// Export media proxy types
export * from './media';

// Re-export whatsapp-web.js types
export type {
  Contact,
  GroupChat,
  Message,
  MessageId,
  ChatId,
  ContactId,
  MessageMedia,
  MessageOptions,
  GroupNotification,
  Client,
  LocalAuth
} from 'whatsapp-web.js';