declare module 'whatsapp-web.js' {
  export interface MessageId {
    _serialized: string;
    id: string;
  }

  export interface ContactId {
    _serialized: string;
  }

  export interface ChatId {
    _serialized: string;
  }

  export interface MessageOptions {
    quotedMessageId?: string;
    mentions?: string[];
    caption?: string;
  }

  export interface MessageAck {
    id: MessageId;
    ack: number;
  }

  export class MessageMedia {
    mimetype: string;
    data: string;
    filename?: string;

    constructor(mimetype: string, data: string, filename?: string);
    
    static fromFilePath(filePath: string): MessageMedia;
    static fromUrl(url: string): Promise<MessageMedia>;
  }

  export interface Contact {
    id: ContactId;
    name?: string;
    pushname?: string;
    shortName?: string;
    number: string;
    isMe: boolean;
    isUser: boolean;
    isGroup: boolean;
    isWAContact: boolean;
    isMyContact: boolean;
    isBlocked: boolean;
    isBusiness: boolean;
    profilePicUrl?: string;
  }

  export interface GroupParticipant {
    id: ContactId;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }

  export interface BaseChat {
    id: ChatId;
    name: string;
    isGroup: boolean;
    isReadOnly: boolean;
    sendMessage(content: string | MessageMedia, options?: MessageOptions): Promise<Message>;
  }

  export interface Chat extends BaseChat {
    timestamp: number;
    lastMessage?: Message;
    description?: string;
    participants?: GroupParticipant[];
  }

  export interface GroupChat extends Chat {
    name: string;
    description?: string;
    participants: GroupParticipant[];
    addParticipants(participantIds: string[]): Promise<void>;
    removeParticipants(participantIds: string[]): Promise<void>;
    promoteParticipants(participantIds: string[]): Promise<void>;
    demoteParticipants(participantIds: string[]): Promise<void>;
    setDescription(description: string): Promise<void>;
    setSubject(subject: string): Promise<void>;
    leave(): Promise<void>;
  }

  export interface Message {
    id: MessageId;
    ack: number;
    hasMedia: boolean;
    body: string;
    type: string;
    timestamp: number;
    from: string;
    to: string;
    author?: string;
    fromMe: boolean;
    isForwarded: boolean;
    isStatus: boolean;
    isStarred: boolean;
    broadcast: boolean;
    deviceType: string;
    isGroup: boolean;
    hasQuotedMsg: boolean;
    mentions?: string[];
    mentionedIds?: string[];
    location?: Location;
    
    downloadMedia(): Promise<MessageMedia | undefined>;
    getContact(): Promise<Contact>;
    getChat(): Promise<Chat>;
    getQuotedMessage(): Promise<Message | undefined>;
    reply(content: string | MessageMedia, options?: MessageOptions): Promise<Message>;
  }

  export interface Location {
    latitude: number;
    longitude: number;
    description?: string;
  }

  export interface GroupNotification {
    id: MessageId;
    chatId: string;
    type: string;
    timestamp: number;
    author?: string;
    recipientIds?: string[];
    body?: string;
  }

  export interface AuthStrategy {
    setup(): Promise<void>;
    logout(): Promise<void>;
    getAuthInfo(): Promise<unknown>;
  }

  export class LocalAuth implements AuthStrategy {
    constructor(options?: { clientId?: string; dataPath?: string });

    setup(): Promise<void>;
    logout(): Promise<void>;
    getAuthInfo(): Promise<unknown>;
  }

  export interface ClientOptions {
    authStrategy?: AuthStrategy;
    puppeteer?: {
      headless?: boolean;
      args?: string[];
      executablePath?: string;
      timeout?: number;
    };
    session?: unknown;
    restartOnAuthFail?: boolean;
    takeoverOnConflict?: boolean;
    takeoverTimeoutMs?: number;
  }

  export class Client {
    constructor(options?: ClientOptions);

    // Events
    on(event: 'qr', listener: (qr: string) => void): this;
    on(event: 'ready', listener: () => void): this;
    on(event: 'authenticated', listener: (session?: unknown) => void): this;
    on(event: 'auth_failure', listener: (message: string) => void): this;
    on(event: 'disconnected', listener: (reason: string) => void): this;
    on(event: 'message', listener: (message: Message) => void): this;
    on(event: 'message_create', listener: (message: Message) => void): this;
    on(event: 'message_ack', listener: (message: Message, ack: MessageAck) => void): this;
    on(event: 'group_join', listener: (notification: GroupNotification) => void): this;
    on(event: 'group_leave', listener: (notification: GroupNotification) => void): this;
    on(event: 'group_update', listener: (notification: GroupNotification) => void): this;
    on(event: 'change_state', listener: (state: string) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;

    // Methods
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    logout(): Promise<void>;
    getState(): Promise<string>;
    getChats(): Promise<Chat[]>;
    getContacts(): Promise<Contact[]>;
    getContactById(contactId: string): Promise<Contact>;
    getChatById(chatId: string): Promise<Chat>;
    sendMessage(chatId: string, content: string | MessageMedia, options?: MessageOptions): Promise<Message>;
    getNumberId(number: string): Promise<ContactId | null>;
  }

  // Default export
  export default Client;
}