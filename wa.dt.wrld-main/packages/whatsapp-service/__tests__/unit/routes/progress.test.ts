/**
 * Progress Routes Unit Tests
 *
 * Tests for the /progress API endpoints.
 * Critical: Tests undefined/missing parameters to prevent production errors.
 */

import express, { Express } from 'express';
import request from 'supertest';
import { progressRouter } from '../../../src/routes/progress';
import { progressService } from '../../../src/services/learning';
import {
  somoUser,
  somoLearningData,
  sampleModuleStructure,
  validProgressRequest,
  sectionCompletedRequest,
} from '../../fixtures/progressTestData';

// Mock the progress service
jest.mock('../../../src/services/learning', () => ({
  progressService: {
    getProgress: jest.fn(),
    updateProgress: jest.fn(),
    getModuleStructure: jest.fn(),
    getLearnersForTag: jest.fn(),
  },
}));

const mockProgressService = progressService as jest.Mocked<typeof progressService>;

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/progress', progressRouter);
  return app;
}

describe('Progress Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  // ===========================================================================
  // GET /progress/modules - Module Structure
  // ===========================================================================

  describe('GET /progress/modules', () => {
    it('should return 400 when tag query param is missing', async () => {
      const response = await request(app).get('/progress/modules');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('tag query parameter is required');
    });

    it('should return module structure for valid tag', async () => {
      mockProgressService.getModuleStructure.mockResolvedValue({
        success: true,
        tag: 'SOMO',
        programName: 'SOMO Financial Literacy',
        modules: sampleModuleStructure,
        totalModules: 3,
      });

      const response = await request(app).get('/progress/modules?tag=SOMO');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.modules).toHaveLength(3);
      expect(mockProgressService.getModuleStructure).toHaveBeenCalledWith('SOMO');
    });

    it('should return 400 when LMS not configured for tag', async () => {
      mockProgressService.getModuleStructure.mockResolvedValue({
        success: false,
        error: 'LMS not configured for tag: UNKNOWN',
      });

      const response = await request(app).get('/progress/modules?tag=UNKNOWN');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // ===========================================================================
  // GET /progress/learners - Learners for Tag
  // ===========================================================================

  describe('GET /progress/learners', () => {
    it('should return 400 when tag query param is missing', async () => {
      const response = await request(app).get('/progress/learners');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('tag query parameter is required');
    });

    it('should return learners list for valid tag', async () => {
      mockProgressService.getLearnersForTag.mockResolvedValue({
        success: true,
        learners: [
          {
            chatId: '254722833440@c.us',
            displayName: 'Test User',
            overallProgress: 45,
            currentModuleId: 2,
            lastActivityAt: '2026-01-29T14:00:00.000Z',
          },
        ],
      });

      const response = await request(app).get('/progress/learners?tag=SOMO');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.learners).toHaveLength(1);
    });
  });

  // ===========================================================================
  // GET /progress?identifier=X&tag=Y - Get Progress
  // ===========================================================================

  describe('GET /progress', () => {
    it('should return 400 when identifier query param is missing', async () => {
      const response = await request(app).get('/progress?tag=SOMO');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('identifier query parameter is required');
    });

    it('should return 400 when tag query param is missing', async () => {
      const response = await request(app).get('/progress?identifier=254722833440');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('tag query parameter is required');
    });

    it('should return 404 when user not found', async () => {
      mockProgressService.getProgress.mockResolvedValue({
        success: false,
        error: 'User not found',
      });

      const response = await request(app).get('/progress?identifier=254999999999&tag=SOMO');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return 400 when user not enrolled in tag', async () => {
      mockProgressService.getProgress.mockResolvedValue({
        success: false,
        error: 'User not enrolled in SOMO',
      });

      const response = await request(app).get('/progress?identifier=254700000000&tag=SOMO');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not enrolled');
    });

    it('should return 400 when LMS not configured for tag', async () => {
      mockProgressService.getProgress.mockResolvedValue({
        success: false,
        error: 'LMS not configured for tag: SOMO',
      });

      const response = await request(app).get('/progress?identifier=254722833440&tag=SOMO');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return progress for valid user and tag', async () => {
      mockProgressService.getProgress.mockResolvedValue({
        success: true,
        user: {
          chatId: somoUser.identifier,
          displayName: somoUser.pushname,
          tags: somoUser.tags,
        },
        learning: somoLearningData,
      });

      const response = await request(app).get('/progress?identifier=254722833440&tag=SOMO');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.chatId).toBe('254722833440');
      expect(response.body.learning.overallProgress).toBe(45);
    });

    it('should include module structure when requested', async () => {
      mockProgressService.getProgress.mockResolvedValue({
        success: true,
        user: {
          chatId: somoUser.identifier,
          displayName: somoUser.pushname,
          tags: somoUser.tags,
        },
        learning: somoLearningData,
        moduleStructure: sampleModuleStructure,
      });

      const response = await request(app).get(
        '/progress?identifier=254722833440&tag=SOMO&includeModuleStructure=true'
      );

      expect(response.status).toBe(200);
      expect(response.body.moduleStructure).toHaveLength(3);
      expect(mockProgressService.getProgress).toHaveBeenCalledWith({
        chatId: '254722833440',
        tag: 'SOMO',
        includeModuleStructure: true,
        includeHistory: false,
      });
    });

    it('should include history when requested', async () => {
      mockProgressService.getProgress.mockResolvedValue({
        success: true,
        user: {
          chatId: somoUser.identifier,
          displayName: somoUser.pushname,
          tags: somoUser.tags,
        },
        learning: somoLearningData,
        history: [],
      });

      const response = await request(app).get(
        '/progress?identifier=254722833440&tag=SOMO&includeHistory=true'
      );

      expect(response.status).toBe(200);
      expect(response.body.history).toBeDefined();
      expect(mockProgressService.getProgress).toHaveBeenCalledWith({
        chatId: '254722833440',
        tag: 'SOMO',
        includeModuleStructure: false,
        includeHistory: true,
      });
    });
  });

  // ===========================================================================
  // POST /progress - Update Progress
  // ===========================================================================

  describe('POST /progress', () => {
    it('should return 400 when identifier is missing in body', async () => {
      const response = await request(app)
        .post('/progress')
        .send({ tag: 'SOMO', moduleId: 2 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('identifier is required');
    });

    it('should return 400 when tag is missing in body', async () => {
      const response = await request(app)
        .post('/progress')
        .send({ identifier: '254722833440', moduleId: 2 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('tag is required');
    });

    it('should return 400 when body is empty', async () => {
      const response = await request(app).post('/progress').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('identifier is required');
    });

    it('should update progress for section completed', async () => {
      mockProgressService.updateProgress.mockResolvedValue({
        success: true,
        learning: {
          ...somoLearningData,
          moduleProgress: {
            ...somoLearningData.moduleProgress,
            '2': {
              ...somoLearningData.moduleProgress['2'],
              completedSections: ['Creating a Budget', 'Tracking Expenses'],
              progressPercent: 66,
            },
          },
        },
      });

      const response = await request(app)
        .post('/progress')
        .send({ identifier: '254722833440', ...sectionCompletedRequest });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockProgressService.updateProgress).toHaveBeenCalledWith(
        '254722833440',
        sectionCompletedRequest
      );
    });

    it('should update progress for module completed', async () => {
      mockProgressService.updateProgress.mockResolvedValue({
        success: true,
        learning: somoLearningData,
      });

      const response = await request(app)
        .post('/progress')
        .send({ identifier: '254722833440', tag: 'SOMO', moduleId: 2, moduleCompleted: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 when LMS not configured', async () => {
      mockProgressService.updateProgress.mockResolvedValue({
        success: false,
        error: 'LMS not configured for tag: SOMO',
      });

      const response = await request(app)
        .post('/progress')
        .send({ identifier: '254722833440', tag: 'SOMO', moduleId: 1 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should update current module', async () => {
      mockProgressService.updateProgress.mockResolvedValue({
        success: true,
        learning: {
          ...somoLearningData,
          currentModuleId: 3,
        },
      });

      const response = await request(app)
        .post('/progress')
        .send({ identifier: '254722833440', tag: 'SOMO', setCurrentModule: 3 });

      expect(response.status).toBe(200);
      expect(mockProgressService.updateProgress).toHaveBeenCalledWith('254722833440', {
        tag: 'SOMO',
        setCurrentModule: 3,
      });
    });

    it('should update with metadata and context', async () => {
      mockProgressService.updateProgress.mockResolvedValue({
        success: true,
        learning: somoLearningData,
      });

      const response = await request(app)
        .post('/progress')
        .send({
          identifier: '254722833440',
          tag: 'SOMO',
          moduleId: 2,
          metadata: { quizScore: 85 },
          context: { lastQuestion: 'Test question' },
        });

      expect(response.status).toBe(200);
      expect(mockProgressService.updateProgress).toHaveBeenCalledWith('254722833440', {
        tag: 'SOMO',
        moduleId: 2,
        metadata: { quizScore: 85 },
        context: { lastQuestion: 'Test question' },
      });
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockProgressService.getProgress.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/progress?identifier=254722833440&tag=SOMO');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Database connection failed');
    });

    it('should handle update service errors gracefully', async () => {
      mockProgressService.updateProgress.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .post('/progress')
        .send({ identifier: '254722833440', tag: 'SOMO', moduleId: 1 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });
});
