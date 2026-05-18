/**
 * Event Normalizer Utility
 *
 * Provides type-safe event ID extraction for deduplication across different
 * WhatsApp event types (messages, edits, reactions, receipts).
 *
 * Handles:
 * - Regular messages (message_create, message)
 * - Message edits (message_edit)
 * - Message reactions (message_reaction)
 * - Delivery receipts (message_ack, message_revoke)
 */

/**
 * Supported event types for normalization
 */
export type NormalizedEventType =
  | 'message'
  | 'message_edit'
  | 'message_reaction'
  | 'message_ack'
  | 'message_revoke'
  | 'unknown';

/**
 * Normalized event representation for deduplication
 */
export interface NormalizedEvent {
  /** Unique event identifier for deduplication */
  eventId: string;
  /** Normalized event type */
  eventType: NormalizedEventType;
  /** User identifier (phone number or group ID) */
  identifier: string;
  /** Original message ID (for edits/reactions/acks) */
  relatedMessageId?: string;
  /** ISO timestamp when event occurred */
  timestamp: string;
  /** Raw event data for debugging */
  rawData: Record<string, unknown>;
}

/**
 * Message event data structure
 */
interface MessageEventData {
  id?: string | { _serialized?: string };
  from?: string;
  to?: string;
  body?: string;
  timestamp?: number;
  fromMe?: boolean;
  [key: string]: unknown;
}

/**
 * Message edit event data structure
 */
interface MessageEditEventData {
  id?: string | { _serialized?: string };
  editedMessage?: {
    id?: string | { _serialized?: string };
    body?: string;
    timestamp?: number;
  };
  from?: string;
  to?: string;
  [key: string]: unknown;
}

/**
 * Message reaction event data structure
 */
interface MessageReactionEventData {
  id?: string | { _serialized?: string };
  reaction?: {
    text?: string;
    messageId?: string | { _serialized?: string };
  };
  from?: string;
  to?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/**
 * Message acknowledgment (receipt) event data structure
 */
interface MessageAckEventData {
  id?: string | { _serialized?: string };
  ack?: number;
  from?: string;
  to?: string;
  timestamp?: number;
  [key: string]: unknown;
}

/**
 * Event Normalizer Service
 *
 * Extracts unique identifiers from WhatsApp events for reliable deduplication.
 */
export class EventNormalizer {
  /**
   * Normalize an event into a standardized format for deduplication
   *
   * @param dataType - Event type from WhatsApp (e.g., 'message_create', 'message_edit')
   * @param data - Raw event data
   * @param identifier - User identifier (phone number or group ID)
   * @returns Normalized event with unique ID
   */
  normalize(
    dataType: string,
    data: Record<string, unknown>,
    identifier: string
  ): NormalizedEvent {
    // Determine normalized event type
    const eventType = this.normalizeEventType(dataType);

    // Extract event ID based on type
    const eventId = this.extractEventId(eventType, data, identifier);

    // Extract related message ID (for edits, reactions, acks)
    const relatedMessageId = this.extractRelatedMessageId(eventType, data);

    // Generate timestamp
    const timestamp = this.extractTimestamp(data);

    return {
      eventId,
      eventType,
      identifier,
      relatedMessageId,
      timestamp,
      rawData: data,
    };
  }

  /**
   * Normalize dataType into standardized event type
   */
  private normalizeEventType(dataType: string): NormalizedEventType {
    const normalized = dataType.toLowerCase().trim();

    if (normalized === 'message' || normalized === 'message_create') {
      return 'message';
    }

    if (normalized === 'message_edit') {
      return 'message_edit';
    }

    if (normalized === 'message_reaction') {
      return 'message_reaction';
    }

    if (normalized === 'message_ack') {
      return 'message_ack';
    }

    if (normalized === 'message_revoke') {
      return 'message_revoke';
    }

    return 'unknown';
  }

  /**
   * Extract unique event ID based on event type
   */
  private extractEventId(
    eventType: NormalizedEventType,
    data: Record<string, unknown>,
    identifier: string
  ): string {
    switch (eventType) {
      case 'message':
        return this.extractMessageId(data as MessageEventData);

      case 'message_edit':
        return this.extractEditId(data as MessageEditEventData);

      case 'message_reaction':
        return this.extractReactionId(data as MessageReactionEventData);

      case 'message_ack':
      case 'message_revoke':
        return this.extractAckId(data as MessageAckEventData);

      case 'unknown':
      default:
        // Fallback: hash-based ID for unknown event types
        return this.generateFallbackId(identifier, data);
    }
  }

  /**
   * Extract message ID from regular message events
   */
  private extractMessageId(data: MessageEventData): string {
    // Try different locations where message ID might be
    if (typeof data.id === 'string') {
      return data.id;
    }

    if (typeof data.id === 'object' && data.id?._serialized) {
      return data.id._serialized;
    }

    // Fallback: construct from available fields
    const from = data.from || 'unknown';
    const timestamp = data.timestamp || Date.now();
    const bodyHash = this.hashString(data.body || '');

    return `msg:${from}:${timestamp}:${bodyHash}`;
  }

