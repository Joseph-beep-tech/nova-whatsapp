/**
 * MongoDB-based State Manager
 *
 * Stores lightweight application state (webhook registrations, config, etc.)
 * For WhatsApp session data, use whatsapp-api (shares volume).
 */

import mongoose, { Schema, Document } from 'mongoose';
import { getErrorMessage } from '../types/webhook';
import { UserLearningData, ModuleProgress, ModuleStatus } from '../types/learning';
import { TagConfiguration } from '../types/routing';
import { ConversationSummary, SummaryEntry } from '../types/memory';
import { eventQueue, QueuedEvent } from '../services/eventQueue';
import { WhatsAppPlatform, DEFAULT_PLATFORM } from '../utils/phoneNumber';

/** Config value can be any JSON-serializable value */
export type ConfigValue = string | number | boolean | null | unknown[] | Record<string, unknown>;

// Webhook document interface
interface IWebhook extends Document {
  sessionId: string;
  url: string;
  events: string[];
  registeredAt: Date;
}

// Config document interface
interface IConfig extends Document {
  key: string;
  value: ConfigValue;
  updatedAt: Date;
}

/** Module progress stored in MongoDB */
interface IModuleProgress {
  moduleId: string | number;
  moduleName?: string;
  status: string;
  completedSections: string[];
  totalSections?: number;
  progressPercent: number;
  lastAccessedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

/** Per-tag learning data stored in MongoDB */
interface ILearningData {
  sourceCollection: {
    url: string;
    collectionName: string;
  };
  moduleProgress: Map<string, IModuleProgress>;
  currentModuleId?: string | number;
  overallProgress: number;
  totalInteractions: number;
  engagedTopics: string[];
  inferredLevel?: string;
  lastActivityAt: Date;
  context?: Record<string, unknown>;
}

// User document interface
interface IUser extends Document {
  identifier: string;       // Phone number or group ID: "254722833440"
  platform: string;         // WhatsApp suffix: "c.us", "g.us", "lid"
  name?: string;            // Contact name
  pushname?: string;        // WhatsApp display name
  tags: string[];           // Tags: ['SOMO', 'VIP', 'Lead']
  welcomedTags: string[];   // Tags that have sent welcome messages
  learningData?: Map<string, ILearningData>;  // Per-tag learning progress
  firstContactAt: Date;
  lastContactAt: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** User response type for API responses */
export interface UserResponse {
  identifier: string;
  platform: WhatsAppPlatform;
  name?: string;
  pushname?: string;
  tags: string[];
  welcomedTags: string[];
  learningData?: Record<string, UserLearningData>;  // Per-tag learning progress
  firstContactAt: string;
  lastContactAt: string;
  messageCount: number;
}

/** Result of registerUser operation */
export interface RegisterUserResult {
  user: UserResponse;
  isNew: boolean;       // true if user was just created
  newTags: string[];    // tags that were newly added (not previously present)
}

/** Conversation state response type for API responses */
export interface ConversationStateResponse {
  identifier: string;
  platform: WhatsAppPlatform;
  sessionId: string;
  handoffStatus: HandoffStatus;
  assignedAgent?: string;
  lastAgentActivity?: string;
  automationPaused: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Webhook schema
const webhookSchema = new Schema<IWebhook>({
  sessionId: { type: String, required: true, index: true },
  url: { type: String, required: true },
  events: { type: [String], required: true },
  registeredAt: { type: Date, default: Date.now },
});

// Compound index for sessionId + url uniqueness
webhookSchema.index({ sessionId: 1, url: 1 }, { unique: true });

// Config schema
const configSchema = new Schema<IConfig>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now },
});

