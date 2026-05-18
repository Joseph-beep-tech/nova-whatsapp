/**
 * Welcome Service
 *
 * Handles sending welcome messages when users are assigned new tags.
 * Welcome messages are configured per-tag in the Config collection,
 * except for the Default flow which is hardcoded.
 *
 * Message format mirrors wwebjs-api sendMessage schema for easy forwarding.
 */

import {
  WhatsAppApiClient,
  MessageContentType,
  MediaContent,
  LocationContent,
  PollContent,
  ContactContent,
  MessageOptions,
} from '../dispatcher/whatsappApiClient';
import { stateManager, ConfigValue } from '../utils/stateManager';
import { getErrorMessage } from '../types/webhook';
import { WhatsAppPlatform, DEFAULT_PLATFORM, toChatId } from '../utils/phoneNumber';

/** Single message in a welcome sequence - mirrors wwebjs-api sendMessage schema */
export interface WelcomeMessageItem {
  contentType: MessageContentType;
  content: string | MediaContent | LocationContent | PollContent | ContactContent;
  options?: MessageOptions;
}

/** Welcome message configuration stored in Config collection */
export interface WelcomeMessageConfig {
  messages: WelcomeMessageItem[];
  enabled: boolean;
}

/** Result of sending welcome messages */
export interface WelcomeResult {
  sentWelcomes: Array<{ tag: string; messageCount: number }>;
  skippedTags: string[];
  errors: Array<{ tag: string; error: string }>;
}

// Config key pattern: welcome_message_{TAG}
const WELCOME_CONFIG_PREFIX = 'welcome_message_';

// Hardcoded default welcome messages (only for 'default' tag)
const DEFAULT_WELCOME_MESSAGES: WelcomeMessageItem[] = [
  { contentType: 'string', content: 'Welcome! You are now registered.' },
];

export class WelcomeService {
  private apiClient: WhatsAppApiClient;

