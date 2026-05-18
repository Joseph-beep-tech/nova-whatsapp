/**
 * Webhook Action Types
 *
 * Type definitions for n8n webhook actions that map to whatsapp-api endpoints.
 * These types define the data structure expected by each action.
 */

// =============================================================================
// Base Types
// =============================================================================

/** Generic API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Chat ID can be individual or group */
export type ChatId = string;

/** Message ID for replies, reactions, forwards */
export type MessageId = string;

/** Contact ID (phone number with @c.us suffix) */
export type ContactId = string;

/** Group ID (with @g.us suffix) */
export type GroupId = string;

// =============================================================================
// Message Action Data Types
// =============================================================================

/** Send a text message */
export interface SendMessageData {
  to?: ChatId;
  chatId?: ChatId;
  message?: string;
  content?: string;
}

/** Send media (image, video, audio, document) */
export interface SendMediaData {
  to?: ChatId;
  chatId?: ChatId;
  media?: {
    url?: string;
    data?: string;
    mimetype?: string;
    filename?: string;
    caption?: string;
  };
}

/** Send a location */
export interface SendLocationData {
  to?: ChatId;
  chatId?: ChatId;
  latitude: number;
  longitude: number;
  description?: string;
  name?: string;
}

/** Send a contact card */
export interface SendContactData {
  to?: ChatId;
  chatId?: ChatId;
  contact: {
    name: string;
    number: string;
  };
}

/** Reply to a message */
export interface ReplyMessageData {
  messageId: MessageId;
  chatId?: ChatId;
  content: string;
}

/** React to a message with emoji */
export interface ReactMessageData {
  messageId: MessageId;
  chatId?: ChatId;
  reaction: string;
}

/** Forward a message to another chat */
export interface ForwardMessageData {
  messageId: MessageId;
  to: ChatId;
  chatId?: ChatId;
}

// =============================================================================
// Group Action Data Types
// =============================================================================

/** Get groups list - no data required */
export type GetGroupsData = Record<string, never>;

/** Create a new group */
export interface CreateGroupData {
  name: string;
  participants: string[];
}

/** Add participants to a group */
export interface AddParticipantsData {
  groupId: GroupId;
  participants: string[];
}

/** Remove participants from a group */
export interface RemoveParticipantsData {
  groupId: GroupId;
  participants: string[];
}

/** Promote participants to admin */
export interface PromoteToAdminData {
  groupId: GroupId;
  participants: string[];
}

/** Demote participants from admin */
export interface DemoteFromAdminData {
  groupId: GroupId;
  participants: string[];
}

/** Update group info (subject/description) */
export interface UpdateGroupInfoData {
  groupId: GroupId;
  subject?: string;
  description?: string;
}

/** Leave a group */
export interface LeaveGroupData {
  groupId: GroupId;
}

/** Get group info */
export interface GetGroupInfoData {
  groupId: GroupId;
}

/** Get group invite code */
export interface GetInviteCodeData {
  groupId: GroupId;
}

// =============================================================================
// Contact Action Data Types
// =============================================================================

/** Get contact info */
export interface GetContactData {
  contactId: ContactId;
}

/** Block a contact */
export interface BlockContactData {
  contactId: ContactId;
}

/** Unblock a contact */
export interface UnblockContactData {
  contactId: ContactId;
}

/** Get profile picture */
export interface GetProfilePictureData {
  contactId: ContactId;
}

// =============================================================================
// Poll Action Data Types
// =============================================================================

/** Create a poll */
export interface CreatePollData {
  to?: ChatId;
  chatId?: ChatId;
  title: string;
  options: string[];
  allowMultipleAnswers?: boolean;
}

// =============================================================================
// Session Action Data Types
// =============================================================================

/** Get session info - no data required */
export type GetSessionInfoData = Record<string, never>;

/** Reset session - no data required */
export type ResetSessionData = Record<string, never>;

// =============================================================================
// User Action Data Types
// =============================================================================

/** Register or update a user with tags */
export interface RegisterUserData {
  chatId: ChatId;
  name?: string;
  pushname?: string;
  tags?: string[];
}

/** Add or remove tags from a user */
export interface ModifyTagsData {
  tags: string[];
}

// =============================================================================
// Webhook Action Union Type
// =============================================================================

/** All possible action data types */
export type WebhookActionData =
  | SendMessageData
  | SendMediaData
  | SendLocationData
  | SendContactData
  | ReplyMessageData
  | ReactMessageData
  | ForwardMessageData
  | GetGroupsData
  | CreateGroupData
  | AddParticipantsData
  | RemoveParticipantsData
  | PromoteToAdminData
  | DemoteFromAdminData
  | UpdateGroupInfoData
  | LeaveGroupData
  | GetGroupInfoData
  | GetInviteCodeData
  | GetContactData
  | BlockContactData
  | UnblockContactData
  | GetProfilePictureData
  | CreatePollData
  | GetSessionInfoData
  | ResetSessionData;

/** Webhook action names */
export type WebhookActionName =
  | 'send_message'
  | 'send_media'
  | 'send_location'
  | 'send_contact'
  | 'reply_message'
  | 'react_message'
  | 'forward_message'
  | 'get_groups'
  | 'create_group'
  | 'add_participants'
  | 'remove_participants'
  | 'promote_to_admin'
  | 'demote_from_admin'
  | 'update_group_info'
  | 'leave_group'
  | 'get_invite_code'
  | 'get_contact'
  | 'block_contact'
  | 'unblock_contact'
  | 'get_profile_picture'
  | 'create_poll'
  | 'get_session_info'
  | 'reset_session';

// =============================================================================
// API Response Types
// =============================================================================

/** Session information response */
export interface SessionInfoResponse {
  sessionId: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr';
  info?: {
    pushname?: string;
    wid?: string;
    platform?: string;
  };
}

/** Group information response */
export interface GroupInfoResponse {
  id: string;
  name: string;
  description?: string;
  participants: Array<{
    id: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }>;
  owner?: string;
  createdAt?: number;
}

/** Contact information response */
export interface ContactInfoResponse {
  id: string;
  name?: string;
  pushname?: string;
  isBlocked: boolean;
  isMyContact: boolean;
  isBusiness: boolean;
}

/** Message sent response */
export interface MessageSentResponse {
  id: string;
  timestamp: number;
  status: string;
}

/** Media stats response */
export interface MediaStatsResponse {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, number>;
}

/** Re-export UserResponse from stateManager for API consistency */
export type { UserResponse } from '../utils/stateManager';

// =============================================================================
// Utility Types
// =============================================================================

/** Error with message property */
export interface ErrorWithMessage {
  message: string;
  code?: string;
  status?: number;
}

/** Type guard to check if error has message */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/** Extract error message from unknown error */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}
