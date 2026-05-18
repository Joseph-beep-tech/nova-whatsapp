/**
 * Progress Service
 *
 * Multi-tenant learning progress management.
 * Queries are tag-aware and schema-driven.
 */

import { stateManager } from '../../utils/stateManager';
import { lmsClientFactory } from '../content/lmsCollectionClient';
import { qdrantHandler } from '../qdrantHandler';
import {
  ProgressQueryRequest,
  ProgressResponse,
  ProgressUpdateRequest,
  ModuleStructureResponse,
} from '../../types/learning/api';
import { LearningInteraction } from '../../types/learning/interaction';
import { TagConfiguration, getTagConfigKey } from '../../types/routing';
import { getErrorMessage } from '../../types/webhook';

/**
 * Progress Service
 *
 * Provides multi-tenant learning progress management.
 * - Queries are tag-aware (business client)
 * - Uses schema-driven LMS collection access
 * - Combines user data with module structure
 */
class ProgressService {
  /**
   * Get learner progress for a specific tag
   *
   * Combines:
   * - User learning data from MongoDB
   * - Module structure from LMS Qdrant collection
   * - Conversation history from whatsapp-qdrant (optional)
   */
  async getProgress(request: ProgressQueryRequest): Promise<ProgressResponse> {
    const { chatId, tag, includeModuleStructure, includeHistory } = request;

    try {
      // 1. Get user
      const user = await stateManager.getUser(chatId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // 2. Verify user has tag
      if (!user.tags.includes(tag)) {
        return { success: false, error: `User not enrolled in ${tag}` };
      }

      // 3. Get tag configuration
      const configKey = getTagConfigKey(tag);
      const tagConfig = (await stateManager.getConfig(configKey)) as unknown as TagConfiguration | undefined;
      if (!tagConfig?.lms?.enabled) {
        return { success: false, error: `LMS not configured for tag: ${tag}` };
      }

      // 4. Get or initialize learning data
      let learningData = await stateManager.getLearningData(chatId, tag);
      if (!learningData) {
        learningData = await stateManager.initializeLearningData(chatId, tagConfig);
      }

      // 5. Optionally get module structure from content collection
      let moduleStructure;
      if (includeModuleStructure) {
        try {
          const client = lmsClientFactory.getClient(tag, tagConfig.lms);
          moduleStructure = await client.getModuleStructure();
        } catch (error) {
          console.warn(
            `[ProgressService] Failed to get module structure for ${tag}:`,
            getErrorMessage(error)
          );
        }
      }

      // 6. Optionally get history from whatsapp-qdrant
      let history: LearningInteraction[] | undefined;
      if (includeHistory) {
        try {
          const conversations = await qdrantHandler.getConversationHistory(tag, chatId, 10);
          history = conversations
            .filter((c) => {
              // Check if message has learning context metadata
              const metadata = c as unknown as {
                metadata?: { learningContext?: { moduleId?: string | number; sectionTitle?: string } };
              };
              return metadata.metadata?.learningContext;
            })
            .map((c) => {
              const metadata = c as unknown as {
                id: string;
                timestamp: string;
                metadata?: {
                  learningContext?: {
                    moduleId?: string | number;
                    sectionTitle?: string;
                    interactionType?: string;
                  };
                };
              };
              return {
                id: metadata.id || '',
                timestamp: metadata.timestamp,
                moduleId: metadata.metadata?.learningContext?.moduleId || '',
                sectionTitle: metadata.metadata?.learningContext?.sectionTitle || '',
                interactionType:
                  (metadata.metadata?.learningContext?.interactionType as
                    | 'question'
                    | 'discussion'
                    | 'completion'
                    | 'review') || 'discussion',
              };
            });
        } catch (error) {
          console.warn(
            `[ProgressService] Failed to get history for ${chatId}:`,
            getErrorMessage(error)
          );
        }
      }

      return {
        success: true,
        user: {
          chatId: user.identifier,
          displayName: user.pushname || user.name,
          tags: user.tags,
        },
        learning: learningData,
        moduleStructure,
        history,
      };
    } catch (error) {
      console.error('[ProgressService] Error getting progress:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Update progress for a user and tag
   */
  async updateProgress(chatId: string, request: ProgressUpdateRequest): Promise<ProgressResponse> {
    const { tag, moduleId, sectionCompleted, moduleCompleted, setCurrentModule, metadata, context } =
      request;

    try {
      // Get tag config
      const configKey = getTagConfigKey(tag);
      const tagConfig = (await stateManager.getConfig(configKey)) as unknown as TagConfiguration | undefined;
      if (!tagConfig?.lms?.enabled) {
        return { success: false, error: `LMS not configured for tag: ${tag}` };
      }

      // Ensure user has learning data initialized
      let learningData = await stateManager.getLearningData(chatId, tag);
      if (!learningData) {
        learningData = await stateManager.initializeLearningData(chatId, tagConfig);
      }

      // Update progress
      const updatedLearningData = await stateManager.updateLearningProgress(chatId, tag, {
        moduleId,
        sectionCompleted,
        moduleCompleted,
        currentModuleId: setCurrentModule,
        metadata,
        context,
      });

      if (!updatedLearningData) {
        return { success: false, error: 'Failed to update progress' };
      }

      return {
        success: true,
        learning: updatedLearningData,
      };
    } catch (error) {
      console.error('[ProgressService] Error updating progress:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Get module structure for a tag
   */
  async getModuleStructure(tag: string): Promise<ModuleStructureResponse> {
    try {
      // Get tag config
      const configKey = getTagConfigKey(tag);
      const tagConfig = (await stateManager.getConfig(configKey)) as unknown as TagConfiguration | undefined;
      if (!tagConfig?.lms?.enabled) {
        return { success: false, error: `LMS not configured for tag: ${tag}` };
      }

      // Get module structure from content collection
      const client = lmsClientFactory.getClient(tag, tagConfig.lms);
      const modules = await client.getModuleStructure();

      return {
        success: true,
        tag,
        programName: tagConfig.lms.programName,
        modules,
        totalModules: modules.length,
      };
    } catch (error) {
      console.error('[ProgressService] Error getting module structure:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Auto-detect learning topic from message and update progress
   *
   * This method can be called during message processing to automatically
   * track which topics a user is engaging with based on semantic similarity.
   *
   * Requires pre-computed embedding vector from the message.
   */
  async detectAndTrackLearning(
    chatId: string,
    tag: string,
    _message: string,
    embedding: number[]
  ): Promise<{ detected: boolean; moduleId?: string | number; sectionTitle?: string }> {
    try {
      // Get tag config
      const configKey = getTagConfigKey(tag);
      const tagConfig = (await stateManager.getConfig(configKey)) as unknown as TagConfiguration | undefined;
      if (!tagConfig?.lms?.enabled || !tagConfig.lms.autoDetect) {
        return { detected: false };
      }

      // Search for similar content
      const client = lmsClientFactory.getClient(tag, tagConfig.lms);
      const matches = await client.searchContent(embedding, 3);

      const threshold = tagConfig.lms.detectionThreshold || 0.7;
      if (matches.length > 0 && matches[0].score >= threshold) {
        const topMatch = matches[0];

        // Track the interaction
        await stateManager.trackLearningInteraction(
          chatId,
          tag,
          topMatch.moduleId,
          topMatch.sectionTitle
        );

        console.log(
          `[ProgressService] Auto-detected learning topic for ${chatId}: ` +
            `${tag}/${topMatch.moduleId}/${topMatch.sectionTitle} (score: ${topMatch.score.toFixed(3)})`
        );

        return {
          detected: true,
          moduleId: topMatch.moduleId,
          sectionTitle: topMatch.sectionTitle,
        };
      }

      return { detected: false };
    } catch (error) {
      console.error('[ProgressService] Error detecting learning topic:', getErrorMessage(error));
      return { detected: false };
    }
  }

  /**
   * Get all learners for a tag with their progress
   *
   * Useful for admin/reporting dashboards.
   */
  async getLearnersForTag(tag: string): Promise<{
    success: boolean;
    learners?: Array<{
      chatId: string;
      displayName?: string;
      overallProgress: number;
      currentModuleId?: string | number;
      lastActivityAt: string;
    }>;
    error?: string;
  }> {
    try {
      // Get all users with this tag
      const users = await stateManager.getUsersByTag(tag);

      const learners = await Promise.all(
        users.map(async (user) => {
          const learningData = await stateManager.getLearningData(user.identifier, tag);

          return {
            chatId: user.identifier,
            displayName: user.pushname || user.name,
            overallProgress: learningData?.overallProgress || 0,
            currentModuleId: learningData?.currentModuleId,
            lastActivityAt: learningData?.lastActivityAt || user.lastContactAt,
          };
        })
      );

      return {
        success: true,
        learners: learners.sort((a, b) => b.overallProgress - a.overallProgress),
      };
    } catch (error) {
      console.error('[ProgressService] Error getting learners:', getErrorMessage(error));
      return { success: false, error: getErrorMessage(error) };
    }
  }
}

// Singleton instance
export const progressService = new ProgressService();