  constructor(apiClient: WhatsAppApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Get welcome messages for a specific tag from config
   * Returns null if no welcome message is configured for the tag
   * Supports backward compatibility with old single-message format
   */
  async getWelcomeMessage(tag: string): Promise<WelcomeMessageConfig | null> {
    // Hardcoded default welcome messages
    if (tag.toLowerCase() === 'default') {
      return {
        messages: DEFAULT_WELCOME_MESSAGES,
        enabled: true,
      };
    }

    // Check config for tag-specific welcome messages
    const configKey = `${WELCOME_CONFIG_PREFIX}${tag}`;
    const config = await stateManager.getConfig<Record<string, unknown>>(configKey);

    if (!config || typeof config !== 'object') {
      return null;
    }

    // New format: messages array
    if ('messages' in config && Array.isArray(config.messages)) {
      return {
        messages: config.messages as WelcomeMessageItem[],
        enabled: config.enabled !== false,
      };
    }

    // Backward compatibility: convert old single-message format to array
    if ('message' in config && typeof config.message === 'string') {
      return {
        messages: [{ contentType: 'string', content: config.message }],
        enabled: config.enabled !== false,
      };
    }

    return null;
  }

  /**
   * Set welcome messages for a tag
   * Messages array mirrors wwebjs-api sendMessage schema
   */
  async setWelcomeMessage(tag: string, messages: WelcomeMessageItem[], enabled = true): Promise<void> {
    const configKey = `${WELCOME_CONFIG_PREFIX}${tag}`;
    await stateManager.setConfig(configKey, {
      messages,
      enabled,
    } as unknown as ConfigValue);
    console.log(`Welcome messages configured for tag '${tag}' (${messages.length} message(s))`);
  }

  /**
   * Disable welcome messages for a tag
   */
  async disableWelcomeMessage(tag: string): Promise<void> {
    const configKey = `${WELCOME_CONFIG_PREFIX}${tag}`;
    const existing = await this.getWelcomeMessage(tag);
    if (existing) {
      await stateManager.setConfig(configKey, {
        messages: existing.messages,
        enabled: false,
      } as unknown as ConfigValue);
      console.log(`Welcome messages disabled for tag '${tag}'`);
    }
  }

  /**
   * Send welcome messages for newly added tags
   *
   * For each new tag:
   * 1. Check if user has already been welcomed for this tag
   * 2. Check if welcome messages are configured for this tag
   * 3. Send all welcome messages in sequence
   * 4. Mark the tag as welcomed for the user
   *
   * @param identifier - User identifier (phone number or group ID)
   * @param platform - WhatsApp platform suffix
   * @param newTags - Tags that were newly added to the user
   * @param sessionId - WhatsApp session to send from
   * @returns Summary of what was sent
   */
  async sendWelcomeForNewTags(
    identifier: string,
    platform: WhatsAppPlatform,
    newTags: string[],
    sessionId: string
  ): Promise<WelcomeResult> {
    const result: WelcomeResult = {
      sentWelcomes: [],
      skippedTags: [],
      errors: [],
    };

    // Reconstruct chatId for wwebjs-api calls
    const chatId = toChatId(identifier, platform);

    for (const tag of newTags) {
      try {
        // Check if user has already been welcomed for this tag
        const alreadyWelcomed = await stateManager.isTagWelcomed(identifier, tag);
        if (alreadyWelcomed) {
          result.skippedTags.push(tag);
          continue;
        }

        // Get welcome message configuration for this tag
        const welcomeConfig = await this.getWelcomeMessage(tag);
        if (!welcomeConfig || !welcomeConfig.enabled || welcomeConfig.messages.length === 0) {
          result.skippedTags.push(tag);
          continue;
        }

        // Send all welcome messages in sequence (wwebjs-api requires chatId format)
        for (const messageItem of welcomeConfig.messages) {
          await this.apiClient.sendMessage(sessionId, {
            chatId,
            contentType: messageItem.contentType,
            content: messageItem.content,
            options: messageItem.options,
          });
        }

        // Mark tag as welcomed
        await stateManager.markTagWelcomed(identifier, tag);

        result.sentWelcomes.push({
          tag,
          messageCount: welcomeConfig.messages.length,
        });

        console.log(`Welcome messages sent for tag '${tag}' to ${identifier} (${welcomeConfig.messages.length} message(s))`);

      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        console.error(`Failed to send welcome for tag '${tag}' to ${identifier}:`, errorMessage);
        result.errors.push({
          tag,
          error: errorMessage,
        });
      }
    }

    return result;
  }

  /**
   * List all configured welcome messages
   */
  async listWelcomeMessages(): Promise<Record<string, WelcomeMessageConfig>> {
    const allConfig = await stateManager.getAllConfig();
    const welcomeMessages: Record<string, WelcomeMessageConfig> = {};

    // Add hardcoded default
    welcomeMessages['default'] = {
      messages: DEFAULT_WELCOME_MESSAGES,
      enabled: true,
    };

    // Add configured messages
    for (const [key, value] of Object.entries(allConfig)) {
      if (key.startsWith(WELCOME_CONFIG_PREFIX)) {
        const tag = key.substring(WELCOME_CONFIG_PREFIX.length);
        if (value && typeof value === 'object') {
          const configValue = value as Record<string, unknown>;

          // New format: messages array
          if ('messages' in configValue && Array.isArray(configValue.messages)) {
            welcomeMessages[tag] = {
              messages: configValue.messages as WelcomeMessageItem[],
              enabled: configValue.enabled !== false,
            };
          }
          // Backward compatibility: convert old single-message format
          else if ('message' in configValue && typeof configValue.message === 'string') {
            welcomeMessages[tag] = {
              messages: [{ contentType: 'string', content: configValue.message }],
              enabled: configValue.enabled !== false,
            };
          }
        }
      }
    }

    return welcomeMessages;
  }
}
