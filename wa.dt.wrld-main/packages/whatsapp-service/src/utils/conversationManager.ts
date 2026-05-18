/**
 * Conversation Assignment Manager
 *
 * Tracks which conversations are assigned to which agents.
 * Used for HITL (Human-in-the-Loop) agent takeover functionality.
 */

import mongoose, { Schema, Document } from 'mongoose';
import { getErrorMessage } from '../types/webhook';
import { WhatsAppPlatform } from '../utils/phoneNumber';

/** Conversation assignment status */
export type ConversationStatus = 'active' | 'released';

// Conversation assignment document interface
interface IConversationAssignment extends Document {
  identifier: string;       // Phone number or group ID (e.g., "254722833440")
  platform: string;         // WhatsApp suffix: "c.us", "g.us", "lid"
  assignedTo: string | null; // Agent ID (agentId from auth context), null when released
  claimedAt: Date;          // When the conversation was claimed
  releasedAt?: Date;        // When the conversation was released (if applicable)
  status: ConversationStatus; // 'active' when assigned, 'released' when not
  createdAt: Date;
  updatedAt: Date;
}

/** Conversation assignment response type for API responses */
export interface ConversationAssignmentResponse {
  identifier: string;
  platform: WhatsAppPlatform;
  assignedTo: string | null;
  claimedAt: string;
  releasedAt?: string;
  status: ConversationStatus;
}

// Conversation assignment schema
const conversationAssignmentSchema = new Schema<IConversationAssignment>({
  identifier: { type: String, required: true, unique: true, index: true },
  platform: { type: String, required: true, default: 'c.us', enum: ['c.us', 'g.us', 'lid'] },
  assignedTo: { type: String, default: null, index: true },
  claimedAt: { type: Date, required: true },
  releasedAt: { type: Date },
  status: {
    type: String,
    enum: ['active', 'released'],
    default: 'active',
    index: true
  },
}, { timestamps: true });

// Compound index for querying active assignments by agent
conversationAssignmentSchema.index({ assignedTo: 1, status: 1 });

// Model
const ConversationAssignment = mongoose.model<IConversationAssignment>(
  'ConversationAssignment',
  conversationAssignmentSchema
);

/**
 * Conversation Manager
 *
 * Manages conversation assignments between agents and chats.
 */
export class ConversationManager {
  private isConnected = false;

