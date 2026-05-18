/**
 * Socket.io Payload Builders
 *
 * Converts RoutableEvent data into typed payloads for the dashboard's
 * SocketEventMap. Extraction helpers imported from shared utils/eventData.ts.
 */

import { RoutableEvent } from '../types/routing';
import { extractFromMe, extractMessageBody } from './eventData';
import type {
  SocketMessagePayload,
  SocketMessageUpdatePayload,
  SocketSessionStatusPayload,
} from '../types/socket';

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

/** Map a wwebjs-api message_create event to a dashboard-compatible Message */
export function toSocketMessage(event: RoutableEvent): SocketMessagePayload {
  const data = event.data;
  const fromMe = extractFromMe(data);
  const body = extractMessageBody(data);
  const messageId = (data.id as Record<string, unknown>)?._serialized as string
    || (data.id as string)
    || `${event.sessionId}-${Date.now()}`;
  const hasMedia = Boolean(data.hasMedia);
  const mediaType = (data.type as string) || 'chat';

  return {
    id: messageId,
    sessionId: event.sessionId,
    identifier: event.identifier,
    platform: event.platform,
    content: body,
    contentType: hasMedia ? mediaType : 'text',
    timestamp: new Date(event.receivedAt || Date.now()).toISOString(),
    sender: {
      type: fromMe ? 'bot' : 'customer',
      name: fromMe ? 'Bot' : ((data.notifyName as string) || event.identifier),
    },
    status: fromMe ? 'sent' : 'delivered',
    isFromMe: fromMe,
  };
}

/** Map a message_ack event to an update payload */
export function toSocketMessageUpdate(event: RoutableEvent): SocketMessageUpdatePayload | null {
  const data = event.data;
  const messageId = (data.id as Record<string, unknown>)?._serialized as string
    || (data.id as string);

  if (!messageId) return null;

  const ackValue = data.ack as number;
  const statusMap: Record<number, string> = {
    0: 'pending',
    1: 'sent',
    2: 'delivered',
    3: 'read',
    4: 'read', // played (for audio)
  };

  return {
    id: messageId,
    status: statusMap[ackValue] || 'sent',
  };
}

/** Map session-level events to a SessionStatus payload */
export function toSocketSessionStatus(
  event: RoutableEvent
): SocketSessionStatusPayload | null {
  const statusMap: Record<string, SocketSessionStatusPayload['status']> = {
    qr: 'qr_required',
    authenticated: 'loading',
    ready: 'connected',
    disconnected: 'disconnected',
    loading_screen: 'loading',
  };

  const status = statusMap[event.dataType];
  if (!status) return null;

  const payload: SocketSessionStatusPayload = {
    sessionId: event.sessionId,
    status,
  };

  // Include QR code data if present
  if (event.dataType === 'qr' && typeof event.data.qr === 'string') {
    payload.qrCode = event.data.qr;
  }

  return payload;
}
