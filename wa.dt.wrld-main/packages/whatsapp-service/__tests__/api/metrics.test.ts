/**
 * Metrics API Tests
 *
 * Tests the metrics endpoint for deduplication statistics.
 */

import request from 'supertest';
import express, { Express } from 'express';
import { metricsRouter } from '../../src/routes/metrics';
import type { DeduplicationMetrics } from '../../src/services/deduplicationService';

// Mock dependencies
jest.mock('../../src/shared/config', () => ({
  deduplicationConfig: {
    enabled: true,
    windowSeconds: 300,
    useRedis: true,
    keyPrefix: 'dedup:event:',
  },
}));

jest.mock('../../src/services/deduplicationService', () => ({
  deduplicationService: {
    getMetrics: jest.fn(),
  },
}));

// Import mocked dependencies
import { deduplicationConfig } from '../../src/shared/config';
import { deduplicationService } from '../../src/services/deduplicationService';

describe('Metrics API', () => {
  let app: Express;
  const API_KEY = 'test-api-key';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create test app
    app = express();
    app.use(express.json());

    // Add auth middleware
    app.use((req, res, next) => {
      const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!providedKey || providedKey !== API_KEY) {
        return res.status(403).json({
          success: false,
          error: 'Invalid or missing API key',
        });
      }

      next();
    });

    // Mount metrics router
    app.use('/metrics', metricsRouter);

    // Reset config to default enabled state
    (deduplicationConfig as { enabled: boolean }).enabled = true;
  });

  describe('GET /metrics/deduplication', () => {
    describe('Authentication', () => {
      it('should require API key authentication', async () => {
        const response = await request(app)
          .get('/metrics/deduplication');

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          success: false,
          error: 'Invalid or missing API key',
        });
      });

      it('should accept API key in x-api-key header', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 100,
          duplicatesDetected: 5,
          duplicateRate: 5.0,
          byEventType: {},
          uptimeSeconds: 3600,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
      });

      it('should accept API key in Authorization Bearer header', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 100,
          duplicatesDetected: 5,
          duplicateRate: 5.0,
          byEventType: {},
          uptimeSeconds: 3600,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('Authorization', `Bearer ${API_KEY}`);

        expect(response.status).toBe(200);
      });

      it('should reject invalid API key', async () => {
        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', 'wrong-key');

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          success: false,
          error: 'Invalid or missing API key',
        });
      });
    });

    describe('When deduplication is disabled', () => {
      beforeEach(() => {
        (deduplicationConfig as { enabled: boolean }).enabled = false;
      });

      it('should return disabled status', async () => {
        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          enabled: false,
          message: 'Deduplication service is disabled',
        });
        expect(deduplicationService.getMetrics).not.toHaveBeenCalled();
      });
    });

    describe('When deduplication is enabled', () => {
      it('should return metrics with zero counts', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 0,
          duplicatesDetected: 0,
          duplicateRate: 0,
          byEventType: {},
          uptimeSeconds: 60,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          enabled: true,
          metrics: mockMetrics,
        });
        expect(deduplicationService.getMetrics).toHaveBeenCalledTimes(1);
      });

      it('should return metrics with non-zero counts', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 100,
          duplicatesDetected: 5,
          duplicateRate: 5.0,
          byEventType: {
            message: {
              total: 80,
              duplicates: 4,
              duplicateRate: 5.0,
            },
            reaction: {
              total: 20,
              duplicates: 1,
              duplicateRate: 5.0,
            },
          },
          uptimeSeconds: 3600,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          enabled: true,
          metrics: mockMetrics,
        });
      });

      it('should include event type breakdown in metrics', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 250,
          duplicatesDetected: 15,
          duplicateRate: 6.0,
          byEventType: {
            message: {
              total: 150,
              duplicates: 10,
              duplicateRate: 6.67,
            },
            edit: {
              total: 50,
              duplicates: 3,
              duplicateRate: 6.0,
            },
            reaction: {
              total: 40,
              duplicates: 2,
              duplicateRate: 5.0,
            },
            ack: {
              total: 10,
              duplicates: 0,
              duplicateRate: 0,
            },
          },
          uptimeSeconds: 7200,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.metrics.byEventType).toEqual(mockMetrics.byEventType);
        expect(Object.keys(response.body.metrics.byEventType)).toHaveLength(4);
      });

      it('should include uptime in metrics', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 50,
          duplicatesDetected: 2,
          duplicateRate: 4.0,
          byEventType: {},
          uptimeSeconds: 86400, // 24 hours
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.metrics.uptimeSeconds).toBe(86400);
      });

      it('should include Redis connection status', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 30,
          duplicatesDetected: 1,
          duplicateRate: 3.33,
          byEventType: {},
          uptimeSeconds: 300,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.metrics.redisConnected).toBe(true);
      });

      it('should handle Redis disconnected state', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 10,
          duplicatesDetected: 0,
          duplicateRate: 0,
          byEventType: {},
          uptimeSeconds: 120,
          redisConnected: false,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.metrics.redisConnected).toBe(false);
      });
    });

    describe('Error Handling', () => {
      it('should return 500 when getMetrics throws an error', async () => {
        const mockError = new Error('Redis connection failed');
        (deduplicationService.getMetrics as jest.Mock).mockRejectedValue(mockError);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: 'Redis connection failed',
        });
      });

      it('should handle non-Error exceptions', async () => {
        (deduplicationService.getMetrics as jest.Mock).mockRejectedValue('String error');

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          error: 'String error',
        });
      });

      it('should handle service unavailable error', async () => {
        const mockError = new Error('Service temporarily unavailable');
        (deduplicationService.getMetrics as jest.Mock).mockRejectedValue(mockError);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('unavailable');
      });
    });

    describe('Response Format', () => {
      it('should return valid JSON format', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 100,
          duplicatesDetected: 5,
          duplicateRate: 5.0,
          byEventType: {},
          uptimeSeconds: 3600,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/json/);
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('enabled');
        expect(response.body).toHaveProperty('metrics');
      });

      it('should have all required metric fields', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 100,
          duplicatesDetected: 5,
          duplicateRate: 5.0,
          byEventType: {},
          uptimeSeconds: 3600,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.metrics).toHaveProperty('totalEvents');
        expect(response.body.metrics).toHaveProperty('duplicatesDetected');
        expect(response.body.metrics).toHaveProperty('duplicateRate');
        expect(response.body.metrics).toHaveProperty('byEventType');
        expect(response.body.metrics).toHaveProperty('uptimeSeconds');
        expect(response.body.metrics).toHaveProperty('redisConnected');
      });

      it('should use correct data types in response', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 100,
          duplicatesDetected: 5,
          duplicateRate: 5.0,
          byEventType: {
            message: {
              total: 100,
              duplicates: 5,
              duplicateRate: 5.0,
            },
          },
          uptimeSeconds: 3600,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(typeof response.body.success).toBe('boolean');
        expect(typeof response.body.enabled).toBe('boolean');
        expect(typeof response.body.metrics.totalEvents).toBe('number');
        expect(typeof response.body.metrics.duplicatesDetected).toBe('number');
        expect(typeof response.body.metrics.duplicateRate).toBe('number');
        expect(typeof response.body.metrics.uptimeSeconds).toBe('number');
        expect(typeof response.body.metrics.redisConnected).toBe('boolean');
        expect(typeof response.body.metrics.byEventType).toBe('object');
      });
    });

    describe('High Load Scenarios', () => {
      it('should handle high event counts', async () => {
        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 1000000,
          duplicatesDetected: 50000,
          duplicateRate: 5.0,
          byEventType: {
            message: {
              total: 800000,
              duplicates: 40000,
              duplicateRate: 5.0,
            },
            reaction: {
              total: 200000,
              duplicates: 10000,
              duplicateRate: 5.0,
            },
          },
          uptimeSeconds: 604800, // 7 days
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(response.body.metrics.totalEvents).toBe(1000000);
        expect(response.body.metrics.duplicatesDetected).toBe(50000);
      });

      it('should handle many event types', async () => {
        const byEventType: Record<string, { total: number; duplicates: number; duplicateRate: number }> = {};
        for (let i = 0; i < 20; i++) {
          byEventType[`event_type_${i}`] = {
            total: 100 * i,
            duplicates: 5 * i,
            duplicateRate: i > 0 ? 5.0 : 0,
          };
        }

        const mockMetrics: DeduplicationMetrics = {
          totalEvents: 19000,
          duplicatesDetected: 950,
          duplicateRate: 5.0,
          byEventType,
          uptimeSeconds: 3600,
          redisConnected: true,
        };

        (deduplicationService.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

        const response = await request(app)
          .get('/metrics/deduplication')
          .set('x-api-key', API_KEY);

        expect(response.status).toBe(200);
        expect(Object.keys(response.body.metrics.byEventType)).toHaveLength(20);
      });
    });
  });
});
