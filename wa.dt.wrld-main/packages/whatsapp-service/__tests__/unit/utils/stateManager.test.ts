/**
 * StateManager Unit Tests
 *
 * Tests for MongoDB-based state management.
 * Uses mocking since we can't connect to real MongoDB in unit tests.
 * Validates Task 028: "Unit tests pass"
 */

import mongoose from 'mongoose';

// Mock mongoose before importing stateManager
jest.mock('mongoose', () => {
  const mockConnection = {
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockModel = jest.fn().mockImplementation(() => ({
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  }));

  // Create Schema constructor with Types property
  const MockSchema = jest.fn().mockImplementation(function (definition: unknown) {
    return {
      definition,
      index: jest.fn().mockReturnThis(),
    };
  }) as jest.Mock & { Types: { Mixed: string } };

  MockSchema.Types = { Mixed: 'Mixed' };

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    connection: mockConnection,
    model: mockModel,
    Schema: MockSchema,
  };
});

// Import after mocking
import { stateManager } from '../../../src/utils/stateManager';

// Helper to access private properties for testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sm = stateManager as any;

describe('StateManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('init()', () => {
    it('connects to MongoDB with default URI when MONGODB_URI is not set', async () => {
      // Save and unset env var to test the fallback default
      const originalUri = process.env.MONGODB_URI;
      delete process.env.MONGODB_URI;

      // Reset state for testing
      sm.isConnected = false;
      sm.connectionPromise = null;

      await stateManager.init();

      expect(mongoose.connect).toHaveBeenCalledWith(
        'mongodb://mongodb:27017/whatsapp-service',
        expect.objectContaining({
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        })
      );

      // Restore env var
      if (originalUri !== undefined) {
        process.env.MONGODB_URI = originalUri;
      }
    });

    it('uses MONGODB_URI environment variable when set', async () => {
      const originalUri = process.env.MONGODB_URI;
      process.env.MONGODB_URI = 'mongodb://custom-host:27017/custom-db';

      // Reset state for testing
      sm.isConnected = false;
      sm.connectionPromise = null;

      await stateManager.init();

      expect(mongoose.connect).toHaveBeenCalledWith(
        'mongodb://custom-host:27017/custom-db',
        expect.any(Object)
      );

      process.env.MONGODB_URI = originalUri;
    });

    it('does not reconnect if already connected', async () => {
      sm.isConnected = true;
      sm.connectionPromise = null;

      await stateManager.init();

      expect(mongoose.connect).not.toHaveBeenCalled();
    });

    it('reuses existing connection promise if in progress', async () => {
      sm.isConnected = false;
      const mockPromise = Promise.resolve();
      sm.connectionPromise = mockPromise;

      const result = stateManager.init();

      // Result should be the same promise instance
      expect(result).toStrictEqual(mockPromise);
      // mongoose.connect should not be called again
      expect(mongoose.connect).not.toHaveBeenCalled();
    });

    it('sets up connection event handlers', async () => {
      sm.isConnected = false;
      sm.connectionPromise = null;

      await stateManager.init();

      expect(mongoose.connection.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mongoose.connection.on).toHaveBeenCalledWith('reconnected', expect.any(Function));
      expect(mongoose.connection.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('ensureConnected()', () => {
    it('throws error when not connected', () => {
      sm.isConnected = false;

      expect(() => {
        sm.ensureConnected();
      }).toThrow('State manager not initialized. Call init() first.');
    });

    it('does not throw when connected', () => {
      sm.isConnected = true;

      expect(() => {
        sm.ensureConnected();
      }).not.toThrow();
    });
  });

  describe('Webhook Management', () => {
    beforeEach(() => {
      sm.isConnected = true;
    });

    describe('registerWebhook()', () => {
      it('throws when not connected', async () => {
        sm.isConnected = false;

        await expect(
          stateManager.registerWebhook('session1', 'https://example.com/hook', ['message'])
        ).rejects.toThrow('State manager not initialized');
      });
    });

    describe('unregisterWebhook()', () => {
      it('throws when not connected', async () => {
        sm.isConnected = false;

        await expect(
          stateManager.unregisterWebhook('session1', 'https://example.com/hook')
        ).rejects.toThrow('State manager not initialized');
      });
    });

    describe('getWebhooks()', () => {
      it('throws when not connected', async () => {
        sm.isConnected = false;

        await expect(stateManager.getWebhooks('session1')).rejects.toThrow(
          'State manager not initialized'
        );
      });
    });

    describe('getAllWebhooks()', () => {
      it('throws when not connected', async () => {
        sm.isConnected = false;

        await expect(stateManager.getAllWebhooks()).rejects.toThrow(
          'State manager not initialized'
        );
      });
    });
  });

  describe('Config Management', () => {
    beforeEach(() => {
      sm.isConnected = true;
    });

    describe('setConfig()', () => {
      it('throws when not connected', async () => {
        sm.isConnected = false;

        await expect(stateManager.setConfig('key', 'value')).rejects.toThrow(
          'State manager not initialized'
        );
      });
    });

    describe('getConfig()', () => {
      it('throws when not connected', async () => {
        sm.isConnected = false;

        await expect(stateManager.getConfig('key')).rejects.toThrow(
          'State manager not initialized'
        );
      });
    });

    describe('getAllConfig()', () => {
      it('throws when not connected', async () => {
        sm.isConnected = false;

        await expect(stateManager.getAllConfig()).rejects.toThrow(
          'State manager not initialized'
        );
      });
    });
  });

  describe('getState()', () => {
    it('throws when not connected', async () => {
      sm.isConnected = false;

      await expect(stateManager.getState()).rejects.toThrow('State manager not initialized');
    });
  });

  describe('close()', () => {
    it('closes connection when connected', async () => {
      sm.isConnected = true;

      await stateManager.close();

      expect(mongoose.connection.close).toHaveBeenCalled();
      expect(sm.isConnected).toBe(false);
    });

    it('does nothing when not connected', async () => {
      sm.isConnected = false;

      await stateManager.close();

      expect(mongoose.connection.close).not.toHaveBeenCalled();
    });
  });

  describe('Welcome Tag Management', () => {
    beforeEach(() => {
      sm.isConnected = true;
    });

    describe('markTagWelcomed()', () => {
      it('throws when not connected', async () => {
        sm.isConnected = false;

        await expect(
          stateManager.markTagWelcomed('254722833440@c.us', 'SOMO')
        ).rejects.toThrow('State manager not initialized');
      });
    });

    describe('isTagWelcomed()', () => {
      it('throws when not connected', async () => {
        sm.isConnected = false;

        await expect(
          stateManager.isTagWelcomed('254722833440@c.us', 'SOMO')
        ).rejects.toThrow('State manager not initialized');
      });
    });
  });
});
