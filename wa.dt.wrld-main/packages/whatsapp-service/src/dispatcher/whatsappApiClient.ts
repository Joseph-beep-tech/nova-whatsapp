/**
 * WhatsApp API Client
 *
 * Thin client wrapper for calling whatsapp-api REST endpoints.
 * This service shares the same Docker network and data volumes as whatsapp-api.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { ApiResponse, getErrorMessage } from '../types/webhook';

export interface WhatsAppApiClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

/** Message content types supported by whatsapp-api */
export type MessageContentType =
  | 'string'
  | 'MessageMedia'
  | 'MessageMediaFromURL'
  | 'Location'
  | 'Poll'
  | 'Contact'
  | 'Buttons'
  | 'List';

/** Message send request data */
export interface SendMessageRequest {
  chatId: string;
  contentType: MessageContentType;
  content: string | MediaContent | LocationContent | PollContent | ContactContent;
  options?: MessageOptions;
}

/** Media content structure */
export interface MediaContent {
  mimetype?: string;
  data?: string;
  filename?: string;
  url?: string;
}

/** Location content structure */
export interface LocationContent {
  latitude: number;
  longitude: number;
  description?: string;
  name?: string;
}

/** Poll content structure */
export interface PollContent {
  pollName: string;
  pollOptions: string[];
  options?: {
    allowMultipleAnswers?: boolean;
  };
}

/** Contact content structure */
export interface ContactContent {
  contactId: string;
}

/** Message options */
export interface MessageOptions {
  caption?: string;
  quotedMessageId?: string;
  mentions?: string[];
}

/** Reply message request */
export interface ReplyMessageRequest {
  chatId: string;
  messageId: string;
  content: string;
  contentType?: string;
}

/** React message request */
export interface ReactMessageRequest {
  chatId: string;
  messageId: string;
  reaction: string;
}

/** Forward message request */
export interface ForwardMessageRequest {
  chatId: string;
  messageId: string;
  toChat: string;
}

/** Generic request data type */
type RequestData = Record<string, unknown>;

/** Axios error with response data */
interface ApiErrorResponse {
  data?: {
    error?: string;
    message?: string;
  };
  status?: number;
}

