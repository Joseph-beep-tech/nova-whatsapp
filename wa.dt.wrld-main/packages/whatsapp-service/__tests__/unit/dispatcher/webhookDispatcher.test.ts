/**
 * WebhookDispatcher Unit Tests
 *
 * Tests all 24 action handlers for the webhook dispatcher.
 * Validates Task 030: "Webhook payloads include sessionId"
 */

import { WebhookDispatcher } from '../../../src/dispatcher/webhookDispatcher';
import { WhatsAppApiClient } from '../../../src/dispatcher/whatsappApiClient';
import { createMockApiClient, sendMessageResponse, getChatsResponse, successResponse } from '../../fixtures/mockApiResponses';
import {
  testSessionId,
  testChatId,
  testChatIdWithoutSuffix,
  testGroupId,
  testGroupIdWithoutSuffix,
  testContactId,
  testMessageId,
  sendMessageData,
  sendMediaData,
  sendMediaBase64Data,
  sendLocationData,
  sendContactData,
  replyMessageData,
  reactMessageData,
  forwardMessageData,
  createGroupData,
  addParticipantsData,
  removeParticipantsData,
  promoteToAdminData,
  demoteFromAdminData,
  updateGroupInfoData,
  updateGroupDescriptionData,
  leaveGroupData,
  getGroupInfoData,
  getInviteCodeData,
  getContactData,
  blockContactData,
  unblockContactData,
  getProfilePictureData,
  createPollData,
} from '../../fixtures/testData';

