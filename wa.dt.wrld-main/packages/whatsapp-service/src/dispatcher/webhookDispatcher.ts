/**
 * Webhook Dispatcher
 *
 * Translates n8n webhook action format into whatsapp-api REST endpoint calls.
 * Acts as a thin bridge between n8n nodes and whatsapp-api.
 */

import { WhatsAppApiClient } from './whatsappApiClient';
import {
  ApiResponse,
  SendMessageData,
  SendMediaData,
  SendLocationData,
  SendContactData,
  ReplyMessageData,
  ReactMessageData,
  ForwardMessageData,
  CreateGroupData,
  AddParticipantsData,
  RemoveParticipantsData,
  PromoteToAdminData,
  DemoteFromAdminData,
  UpdateGroupInfoData,
  LeaveGroupData,
  GetGroupInfoData,
  GetInviteCodeData,
  GetContactData,
  BlockContactData,
  UnblockContactData,
  GetProfilePictureData,
  CreatePollData,
  WebhookActionName,
  getErrorMessage,
} from '../types/webhook';
import { normalizeChatId, normalizeMultiple } from '../utils/phoneNumber';

export interface WebhookAction {
  action: WebhookActionName | string;
  data: WebhookActionData;
  sessionId?: string;
}

/** All possible webhook action data */
export type WebhookActionData = Record<string, unknown>;

export interface WebhookResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Chat type for filter operations */
interface ChatInfo {
  id: string;
  name?: string;
  isGroup?: boolean;
}

export class WebhookDispatcher {
  private apiClient: WhatsAppApiClient;

