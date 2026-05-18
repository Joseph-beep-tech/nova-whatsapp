/**
 * Socket.io Event Types
 *
 * Server-side type definitions for the real-time event map.
 * Mirrors the dashboard's SocketEventMap
 * (packages/whatsapp-dashboard/src/lib/socket.ts).
 *
 * Payload builder functions are in utils/socketPayloads.ts.
 */

// ---------------------------------------------------------------------------
// Event payload types (mirror dashboard types/index.ts)
// ---------------------------------------------------------------------------

export interface SocketMessagePayload {
  id: string;
  sessionId: string;
  identifier: string;
  platform: string;
  content: string;
  contentType: string;
  /** ISO 8601 string — Socket.io serializes Date to string on the wire */
  timestamp: string;
  sender: { type: 'customer' | 'bot' | 'agent'; name: string };
  status: string;
  isFromMe: boolean;
}

export interface SocketMessageUpdatePayload {
  id: string;
  status?: string;
}

export interface SocketChatUpdatePayload {
  id: string;
  lastMessage?: string;
  /** ISO 8601 string — Socket.io serializes Date to string on the wire */
  lastMessageTime?: string;
  unreadCount?: number;
}

export interface SocketSessionStatusPayload {
  sessionId: string;
  status: 'connected' | 'disconnected' | 'qr_required' | 'loading';
  qrCode?: string;
}

/** All server→client event names and their payloads */
export interface ServerSocketEventMap {
  'message:new': SocketMessagePayload;
  'message:update': SocketMessageUpdatePayload;
  'chat:update': SocketChatUpdatePayload;
  'typing:start': { chatId: string; identifier?: string; platform?: string };
  'typing:stop': { chatId: string; identifier?: string; platform?: string };
  'session:status': SocketSessionStatusPayload;
}