// Module progress subdocument schema
const moduleProgressSchema = new Schema({
  moduleId: { type: Schema.Types.Mixed, required: true },
  moduleName: { type: String },
  status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
  completedSections: { type: [String], default: [] },
  totalSections: { type: Number },
  progressPercent: { type: Number, default: 0 },
  lastAccessedAt: { type: Date },
  completedAt: { type: Date },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

// Learning data subdocument schema
const learningDataSchema = new Schema({
  sourceCollection: {
    url: { type: String, required: true },
    collectionName: { type: String, required: true },
  },
  moduleProgress: { type: Map, of: moduleProgressSchema, default: new Map() },
  currentModuleId: { type: Schema.Types.Mixed },
  overallProgress: { type: Number, default: 0 },
  totalInteractions: { type: Number, default: 0 },
  engagedTopics: { type: [String], default: [] },
  inferredLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
  lastActivityAt: { type: Date, default: Date.now },
  context: { type: Schema.Types.Mixed },
}, { _id: false });

// User schema
const userSchema = new Schema<IUser>({
  identifier: { type: String, required: true, unique: true },
  platform: { type: String, required: true, default: 'c.us', enum: ['c.us', 'g.us', 'lid'] },
  name: { type: String },
  pushname: { type: String },
  tags: { type: [String], default: [], index: true },  // Multi-key index for tag queries
  welcomedTags: { type: [String], default: [] },       // Tags that have sent welcome messages
  learningData: { type: Map, of: learningDataSchema }, // Per-tag learning progress
  firstContactAt: { type: Date, default: Date.now },
  lastContactAt: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 1 },
}, { timestamps: true });

// =============================================================================
// Conversation State Schema
// =============================================================================

/** Handoff status values */
export type HandoffStatus = 'automated' | 'requested' | 'active' | 'resolved';

/** Conversation state document interface */
interface IConversationState extends Document {
  identifier: string;
  platform: string;
  sessionId: string;
  handoffStatus: HandoffStatus;
  assignedAgent?: string;
  lastAgentActivity?: Date;
  automationPaused: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Conversation state schema
const conversationStateSchema = new Schema<IConversationState>({
  identifier: { type: String, required: true, index: true },
  platform: { type: String, required: true, default: 'c.us', enum: ['c.us', 'g.us', 'lid'] },
  sessionId: { type: String, required: true, index: true },
  handoffStatus: {
    type: String,
    enum: ['automated', 'requested', 'active', 'resolved'],
    default: 'automated',
    required: true
  },
  assignedAgent: { type: String },
  lastAgentActivity: { type: Date },
  automationPaused: { type: Boolean, default: false, required: true },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

// Compound index for efficient queries by identifier + platform + sessionId
conversationStateSchema.index({ identifier: 1, platform: 1, sessionId: 1 }, { unique: true });

// =============================================================================
// Conversation Summary Schema
// =============================================================================

/** Summary entry subdocument stored in MongoDB */
interface ISummaryEntry {
  timestamp: Date;
  text: string;
  messageCount: number;
  sourceMessageIds: string[];
  topics: string[];
}

/** Conversation summary document interface */
interface IConversationSummary extends Document {
  identifier: string;
  platform: string;
  sessionId: string;
  tag: string;
  date: string;  // YYYY-MM-DD format
  entries: ISummaryEntry[];
  totalMessagesSummarized: number;
  createdAt: Date;
  updatedAt: Date;
}

// Summary entry subdocument schema
const summaryEntrySchema = new Schema({
  timestamp: { type: Date, required: true },
  text: { type: String, required: true },
  messageCount: { type: Number, required: true },
  sourceMessageIds: { type: [String], default: [] },
  topics: { type: [String], default: [] },
}, { _id: false });

// Conversation summary schema
const conversationSummarySchema = new Schema<IConversationSummary>({
  identifier: { type: String, required: true, index: true },
  platform: { type: String, required: true, default: 'c.us', enum: ['c.us', 'g.us', 'lid'] },
  sessionId: { type: String, required: true, index: true },
  tag: { type: String, required: true, index: true },
  date: { type: String, required: true },  // YYYY-MM-DD
  entries: { type: [summaryEntrySchema], default: [] },
  totalMessagesSummarized: { type: Number, default: 0 },
}, { timestamps: true });

// Compound indexes for efficient queries
conversationSummarySchema.index({ identifier: 1, date: -1 });
conversationSummarySchema.index({ sessionId: 1, date: -1 });
conversationSummarySchema.index({ identifier: 1, tag: 1, date: -1 });

// Models
const Webhook = mongoose.model<IWebhook>('Webhook', webhookSchema);
const Config = mongoose.model<IConfig>('Config', configSchema);
const User = mongoose.model<IUser>('User', userSchema);
const ConversationState = mongoose.model<IConversationState>('ConversationState', conversationStateSchema);
const ConversationSummaryModel = mongoose.model<IConversationSummary>('ConversationSummary', conversationSummarySchema);

class StateManager {
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.isConnected) {
      console.log('State manager already initialized');
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.connect();
    await this.connectionPromise;
  }

  private async connect(): Promise<void> {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/whatsapp-service';

      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      console.log('✅ MongoDB connected successfully');

      // Handle connection events
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected');
        this.isConnected = true;
      });

      mongoose.connection.on('error', (error: Error) => {
        console.error('❌ MongoDB connection error:', error);
        this.isConnected = false;
      });

    } catch (error: unknown) {
      console.error('Failed to connect to MongoDB:', getErrorMessage(error));
      this.isConnected = false;
      throw error;
    }
  }

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('State manager not initialized. Call init() first.');
    }
  }

  // Webhook management
  async registerWebhook(sessionId: string, url: string, events: string[]): Promise<void> {
    this.ensureConnected();

    try {
      // Upsert: update if exists, insert if not
      await Webhook.findOneAndUpdate(
        { sessionId, url },
        {
          sessionId,
          url,
          events,
          registeredAt: new Date(),
        },
        { upsert: true, new: true }
      );

      console.log(`Webhook registered for session ${sessionId}: ${url}`);
    } catch (error: unknown) {
      console.error('Error registering webhook:', getErrorMessage(error));
      throw error;
    }
  }

  async unregisterWebhook(sessionId: string, url: string): Promise<void> {
    this.ensureConnected();

    try {
      await Webhook.deleteOne({ sessionId, url });
      console.log(`Webhook unregistered for session ${sessionId}: ${url}`);
    } catch (error: unknown) {
      console.error('Error unregistering webhook:', getErrorMessage(error));
      throw error;
    }
  }

  async getWebhooks(sessionId: string): Promise<Array<{
    url: string;
    events: string[];
    registeredAt: string;
  }>> {
    this.ensureConnected();

    try {
      const webhooks = await Webhook.find({ sessionId }).lean();
      return webhooks.map(w => ({
        url: w.url,
        events: w.events,
        registeredAt: w.registeredAt.toISOString(),
      }));
    } catch (error: unknown) {
      console.error('Error getting webhooks:', getErrorMessage(error));
      return [];
    }
  }

  async getAllWebhooks(): Promise<Record<string, Array<{
    url: string;
    events: string[];
    registeredAt: string;
  }>>> {
    this.ensureConnected();

    try {
      const webhooks = await Webhook.find({}).lean();

      // Group by sessionId
      const grouped: Record<string, Array<{
        url: string;
        events: string[];
        registeredAt: string;
      }>> = {};

      webhooks.forEach(w => {
        if (!grouped[w.sessionId]) {
          grouped[w.sessionId] = [];
        }
        grouped[w.sessionId].push({
          url: w.url,
          events: w.events,
          registeredAt: w.registeredAt.toISOString(),
        });
      });

      return grouped;
    } catch (error: unknown) {
      console.error('Error getting all webhooks:', getErrorMessage(error));
      return {};
    }
  }

  // Config management
  async setConfig(key: string, value: ConfigValue): Promise<void> {
    this.ensureConnected();

    try {
      await Config.findOneAndUpdate(
        { key },
        {
          key,
          value,
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
    } catch (error: unknown) {
      console.error('Error setting config:', getErrorMessage(error));
      throw error;
    }
  }

  async getConfig<T extends ConfigValue = ConfigValue>(key: string, defaultValue?: T): Promise<T | undefined> {
    this.ensureConnected();

    try {
      const config = await Config.findOne({ key }).lean();
      return config ? (config.value as T) : defaultValue;
    } catch (error: unknown) {
      console.error('Error getting config:', getErrorMessage(error));
      return defaultValue;
    }
  }

  async getAllConfig(): Promise<Record<string, ConfigValue>> {
    this.ensureConnected();

    try {
      const configs = await Config.find({}).lean();
      const result: Record<string, ConfigValue> = {};
      configs.forEach(c => {
        result[c.key] = c.value;
      });
      return result;
    } catch (error: unknown) {
      console.error('Error getting all config:', getErrorMessage(error));
      return {};
    }
  }

  /**
   * Delete a config value by key
   * Returns true if deleted, false if not found
   */
  async deleteConfig(key: string): Promise<boolean> {
    this.ensureConnected();

    try {
      const result = await Config.deleteOne({ key });
      return result.deletedCount > 0;
    } catch (error: unknown) {
      console.error('Error deleting config:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Get all config keys matching a prefix
   */
  async getConfigsByPrefix(prefix: string): Promise<Record<string, ConfigValue>> {
    this.ensureConnected();

    try {
      const configs = await Config.find({ key: { $regex: `^${prefix}` } }).lean();
      const result: Record<string, ConfigValue> = {};
      configs.forEach(c => {
        result[c.key] = c.value;
      });
      return result;
    } catch (error: unknown) {
      console.error('Error getting configs by prefix:', getErrorMessage(error));
      return {};
    }
  }

  // ==========================================================================
  // User management
  // ==========================================================================

  /**
   * Register or update a user (upsert by identifier)
   * Adds tags without duplicates, increments messageCount, updates lastContactAt
   * Returns which tags were newly added (for welcome message triggering)
   */
  async registerUser(identifier: string, platform: WhatsAppPlatform = DEFAULT_PLATFORM, data: {
    name?: string;
    pushname?: string;
    tags?: string[];
  }): Promise<RegisterUserResult> {
    this.ensureConnected();

    try {
      const now = new Date();

      // First, get existing user to determine which tags are new
      const existingUser = await User.findOne({ identifier }).lean();
      const existingTags = existingUser?.tags || [];
      const requestedTags = data.tags || [];

      // Calculate which tags are genuinely new (not already present)
      const newTags = requestedTags.filter(tag => !existingTags.includes(tag));
      const isNew = !existingUser;

      // Build update object with $addToSet for tags (no duplicates)
      const updateObj: Record<string, unknown> = {
        $set: {
          platform,
          lastContactAt: now,
          ...(data.name && { name: data.name }),
          ...(data.pushname && { pushname: data.pushname }),
        },
        $setOnInsert: {
          identifier,
          firstContactAt: now,
        },
        $inc: { messageCount: 1 },
      };

      // Add tags without duplicates using $addToSet with $each
      if (requestedTags.length > 0) {
        updateObj.$addToSet = { tags: { $each: requestedTags } };
      }

      const user = await User.findOneAndUpdate(
        { identifier },
        updateObj,
        { upsert: true, new: true }
      ).lean();

      console.log(`User registered: ${identifier} with tags: [${user.tags.join(', ')}]${newTags.length > 0 ? ` (new: [${newTags.join(', ')}])` : ''}`);

      // Fire-and-forget ERPNext sync (no-op when disabled)
      import('../services/erpnextSync')
        .then(({ erpnextSync }) => {
          void erpnextSync.upsertContact(identifier, data.name || data.pushname || identifier, {
            platform: platform,
            tags: user.tags,
          });
        })
        .catch(() => { /* ERPNext sync import failed — ignore */ });

      return {
        user: {
          identifier: user.identifier,
          platform: user.platform as WhatsAppPlatform,
          name: user.name,
          pushname: user.pushname,
          tags: user.tags,
          welcomedTags: user.welcomedTags || [],
          firstContactAt: user.firstContactAt.toISOString(),
          lastContactAt: user.lastContactAt.toISOString(),
          messageCount: user.messageCount,
        },
        isNew,
        newTags,
      };
    } catch (error: unknown) {
      console.error('Error registering user:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Convert IUser lean document to UserResponse
   * Accepts both IUser documents and lean() results (FlattenMaps<IUser>)
   */
  private toUserResponse(u: Pick<IUser, 'identifier' | 'platform' | 'name' | 'pushname' | 'tags' | 'welcomedTags' | 'firstContactAt' | 'lastContactAt' | 'messageCount'>): UserResponse {
    return {
      identifier: u.identifier,
      platform: u.platform as WhatsAppPlatform,
      name: u.name,
      pushname: u.pushname,
      tags: u.tags,
      welcomedTags: u.welcomedTags || [],
      firstContactAt: u.firstContactAt.toISOString(),
      lastContactAt: u.lastContactAt.toISOString(),
      messageCount: u.messageCount,
    };
  }

  /**
   * Get all users
   */
  async getUsers(): Promise<UserResponse[]> {
    this.ensureConnected();

    try {
      const users = await User.find({}).sort({ lastContactAt: -1 }).lean();
      return users.map(u => this.toUserResponse(u));
    } catch (error: unknown) {
      console.error('Error getting users:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Get users filtered by tag
   */
  async getUsersByTag(tag: string): Promise<UserResponse[]> {
    this.ensureConnected();

    try {
      const users = await User.find({ tags: tag }).sort({ lastContactAt: -1 }).lean();
      return users.map(u => this.toUserResponse(u));
    } catch (error: unknown) {
      console.error('Error getting users by tag:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Get a single user by identifier
   */
  async getUser(identifier: string): Promise<UserResponse | null> {
    this.ensureConnected();

    try {
      const user = await User.findOne({ identifier }).lean();
      if (!user) return null;

      return this.toUserResponse(user);
    } catch (error: unknown) {
      console.error('Error getting user:', getErrorMessage(error));
      return null;
    }
  }

  /**
   * Add tags to a user (no duplicates)
   */
  async addTags(identifier: string, tags: string[]): Promise<UserResponse | null> {
    this.ensureConnected();

    try {
      const user = await User.findOneAndUpdate(
        { identifier },
        { $addToSet: { tags: { $each: tags } } },
        { new: true }
      ).lean();

      if (!user) return null;

      console.log(`Tags added to ${identifier}: [${tags.join(', ')}]`);

      return this.toUserResponse(user);
    } catch (error: unknown) {
      console.error('Error adding tags:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Remove tags from a user
   */
  async removeTags(identifier: string, tags: string[]): Promise<UserResponse | null> {
    this.ensureConnected();

    try {
      const user = await User.findOneAndUpdate(
        { identifier },
        { $pull: { tags: { $in: tags } } },
        { new: true }
      ).lean();

      if (!user) return null;

      console.log(`Tags removed from ${identifier}: [${tags.join(', ')}]`);

      return this.toUserResponse(user);
    } catch (error: unknown) {
      console.error('Error removing tags:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Get all unique tags across all users
   */
  async getAllTags(): Promise<string[]> {
    this.ensureConnected();

    try {
      const result = await User.distinct('tags');
      return result.sort();
    } catch (error: unknown) {
      console.error('Error getting all tags:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Mark a tag as welcomed for a user (welcome message has been sent)
   */
  async markTagWelcomed(identifier: string, tag: string): Promise<UserResponse | null> {
    this.ensureConnected();

    try {
      const user = await User.findOneAndUpdate(
        { identifier },
        { $addToSet: { welcomedTags: tag } },
        { new: true }
      ).lean();

      if (!user) return null;

      console.log(`Tag '${tag}' marked as welcomed for ${identifier}`);

      return this.toUserResponse(user);
    } catch (error: unknown) {
      console.error('Error marking tag as welcomed:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Check if a tag has been welcomed for a user
   */
  async isTagWelcomed(identifier: string, tag: string): Promise<boolean> {
    this.ensureConnected();

    try {
      const user = await User.findOne({ identifier }).lean();
      return user?.welcomedTags?.includes(tag) || false;
    } catch (error: unknown) {
      console.error('Error checking if tag welcomed:', getErrorMessage(error));
      return false;
    }
  }

  // ==========================================================================
  // Learning data management
  // ==========================================================================

  /**
   * Convert MongoDB learning data to API response format
   */
  private convertLearningDataToResponse(
    tag: string,
    data: ILearningData
  ): UserLearningData {
    const moduleProgress: Record<string, ModuleProgress> = {};

    if (data.moduleProgress) {
      // Handle both Map and plain object (from lean() queries)
      const entries: [string, IModuleProgress][] = data.moduleProgress instanceof Map
        ? Array.from(data.moduleProgress.entries())
        : Object.entries(data.moduleProgress) as [string, IModuleProgress][];

      for (const [key, mp] of entries) {
        moduleProgress[key] = {
          moduleId: mp.moduleId,
          moduleName: mp.moduleName,
          status: mp.status as ModuleStatus,
          completedSections: mp.completedSections || [],
          totalSections: mp.totalSections,
          progressPercent: mp.progressPercent || 0,
          lastAccessedAt: mp.lastAccessedAt?.toISOString?.() || (mp.lastAccessedAt as unknown as string),
          completedAt: mp.completedAt?.toISOString?.() || (mp.completedAt as unknown as string),
          metadata: mp.metadata,
        };
      }
    }

    return {
      tag,
      sourceCollection: {
        url: data.sourceCollection?.url || '',
        collectionName: data.sourceCollection?.collectionName || '',
      },
      moduleProgress,
      currentModuleId: data.currentModuleId,
      overallProgress: data.overallProgress || 0,
      totalInteractions: data.totalInteractions || 0,
      engagedTopics: data.engagedTopics || [],
      inferredLevel: data.inferredLevel as 'beginner' | 'intermediate' | 'advanced' | undefined,
      lastActivityAt: data.lastActivityAt?.toISOString?.() || new Date().toISOString(),
      context: data.context,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get learning data for a user and tag
   */
  async getLearningData(identifier: string, tag: string): Promise<UserLearningData | null> {
    this.ensureConnected();

    try {
      const user = await User.findOne({ identifier }).lean();
      if (!user) return null;

      const learningDataMap = user.learningData as unknown as Record<string, ILearningData> | undefined;
      if (!learningDataMap || !learningDataMap[tag]) return null;

      return this.convertLearningDataToResponse(tag, learningDataMap[tag]);
    } catch (error: unknown) {
      console.error('Error getting learning data:', getErrorMessage(error));
      return null;
    }
  }

  /**
   * Initialize learning data for a user and tag
   * Uses TagConfiguration.lms to set up the structure
   */
  async initializeLearningData(identifier: string, tagConfig: TagConfiguration): Promise<UserLearningData> {
    this.ensureConnected();

    const tag = tagConfig.tag;
    const now = new Date();

    const initialData: ILearningData = {
      sourceCollection: {
        url: tagConfig.lms?.contentCollection.url || '',
        collectionName: tagConfig.lms?.contentCollection.collectionName || '',
      },
      moduleProgress: new Map(),
      overallProgress: 0,
      totalInteractions: 0,
      engagedTopics: [],
      lastActivityAt: now,
    };

    try {
      await User.findOneAndUpdate(
        { identifier },
        { $set: { [`learningData.${tag}`]: initialData } },
        { new: true }
      );

      console.log(`Learning data initialized for ${identifier} in ${tag}`);

      return this.convertLearningDataToResponse(tag, initialData);
    } catch (error: unknown) {
      console.error('Error initializing learning data:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Update learning progress for a user and tag
   */
  async updateLearningProgress(
    identifier: string,
    tag: string,
    update: {
      moduleId?: string | number;
      sectionCompleted?: string;
      moduleCompleted?: boolean;
      currentModuleId?: string | number;
      metadata?: Record<string, unknown>;
      context?: Record<string, unknown>;
    }
  ): Promise<UserLearningData | null> {
    this.ensureConnected();

    try {
      const now = new Date();
      const updateObj: Record<string, unknown> = {
        [`learningData.${tag}.lastActivityAt`]: now,
      };

      // Update current module
      if (update.currentModuleId !== undefined) {
        updateObj[`learningData.${tag}.currentModuleId`] = update.currentModuleId;
      }

      // Update module progress
      if (update.moduleId !== undefined) {
        const moduleKey = String(update.moduleId);

        updateObj[`learningData.${tag}.moduleProgress.${moduleKey}.moduleId`] = update.moduleId;
        updateObj[`learningData.${tag}.moduleProgress.${moduleKey}.lastAccessedAt`] = now;
        updateObj[`learningData.${tag}.moduleProgress.${moduleKey}.status`] = 'in_progress';

        // Mark section as completed
        if (update.sectionCompleted) {
          await User.findOneAndUpdate(
            { identifier },
            {
              $addToSet: {
                [`learningData.${tag}.moduleProgress.${moduleKey}.completedSections`]: update.sectionCompleted,
                [`learningData.${tag}.engagedTopics`]: update.sectionCompleted,
              },
            }
          );
        }

        // Mark module as completed
        if (update.moduleCompleted) {
          updateObj[`learningData.${tag}.moduleProgress.${moduleKey}.status`] = 'completed';
          updateObj[`learningData.${tag}.moduleProgress.${moduleKey}.completedAt`] = now;
          updateObj[`learningData.${tag}.moduleProgress.${moduleKey}.progressPercent`] = 100;
        }

        // Merge metadata
        if (update.metadata) {
          for (const [key, value] of Object.entries(update.metadata)) {
            updateObj[`learningData.${tag}.moduleProgress.${moduleKey}.metadata.${key}`] = value;
          }
        }
      }

      // Merge context
      if (update.context) {
        for (const [key, value] of Object.entries(update.context)) {
          updateObj[`learningData.${tag}.context.${key}`] = value;
        }
      }

      const user = await User.findOneAndUpdate(
        { identifier },
        { $set: updateObj },
        { new: true }
      ).lean();

      if (!user) return null;

      const learningDataMap = user.learningData as unknown as Record<string, ILearningData> | undefined;
      if (!learningDataMap || !learningDataMap[tag]) return null;

      // Recalculate overall progress
      const data = learningDataMap[tag];
      await this.recalculateOverallProgress(identifier, tag, data);

      // Fetch updated data
      const updatedUser = await User.findOne({ identifier }).lean();
      const updatedLearningData = (updatedUser?.learningData as unknown as Record<string, ILearningData>)?.[tag];

      if (!updatedLearningData) return null;

      console.log(`Learning progress updated for ${identifier} in ${tag}`);
      return this.convertLearningDataToResponse(tag, updatedLearningData);
    } catch (error: unknown) {
      console.error('Error updating learning progress:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Recalculate overall progress percentage
   */
  private async recalculateOverallProgress(
    identifier: string,
    tag: string,
    data: ILearningData
  ): Promise<void> {
    if (!data.moduleProgress) return;

    const entries: IModuleProgress[] = data.moduleProgress instanceof Map
      ? Array.from(data.moduleProgress.values())
      : Object.values(data.moduleProgress) as IModuleProgress[];

    if (entries.length === 0) return;

    const totalProgress = entries.reduce((sum: number, mp: IModuleProgress) => sum + (mp.progressPercent || 0), 0);
    const overallProgress = Math.round(totalProgress / entries.length);

    await User.findOneAndUpdate(
      { identifier },
      { $set: { [`learningData.${tag}.overallProgress`]: overallProgress } }
    );
  }

  /**
   * Track a learning interaction (increments totalInteractions and adds topic)
   */
  async trackLearningInteraction(
    identifier: string,
    tag: string,
    moduleId: string | number,
    sectionTitle: string
  ): Promise<void> {
    this.ensureConnected();

    try {
      const now = new Date();
      const moduleKey = String(moduleId);

      await User.findOneAndUpdate(
        { identifier },
        {
          $inc: { [`learningData.${tag}.totalInteractions`]: 1 },
          $set: {
            [`learningData.${tag}.lastActivityAt`]: now,
            [`learningData.${tag}.moduleProgress.${moduleKey}.lastAccessedAt`]: now,
            [`learningData.${tag}.moduleProgress.${moduleKey}.moduleId`]: moduleId,
            [`learningData.${tag}.moduleProgress.${moduleKey}.status`]: 'in_progress',
            [`learningData.${tag}.currentModuleId`]: moduleId,
          },
          $addToSet: {
            [`learningData.${tag}.engagedTopics`]: sectionTitle,
          },
        }
      );

      console.log(`Learning interaction tracked for ${identifier}: ${tag}/${moduleId}/${sectionTitle}`);
    } catch (error: unknown) {
      console.error('Error tracking learning interaction:', getErrorMessage(error));
    }
  }

  // ==========================================================================
  // Conversation Summary management
  // ==========================================================================

  /**
   * Convert MongoDB summary to API response format
   */
  private convertSummaryToResponse(doc: IConversationSummary): ConversationSummary {
    return {
      id: doc._id.toString(),
      identifier: doc.identifier,
      platform: doc.platform as WhatsAppPlatform,
      sessionId: doc.sessionId,
      tag: doc.tag,
      date: doc.date,
      entries: doc.entries.map(e => ({
        timestamp: e.timestamp.toISOString(),
        text: e.text,
        messageCount: e.messageCount,
        sourceMessageIds: e.sourceMessageIds,
        topics: e.topics,
      })),
      totalMessagesSummarized: doc.totalMessagesSummarized,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new conversation summary for a date
   */
  async createSummary(data: {
    identifier: string;
    platform: WhatsAppPlatform;
    sessionId: string;
    tag: string;
    date?: string;  // Defaults to today
    initialEntry?: Omit<SummaryEntry, 'timestamp'> & { timestamp?: string };
  }): Promise<ConversationSummary> {
    this.ensureConnected();

    const date = data.date || new Date().toISOString().split('T')[0];
    const now = new Date();

    try {
      const entries: ISummaryEntry[] = [];

      if (data.initialEntry) {
        entries.push({
          timestamp: data.initialEntry.timestamp ? new Date(data.initialEntry.timestamp) : now,
          text: data.initialEntry.text,
          messageCount: data.initialEntry.messageCount,
          sourceMessageIds: data.initialEntry.sourceMessageIds,
          topics: data.initialEntry.topics,
        });
      }

      const summary = await ConversationSummaryModel.create({
        identifier: data.identifier,
        platform: data.platform,
        sessionId: data.sessionId,
        tag: data.tag,
        date,
        entries,
        totalMessagesSummarized: data.initialEntry?.messageCount || 0,
      });

      console.log(`Conversation summary created for ${data.identifier} on ${date}`);
      return this.convertSummaryToResponse(summary);
    } catch (error: unknown) {
      console.error('Error creating conversation summary:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Get or create a summary for today
   */
  async getOrCreateTodaySummary(data: {
    identifier: string;
    platform: WhatsAppPlatform;
    sessionId: string;
    tag: string;
  }): Promise<ConversationSummary> {
    this.ensureConnected();

    const date = new Date().toISOString().split('T')[0];

    try {
      let summary = await ConversationSummaryModel.findOne({
        identifier: data.identifier,
        tag: data.tag,
        date,
      });

      if (!summary) {
        summary = await ConversationSummaryModel.create({
          identifier: data.identifier,
          platform: data.platform,
          sessionId: data.sessionId,
          tag: data.tag,
          date,
          entries: [],
          totalMessagesSummarized: 0,
        });
        console.log(`New summary created for ${data.identifier} on ${date}`);
      }

      return this.convertSummaryToResponse(summary);
    } catch (error: unknown) {
      console.error('Error getting/creating summary:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Append a summary entry to an existing summary
   */
  async appendSummaryEntry(
    summaryId: string,
    entry: Omit<SummaryEntry, 'timestamp'> & { timestamp?: string }
  ): Promise<ConversationSummary | null> {
    this.ensureConnected();

    try {
      const now = new Date();

      const summary = await ConversationSummaryModel.findByIdAndUpdate(
        summaryId,
        {
          $push: {
            entries: {
              timestamp: entry.timestamp ? new Date(entry.timestamp) : now,
              text: entry.text,
              messageCount: entry.messageCount,
              sourceMessageIds: entry.sourceMessageIds,
              topics: entry.topics,
            },
          },
          $inc: { totalMessagesSummarized: entry.messageCount },
        },
        { new: true }
      );

      if (!summary) return null;

      console.log(`Summary entry appended to ${summaryId}`);
      return this.convertSummaryToResponse(summary);
    } catch (error: unknown) {
      console.error('Error appending summary entry:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Get summaries for RAG context retrieval
   * Returns recent summaries ordered by date descending
   */
  async getSummariesForContext(options: {
    identifier: string;
    tag?: string;
    limit?: number;
    beforeDate?: string;
    afterDate?: string;
  }): Promise<ConversationSummary[]> {
    this.ensureConnected();

    try {
      const query: Record<string, unknown> = { identifier: options.identifier };

      if (options.tag) {
        query.tag = options.tag;
      }

      if (options.beforeDate || options.afterDate) {
        query.date = {};
        if (options.beforeDate) {
          (query.date as Record<string, string>).$lt = options.beforeDate;
        }
        if (options.afterDate) {
          (query.date as Record<string, string>).$gt = options.afterDate;
        }
      }

      const summaries = await ConversationSummaryModel.find(query)
        .sort({ date: -1 })
        .limit(options.limit || 7)  // Default: last 7 days
        .lean();

      return summaries.map(s => this.convertSummaryToResponse(s as unknown as IConversationSummary));
    } catch (error: unknown) {
      console.error('Error getting summaries for context:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Get a single summary by ID
   */
  async getSummary(summaryId: string): Promise<ConversationSummary | null> {
    this.ensureConnected();

    try {
      const summary = await ConversationSummaryModel.findById(summaryId);
      if (!summary) return null;

      return this.convertSummaryToResponse(summary);
    } catch (error: unknown) {
      console.error('Error getting summary:', getErrorMessage(error));
      return null;
    }
  }

  /**
   * Delete old summaries (for retention policy)
   */
  async deleteSummariesOlderThan(identifier: string, beforeDate: string): Promise<number> {
    this.ensureConnected();

    try {
      const result = await ConversationSummaryModel.deleteMany({
        identifier,
        date: { $lt: beforeDate },
      });

      console.log(`Deleted ${result.deletedCount} old summaries for ${identifier}`);
      return result.deletedCount;
    } catch (error: unknown) {
      console.error('Error deleting old summaries:', getErrorMessage(error));
      return 0;
    }
  }

  // ==========================================================================
  // Conversation State management
  // ==========================================================================

  /**
   * Convert MongoDB conversation state to API response format
   */
  private convertConversationStateToResponse(doc: IConversationState): ConversationStateResponse {
    return {
      identifier: doc.identifier,
      platform: doc.platform as WhatsAppPlatform,
      sessionId: doc.sessionId,
      handoffStatus: doc.handoffStatus,
      assignedAgent: doc.assignedAgent,
      lastAgentActivity: doc.lastAgentActivity?.toISOString(),
      automationPaused: doc.automationPaused,
      metadata: doc.metadata,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  /**
   * Get conversation state for a chat and session
   * Returns null if no state exists
   */
  async getConversationState(identifier: string, sessionId: string): Promise<ConversationStateResponse | null> {
    this.ensureConnected();

    try {
      const state = await ConversationState.findOne({ identifier, sessionId }).lean();
      if (!state) return null;

      return {
        identifier: state.identifier,
        platform: state.platform as WhatsAppPlatform,
        sessionId: state.sessionId,
        handoffStatus: state.handoffStatus,
        assignedAgent: state.assignedAgent,
        lastAgentActivity: state.lastAgentActivity?.toISOString(),
        automationPaused: state.automationPaused,
        metadata: state.metadata,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString(),
      };
    } catch (error: unknown) {
      console.error('Error getting conversation state:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Set or update conversation state (upsert)
   * Creates new state if it doesn't exist, updates if it does
   */
  async setConversationState(
    identifier: string,
    platform: WhatsAppPlatform = DEFAULT_PLATFORM,
    sessionId: string,
    stateUpdate: {
      handoffStatus?: HandoffStatus;
      assignedAgent?: string;
      lastAgentActivity?: Date;
      automationPaused?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ConversationStateResponse> {
    this.ensureConnected();

    try {
      // Get old state before updating (for change tracking)
      const oldState = await ConversationState.findOne({ identifier, sessionId });

      const updateObj: Record<string, unknown> = {};

      if (stateUpdate.handoffStatus !== undefined) {
        updateObj.handoffStatus = stateUpdate.handoffStatus;
      }
      if (stateUpdate.assignedAgent !== undefined) {
        updateObj.assignedAgent = stateUpdate.assignedAgent;
      }
      if (stateUpdate.lastAgentActivity !== undefined) {
        updateObj.lastAgentActivity = stateUpdate.lastAgentActivity;
      }
      if (stateUpdate.automationPaused !== undefined) {
        updateObj.automationPaused = stateUpdate.automationPaused;
      }
      if (stateUpdate.metadata !== undefined) {
        updateObj.metadata = stateUpdate.metadata;
      }

      const state = await ConversationState.findOneAndUpdate(
        { identifier, sessionId },
        { $set: { ...updateObj, platform } },
        { upsert: true, new: true }
      );

      console.log(`Conversation state updated for ${identifier}/${sessionId}: ${JSON.stringify(stateUpdate)}`);

      // Emit event if queue is enabled
      if (eventQueue.isEnabled()) {
        try {
          const changes: Record<string, { old: unknown; new: unknown }> = {};

          // Track changes for each field
          if (stateUpdate.handoffStatus !== undefined) {
            changes.handoffStatus = {
              old: oldState?.handoffStatus || null,
              new: stateUpdate.handoffStatus,
            };
          }
          if (stateUpdate.assignedAgent !== undefined) {
            changes.assignedAgent = {
              old: oldState?.assignedAgent || null,
              new: stateUpdate.assignedAgent,
            };
          }
          if (stateUpdate.automationPaused !== undefined) {
            changes.automationPaused = {
              old: oldState?.automationPaused || false,
              new: stateUpdate.automationPaused,
            };
          }

          const eventPayload: QueuedEvent = {
            sessionId,
            dataType: 'conversation_state_changed',
            data: {
              identifier,
              platform,
              sessionId,
              changes,
              timestamp: new Date().toISOString(),
              oldState: oldState ? this.convertConversationStateToResponse(oldState) : null,
              newState: this.convertConversationStateToResponse(state),
            },
            receivedAt: new Date().toISOString(),
            chatId: `${identifier}@${platform}`,
          };

          await eventQueue.enqueue(eventPayload);
          console.log(`Conversation state change event queued for ${identifier}/${sessionId}`);
        } catch (eventError: unknown) {
          // Log error but don't fail the state update
          console.error('Error emitting conversation state change event:', getErrorMessage(eventError));
        }
      }

      return this.convertConversationStateToResponse(state);
    } catch (error: unknown) {
      console.error('Error setting conversation state:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Update handoff status for a conversation (convenience method)
   */
  async updateHandoffStatus(
    identifier: string,
    platform: WhatsAppPlatform = DEFAULT_PLATFORM,
    sessionId: string,
    status: HandoffStatus
  ): Promise<ConversationStateResponse> {
    this.ensureConnected();

    try {
      // Get old state before updating (for change tracking)
      const oldState = await ConversationState.findOne({ identifier, sessionId });

      const updateData: {
        handoffStatus: HandoffStatus;
        lastAgentActivity?: Date;
      } = { handoffStatus: status };

      // Update lastAgentActivity when transitioning to 'active' status
      if (status === 'active') {
        updateData.lastAgentActivity = new Date();
      }

      const state = await ConversationState.findOneAndUpdate(
        { identifier, sessionId },
        { $set: { ...updateData, platform } },
        { upsert: true, new: true }
      );

      console.log(`Handoff status updated for ${identifier}/${sessionId}: ${status}`);

      // Emit event if queue is enabled
      if (eventQueue.isEnabled()) {
        try {
          const changes: Record<string, { old: unknown; new: unknown }> = {
            handoffStatus: {
              old: oldState?.handoffStatus || null,
              new: status,
            },
          };

          if (status === 'active') {
            changes.lastAgentActivity = {
              old: oldState?.lastAgentActivity || null,
              new: updateData.lastAgentActivity,
            };
          }

          const eventPayload: QueuedEvent = {
            sessionId,
            dataType: 'conversation_state_changed',
            data: {
              identifier,
              platform,
              sessionId,
              changes,
              timestamp: new Date().toISOString(),
              oldState: oldState ? this.convertConversationStateToResponse(oldState) : null,
              newState: this.convertConversationStateToResponse(state),
            },
            receivedAt: new Date().toISOString(),
            chatId: `${identifier}@${platform}`,
          };

          await eventQueue.enqueue(eventPayload);
          console.log(`Conversation state change event queued for ${identifier}/${sessionId} (handoff status)`);
        } catch (eventError: unknown) {
          // Log error but don't fail the state update
          console.error('Error emitting conversation state change event:', getErrorMessage(eventError));
        }
      }

      return this.convertConversationStateToResponse(state);
    } catch (error: unknown) {
      console.error('Error updating handoff status:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Assign an agent to a conversation (convenience method)
   */
  async assignAgent(
    identifier: string,
    platform: WhatsAppPlatform = DEFAULT_PLATFORM,
    sessionId: string,
    agentId: string
  ): Promise<ConversationStateResponse> {
    this.ensureConnected();

    try {
      // Get old state before updating (for change tracking)
      const oldState = await ConversationState.findOne({ identifier, sessionId });

      const now = new Date();
      const state = await ConversationState.findOneAndUpdate(
        { identifier, sessionId },
        {
          $set: {
            platform,
            assignedAgent: agentId,
            handoffStatus: 'active',
            lastAgentActivity: now,
          },
        },
        { upsert: true, new: true }
      );

      console.log(`Agent ${agentId} assigned to conversation ${identifier}/${sessionId}`);

      // Emit event if queue is enabled
      if (eventQueue.isEnabled()) {
        try {
          const changes: Record<string, { old: unknown; new: unknown }> = {
            assignedAgent: {
              old: oldState?.assignedAgent || null,
              new: agentId,
            },
            handoffStatus: {
              old: oldState?.handoffStatus || null,
              new: 'active',
            },
            lastAgentActivity: {
              old: oldState?.lastAgentActivity || null,
              new: now,
            },
          };

          const eventPayload: QueuedEvent = {
            sessionId,
            dataType: 'conversation_state_changed',
            data: {
              identifier,
              platform,
              sessionId,
              changes,
              timestamp: new Date().toISOString(),
              oldState: oldState ? this.convertConversationStateToResponse(oldState) : null,
              newState: this.convertConversationStateToResponse(state),
            },
            receivedAt: new Date().toISOString(),
            chatId: `${identifier}@${platform}`,
          };

          await eventQueue.enqueue(eventPayload);
          console.log(`Conversation state change event queued for ${identifier}/${sessionId} (agent assigned)`);
        } catch (eventError: unknown) {
          // Log error but don't fail the state update
          console.error('Error emitting conversation state change event:', getErrorMessage(eventError));
        }
      }

      return this.convertConversationStateToResponse(state);
    } catch (error: unknown) {
      console.error('Error assigning agent:', getErrorMessage(error));
      throw error;
    }
  }

  // Get full state (for debugging/inspection)
  async getState(): Promise<{
    webhooks: Record<string, Array<{ url: string; events: string[]; registeredAt: string }>>;
    config: Record<string, ConfigValue>;
    lastUpdated: string;
  }> {
    this.ensureConnected();

    try {
      const webhooks = await this.getAllWebhooks();
      const config = await this.getAllConfig();

      return {
        webhooks,
        config,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error: unknown) {
      console.error('Error getting state:', getErrorMessage(error));
      return {
        webhooks: {},
        config: {},
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  // Graceful shutdown
  async close(): Promise<void> {
    if (this.isConnected) {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('MongoDB connection closed');
    }
  }
}

// Singleton instance
export const stateManager = new StateManager();