  constructor(apiClient: WhatsAppApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Dispatch a webhook action to the appropriate whatsapp-api endpoint
   */
  async dispatch(sessionId: string, action: WebhookAction): Promise<WebhookResponse> {
    try {
      const result = await this.routeAction(sessionId, action);
      return {
        success: true,
        data: result,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Route action to appropriate handler
   * Note: Data is cast through unknown for type safety with dynamic webhook payloads
   */
  private async routeAction(sessionId: string, action: WebhookAction): Promise<ApiResponse> {
    const { action: actionName, data } = action;

    switch (actionName) {
      // Message actions
      case 'send_message':
        return this.handleSendMessage(sessionId, data as unknown as SendMessageData);

      case 'send_media':
        return this.handleSendMedia(sessionId, data as unknown as SendMediaData);

      case 'send_location':
        return this.handleSendLocation(sessionId, data as unknown as SendLocationData);

      case 'send_contact':
        return this.handleSendContact(sessionId, data as unknown as SendContactData);

      case 'reply_message':
        return this.handleReplyMessage(sessionId, data as unknown as ReplyMessageData);

      case 'react_message':
        return this.handleReactMessage(sessionId, data as unknown as ReactMessageData);

      case 'forward_message':
        return this.handleForwardMessage(sessionId, data as unknown as ForwardMessageData);

      // Group actions
      case 'get_groups':
        return this.handleGetGroups(sessionId);

      case 'create_group':
        return this.handleCreateGroup(sessionId, data as unknown as CreateGroupData);

      case 'get_group_info':
        return this.handleGetGroupInfo(sessionId, data as unknown as GetGroupInfoData);

      case 'add_participants':
        return this.handleAddParticipants(sessionId, data as unknown as AddParticipantsData);

      case 'remove_participants':
        return this.handleRemoveParticipants(sessionId, data as unknown as RemoveParticipantsData);

      case 'promote_to_admin':
        return this.handlePromoteToAdmin(sessionId, data as unknown as PromoteToAdminData);

      case 'demote_from_admin':
        return this.handleDemoteFromAdmin(sessionId, data as unknown as DemoteFromAdminData);

      case 'update_group_info':
        return this.handleUpdateGroupInfo(sessionId, data as unknown as UpdateGroupInfoData);

      case 'get_invite_code':
        return this.handleGetInviteCode(sessionId, data as unknown as GetInviteCodeData);

      case 'leave_group':
        return this.handleLeaveGroup(sessionId, data as unknown as LeaveGroupData);

      // Contact actions
      case 'get_contact':
        return this.handleGetContact(sessionId, data as unknown as GetContactData);

      case 'block_contact':
        return this.handleBlockContact(sessionId, data as unknown as BlockContactData);

      case 'unblock_contact':
        return this.handleUnblockContact(sessionId, data as unknown as UnblockContactData);

      case 'get_profile_picture':
        return this.handleGetProfilePicture(sessionId, data as unknown as GetProfilePictureData);

      // Poll actions
      case 'create_poll':
        return this.handleCreatePoll(sessionId, data as unknown as CreatePollData);

      // Session actions
      case 'get_session_info':
        return this.handleGetSessionInfo(sessionId);

      case 'reset_session':
        return this.handleResetSession(sessionId);

      default:
        throw new Error(`Unknown action: ${actionName}`);
    }
  }

  /**
   * Message Handlers
   */
  private async handleSendMessage(sessionId: string, data: SendMessageData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.to || data.chatId || '');
    return this.apiClient.sendMessage(sessionId, {
      chatId,
      contentType: 'string',
      content: data.message || data.content || '',
    });
  }

  private async handleSendMedia(sessionId: string, data: SendMediaData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.to || data.chatId || '');

    // Support both URL and base64 media
    if (data.media?.url) {
      return this.apiClient.sendMessage(sessionId, {
        chatId,
        contentType: 'MessageMediaFromURL',
        content: data.media.url,
        options: { caption: data.media.caption },
      });
    } else if (data.media?.data) {
      return this.apiClient.sendMessage(sessionId, {
        chatId,
        contentType: 'MessageMedia',
        content: {
          mimetype: data.media.mimetype,
          data: data.media.data,
          filename: data.media.filename,
        },
        options: { caption: data.media.caption },
      });
    } else {
      throw new Error('Media URL or data required');
    }
  }

  private async handleSendLocation(sessionId: string, data: SendLocationData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.to || data.chatId || '');
    return this.apiClient.sendMessage(sessionId, {
      chatId,
      contentType: 'Location',
      content: {
        latitude: data.latitude,
        longitude: data.longitude,
        description: data.description,
      },
    });
  }

  private async handleSendContact(sessionId: string, data: SendContactData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.to || data.chatId || '');
    const contactId = normalizeChatId(data.contact?.number || '');
    return this.apiClient.sendMessage(sessionId, {
      chatId,
      contentType: 'Contact',
      content: { contactId },
    });
  }

