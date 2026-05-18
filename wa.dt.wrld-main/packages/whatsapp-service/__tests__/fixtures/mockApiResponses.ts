/**
 * Mock API Responses
 *
 * Sample responses from whatsapp-api for mocking in tests.
 */

import { testChatId, testGroupId, testContactId, testMessageId, testSessionId } from './testData';

// =============================================================================
// Success Responses
// =============================================================================

export const successResponse = {
  success: true,
  message: 'Operation completed successfully',
};

export const sendMessageResponse = {
  success: true,
  message: {
    id: {
      fromMe: true,
      remote: testChatId,
      id: '3EB0A0BCE52F1D610F0CA9',
      _serialized: testMessageId,
    },
    ack: 0,
    hasMedia: false,
    body: 'Hello, World!',
    type: 'chat',
    timestamp: 1737400000,
    from: '254700000000@c.us',
    to: testChatId,
  },
};

export const sessionStatusResponse = {
  success: true,
  state: 'CONNECTED',
  message: 'Session is connected',
};

export const getChatsResponse = {
  success: true,
  chats: [
    { id: testChatId, name: 'John Doe', isGroup: false },
    { id: testGroupId, name: 'Test Group', isGroup: true },
    { id: '254700000005@c.us', name: 'Jane Doe', isGroup: false },
  ],
};

export const getContactResponse = {
  success: true,
  contact: {
    id: testContactId,
    name: 'Test Contact',
    pushname: 'TestUser',
    isBlocked: false,
    isMyContact: true,
    isBusiness: false,
  },
};

export const createGroupResponse = {
  success: true,
  group: {
    gid: {
      server: 'g.us',
      user: '120363000000000001',
      _serialized: '120363000000000001@g.us',
    },
  },
};

export const getInviteCodeResponse = {
  success: true,
  inviteCode: 'ABC123XYZ789',
};

export const getProfilePictureResponse = {
  success: true,
  profilePicUrl: 'https://pps.whatsapp.net/v/t61.24694-24/123456789_123456789.jpg',
};

export const qrCodeResponse = {
  success: true,
  qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
};

// =============================================================================
// Error Responses
// =============================================================================

export const notFoundError = {
  success: false,
  error: 'Session not found',
};

export const invalidRequestError = {
  success: false,
  error: 'Invalid request data',
};

export const authenticationError = {
  success: false,
  error: 'Invalid API key',
};

export const sessionNotConnectedError = {
  success: false,
  error: 'Session is not connected',
  state: 'DISCONNECTED',
};

export const rateLimitError = {
  success: false,
  error: 'Too many requests',
  retryAfter: 60,
};

// =============================================================================
// Mock Axios Error Creator
// =============================================================================

export function createAxiosError(status: number, data: Record<string, unknown>) {
  const error = new Error('Request failed') as Error & { response?: { status: number; data: Record<string, unknown> } };
  error.response = { status, data };
  return error;
}

// =============================================================================
// Mock WhatsApp API Client
// =============================================================================

export function createMockApiClient() {
  return {
    sendMessage: jest.fn().mockResolvedValue(sendMessageResponse),
    getChats: jest.fn().mockResolvedValue(getChatsResponse),
    getContacts: jest.fn().mockResolvedValue(successResponse),
    getContactById: jest.fn().mockResolvedValue(getContactResponse),
    blockContact: jest.fn().mockResolvedValue(successResponse),
    unblockContact: jest.fn().mockResolvedValue(successResponse),
    getProfilePicture: jest.fn().mockResolvedValue(getProfilePictureResponse),
    createGroup: jest.fn().mockResolvedValue(createGroupResponse),
    addParticipants: jest.fn().mockResolvedValue(successResponse),
    removeParticipants: jest.fn().mockResolvedValue(successResponse),
    promoteParticipants: jest.fn().mockResolvedValue(successResponse),
    demoteParticipants: jest.fn().mockResolvedValue(successResponse),
    getInviteCode: jest.fn().mockResolvedValue(getInviteCodeResponse),
    setGroupSubject: jest.fn().mockResolvedValue(successResponse),
    setGroupDescription: jest.fn().mockResolvedValue(successResponse),
    leaveGroup: jest.fn().mockResolvedValue(successResponse),
    replyToMessage: jest.fn().mockResolvedValue(sendMessageResponse),
    reactToMessage: jest.fn().mockResolvedValue(successResponse),
    forwardMessage: jest.fn().mockResolvedValue(successResponse),
    downloadMedia: jest.fn().mockResolvedValue(successResponse),
    getSessionStatus: jest.fn().mockResolvedValue(sessionStatusResponse),
    getSessionQR: jest.fn().mockResolvedValue(qrCodeResponse),
    startSession: jest.fn().mockResolvedValue(successResponse),
    restartSession: jest.fn().mockResolvedValue(successResponse),
    terminateSession: jest.fn().mockResolvedValue(successResponse),
  };
}