export class WhatsAppApiClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: WhatsAppApiClientConfig) {
    this.apiKey = config.apiKey;

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });
  }

  /**
   * Send a message (text, media, location, buttons, etc.)
   */
  async sendMessage(sessionId: string, data: SendMessageRequest): Promise<ApiResponse> {
    return this.request('POST', `/client/sendMessage/${sessionId}`, data as unknown as RequestData);
  }

  /**
   * Get all chats for a session
   */
  async getChats(sessionId: string): Promise<ApiResponse & { chats?: unknown[] }> {
    return this.request('GET', `/client/getChats/${sessionId}`);
  }

  /**
   * Get all contacts for a session
   */
  async getContacts(sessionId: string): Promise<ApiResponse> {
    return this.request('GET', `/client/getContacts/${sessionId}`);
  }

  /**
   * Get contact by ID
   */
  async getContactById(sessionId: string, contactId: string): Promise<ApiResponse> {
    return this.request('POST', `/client/getContactById/${sessionId}`, { contactId });
  }

  /**
   * Block a contact
   */
  async blockContact(sessionId: string, contactId: string): Promise<ApiResponse> {
    return this.request('POST', `/contact/block/${sessionId}`, { contactId });
  }

  /**
   * Unblock a contact
   */
  async unblockContact(sessionId: string, contactId: string): Promise<ApiResponse> {
    return this.request('POST', `/contact/unblock/${sessionId}`, { contactId });
  }

  /**
   * Get contact profile picture URL
   */
  async getProfilePicture(sessionId: string, contactId: string): Promise<ApiResponse> {
    return this.request('POST', `/contact/getProfilePicUrl/${sessionId}`, { contactId });
  }

  /**
   * Create a group
   */
  async createGroup(sessionId: string, groupName: string, contacts: string[]): Promise<ApiResponse> {
    return this.request('POST', `/client/createGroup/${sessionId}`, {
      groupName,
      contacts,
    });
  }

  /**
   * Add participants to a group
   */
  async addParticipants(sessionId: string, chatId: string, contactIds: string[]): Promise<ApiResponse> {
    return this.request('POST', `/groupChat/addParticipants/${sessionId}`, {
      chatId,
      contactIds,
    });
  }

  /**
   * Remove participants from a group
   */
  async removeParticipants(sessionId: string, chatId: string, contactIds: string[]): Promise<ApiResponse> {
    return this.request('POST', `/groupChat/removeParticipants/${sessionId}`, {
      chatId,
      contactIds,
    });
  }

  /**
   * Promote participants to admin
   */
  async promoteParticipants(sessionId: string, chatId: string, contactIds: string[]): Promise<ApiResponse> {
    return this.request('POST', `/groupChat/promoteParticipants/${sessionId}`, {
      chatId,
      contactIds,
    });
  }

  /**
   * Demote participants from admin
   */
  async demoteParticipants(sessionId: string, chatId: string, contactIds: string[]): Promise<ApiResponse> {
    return this.request('POST', `/groupChat/demoteParticipants/${sessionId}`, {
      chatId,
      contactIds,
    });
  }

  /**
   * Get group invite code
   */
  async getInviteCode(sessionId: string, chatId: string): Promise<ApiResponse> {
    return this.request('POST', `/groupChat/getInviteCode/${sessionId}`, { chatId });
  }

  /**
   * Set group subject (name)
   */
  async setGroupSubject(sessionId: string, chatId: string, subject: string): Promise<ApiResponse> {
    return this.request('POST', `/groupChat/setSubject/${sessionId}`, {
      chatId,
      subject,
    });
  }

  /**
   * Set group description
   */
  async setGroupDescription(sessionId: string, chatId: string, description: string): Promise<ApiResponse> {
    return this.request('POST', `/groupChat/setDescription/${sessionId}`, {
      chatId,
      description,
    });
  }

  /**
   * Leave a group
   */
  async leaveGroup(sessionId: string, chatId: string): Promise<ApiResponse> {
    return this.request('POST', `/groupChat/leave/${sessionId}`, { chatId });
  }

  /**
   * Reply to a message
   */
  async replyToMessage(sessionId: string, data: ReplyMessageRequest): Promise<ApiResponse> {
    return this.request('POST', `/message/reply/${sessionId}`, {
      chatId: data.chatId,
      messageId: data.messageId,
      content: data.content,
      contentType: data.contentType || 'string',
    });
  }

  /**
   * React to a message
   */
  async reactToMessage(sessionId: string, data: ReactMessageRequest): Promise<ApiResponse> {
    return this.request('POST', `/message/react/${sessionId}`, data as unknown as RequestData);
  }

  /**
   * Forward a message
   */
  async forwardMessage(sessionId: string, data: ForwardMessageRequest): Promise<ApiResponse> {
    return this.request('POST', `/message/forward/${sessionId}`, data as unknown as RequestData);
  }

  /**
   * Download media from a message
   */
  async downloadMedia(sessionId: string, chatId: string, messageId: string): Promise<ApiResponse> {
    return this.request('POST', `/message/downloadMedia/${sessionId}`, {
      chatId,
      messageId,
    });
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<ApiResponse> {
    return this.request('GET', `/session/status/${sessionId}`);
  }

  /**
   * Get session QR code
   */
  async getSessionQR(sessionId: string): Promise<ApiResponse> {
    return this.request('GET', `/session/qr/${sessionId}`);
  }

  /**
   * Start a new session
   */
  async startSession(sessionId: string): Promise<ApiResponse> {
    return this.request('GET', `/session/start/${sessionId}`);
  }

  /**
   * Restart a session
   */
  async restartSession(sessionId: string): Promise<ApiResponse> {
    return this.request('GET', `/session/restart/${sessionId}`);
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<ApiResponse> {
    return this.request('GET', `/session/terminate/${sessionId}`);
  }

  /**
   * Generic request method
   */
  private async request(method: string, path: string, data?: RequestData): Promise<ApiResponse> {
    const config: AxiosRequestConfig = {
      method,
      url: path,
    };

    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    try {
      const response = await this.client.request(config);
      return response.data;
    } catch (error: unknown) {
      // Re-throw with more context
      const axiosError = error as AxiosError;
      const responseData = axiosError.response as ApiErrorResponse | undefined;
      const errorMessage = responseData?.data?.error || responseData?.data?.message || getErrorMessage(error);
      const errorStatus = responseData?.status;

      throw new Error(
        `WhatsApp API Error [${errorStatus || 'UNKNOWN'}]: ${errorMessage}`
      );
    }
  }
}
