/**
 * WhatsAppApiClient Unit Tests
 *
 * Tests the HTTP client methods with mocked axios.
 * Validates Task 028: "Unit tests pass"
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosHeaders } from 'axios';
import { WhatsAppApiClient, SendMessageRequest } from '../../../src/dispatcher/whatsappApiClient';
import { testSessionId, testChatId, testGroupId, testMessageId, testContactId } from '../../fixtures/testData';
import { sendMessageResponse, successResponse, getChatsResponse } from '../../fixtures/mockApiResponses';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WhatsAppApiClient', () => {
  let client: WhatsAppApiClient;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;

  beforeEach(() => {
    // Create a mock axios instance
    mockAxiosInstance = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      head: jest.fn(),
      options: jest.fn(),
      postForm: jest.fn(),
      putForm: jest.fn(),
      patchForm: jest.fn(),
      defaults: {
        headers: {} as unknown as AxiosHeaders,
        baseURL: 'http://localhost:3000',
        timeout: 30000,
      },
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
      },
      getUri: jest.fn(),
    } as unknown as jest.Mocked<AxiosInstance>;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    client = new WhatsAppApiClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      timeout: 30000,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3000',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
        },
      });
    });

    it('should use default timeout of 30000ms', () => {
      const clientWithoutTimeout = new WhatsAppApiClient({
        baseUrl: 'http://localhost:3000',
        apiKey: 'test-api-key',
      });

      expect(mockedAxios.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ timeout: 30000 })
      );
    });
  });

  // ==========================================================================
  // Message Methods Tests
  // ==========================================================================

  describe('Message Methods', () => {
    describe('sendMessage', () => {
      it('should POST to correct endpoint with message data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: sendMessageResponse });

        const messageData: SendMessageRequest = {
          chatId: testChatId,
          contentType: 'string',
          content: 'Hello, World!',
        };

        await client.sendMessage(testSessionId, messageData);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/client/sendMessage/${testSessionId}`,
          data: messageData,
        });
      });

      it('should return API response data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: sendMessageResponse });

        const result = await client.sendMessage(testSessionId, {
          chatId: testChatId,
          contentType: 'string',
          content: 'Test',
        });

        expect(result).toEqual(sendMessageResponse);
      });
    });

    describe('getChats', () => {
      it('should GET chats for session', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: getChatsResponse });

        const result = await client.getChats(testSessionId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'GET',
          url: `/client/getChats/${testSessionId}`,
        });
        expect(result).toEqual(getChatsResponse);
      });
    });

    describe('getContacts', () => {
      it('should GET contacts for session', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.getContacts(testSessionId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'GET',
          url: `/client/getContacts/${testSessionId}`,
        });
      });
    });

    describe('getContactById', () => {
      it('should POST with contactId', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.getContactById(testSessionId, testContactId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/client/getContactById/${testSessionId}`,
          data: { contactId: testContactId },
        });
      });
    });

    describe('replyToMessage', () => {
      it('should POST reply data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: sendMessageResponse });

        await client.replyToMessage(testSessionId, {
          chatId: testChatId,
          messageId: testMessageId,
          content: 'Reply text',
        });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/message/reply/${testSessionId}`,
          data: {
            chatId: testChatId,
            messageId: testMessageId,
            content: 'Reply text',
            contentType: 'string',
          },
        });
      });
    });

    describe('reactToMessage', () => {
      it('should POST reaction data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.reactToMessage(testSessionId, {
          chatId: testChatId,
          messageId: testMessageId,
          reaction: '👍',
        });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/message/react/${testSessionId}`,
          data: {
            chatId: testChatId,
            messageId: testMessageId,
            reaction: '👍',
          },
        });
      });
    });

    describe('forwardMessage', () => {
      it('should POST forward data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.forwardMessage(testSessionId, {
          chatId: testChatId,
          messageId: testMessageId,
          toChat: '254700000005@c.us',
        });

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/message/forward/${testSessionId}`,
          data: {
            chatId: testChatId,
            messageId: testMessageId,
            toChat: '254700000005@c.us',
          },
        });
      });
    });

    describe('downloadMedia', () => {
      it('should POST download request', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.downloadMedia(testSessionId, testChatId, testMessageId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/message/downloadMedia/${testSessionId}`,
          data: {
            chatId: testChatId,
            messageId: testMessageId,
          },
        });
      });
    });
  });

  // ==========================================================================
  // Contact Methods Tests
  // ==========================================================================

  describe('Contact Methods', () => {
    describe('blockContact', () => {
      it('should POST to block endpoint', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.blockContact(testSessionId, testContactId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/contact/block/${testSessionId}`,
          data: { contactId: testContactId },
        });
      });
    });

    describe('unblockContact', () => {
      it('should POST to unblock endpoint', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.unblockContact(testSessionId, testContactId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/contact/unblock/${testSessionId}`,
          data: { contactId: testContactId },
        });
      });
    });

    describe('getProfilePicture', () => {
      it('should POST to profile picture endpoint', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.getProfilePicture(testSessionId, testContactId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/contact/getProfilePicUrl/${testSessionId}`,
          data: { contactId: testContactId },
        });
      });
    });
  });

  // ==========================================================================
  // Group Methods Tests
  // ==========================================================================

  describe('Group Methods', () => {
    describe('createGroup', () => {
      it('should POST group creation data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.createGroup(testSessionId, 'Test Group', ['254700000001@c.us', '254700000002@c.us']);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/client/createGroup/${testSessionId}`,
          data: {
            groupName: 'Test Group',
            contacts: ['254700000001@c.us', '254700000002@c.us'],
          },
        });
      });
    });

    describe('addParticipants', () => {
      it('should POST add participants data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.addParticipants(testSessionId, testGroupId, ['254700000003@c.us']);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/groupChat/addParticipants/${testSessionId}`,
          data: {
            chatId: testGroupId,
            contactIds: ['254700000003@c.us'],
          },
        });
      });
    });

    describe('removeParticipants', () => {
      it('should POST remove participants data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.removeParticipants(testSessionId, testGroupId, ['254700000003@c.us']);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/groupChat/removeParticipants/${testSessionId}`,
          data: {
            chatId: testGroupId,
            contactIds: ['254700000003@c.us'],
          },
        });
      });
    });

    describe('promoteParticipants', () => {
      it('should POST promote data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.promoteParticipants(testSessionId, testGroupId, ['254700000002@c.us']);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/groupChat/promoteParticipants/${testSessionId}`,
          data: {
            chatId: testGroupId,
            contactIds: ['254700000002@c.us'],
          },
        });
      });
    });

    describe('demoteParticipants', () => {
      it('should POST demote data', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.demoteParticipants(testSessionId, testGroupId, ['254700000002@c.us']);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/groupChat/demoteParticipants/${testSessionId}`,
          data: {
            chatId: testGroupId,
            contactIds: ['254700000002@c.us'],
          },
        });
      });
    });

    describe('getInviteCode', () => {
      it('should POST to invite code endpoint', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.getInviteCode(testSessionId, testGroupId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/groupChat/getInviteCode/${testSessionId}`,
          data: { chatId: testGroupId },
        });
      });
    });

    describe('setGroupSubject', () => {
      it('should POST new subject', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.setGroupSubject(testSessionId, testGroupId, 'New Name');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/groupChat/setSubject/${testSessionId}`,
          data: {
            chatId: testGroupId,
            subject: 'New Name',
          },
        });
      });
    });

    describe('setGroupDescription', () => {
      it('should POST new description', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.setGroupDescription(testSessionId, testGroupId, 'New description');

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/groupChat/setDescription/${testSessionId}`,
          data: {
            chatId: testGroupId,
            description: 'New description',
          },
        });
      });
    });

    describe('leaveGroup', () => {
      it('should POST leave request', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.leaveGroup(testSessionId, testGroupId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'POST',
          url: `/groupChat/leave/${testSessionId}`,
          data: { chatId: testGroupId },
        });
      });
    });
  });

  // ==========================================================================
  // Session Methods Tests
  // ==========================================================================

  describe('Session Methods', () => {
    describe('getSessionStatus', () => {
      it('should GET session status', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.getSessionStatus(testSessionId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'GET',
          url: `/session/status/${testSessionId}`,
        });
      });
    });

    describe('getSessionQR', () => {
      it('should GET session QR code', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.getSessionQR(testSessionId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'GET',
          url: `/session/qr/${testSessionId}`,
        });
      });
    });

    describe('startSession', () => {
      it('should GET start session endpoint', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.startSession(testSessionId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'GET',
          url: `/session/start/${testSessionId}`,
        });
      });
    });

    describe('restartSession', () => {
      it('should GET restart session endpoint', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.restartSession(testSessionId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'GET',
          url: `/session/restart/${testSessionId}`,
        });
      });
    });

    describe('terminateSession', () => {
      it('should GET terminate session endpoint', async () => {
        mockAxiosInstance.request.mockResolvedValue({ data: successResponse });

        await client.terminateSession(testSessionId);

        expect(mockAxiosInstance.request).toHaveBeenCalledWith({
          method: 'GET',
          url: `/session/terminate/${testSessionId}`,
        });
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should throw error with status code and message on API error', async () => {
      const axiosError = new Error('Request failed') as AxiosError;
      (axiosError as unknown as Record<string, unknown>).response = {
        status: 404,
        data: { error: 'Session not found' },
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(client.getSessionStatus(testSessionId)).rejects.toThrow(
        'WhatsApp API Error [404]: Session not found'
      );
    });

    it('should handle error with message field instead of error field', async () => {
      const axiosError = new Error('Request failed') as AxiosError;
      (axiosError as unknown as Record<string, unknown>).response = {
        status: 400,
        data: { message: 'Invalid request' },
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(client.sendMessage(testSessionId, {
        chatId: testChatId,
        contentType: 'string',
        content: 'Test',
      })).rejects.toThrow('WhatsApp API Error [400]: Invalid request');
    });

    it('should handle network errors without response', async () => {
      const networkError = new Error('Network timeout');

      mockAxiosInstance.request.mockRejectedValue(networkError);

      await expect(client.getSessionStatus(testSessionId)).rejects.toThrow(
        'WhatsApp API Error [UNKNOWN]: Network timeout'
      );
    });

    it('should handle errors without message', async () => {
      const axiosError = new Error('Request failed') as AxiosError;
      (axiosError as unknown as Record<string, unknown>).response = {
        status: 500,
        data: {},
      };

      mockAxiosInstance.request.mockRejectedValue(axiosError);

      await expect(client.getSessionStatus(testSessionId)).rejects.toThrow(
        'WhatsApp API Error [500]: Request failed'
      );
    });
  });
});
