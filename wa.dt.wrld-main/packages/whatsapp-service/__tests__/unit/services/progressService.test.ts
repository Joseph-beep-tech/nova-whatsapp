/**
 * Progress Service Unit Tests
 *
 * Tests for the progress service that manages multi-tenant learning progress.
 * Critical: Tests all error paths and undefined data scenarios.
 */

import { progressService } from '../../../src/services/learning';
import { stateManager } from '../../../src/utils/stateManager';
import { lmsClientFactory, LmsCollectionClient } from '../../../src/services/content/lmsCollectionClient';
import { qdrantHandler } from '../../../src/services/qdrantHandler';
import {
  somoUser,
  nonSomoUser,
  noTagUser,
  somoTagConfig,
  lmsDisabledTagConfig,
  noLmsTagConfig,
  somoLearningData,
  emptyLearningData,
  sampleModuleStructure,
} from '../../fixtures/progressTestData';

// Mock dependencies
jest.mock('../../../src/utils/stateManager', () => ({
  stateManager: {
    getUser: jest.fn(),
    getConfig: jest.fn(),
    getLearningData: jest.fn(),
    initializeLearningData: jest.fn(),
    updateLearningProgress: jest.fn(),
    trackLearningInteraction: jest.fn(),
    getUsersByTag: jest.fn(),
  },
}));

// Helper to cast TagConfiguration to expected mock type
// ConfigValue = string | number | boolean | null | unknown[] | Record<string, unknown>
// TagConfiguration needs to be cast through Record<string, unknown>
const asConfig = <T>(config: T): Record<string, unknown> => config as unknown as Record<string, unknown>;

jest.mock('../../../src/services/content/lmsCollectionClient', () => ({
  lmsClientFactory: {
    getClient: jest.fn(),
  },
  LmsCollectionClient: jest.fn(),
}));

jest.mock('../../../src/services/qdrantHandler', () => ({
  qdrantHandler: {
    getConversationHistory: jest.fn(),
  },
}));

const mockStateManager = stateManager as jest.Mocked<typeof stateManager>;
const mockLmsClientFactory = lmsClientFactory as jest.Mocked<typeof lmsClientFactory>;
const mockQdrantHandler = qdrantHandler as jest.Mocked<typeof qdrantHandler>;

// Mock LMS client instance
const mockLmsClient = {
  getModuleStructure: jest.fn(),
  searchContent: jest.fn(),
  getModuleContent: jest.fn(),
  testConnection: jest.fn(),
} as unknown as jest.Mocked<LmsCollectionClient>;

