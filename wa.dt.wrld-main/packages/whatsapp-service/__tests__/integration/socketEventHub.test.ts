/**
 * Integration Test: Socket.io EventHub
 *
 * Tests the real-time Socket.io engine end-to-end:
 * 1. Auth: API key required — rejects unauthenticated connections
 * 2. Auth: API key accepted — connects with valid key
 * 3. Events: message:new emitted when message_create processed
 * 4. Events: session:status emitted for lifecycle events (qr, ready, disconnected)
 * 5. Events: message:update emitted for message_ack
 * 6. Events: chat:update emitted alongside message:new
 * 7. Filtering: own messages (fromMe) do NOT emit socket events
 * 8. Shutdown: graceful close of all connections
 *
 * Requires: MongoDB on localhost:27017, no Redis needed for basic tests
 */

// CRITICAL: Set environment variables BEFORE imports
process.env.ENABLE_SOCKET = 'true';
process.env.ENABLE_ALERTS = 'false';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-test-socket';
process.env.API_KEY = 'test-socket-api-key';

import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { EventHubService } from '../../src/services/eventHub';
import { eventRouter } from '../../src/services/eventRouter';
import { stateManager } from '../../src/utils/stateManager';
import { QueuedEvent } from '../../src/services/eventQueue';
import type {
  SocketMessagePayload,
  SocketMessageUpdatePayload,
  SocketSessionStatusPayload,
  SocketChatUpdatePayload,
} from '../../src/types/socket';

const API_KEY = 'test-socket-api-key';
const PORT = 0; // Let OS pick a free port

