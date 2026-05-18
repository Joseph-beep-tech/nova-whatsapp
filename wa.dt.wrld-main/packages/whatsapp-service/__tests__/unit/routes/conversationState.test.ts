/**
 * Conversation State Routes Unit Tests
 *
 * Tests for the /conversation-state API endpoints.
 * Critical: Tests undefined/missing parameters to prevent production errors.
 */

import express, { Express } from 'express';
import request from 'supertest';
import conversationStateRouter from '../../../src/routes/conversationState';
import { stateManager } from '../../../src/utils/stateManager';

// Mock the state manager
jest.mock('../../../src/utils/stateManager', () => ({
  stateManager: {
    getConversationState: jest.fn(),
    setConversationState: jest.fn(),
  },
}));

const mockStateManager = stateManager as jest.Mocked<typeof stateManager>;

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/conversation-state', conversationStateRouter);
  return app;
}

describe('Conversation State Routes', () => {
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  // ===========================================================================
  // GET /conversation-state/:sessionId?identifier=X - Get Conversation State
  // ===========================================================================

  describe('GET /conversation-state/:sessionId', () => {
    describe('parameter validation', () => {
      it('should return 400 when identifier query param is missing', async () => {
        const response = await request(app)
          .get('/conversation-state/mysession');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('identifier query parameter is required');
      });
    });

    describe('state retrieval', () => {
      it('should return 404 when conversation state not found', async () => {
        mockStateManager.getConversationState.mockResolvedValue(null);

        const response = await request(app)
          .get('/conversation-state/mysession?identifier=254722833440');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Conversation state not found');
        expect(mockStateManager.getConversationState).toHaveBeenCalledWith(
          '254722833440',
          'mysession'
        );
      });

      it('should return conversation state when found', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          assignedAgent: 'agent-123',
          lastAgentActivity: '2026-02-12T10:00:00.000Z',
          automationPaused: true,
          metadata: { notes: 'Customer escalation' },
          createdAt: '2026-02-10T08:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.getConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .get('/conversation-state/mysession?identifier=254722833440');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state).toEqual(mockState);
        expect(response.body.state.handoffStatus).toBe('active');
        expect(response.body.state.assignedAgent).toBe('agent-123');
        expect(response.body.state.automationPaused).toBe(true);
      });

      it('should return state with minimal fields (automated)', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'automated' as const,
          automationPaused: false,
          createdAt: '2026-02-10T08:00:00.000Z',
          updatedAt: '2026-02-10T08:00:00.000Z',
        };

        mockStateManager.getConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .get('/conversation-state/mysession?identifier=254722833440');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.handoffStatus).toBe('automated');
        expect(response.body.state.automationPaused).toBe(false);
        expect(response.body.state.assignedAgent).toBeUndefined();
      });

      it('should handle group identifiers', async () => {
        const mockState = {
          identifier: '120363123456789012',
          platform: 'g.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'automated' as const,
          automationPaused: false,
          createdAt: '2026-02-10T08:00:00.000Z',
          updatedAt: '2026-02-10T08:00:00.000Z',
        };

        mockStateManager.getConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .get('/conversation-state/mysession?identifier=120363123456789012');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.identifier).toBe('120363123456789012');
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockStateManager.getConversationState.mockRejectedValue(
          new Error('Database connection failed')
        );

        const response = await request(app)
          .get('/conversation-state/mysession?identifier=254722833440');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Database connection failed');
      });

      it('should handle unknown error types', async () => {
        mockStateManager.getConversationState.mockRejectedValue('Unknown error');

        const response = await request(app)
          .get('/conversation-state/mysession?identifier=254722833440');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // POST /conversation-state/:sessionId - Set/Update Conversation State
  // ===========================================================================

  describe('POST /conversation-state/:sessionId', () => {
    describe('parameter validation', () => {
      it('should return 400 when identifier is missing from body', async () => {
        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ handoffStatus: 'active' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('identifier is required');
      });

      it('should return 400 for invalid handoffStatus', async () => {
        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', handoffStatus: 'invalid_status' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid handoffStatus');
        expect(response.body.error).toContain('automated, requested, active, resolved');
      });

      it('should return 400 when no update fields provided', async () => {
        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('At least one field must be provided for update');
      });
    });

    describe('valid handoffStatus values', () => {
      it('should accept handoffStatus: automated', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'automated' as const,
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', handoffStatus: 'automated' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.handoffStatus).toBe('automated');
      });

      it('should accept handoffStatus: requested', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'requested' as const,
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', handoffStatus: 'requested' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.handoffStatus).toBe('requested');
      });

      it('should accept handoffStatus: active', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', handoffStatus: 'active' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.handoffStatus).toBe('active');
      });

      it('should accept handoffStatus: resolved', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'resolved' as const,
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', handoffStatus: 'resolved' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.handoffStatus).toBe('resolved');
      });
    });

    describe('field updates', () => {
      it('should update assignedAgent field', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          assignedAgent: 'agent-456',
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', assignedAgent: 'agent-456' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.assignedAgent).toBe('agent-456');
        expect(mockStateManager.setConversationState).toHaveBeenCalledWith(
          '254722833440',
          'c.us',
          'mysession',
          expect.objectContaining({ assignedAgent: 'agent-456' })
        );
      });

      it('should update lastAgentActivity field', async () => {
        const activityDate = '2026-02-12T10:30:00.000Z';
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          lastAgentActivity: activityDate,
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:30:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', lastAgentActivity: activityDate });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.lastAgentActivity).toBe(activityDate);
        expect(mockStateManager.setConversationState).toHaveBeenCalledWith(
          '254722833440',
          'c.us',
          'mysession',
          expect.objectContaining({
            lastAgentActivity: expect.any(Date),
          })
        );
      });

      it('should update automationPaused field (true)', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          automationPaused: true,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', automationPaused: true });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.automationPaused).toBe(true);
      });

      it('should update automationPaused field (false)', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'automated' as const,
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', automationPaused: false });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.automationPaused).toBe(false);
      });

      it('should update metadata field', async () => {
        const metadata = {
          escalationReason: 'complex_query',
          priority: 'high',
          tags: ['billing', 'refund'],
        };

        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          metadata,
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', metadata });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.metadata).toEqual(metadata);
      });

      it('should update multiple fields at once', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          assignedAgent: 'agent-789',
          automationPaused: true,
          metadata: { notes: 'VIP customer' },
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({
            identifier: '254722833440',
            handoffStatus: 'active',
            assignedAgent: 'agent-789',
            automationPaused: true,
            metadata: { notes: 'VIP customer' },
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.handoffStatus).toBe('active');
        expect(response.body.state.assignedAgent).toBe('agent-789');
        expect(response.body.state.automationPaused).toBe(true);
        expect(response.body.state.metadata).toEqual({ notes: 'VIP customer' });
      });
    });

    describe('edge cases', () => {
      it('should handle group identifiers with platform', async () => {
        const mockState = {
          identifier: '120363123456789012',
          platform: 'g.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '120363123456789012', platform: 'g.us', handoffStatus: 'active' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.identifier).toBe('120363123456789012');
      });

      it('should handle empty string assignedAgent', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'automated' as const,
          assignedAgent: '',
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', assignedAgent: '' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.assignedAgent).toBe('');
      });

      it('should handle empty metadata object', async () => {
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'automated' as const,
          metadata: {},
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', metadata: {} });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.metadata).toEqual({});
      });

      it('should handle nested metadata objects', async () => {
        const metadata = {
          customer: {
            tier: 'premium',
            accountAge: 365,
          },
          issue: {
            category: 'billing',
            subcategory: 'refund_request',
          },
        };

        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          metadata,
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', metadata });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.state.metadata).toEqual(metadata);
      });
    });

    describe('error handling', () => {
      it('should return 500 on database error', async () => {
        mockStateManager.setConversationState.mockRejectedValue(
          new Error('Database write failed')
        );

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', handoffStatus: 'active' });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Database write failed');
      });

      it('should handle unknown error types', async () => {
        mockStateManager.setConversationState.mockRejectedValue('Unknown error');

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', handoffStatus: 'active' });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });

      it('should handle invalid date format in lastAgentActivity', async () => {
        // Invalid date should still be passed through (Date constructor handles it)
        const mockState = {
          identifier: '254722833440',
          platform: 'c.us' as const,
          sessionId: 'mysession',
          handoffStatus: 'active' as const,
          lastAgentActivity: 'Invalid Date',
          automationPaused: false,
          createdAt: '2026-02-12T10:00:00.000Z',
          updatedAt: '2026-02-12T10:00:00.000Z',
        };

        mockStateManager.setConversationState.mockResolvedValue(mockState);

        const response = await request(app)
          .post('/conversation-state/mysession')
          .send({ identifier: '254722833440', lastAgentActivity: 'invalid-date' });

        // Note: The route accepts any string and converts to Date
        // Invalid dates become "Invalid Date" but don't throw errors
        expect(response.status).toBe(200);
      });
    });
  });
});
