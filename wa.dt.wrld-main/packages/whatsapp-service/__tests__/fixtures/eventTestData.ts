/**
 * Test fixtures for WhatsApp event data
 *
 * Provides sample event payloads for different event types,
 * including edge cases like events without data payloads.
 */

/**
 * Standard message event with full data
 */
export const messageEvent = {
  dataType: 'message',
  sessionId: 'test-session',
  data: {
    from: '254722833440@c.us',
    to: '254700000000@c.us',
    body: 'Hello, world!',
    fromMe: false,
    timestamp: 1706540400,
    type: 'chat',
  },
};

/**
 * Message create event (alternative event type)
 */
export const messageCreateEvent = {
  dataType: 'message_create',
  sessionId: 'test-session',
  data: {
    from: '254722833440@c.us',
    body: 'Test message',
    fromMe: false,
  },
};

/**
 * Message sent by the bot itself (fromMe: true)
 */
export const ownMessageEvent = {
  dataType: 'message_create',
  sessionId: 'test-session',
  data: {
    from: '254700000000@c.us',
    body: 'Bot response',
    fromMe: true,
  },
};

/**
 * Group message event
 */
export const groupMessageEvent = {
  dataType: 'message',
  sessionId: 'test-session',
  data: {
    from: '254722833440@c.us',
    chatId: '120363000000@g.us',
    body: 'Hello group!',
    fromMe: false,
    author: '254722833440@c.us',
    isGroupMsg: true,
  },
};

/**
 * Authenticated event - NO data payload
 * This caused the production error on 2026-01-29
 */
export const authenticatedEvent = {
  dataType: 'authenticated',
  sessionId: 'mysession',
  // No data field
};

/**
 * Loading screen event - NO data payload
 */
export const loadingScreenEvent = {
  dataType: 'loading_screen',
  sessionId: 'mysession',
  // No data field
};

/**
 * Disconnected event - NO data payload
 */
export const disconnectedEvent = {
  dataType: 'disconnected',
  sessionId: 'mysession',
  // No data field
};

/**
 * QR code event - minimal data
 */
export const qrEvent = {
  dataType: 'qr',
  sessionId: 'mysession',
  data: {
    qr: 'base64-encoded-qr-data',
  },
};

/**
 * Status change event
 */
export const statusChangeEvent = {
  dataType: 'status_change',
  sessionId: 'mysession',
  data: {
    status: 'CONNECTED',
  },
};

/**
 * Event with nested message structure
 */
export const nestedMessageEvent = {
  dataType: 'message',
  sessionId: 'test-session',
  data: {
    message: {
      from: '254722833440@c.us',
      body: 'Nested body',
      fromMe: false,
    },
  },
};

/**
 * Event with msg structure (alternative nesting)
 */
export const msgStructureEvent = {
  dataType: 'message',
  sessionId: 'test-session',
  data: {
    msg: {
      from: '254711222333@c.us',
      body: 'Msg body',
      fromMe: false,
    },
  },
};

/**
 * Event with chatId instead of from
 */
export const chatIdEvent = {
  dataType: 'message',
  sessionId: 'test-session',
  data: {
    chatId: '254722833440@c.us',
    body: 'Using chatId',
    fromMe: false,
  },
};

/**
 * Event with undefined data (explicit)
 */
export const undefinedDataEvent = {
  dataType: 'authenticated',
  sessionId: 'mysession',
  data: undefined,
};

/**
 * Event with null data
 */
export const nullDataEvent = {
  dataType: 'authenticated',
  sessionId: 'mysession',
  data: null,
};

/**
 * Event with empty data object
 */
export const emptyDataEvent = {
  dataType: 'unknown',
  sessionId: 'test-session',
  data: {},
};

/**
 * Event with invalid from field (no @ sign)
 */
export const invalidFromEvent = {
  dataType: 'message',
  sessionId: 'test-session',
  data: {
    from: 'invalid-phone-number',
    body: 'Test',
    fromMe: false,
  },
};

/**
 * SOMO keyword message
 */
export const somoMessageEvent = {
  dataType: 'message',
  sessionId: 'test-session',
  data: {
    from: '254722833440@c.us',
    body: 'I want to join SOMO',
    fromMe: false,
  },
};

/**
 * Echo command message
 */
export const echoMessageEvent = {
  dataType: 'message',
  sessionId: 'test-session',
  data: {
    from: '254722833440@c.us',
    body: 'echo hello world',
    fromMe: false,
  },
};

/**
 * Ping command message
 */
export const pingMessageEvent = {
  dataType: 'message',
  sessionId: 'test-session',
  data: {
    from: '254722833440@c.us',
    body: 'ping',
    fromMe: false,
  },
};