  async init(mongoUri?: string): Promise<void> {
    if (this.isConnected) {
      return;
    }

    const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-service';

    try {
      await mongoose.connect(uri);
      this.isConnected = true;
      console.log('✅ ConversationManager connected to MongoDB');

      // Connection event handlers
      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected (ConversationManager)');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected (ConversationManager)');
        this.isConnected = true;
      });

      mongoose.connection.on('error', (error: Error) => {
        console.error('❌ MongoDB connection error (ConversationManager):', error);
        this.isConnected = false;
      });

    } catch (error: unknown) {
      console.error('Failed to connect to MongoDB (ConversationManager):', getErrorMessage(error));
      this.isConnected = false;
      throw error;
    }
  }

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('ConversationManager not initialized. Call init() first.');
    }
  }

  /**
   * Claim a conversation for an agent
   * @param identifier Phone number or group ID
   * @param platform WhatsApp platform suffix
   * @param agentId Agent identifier (from auth context)
   * @returns Conversation assignment details
   */
  async claimChat(identifier: string, platform: WhatsAppPlatform, agentId: string): Promise<ConversationAssignmentResponse> {
    this.ensureConnected();

    try {
      const now = new Date();

      const assignment = await ConversationAssignment.findOneAndUpdate(
        { identifier },
        {
          identifier,
          platform,
          assignedTo: agentId,
          claimedAt: now,
          status: 'active',
          $unset: { releasedAt: '' }, // Remove releasedAt when claiming
        },
        { upsert: true, new: true }
      );

      console.log(`Chat ${identifier} claimed by agent ${agentId}`);

      return {
        identifier: assignment.identifier,
        platform: assignment.platform as WhatsAppPlatform,
        assignedTo: assignment.assignedTo,
        claimedAt: assignment.claimedAt.toISOString(),
        status: assignment.status,
      };
    } catch (error: unknown) {
      console.error('Error claiming chat:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Release a conversation back to automation
   * @param identifier Phone number or group ID
   * @returns Conversation assignment details
   */
  async releaseChat(identifier: string): Promise<ConversationAssignmentResponse> {
    this.ensureConnected();

    try {
      const now = new Date();

      const assignment = await ConversationAssignment.findOneAndUpdate(
        { identifier },
        {
          assignedTo: null,
          releasedAt: now,
          status: 'released',
        },
        { new: true }
      );

      if (!assignment) {
        throw new Error(`No assignment found for chat ${identifier}`);
      }

      console.log(`Chat ${identifier} released back to automation`);

      return {
        identifier: assignment.identifier,
        platform: assignment.platform as WhatsAppPlatform,
        assignedTo: assignment.assignedTo,
        claimedAt: assignment.claimedAt.toISOString(),
        releasedAt: assignment.releasedAt?.toISOString(),
        status: assignment.status,
      };
    } catch (error: unknown) {
      console.error('Error releasing chat:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Get all conversations assigned to an agent (or all assigned conversations)
   * @param agentId Optional agent identifier. If not provided, returns all active assignments.
   * @returns Array of conversation assignments
   */
  async getAssignedChats(agentId?: string): Promise<ConversationAssignmentResponse[]> {
    this.ensureConnected();

    try {
      const query: Record<string, unknown> = { status: 'active' };

      if (agentId) {
        query.assignedTo = agentId;
      }

      const assignments = await ConversationAssignment.find(query).lean();

      return assignments.map(a => ({
        identifier: a.identifier,
        platform: a.platform as WhatsAppPlatform,
        assignedTo: a.assignedTo,
        claimedAt: a.claimedAt.toISOString(),
        releasedAt: a.releasedAt?.toISOString(),
        status: a.status,
      }));
    } catch (error: unknown) {
      console.error('Error getting assigned chats:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Check if a chat is assigned to an agent
   * @param identifier Phone number or group ID
   * @param agentId Optional agent identifier. If provided, checks if assigned to this specific agent.
   * @returns True if assigned (to the specified agent if provided), false otherwise
   */
  async isAssignedTo(identifier: string, agentId?: string): Promise<boolean> {
    this.ensureConnected();

    try {
      const query: Record<string, unknown> = {
        identifier,
        status: 'active',
      };

      if (agentId) {
        query.assignedTo = agentId;
      } else {
        // Check if assigned to anyone (assignedTo is not null)
        query.assignedTo = { $ne: null };
      }

      const assignment = await ConversationAssignment.findOne(query).lean();

      return assignment !== null;
    } catch (error: unknown) {
      console.error('Error checking assignment:', getErrorMessage(error));
      return false;
    }
  }

  /**
   * Get assignment details for a specific chat
   * @param identifier Phone number or group ID
   * @returns Conversation assignment details or null if not found
   */
  async getAssignment(identifier: string): Promise<ConversationAssignmentResponse | null> {
    this.ensureConnected();

    try {
      const assignment = await ConversationAssignment.findOne({ identifier }).lean();

      if (!assignment) {
        return null;
      }

      return {
        identifier: assignment.identifier,
        platform: assignment.platform as WhatsAppPlatform,
        assignedTo: assignment.assignedTo,
        claimedAt: assignment.claimedAt.toISOString(),
        releasedAt: assignment.releasedAt?.toISOString(),
        status: assignment.status,
      };
    } catch (error: unknown) {
      console.error('Error getting assignment:', getErrorMessage(error));
      return null;
    }
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    if (this.isConnected) {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('ConversationManager MongoDB connection closed');
    }
  }
}

// Singleton instance
export const conversationManager = new ConversationManager();
