/**
 * EventHub Service
 *
 * Socket.io real-time event broadcaster for the HITL dashboard.
 * Wraps the Socket.io Server instance and provides typed emit methods
 * matching the dashboard's SocketEventMap.
 *
 * Authentication supports two methods:
 * 1. API key — via `auth.apiKey` or `x-api-key` header (for backend/automation)
 * 2. Keycloak session cookie — via shared Express session middleware (for dashboard)
 *
 * Session scoping: clients join a room keyed by their `sessionId` query param.
 * Payloads with a `sessionId` field are emitted to that room; others broadcast.
 */

import http from 'http';
import { RequestHandler } from 'express';
import { Server } from 'socket.io';
import { socketConfig, corsConfig, config } from '../shared/config';
import type {
  SocketMessagePayload,
  SocketMessageUpdatePayload,
  SocketChatUpdatePayload,
  SocketSessionStatusPayload,
} from '../types/socket';

export class EventHubService {
  private io: Server | null = null;
  private connectedClients = 0;

  /**
   * Initialize Socket.io server on the given HTTP server.
   * No-op if already initialized.
   *
   * @param httpServer  The Node.js HTTP server to attach to
   * @param sessionMiddleware  Optional Express session middleware for cookie-based auth
   */
  init(httpServer: http.Server, sessionMiddleware?: RequestHandler): void {
    if (this.io) {
      return;
    }

    this.io = new Server(httpServer, {
      path: socketConfig.path,
      cors: {
        origin: corsConfig.origins,
        credentials: corsConfig.credentials,
      },
      transports: ['websocket', 'polling'],
    });

    // Share Express session middleware with Socket.io's HTTP engine.
    // This parses the session cookie on every handshake so that
    // socket.request.session is populated for Keycloak-authenticated
    // dashboard clients.
    if (sessionMiddleware) {
      this.io.engine.use(sessionMiddleware);
    }

    // Connection authentication: API key OR Keycloak session
    this.io.use((socket, next) => {
      // Method 1: API key (backend clients, automation)
      const apiKey = socket.handshake.auth.apiKey as string
        || socket.handshake.headers['x-api-key'] as string;

      if (apiKey && apiKey === config.apiKey) {
        return next();
      }

      // Method 2: Keycloak session cookie (dashboard browser clients)
      // After engine.use(sessionMiddleware), the session is on socket.request
      const req = socket.request as http.IncomingMessage & {
        session?: { tokens?: unknown; user?: unknown };
      };
      if (req.session?.tokens || req.session?.user) {
        return next();
      }

      console.warn(`[EventHub] Rejected unauthenticated connection: ${socket.id}`);
      next(new Error('Authentication required — provide apiKey in auth or x-api-key header'));
    });

    this.io.on('connection', (socket) => {
      this.connectedClients++;
      const rawSessionId = socket.handshake.query.sessionId;
      const sessionId = Array.isArray(rawSessionId)
        ? rawSessionId[0] ?? 'unknown'
        : rawSessionId ?? 'unknown';

      // Join a room keyed by sessionId for scoped event delivery
      socket.join(`session:${sessionId}`);
      console.log(`[EventHub] Client connected: ${socket.id} (session: ${sessionId}, total: ${this.connectedClients})`);

      socket.on('disconnect', (reason) => {
        this.connectedClients = Math.max(0, this.connectedClients - 1);
        console.log(`[EventHub] Client disconnected: ${socket.id} (${reason}, total: ${this.connectedClients})`);
      });
    });

    console.log(`✅ Socket.io server initialized (path: ${socketConfig.path})`);
  }

  /** Check if EventHub is active and has an io instance */
  isEnabled(): boolean {
    return this.io !== null;
  }

  /** Number of currently connected clients */
  getConnectedClients(): number {
    return this.connectedClients;
  }

  // -------------------------------------------------------------------------
  // Typed emit methods — all are no-op if io is not initialized.
  // Payloads with a sessionId field emit to that session's room;
  // others broadcast to all connected clients.
  // -------------------------------------------------------------------------

  /**
   * Emit to a specific session room when the payload has a sessionId,
   * otherwise broadcast to all connected clients.
   */
  private emitToSessionOrAll(event: string, payload: unknown): void {
    if (!this.io) return;

    const p = payload as { sessionId?: string } | null | undefined;
    const sessionId = p?.sessionId;

    if (sessionId) {
      this.io.to(`session:${sessionId}`).emit(event, payload);
    } else {
      this.io.emit(event, payload);
    }
  }

  emitMessage(payload: SocketMessagePayload): void {
    this.emitToSessionOrAll('message:new', payload);
  }

  emitMessageUpdate(payload: SocketMessageUpdatePayload): void {
    this.emitToSessionOrAll('message:update', payload);
  }

  emitChatUpdate(payload: SocketChatUpdatePayload): void {
    this.emitToSessionOrAll('chat:update', payload);
  }

  emitTypingStart(payload: { chatId: string; identifier?: string; platform?: string }): void {
    this.emitToSessionOrAll('typing:start', payload);
  }

  emitTypingStop(payload: { chatId: string; identifier?: string; platform?: string }): void {
    this.emitToSessionOrAll('typing:stop', payload);
  }

  emitSessionStatus(payload: SocketSessionStatusPayload): void {
    this.emitToSessionOrAll('session:status', payload);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Gracefully close all socket connections */
  async shutdown(): Promise<void> {
    if (!this.io) return;

    return new Promise((resolve) => {
      this.io!.close(() => {
        this.io = null;
        this.connectedClients = 0;
        resolve();
      });
    });
  }
}

// Singleton
export const eventHub = new EventHubService();