  /**
   * Extract edit ID from message edit events
   */
  private extractEditId(data: MessageEditEventData): string {
    // Edit events should have a unique ID
    if (typeof data.id === 'string') {
      return `edit:${data.id}`;
    }

    if (typeof data.id === 'object' && data.id?._serialized) {
      return `edit:${data.id._serialized}`;
    }

    // Try edited message ID
    const editedMsg = data.editedMessage;
    if (editedMsg) {
      if (typeof editedMsg.id === 'string') {
        return `edit:${editedMsg.id}:${editedMsg.timestamp || Date.now()}`;
      }

      if (typeof editedMsg.id === 'object' && editedMsg.id?._serialized) {
        return `edit:${editedMsg.id._serialized}:${editedMsg.timestamp || Date.now()}`;
      }
    }

    // Fallback
    const from = data.from || 'unknown';
    const timestamp = Date.now();
    return `edit:${from}:${timestamp}`;
  }

  /**
   * Extract reaction ID from message reaction events
   */
  private extractReactionId(data: MessageReactionEventData): string {
    const reaction = data.reaction;

    if (!reaction) {
      return this.generateFallbackId('reaction', data);
    }

    // Reaction ID = message ID + reactor ID + reaction text
    let messageId = 'unknown';
    if (typeof reaction.messageId === 'string') {
      messageId = reaction.messageId;
    } else if (typeof reaction.messageId === 'object' && reaction.messageId?._serialized) {
      messageId = reaction.messageId._serialized;
    }

    const from = data.from || 'unknown';
    const text = reaction.text || '';

    return `reaction:${messageId}:${from}:${text}`;
  }

  /**
   * Extract acknowledgment ID from receipt events
   */
  private extractAckId(data: MessageAckEventData): string {
    // Ack events reference the original message
    if (typeof data.id === 'string') {
      return `ack:${data.id}:${data.ack || 0}`;
    }

    if (typeof data.id === 'object' && data.id?._serialized) {
      return `ack:${data.id._serialized}:${data.ack || 0}`;
    }

    // Fallback
    const from = data.from || 'unknown';
    const timestamp = data.timestamp || Date.now();
    return `ack:${from}:${timestamp}`;
  }

  /**
   * Extract related message ID (for edits, reactions, acks)
   */
  private extractRelatedMessageId(
    eventType: NormalizedEventType,
    data: Record<string, unknown>
  ): string | undefined {
    switch (eventType) {
      case 'message_edit': {
        const editData = data as MessageEditEventData;
        if (typeof editData.id === 'string') {
          return editData.id;
        }
        if (typeof editData.id === 'object' && editData.id?._serialized) {
          return editData.id._serialized;
        }
        break;
      }

      case 'message_reaction': {
        const reactionData = data as MessageReactionEventData;
        const reaction = reactionData.reaction;
        if (reaction) {
          if (typeof reaction.messageId === 'string') {
            return reaction.messageId;
          }
          if (typeof reaction.messageId === 'object' && reaction.messageId?._serialized) {
            return reaction.messageId._serialized;
          }
        }
        break;
      }

      case 'message_ack':
      case 'message_revoke': {
        const ackData = data as MessageAckEventData;
        if (typeof ackData.id === 'string') {
          return ackData.id;
        }
        if (typeof ackData.id === 'object' && ackData.id?._serialized) {
          return ackData.id._serialized;
        }
        break;
      }

      default:
        return undefined;
    }

    return undefined;
  }

  /**
   * Extract timestamp from event data
   */
  private extractTimestamp(data: Record<string, unknown>): string {
    // Try to extract timestamp from event data
    const timestamp = data.timestamp;

    if (typeof timestamp === 'number') {
      // WhatsApp timestamps are usually in seconds, convert to ISO
      const ms = timestamp > 9999999999 ? timestamp : timestamp * 1000;
      return new Date(ms).toISOString();
    }

    if (typeof timestamp === 'string') {
      return timestamp;
    }

    // Fallback to current time
    return new Date().toISOString();
  }

  /**
   * Generate fallback ID for unknown event types
   */
  private generateFallbackId(
    prefix: string,
    data: Record<string, unknown>
  ): string {
    // Create a stable hash from the data
    const dataString = JSON.stringify(data);
    const hash = this.hashString(dataString);
    const timestamp = Date.now();

    return `${prefix}:${hash}:${timestamp}`;
  }

  /**
   * Simple string hashing for ID generation
   * (Not cryptographic - just for deduplication)
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Singleton instance for convenience
 */
export const eventNormalizer = new EventNormalizer();