  private async handleReplyMessage(sessionId: string, data: ReplyMessageData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.chatId || '');
    return this.apiClient.replyToMessage(sessionId, {
      chatId,
      messageId: data.messageId,
      content: data.content,
      contentType: 'string',
    });
  }

  private async handleReactMessage(sessionId: string, data: ReactMessageData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.chatId || '');
    return this.apiClient.reactToMessage(sessionId, {
      chatId,
      messageId: data.messageId,
      reaction: data.reaction,
    });
  }

  private async handleForwardMessage(sessionId: string, data: ForwardMessageData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.chatId || '');
    const toChat = normalizeChatId(data.to);
    return this.apiClient.forwardMessage(sessionId, {
      chatId,
      messageId: data.messageId,
      toChat,
    });
  }

  /**
   * Group Handlers
   */
  private async handleGetGroups(sessionId: string): Promise<ApiResponse> {
    const chats = await this.apiClient.getChats(sessionId);
    // Filter only group chats (those with @g.us)
    if (chats.chats) {
      return {
        success: true,
        data: {
          groups: (chats.chats as ChatInfo[]).filter((chat: ChatInfo) => chat.id.includes('@g.us')),
        },
      };
    }
    return chats;
  }

  private async handleCreateGroup(sessionId: string, data: CreateGroupData): Promise<ApiResponse> {
    const contacts = normalizeMultiple(data.participants);
    return this.apiClient.createGroup(sessionId, data.name, contacts);
  }

  private async handleGetGroupInfo(sessionId: string, data: GetGroupInfoData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.groupId, true);
    return this.apiClient.getContactById(sessionId, chatId);
  }

  private async handleAddParticipants(sessionId: string, data: AddParticipantsData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.groupId, true);
    const contacts = normalizeMultiple(data.participants);
    return this.apiClient.addParticipants(sessionId, chatId, contacts);
  }

  private async handleRemoveParticipants(sessionId: string, data: RemoveParticipantsData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.groupId, true);
    const contacts = normalizeMultiple(data.participants);
    return this.apiClient.removeParticipants(sessionId, chatId, contacts);
  }

  private async handlePromoteToAdmin(sessionId: string, data: PromoteToAdminData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.groupId, true);
    const contacts = normalizeMultiple(data.participants);
    return this.apiClient.promoteParticipants(sessionId, chatId, contacts);
  }

  private async handleDemoteFromAdmin(sessionId: string, data: DemoteFromAdminData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.groupId, true);
    const contacts = normalizeMultiple(data.participants);
    return this.apiClient.demoteParticipants(sessionId, chatId, contacts);
  }

  private async handleUpdateGroupInfo(sessionId: string, data: UpdateGroupInfoData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.groupId, true);

    if (data.subject) {
      return this.apiClient.setGroupSubject(sessionId, chatId, data.subject);
    } else if (data.description) {
      return this.apiClient.setGroupDescription(sessionId, chatId, data.description);
    } else {
      throw new Error('Either subject or description required for group update');
    }
  }

  private async handleGetInviteCode(sessionId: string, data: GetInviteCodeData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.groupId, true);
    return this.apiClient.getInviteCode(sessionId, chatId);
  }

  private async handleLeaveGroup(sessionId: string, data: LeaveGroupData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.groupId, true);
    return this.apiClient.leaveGroup(sessionId, chatId);
  }

  /**
   * Contact Handlers
   */
  private async handleGetContact(sessionId: string, data: GetContactData): Promise<ApiResponse> {
    const contactId = normalizeChatId(data.contactId);
    return this.apiClient.getContactById(sessionId, contactId);
  }

  private async handleBlockContact(sessionId: string, data: BlockContactData): Promise<ApiResponse> {
    const contactId = normalizeChatId(data.contactId);
    return this.apiClient.blockContact(sessionId, contactId);
  }

  private async handleUnblockContact(sessionId: string, data: UnblockContactData): Promise<ApiResponse> {
    const contactId = normalizeChatId(data.contactId);
    return this.apiClient.unblockContact(sessionId, contactId);
  }

  private async handleGetProfilePicture(sessionId: string, data: GetProfilePictureData): Promise<ApiResponse> {
    const contactId = normalizeChatId(data.contactId);
    return this.apiClient.getProfilePicture(sessionId, contactId);
  }

  /**
   * Poll Handlers
   */
  private async handleCreatePoll(sessionId: string, data: CreatePollData): Promise<ApiResponse> {
    const chatId = normalizeChatId(data.to || data.chatId || '');
    return this.apiClient.sendMessage(sessionId, {
      chatId,
      contentType: 'Poll',
      content: {
        pollName: data.title,
        pollOptions: data.options,
        options: {
          allowMultipleAnswers: data.allowMultipleAnswers || false,
        },
      },
    });
  }

  /**
   * Session Handlers
   */
  private async handleGetSessionInfo(sessionId: string): Promise<ApiResponse> {
    return this.apiClient.getSessionStatus(sessionId);
  }

  private async handleResetSession(sessionId: string): Promise<ApiResponse> {
    await this.apiClient.terminateSession(sessionId);
    return this.apiClient.startSession(sessionId);
  }
}
