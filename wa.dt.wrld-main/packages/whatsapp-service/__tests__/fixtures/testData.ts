/**
 * Test Data Fixtures
 *
 * Sample data for unit and integration tests.
 */

// =============================================================================
// Session Data
// =============================================================================

export const testSessionId = 'test-session';

export const testSession = {
  sessionId: testSessionId,
  status: 'connected' as const,
  info: {
    pushname: 'Test Bot',
    wid: '254700000000@c.us',
    platform: 'smba',
  },
};

// =============================================================================
// Chat/Contact IDs
// =============================================================================

export const testChatId = '254700000001@c.us';
export const testGroupId = '120363000000000000@g.us';
export const testContactId = '254700000002@c.us';

export const testChatIdWithoutSuffix = '254700000001';
export const testGroupIdWithoutSuffix = '120363000000000000';

// =============================================================================
// Message Data
// =============================================================================

export const testMessageId = 'true_254700000001@c.us_3EB0A0BCE52F1D610F0CA9';

export const sendMessageData = {
  to: testChatIdWithoutSuffix,
  message: 'Hello, World!',
};

export const sendMediaData = {
  to: testChatIdWithoutSuffix,
  media: {
    url: 'https://example.com/image.jpg',
    caption: 'Test image',
  },
};

export const sendMediaBase64Data = {
  to: testChatIdWithoutSuffix,
  media: {
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    mimetype: 'image/png',
    filename: 'test.png',
    caption: 'Base64 image',
  },
};

export const sendLocationData = {
  to: testChatIdWithoutSuffix,
  latitude: -1.2921,
  longitude: 36.8219,
  description: 'Nairobi, Kenya',
};

export const sendContactData = {
  to: testChatIdWithoutSuffix,
  contact: {
    name: 'John Doe',
    number: '254700000003',
  },
};

export const replyMessageData = {
  chatId: testChatId,
  messageId: testMessageId,
  content: 'This is a reply',
};

export const reactMessageData = {
  chatId: testChatId,
  messageId: testMessageId,
  reaction: '👍',
};

export const forwardMessageData = {
  chatId: testChatId,
  messageId: testMessageId,
  to: '254700000004',
};

// =============================================================================
// Group Data
// =============================================================================

export const createGroupData = {
  name: 'Test Group',
  participants: ['254700000001', '254700000002'],
};

export const addParticipantsData = {
  groupId: testGroupId,
  participants: ['254700000003', '254700000004'],
};

export const removeParticipantsData = {
  groupId: testGroupId,
  participants: ['254700000003'],
};

export const promoteToAdminData = {
  groupId: testGroupId,
  participants: ['254700000002'],
};

export const demoteFromAdminData = {
  groupId: testGroupId,
  participants: ['254700000002'],
};

export const updateGroupInfoData = {
  groupId: testGroupId,
  subject: 'New Group Name',
};

export const updateGroupDescriptionData = {
  groupId: testGroupId,
  description: 'New group description',
};

export const leaveGroupData = {
  groupId: testGroupId,
};

export const getGroupInfoData = {
  groupId: testGroupId,
};

export const getInviteCodeData = {
  groupId: testGroupId,
};

// =============================================================================
// Contact Data
// =============================================================================

export const getContactData = {
  contactId: testContactId,
};

export const blockContactData = {
  contactId: testContactId,
};

export const unblockContactData = {
  contactId: testContactId,
};

export const getProfilePictureData = {
  contactId: testContactId,
};

// =============================================================================
// Poll Data
// =============================================================================

export const createPollData = {
  to: testChatIdWithoutSuffix,
  title: 'Favorite color?',
  options: ['Red', 'Blue', 'Green'],
  allowMultipleAnswers: false,
};

// =============================================================================
// Helper Functions
// =============================================================================

export function createWebhookAction(action: string, data: Record<string, unknown> = {}) {
  return {
    action,
    data,
    sessionId: testSessionId,
  };
}