describe('Socket.io EventHub Integration', () => {
  let httpServer: http.Server;
  let hub: EventHubService;
  let serverUrl: string;

  beforeAll(async () => {
    // Connect to test MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-test-socket');
    }
    await stateManager.init();

    // Create Express app + HTTP server
    const app = express();
    httpServer = http.createServer(app);

    // Initialize EventHub
    hub = new EventHubService();
    hub.init(httpServer);
    eventRouter.setEventHub(hub);

    // Start listening on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, () => resolve());
    });

    const addr = httpServer.address();
    if (addr && typeof addr === 'object') {
      serverUrl = `http://localhost:${addr.port}`;
    }
  });

  afterAll(async () => {
    // Shutdown hub first
    await hub.shutdown();

    // Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });

    // Close MongoDB
    await mongoose.connection.close();
  });

  /**
   * Helper: create authenticated socket client
   */
  function createClient(opts?: { apiKey?: string; sessionId?: string }): ClientSocket {
    return ioClient(serverUrl, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { apiKey: opts?.apiKey ?? API_KEY },
      query: { sessionId: opts?.sessionId ?? 'test-session' },
    });
  }

  /**
   * Helper: wait for an event with timeout
   */
  function waitForEvent<T>(client: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
      client.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  // -------------------------------------------------------------------------
  // 1. Authentication
  // -------------------------------------------------------------------------

  describe('Authentication', () => {
    it('should reject connections without API key', (done) => {
      const client = ioClient(serverUrl, {
        transports: ['websocket'],
        autoConnect: false,
        // No auth provided
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication required');
        client.close();
        done();
      });

      client.connect();
    });

    it('should reject connections with wrong API key', (done) => {
      const client = ioClient(serverUrl, {
        transports: ['websocket'],
        autoConnect: false,
        auth: { apiKey: 'wrong-key' },
      });

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication required');
        client.close();
        done();
      });

      client.connect();
    });

    it('should accept connections with valid API key', (done) => {
      const client = createClient();

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        expect(hub.getConnectedClients()).toBeGreaterThanOrEqual(1);
        client.close();
        done();
      });

      client.connect();
    });

    it('should accept API key via x-api-key header', (done) => {
      const client = ioClient(serverUrl, {
        transports: ['websocket'],
        autoConnect: false,
        extraHeaders: { 'x-api-key': API_KEY },
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.close();
        done();
      });

      client.connect();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Message Events
  // -------------------------------------------------------------------------

  describe('Message Events', () => {
    let client: ClientSocket;

    beforeEach((done) => {
      client = createClient();
      client.on('connect', () => done());
      client.connect();
    });

    afterEach(() => {
      client.close();
    });

    it('should emit message:new for inbound message_create events', async () => {
      const messagePromise = waitForEvent<SocketMessagePayload>(client, 'message:new');

      // Simulate inbound message via eventRouter.processEvent
      const event: QueuedEvent = {
        sessionId: 'test-session',
        dataType: 'message_create',
        data: {
          from: '254700000001@c.us',
          body: 'Hello from integration test',
          fromMe: false,
          notifyName: 'Test User',
          id: { _serialized: 'msg-123' },
          type: 'chat',
        },
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(event);

      const msg = await messagePromise;
      expect(msg.id).toBe('msg-123');
      expect(msg.content).toBe('Hello from integration test');
      expect(msg.isFromMe).toBe(false);
      expect(msg.sender.type).toBe('customer');
      expect(msg.sender.name).toBe('Test User');
      expect(msg.contentType).toBe('text');
    });

    it('should emit chat:update alongside message:new', async () => {
      const chatPromise = waitForEvent<SocketChatUpdatePayload>(client, 'chat:update');

      const event: QueuedEvent = {
        sessionId: 'test-session',
        dataType: 'message_create',
        data: {
          from: '254700000002@c.us',
          body: 'Chat update test',
          fromMe: false,
          id: { _serialized: 'msg-456' },
        },
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(event);

      const chat = await chatPromise;
      expect(chat.id).toContain('254700000002');
      expect(chat.lastMessage).toBe('Chat update test');
    });

    it('should NOT emit message:new for own messages (fromMe)', async () => {
      let received = false;
      client.on('message:new', () => { received = true; });

      const event: QueuedEvent = {
        sessionId: 'test-session',
        dataType: 'message_create',
        data: {
          from: '254700000003@c.us',
          body: 'Bot reply',
          fromMe: true,
          id: { _serialized: 'msg-bot-1' },
        },
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(event);

      // Wait a beat to confirm no event arrives
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(received).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Message Ack Events
  // -------------------------------------------------------------------------

  describe('Message Ack Events', () => {
    let client: ClientSocket;

    beforeEach((done) => {
      client = createClient();
      client.on('connect', () => done());
      client.connect();
    });

    afterEach(() => {
      client.close();
    });

    it('should emit message:update for message_ack events', async () => {
      const updatePromise = waitForEvent<SocketMessageUpdatePayload>(client, 'message:update');

      const event: QueuedEvent = {
        sessionId: 'test-session',
        dataType: 'message_ack',
        data: {
          id: { _serialized: 'msg-ack-1' },
          ack: 3, // read
        },
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(event);

      const update = await updatePromise;
      expect(update.id).toBe('msg-ack-1');
      expect(update.status).toBe('read');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Session Lifecycle Events
  // -------------------------------------------------------------------------

  describe('Session Lifecycle Events', () => {
    let client: ClientSocket;

    beforeEach((done) => {
      // Connect with sessionId matching the events we'll emit
      client = createClient({ sessionId: 'mysession' });
      client.on('connect', () => done());
      client.connect();
    });

    afterEach(() => {
      client.close();
    });

    it('should emit session:status for "ready" events', async () => {
      const statusPromise = waitForEvent<SocketSessionStatusPayload>(client, 'session:status');

      const event: QueuedEvent = {
        sessionId: 'mysession',
        dataType: 'ready',
        data: {} as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(event);

      const status = await statusPromise;
      expect(status.sessionId).toBe('mysession');
      expect(status.status).toBe('connected');
    });

    it('should emit session:status with QR data for "qr" events', async () => {
      const statusPromise = waitForEvent<SocketSessionStatusPayload>(client, 'session:status');

      const event: QueuedEvent = {
        sessionId: 'mysession',
        dataType: 'qr',
        data: { qr: 'data:image/png;base64,AAAA' },
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(event);

      const status = await statusPromise;
      expect(status.sessionId).toBe('mysession');
      expect(status.status).toBe('qr_required');
      expect(status.qrCode).toBe('data:image/png;base64,AAAA');
    });

    it('should emit session:status as "loading" for "authenticated" events', async () => {
      const statusPromise = waitForEvent<SocketSessionStatusPayload>(client, 'session:status');

      const event: QueuedEvent = {
        sessionId: 'mysession',
        dataType: 'authenticated',
        data: {} as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(event);

      const status = await statusPromise;
      expect(status.sessionId).toBe('mysession');
      expect(status.status).toBe('loading');
    });

    it('should emit session:status for "disconnected" events', async () => {
      const statusPromise = waitForEvent<SocketSessionStatusPayload>(client, 'session:status');

      const event: QueuedEvent = {
        sessionId: 'mysession',
        dataType: 'disconnected',
        data: {} as Record<string, unknown>,
        receivedAt: new Date().toISOString(),
        tags: [],
      };

      await eventRouter.processEvent(event);

      const status = await statusPromise;
      expect(status.sessionId).toBe('mysession');
      expect(status.status).toBe('disconnected');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Connection Lifecycle
  // -------------------------------------------------------------------------

  describe('Connection Lifecycle', () => {
    it('should track connected client count', async () => {
      // Wait for any previous test clients to fully disconnect
      await new Promise(resolve => setTimeout(resolve, 200));
      const initialCount = hub.getConnectedClients();

      const client = createClient();

      // Connect
      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
        client.connect();
      });
      expect(hub.getConnectedClients()).toBe(initialCount + 1);

      // Disconnect
      client.close();
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(hub.getConnectedClients()).toBe(initialCount);
    });

    it('should handle multiple concurrent clients', async () => {
      const clients = [createClient(), createClient(), createClient()];

      // Connect all
      await Promise.all(clients.map((c) =>
        new Promise<void>((resolve) => {
          c.on('connect', () => resolve());
          c.connect();
        })
      ));

      expect(hub.getConnectedClients()).toBeGreaterThanOrEqual(3);

      // Disconnect all
      clients.forEach((c) => c.close());

      await new Promise(resolve => setTimeout(resolve, 200));
    });

    it('should handle graceful shutdown', async () => {
      // Create a fresh hub for shutdown testing
      const shutdownApp = express();
      const shutdownServer = http.createServer(shutdownApp);
      const shutdownHub = new EventHubService();

      await new Promise<void>((resolve) => {
        shutdownServer.listen(0, () => resolve());
      });

      const addr = shutdownServer.address();
      const url = addr && typeof addr === 'object' ? `http://localhost:${addr.port}` : '';
      shutdownHub.init(shutdownServer);

      // Connect a client
      const client = ioClient(url, {
        transports: ['websocket'],
        autoConnect: false,
        auth: { apiKey: API_KEY },
      });

      await new Promise<void>((resolve) => {
        client.on('connect', () => resolve());
        client.connect();
      });

      expect(shutdownHub.getConnectedClients()).toBe(1);

      // Shutdown
      await shutdownHub.shutdown();
      expect(shutdownHub.getConnectedClients()).toBe(0);
      expect(shutdownHub.isEnabled()).toBe(false);

      client.close();
      await new Promise<void>((resolve) => {
        shutdownServer.close(() => resolve());
      });
    });
  });
});