describe('WebhookDispatcher', () => {
  let dispatcher: WebhookDispatcher;
  let mockApiClient: ReturnType<typeof createMockApiClient>;

  beforeEach(() => {
    mockApiClient = createMockApiClient();
    dispatcher = new WebhookDispatcher(mockApiClient as unknown as WhatsAppApiClient);
  });

  // ==========================================================================
  // Dispatch Method Tests
  // ==========================================================================

  describe('dispatch()', () => {
    it('should return success response on valid action', async () => {
      const result = await dispatcher.dispatch(testSessionId, {
        action: 'send_message',
        data: sendMessageData,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return error response on unknown action', async () => {
      const result = await dispatcher.dispatch(testSessionId, {
        action: 'unknown_action',
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });

    it('should return error response when API throws', async () => {
      mockApiClient.sendMessage.mockRejectedValue(new Error('Network error'));

      const result = await dispatcher.dispatch(testSessionId, {
        action: 'send_message',
        data: sendMessageData,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  // ==========================================================================
  // Message Action Tests
  // ==========================================================================

  describe('Message Actions', () => {
    describe('send_message', () => {
      it('should send text message with "to" field', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'send_message',
          data: { to: testChatIdWithoutSuffix, message: 'Hello' },
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: testChatId,
          contentType: 'string',
          content: 'Hello',
        });
      });

      it('should send text message with "chatId" field', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'send_message',
          data: { chatId: testChatId, message: 'Hello' },
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: testChatId,
          contentType: 'string',
          content: 'Hello',
        });
      });

      it('should use "content" field as fallback for message', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'send_message',
          data: { to: testChatIdWithoutSuffix, content: 'Hello from content' },
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: testChatId,
          contentType: 'string',
          content: 'Hello from content',
        });
      });

      it('should add @c.us suffix to phone number', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'send_message',
          data: { to: '254700000001', message: 'Hello' },
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
          testSessionId,
          expect.objectContaining({ chatId: '254700000001@c.us' })
        );
      });
    });

    describe('send_media', () => {
      it('should send media from URL', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'send_media',
          data: sendMediaData,
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: testChatId,
          contentType: 'MessageMediaFromURL',
          content: sendMediaData.media!.url,
          options: { caption: sendMediaData.media!.caption },
        });
      });

      it('should send media from base64 data', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'send_media',
          data: sendMediaBase64Data,
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: testChatId,
          contentType: 'MessageMedia',
          content: {
            mimetype: sendMediaBase64Data.media!.mimetype,
            data: sendMediaBase64Data.media!.data,
            filename: sendMediaBase64Data.media!.filename,
          },
          options: { caption: sendMediaBase64Data.media!.caption },
        });
      });

      it('should throw error when no media URL or data provided', async () => {
        const result = await dispatcher.dispatch(testSessionId, {
          action: 'send_media',
          data: { to: testChatIdWithoutSuffix, media: {} },
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Media URL or data required');
      });
    });

    describe('send_location', () => {
      it('should send location message', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'send_location',
          data: sendLocationData,
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: testChatId,
          contentType: 'Location',
          content: {
            latitude: sendLocationData.latitude,
            longitude: sendLocationData.longitude,
            description: sendLocationData.description,
          },
        });
      });
    });

    describe('send_contact', () => {
      it('should send contact card', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'send_contact',
          data: sendContactData,
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: testChatId,
          contentType: 'Contact',
          content: {
            contactId: `${sendContactData.contact.number}@c.us`,
          },
        });
      });
    });

    describe('reply_message', () => {
      it('should reply to message', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'reply_message',
          data: replyMessageData,
        });

        expect(mockApiClient.replyToMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: replyMessageData.chatId,
          messageId: replyMessageData.messageId,
          content: replyMessageData.content,
          contentType: 'string',
        });
      });
    });

    describe('react_message', () => {
      it('should react to message with emoji', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'react_message',
          data: reactMessageData,
        });

        expect(mockApiClient.reactToMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: reactMessageData.chatId,
          messageId: reactMessageData.messageId,
          reaction: reactMessageData.reaction,
        });
      });
    });

    describe('forward_message', () => {
      it('should forward message to another chat', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'forward_message',
          data: forwardMessageData,
        });

        expect(mockApiClient.forwardMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: forwardMessageData.chatId,
          messageId: forwardMessageData.messageId,
          toChat: `${forwardMessageData.to}@c.us`,
        });
      });
    });
  });

  // ==========================================================================
  // Group Action Tests
  // ==========================================================================

  describe('Group Actions', () => {
    describe('get_groups', () => {
      it('should filter group chats from all chats', async () => {
        const result = await dispatcher.dispatch(testSessionId, {
          action: 'get_groups',
          data: {},
        });

        expect(mockApiClient.getChats).toHaveBeenCalledWith(testSessionId);
        expect(result.success).toBe(true);
        // The dispatch wraps the result in { success, data }
        const innerData = result.data as { success: boolean; data: { groups: unknown[] } };
        expect(innerData.data.groups).toEqual([
          { id: testGroupId, name: 'Test Group', isGroup: true },
        ]);
      });
    });

    describe('create_group', () => {
      it('should create group with participants', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'create_group',
          data: createGroupData,
        });

        expect(mockApiClient.createGroup).toHaveBeenCalledWith(
          testSessionId,
          createGroupData.name,
          ['254700000001@c.us', '254700000002@c.us']
        );
      });

      it('should handle comma-separated participant string', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'create_group',
          data: { name: 'Test', participants: '254700000001, 254700000002' },
        });

        expect(mockApiClient.createGroup).toHaveBeenCalledWith(
          testSessionId,
          'Test',
          ['254700000001@c.us', '254700000002@c.us']
        );
      });
    });

    describe('get_group_info', () => {
      it('should get group info by ID', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'get_group_info',
          data: getGroupInfoData,
        });

        expect(mockApiClient.getContactById).toHaveBeenCalledWith(
          testSessionId,
          testGroupId
        );
      });

      it('should add @g.us suffix to group ID without suffix', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'get_group_info',
          data: { groupId: testGroupIdWithoutSuffix },
        });

        expect(mockApiClient.getContactById).toHaveBeenCalledWith(
          testSessionId,
          testGroupId
        );
      });
    });

    describe('add_participants', () => {
      it('should add participants to group', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'add_participants',
          data: addParticipantsData,
        });

        expect(mockApiClient.addParticipants).toHaveBeenCalledWith(
          testSessionId,
          testGroupId,
          ['254700000003@c.us', '254700000004@c.us']
        );
      });
    });

    describe('remove_participants', () => {
      it('should remove participants from group', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'remove_participants',
          data: removeParticipantsData,
        });

        expect(mockApiClient.removeParticipants).toHaveBeenCalledWith(
          testSessionId,
          testGroupId,
          ['254700000003@c.us']
        );
      });
    });

    describe('promote_to_admin', () => {
      it('should promote participants to admin', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'promote_to_admin',
          data: promoteToAdminData,
        });

        expect(mockApiClient.promoteParticipants).toHaveBeenCalledWith(
          testSessionId,
          testGroupId,
          ['254700000002@c.us']
        );
      });
    });

    describe('demote_from_admin', () => {
      it('should demote participants from admin', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'demote_from_admin',
          data: demoteFromAdminData,
        });

        expect(mockApiClient.demoteParticipants).toHaveBeenCalledWith(
          testSessionId,
          testGroupId,
          ['254700000002@c.us']
        );
      });
    });

    describe('update_group_info', () => {
      it('should update group subject', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'update_group_info',
          data: updateGroupInfoData,
        });

        expect(mockApiClient.setGroupSubject).toHaveBeenCalledWith(
          testSessionId,
          testGroupId,
          updateGroupInfoData.subject
        );
      });

      it('should update group description', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'update_group_info',
          data: updateGroupDescriptionData,
        });

        expect(mockApiClient.setGroupDescription).toHaveBeenCalledWith(
          testSessionId,
          testGroupId,
          updateGroupDescriptionData.description
        );
      });

      it('should throw error when neither subject nor description provided', async () => {
        const result = await dispatcher.dispatch(testSessionId, {
          action: 'update_group_info',
          data: { groupId: testGroupId },
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Either subject or description required');
      });
    });

    describe('get_invite_code', () => {
      it('should get group invite code', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'get_invite_code',
          data: getInviteCodeData,
        });

        expect(mockApiClient.getInviteCode).toHaveBeenCalledWith(
          testSessionId,
          testGroupId
        );
      });
    });

    describe('leave_group', () => {
      it('should leave group', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'leave_group',
          data: leaveGroupData,
        });

        expect(mockApiClient.leaveGroup).toHaveBeenCalledWith(
          testSessionId,
          testGroupId
        );
      });
    });
  });

  // ==========================================================================
  // Contact Action Tests
  // ==========================================================================

  describe('Contact Actions', () => {
    describe('get_contact', () => {
      it('should get contact by ID', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'get_contact',
          data: getContactData,
        });

        expect(mockApiClient.getContactById).toHaveBeenCalledWith(
          testSessionId,
          testContactId
        );
      });
    });

    describe('block_contact', () => {
      it('should block contact', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'block_contact',
          data: blockContactData,
        });

        expect(mockApiClient.blockContact).toHaveBeenCalledWith(
          testSessionId,
          testContactId
        );
      });
    });

    describe('unblock_contact', () => {
      it('should unblock contact', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'unblock_contact',
          data: unblockContactData,
        });

        expect(mockApiClient.unblockContact).toHaveBeenCalledWith(
          testSessionId,
          testContactId
        );
      });
    });

    describe('get_profile_picture', () => {
      it('should get profile picture URL', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'get_profile_picture',
          data: getProfilePictureData,
        });

        expect(mockApiClient.getProfilePicture).toHaveBeenCalledWith(
          testSessionId,
          testContactId
        );
      });
    });
  });

  // ==========================================================================
  // Poll Action Tests
  // ==========================================================================

  describe('Poll Actions', () => {
    describe('create_poll', () => {
      it('should create poll', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'create_poll',
          data: createPollData,
        });

        expect(mockApiClient.sendMessage).toHaveBeenCalledWith(testSessionId, {
          chatId: testChatId,
          contentType: 'Poll',
          content: {
            pollName: createPollData.title,
            pollOptions: createPollData.options,
            options: {
              allowMultipleAnswers: createPollData.allowMultipleAnswers,
            },
          },
        });
      });
    });
  });

  // ==========================================================================
  // Session Action Tests
  // ==========================================================================

  describe('Session Actions', () => {
    describe('get_session_info', () => {
      it('should get session status', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'get_session_info',
          data: {},
        });

        expect(mockApiClient.getSessionStatus).toHaveBeenCalledWith(testSessionId);
      });
    });

    describe('reset_session', () => {
      it('should terminate and restart session', async () => {
        await dispatcher.dispatch(testSessionId, {
          action: 'reset_session',
          data: {},
        });

        expect(mockApiClient.terminateSession).toHaveBeenCalledWith(testSessionId);
        expect(mockApiClient.startSession).toHaveBeenCalledWith(testSessionId);
      });
    });
  });

  // ==========================================================================
  // Chat ID Formatting Tests
  // ==========================================================================

  describe('Chat ID Formatting', () => {
    it('should preserve existing @c.us suffix', async () => {
      await dispatcher.dispatch(testSessionId, {
        action: 'send_message',
        data: { to: testChatId, message: 'Hello' },
      });

      expect(mockApiClient.sendMessage).toHaveBeenCalledWith(
        testSessionId,
        expect.objectContaining({ chatId: testChatId })
      );
    });

    it('should preserve existing @g.us suffix', async () => {
      await dispatcher.dispatch(testSessionId, {
        action: 'get_group_info',
        data: { groupId: testGroupId },
      });

      expect(mockApiClient.getContactById).toHaveBeenCalledWith(
        testSessionId,
        testGroupId
      );
    });

    it('should throw error when chat ID is empty', async () => {
      const result = await dispatcher.dispatch(testSessionId, {
        action: 'send_message',
        data: { to: '', message: 'Hello' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Phone number or chat ID is required');
    });
  });

  // ==========================================================================
  // Participant Array Formatting Tests
  // ==========================================================================

  describe('Participant Array Formatting', () => {
    it('should convert comma-separated string to array', async () => {
      await dispatcher.dispatch(testSessionId, {
        action: 'add_participants',
        data: { groupId: testGroupId, participants: '254700000001, 254700000002' },
      });

      expect(mockApiClient.addParticipants).toHaveBeenCalledWith(
        testSessionId,
        testGroupId,
        ['254700000001@c.us', '254700000002@c.us']
      );
    });

    it('should filter empty strings from participant list', async () => {
      await dispatcher.dispatch(testSessionId, {
        action: 'add_participants',
        data: { groupId: testGroupId, participants: '254700000001, , 254700000002, ' },
      });

      expect(mockApiClient.addParticipants).toHaveBeenCalledWith(
        testSessionId,
        testGroupId,
        ['254700000001@c.us', '254700000002@c.us']
      );
    });

    it('should add @c.us suffix to each participant', async () => {
      await dispatcher.dispatch(testSessionId, {
        action: 'add_participants',
        data: { groupId: testGroupId, participants: ['254700000001', '254700000002@c.us'] },
      });

      expect(mockApiClient.addParticipants).toHaveBeenCalledWith(
        testSessionId,
        testGroupId,
        ['254700000001@c.us', '254700000002@c.us']
      );
    });
  });
});