describe('ProgressService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLmsClientFactory.getClient.mockReturnValue(mockLmsClient);
  });

  // ===========================================================================
  // getProgress
  // ===========================================================================

  describe('getProgress', () => {
    describe('User validation', () => {
      it('should return error when user not found', async () => {
        mockStateManager.getUser.mockResolvedValue(null);

        const result = await progressService.getProgress({
          chatId: '254999999999@c.us',
          tag: 'SOMO',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('User not found');
      });

      it('should return error when user not enrolled in tag', async () => {
        mockStateManager.getUser.mockResolvedValue(nonSomoUser);

        const result = await progressService.getProgress({
          chatId: nonSomoUser.identifier,
          tag: 'SOMO',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('User not enrolled in SOMO');
      });

      it('should return error when user has no tags', async () => {
        mockStateManager.getUser.mockResolvedValue(noTagUser);

        const result = await progressService.getProgress({
          chatId: noTagUser.identifier,
          tag: 'SOMO',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('User not enrolled in SOMO');
      });
    });

    describe('Tag configuration validation', () => {
      it('should return error when tag config not found', async () => {
        mockStateManager.getUser.mockResolvedValue(somoUser);
        mockStateManager.getConfig.mockResolvedValue(undefined);

        const result = await progressService.getProgress({
          chatId: somoUser.identifier,
          tag: 'SOMO',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('LMS not configured for tag: SOMO');
      });

      it('should return error when LMS is disabled', async () => {
        mockStateManager.getUser.mockResolvedValue(somoUser);
        mockStateManager.getConfig.mockResolvedValue(asConfig(lmsDisabledTagConfig));

        const result = await progressService.getProgress({
          chatId: somoUser.identifier,
          tag: 'SOMO',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('LMS not configured for tag: SOMO');
      });

      it('should return error when tag config has no LMS field', async () => {
        mockStateManager.getUser.mockResolvedValue(somoUser);
        mockStateManager.getConfig.mockResolvedValue(asConfig(noLmsTagConfig));

        const result = await progressService.getProgress({
          chatId: somoUser.identifier,
          tag: 'SOMO',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('LMS not configured for tag: SOMO');
      });
    });

    describe('Learning data retrieval', () => {
      it('should initialize learning data if not exists', async () => {
        mockStateManager.getUser.mockResolvedValue(somoUser);
        mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
        mockStateManager.getLearningData.mockResolvedValue(null);
        mockStateManager.initializeLearningData.mockResolvedValue(emptyLearningData);

        const result = await progressService.getProgress({
          chatId: somoUser.identifier,
          tag: 'SOMO',
        });

        expect(result.success).toBe(true);
        expect(mockStateManager.initializeLearningData).toHaveBeenCalledWith(
          somoUser.identifier,
          somoTagConfig
        );
        expect(result.learning).toEqual(emptyLearningData);
      });

      it('should return existing learning data', async () => {
        mockStateManager.getUser.mockResolvedValue(somoUser);
        mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
        mockStateManager.getLearningData.mockResolvedValue(somoLearningData);

        const result = await progressService.getProgress({
          chatId: somoUser.identifier,
          tag: 'SOMO',
        });

        expect(result.success).toBe(true);
        expect(result.learning).toEqual(somoLearningData);
        expect(mockStateManager.initializeLearningData).not.toHaveBeenCalled();
      });

      it('should return user info in response', async () => {
        mockStateManager.getUser.mockResolvedValue(somoUser);
        mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
        mockStateManager.getLearningData.mockResolvedValue(somoLearningData);

        const result = await progressService.getProgress({
          chatId: somoUser.identifier,
          tag: 'SOMO',
        });

        expect(result.success).toBe(true);
        expect(result.user).toEqual({
          chatId: somoUser.identifier,
          displayName: somoUser.pushname,
          tags: somoUser.tags,
        });
      });
    });

    describe('Optional data inclusion', () => {
      it('should include module structure when requested', async () => {
        mockStateManager.getUser.mockResolvedValue(somoUser);
        mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
        mockStateManager.getLearningData.mockResolvedValue(somoLearningData);
        mockLmsClient.getModuleStructure.mockResolvedValue(sampleModuleStructure);

        const result = await progressService.getProgress({
          chatId: somoUser.identifier,
          tag: 'SOMO',
          includeModuleStructure: true,
        });

        expect(result.success).toBe(true);
        expect(result.moduleStructure).toEqual(sampleModuleStructure);
        expect(mockLmsClientFactory.getClient).toHaveBeenCalledWith('SOMO', somoTagConfig.lms);
      });

      it('should not include module structure when not requested', async () => {
        mockStateManager.getUser.mockResolvedValue(somoUser);
        mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
        mockStateManager.getLearningData.mockResolvedValue(somoLearningData);

        const result = await progressService.getProgress({
          chatId: somoUser.identifier,
          tag: 'SOMO',
          includeModuleStructure: false,
        });

        expect(result.success).toBe(true);
        expect(result.moduleStructure).toBeUndefined();
        expect(mockLmsClient.getModuleStructure).not.toHaveBeenCalled();
      });

      it('should handle module structure fetch failure gracefully', async () => {
        mockStateManager.getUser.mockResolvedValue(somoUser);
        mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
        mockStateManager.getLearningData.mockResolvedValue(somoLearningData);
        mockLmsClient.getModuleStructure.mockRejectedValue(new Error('Qdrant connection failed'));

        const result = await progressService.getProgress({
          chatId: somoUser.identifier,
          tag: 'SOMO',
          includeModuleStructure: true,
        });

        // Should still succeed, just without module structure
        expect(result.success).toBe(true);
        expect(result.moduleStructure).toBeUndefined();
      });
    });
  });

  // ===========================================================================
  // updateProgress
  // ===========================================================================

  describe('updateProgress', () => {
    it('should return error when LMS not configured', async () => {
      mockStateManager.getConfig.mockResolvedValue(undefined);

      const result = await progressService.updateProgress('254722833440@c.us', {
        tag: 'SOMO',
        moduleId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('LMS not configured for tag: SOMO');
    });

    it('should initialize learning data if not exists before update', async () => {
      mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
      mockStateManager.getLearningData.mockResolvedValue(null);
      mockStateManager.initializeLearningData.mockResolvedValue(emptyLearningData);
      mockStateManager.updateLearningProgress.mockResolvedValue(somoLearningData);

      const result = await progressService.updateProgress('254722833440@c.us', {
        tag: 'SOMO',
        moduleId: 1,
      });

      expect(result.success).toBe(true);
      expect(mockStateManager.initializeLearningData).toHaveBeenCalled();
    });

    it('should update progress successfully', async () => {
      mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
      mockStateManager.getLearningData.mockResolvedValue(somoLearningData);
      mockStateManager.updateLearningProgress.mockResolvedValue({
        ...somoLearningData,
        currentModuleId: 3,
      });

      const result = await progressService.updateProgress('254722833440@c.us', {
        tag: 'SOMO',
        setCurrentModule: 3,
      });

      expect(result.success).toBe(true);
      expect(result.learning?.currentModuleId).toBe(3);
    });

    it('should return error when update fails', async () => {
      mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
      mockStateManager.getLearningData.mockResolvedValue(somoLearningData);
      mockStateManager.updateLearningProgress.mockResolvedValue(null);

      const result = await progressService.updateProgress('254722833440@c.us', {
        tag: 'SOMO',
        moduleId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update progress');
    });

    it('should pass all update fields to state manager', async () => {
      mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
      mockStateManager.getLearningData.mockResolvedValue(somoLearningData);
      mockStateManager.updateLearningProgress.mockResolvedValue(somoLearningData);

      await progressService.updateProgress('254722833440@c.us', {
        tag: 'SOMO',
        moduleId: 2,
        sectionCompleted: 'Test Section',
        moduleCompleted: true,
        setCurrentModule: 3,
        metadata: { score: 90 },
        context: { question: 'Test?' },
      });

      expect(mockStateManager.updateLearningProgress).toHaveBeenCalledWith(
        '254722833440@c.us',
        'SOMO',
        {
          moduleId: 2,
          sectionCompleted: 'Test Section',
          moduleCompleted: true,
          currentModuleId: 3,
          metadata: { score: 90 },
          context: { question: 'Test?' },
        }
      );
    });
  });

  // ===========================================================================
  // getModuleStructure
  // ===========================================================================

  describe('getModuleStructure', () => {
    it('should return error when LMS not configured', async () => {
      mockStateManager.getConfig.mockResolvedValue(undefined);

      const result = await progressService.getModuleStructure('SOMO');

      expect(result.success).toBe(false);
      expect(result.error).toBe('LMS not configured for tag: SOMO');
    });

    it('should return module structure', async () => {
      mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
      mockLmsClient.getModuleStructure.mockResolvedValue(sampleModuleStructure);

      const result = await progressService.getModuleStructure('SOMO');

      expect(result.success).toBe(true);
      expect(result.modules).toEqual(sampleModuleStructure);
      expect(result.totalModules).toBe(3);
      expect(result.programName).toBe('SOMO Financial Literacy');
    });

    it('should handle empty module structure', async () => {
      mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
      mockLmsClient.getModuleStructure.mockResolvedValue([]);

      const result = await progressService.getModuleStructure('SOMO');

      expect(result.success).toBe(true);
      expect(result.modules).toEqual([]);
      expect(result.totalModules).toBe(0);
    });
  });

  // ===========================================================================
  // detectAndTrackLearning
  // ===========================================================================

  describe('detectAndTrackLearning', () => {
    const testEmbedding = new Array(768).fill(0.1);

    it('should return not detected when LMS not configured', async () => {
      mockStateManager.getConfig.mockResolvedValue(undefined);

      const result = await progressService.detectAndTrackLearning(
        '254722833440@c.us',
        'SOMO',
        'Test message',
        testEmbedding
      );

      expect(result.detected).toBe(false);
    });

    it('should return not detected when autoDetect is false', async () => {
      const configWithoutAutoDetect = {
        ...somoTagConfig,
        lms: { ...somoTagConfig.lms!, autoDetect: false },
      };
      mockStateManager.getConfig.mockResolvedValue(asConfig(configWithoutAutoDetect));

      const result = await progressService.detectAndTrackLearning(
        '254722833440@c.us',
        'SOMO',
        'Test message',
        testEmbedding
      );

      expect(result.detected).toBe(false);
    });

    it('should return not detected when no matches', async () => {
      mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
      mockLmsClient.searchContent.mockResolvedValue([]);

      const result = await progressService.detectAndTrackLearning(
        '254722833440@c.us',
        'SOMO',
        'Random message',
        testEmbedding
      );

      expect(result.detected).toBe(false);
    });

    it('should return not detected when score below threshold', async () => {
      mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
      mockLmsClient.searchContent.mockResolvedValue([
        { moduleId: 1, sectionTitle: 'Test', content: 'Test', score: 0.5, payload: {} },
      ]);

      const result = await progressService.detectAndTrackLearning(
        '254722833440@c.us',
        'SOMO',
        'Test message',
        testEmbedding
      );

      expect(result.detected).toBe(false);
    });

    it('should detect and track when score above threshold', async () => {
      mockStateManager.getConfig.mockResolvedValue(asConfig(somoTagConfig));
      mockLmsClient.searchContent.mockResolvedValue([
        { moduleId: 2, sectionTitle: 'Budgeting', content: 'Test', score: 0.85, payload: {} },
      ]);

      const result = await progressService.detectAndTrackLearning(
        '254722833440@c.us',
        'SOMO',
        'How do I create a budget?',
        testEmbedding
      );

      expect(result.detected).toBe(true);
      expect(result.moduleId).toBe(2);
      expect(result.sectionTitle).toBe('Budgeting');
      expect(mockStateManager.trackLearningInteraction).toHaveBeenCalledWith(
        '254722833440@c.us',
        'SOMO',
        2,
        'Budgeting'
      );
    });
  });

  // ===========================================================================
  // getLearnersForTag
  // ===========================================================================

  describe('getLearnersForTag', () => {
    it('should return list of learners with progress', async () => {
      mockStateManager.getUsersByTag.mockResolvedValue([somoUser]);
      mockStateManager.getLearningData.mockResolvedValue(somoLearningData);

      const result = await progressService.getLearnersForTag('SOMO');

      expect(result.success).toBe(true);
      expect(result.learners).toHaveLength(1);
      expect(result.learners![0]).toEqual({
        chatId: somoUser.identifier,
        displayName: somoUser.pushname,
        overallProgress: 45,
        currentModuleId: 2,
        lastActivityAt: somoLearningData.lastActivityAt,
      });
    });

    it('should handle users without learning data', async () => {
      mockStateManager.getUsersByTag.mockResolvedValue([somoUser]);
      mockStateManager.getLearningData.mockResolvedValue(null);

      const result = await progressService.getLearnersForTag('SOMO');

      expect(result.success).toBe(true);
      expect(result.learners![0].overallProgress).toBe(0);
      expect(result.learners![0].currentModuleId).toBeUndefined();
    });

    it('should sort learners by progress descending', async () => {
      const user2 = { ...somoUser, identifier: '254711111111', pushname: 'User2' };
      mockStateManager.getUsersByTag.mockResolvedValue([somoUser, user2]);
      mockStateManager.getLearningData
        .mockResolvedValueOnce({ ...somoLearningData, overallProgress: 30 })
        .mockResolvedValueOnce({ ...somoLearningData, overallProgress: 80 });

      const result = await progressService.getLearnersForTag('SOMO');

      expect(result.learners![0].overallProgress).toBe(80);
      expect(result.learners![1].overallProgress).toBe(30);
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe('Error handling', () => {
    it('should handle state manager errors in getProgress', async () => {
      mockStateManager.getUser.mockRejectedValue(new Error('Database error'));

      const result = await progressService.getProgress({
        chatId: '254722833440@c.us',
        tag: 'SOMO',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });

    it('should handle state manager errors in updateProgress', async () => {
      mockStateManager.getConfig.mockRejectedValue(new Error('Config fetch failed'));

      const result = await progressService.updateProgress('254722833440@c.us', {
        tag: 'SOMO',
        moduleId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Config fetch failed');
    });
  });
});
