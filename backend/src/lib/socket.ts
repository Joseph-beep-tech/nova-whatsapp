import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: Server | null = null;

interface SocketAuthPayload {
  userId: string;
  role?: string;
}

/**
 * Every non-rider socket (admin/restaurant staff) joins this room. There's no
 * distinct "restaurant" role today — only Restaurant.ownerId — so scoping is
 * done client-side via the restaurantId included in each payload rather than
 * server-side rooms, for now.
 */
const ADMIN_ROOM = 'admin';
const riderRoom = (riderId: string) => `rider:${riderId}`;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: (origin, cb) => cb(null, true), credentials: true },
  });

  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as SocketAuthPayload;
      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketAuthPayload;
    if (user.role === 'rider') {
      socket.join(riderRoom(user.userId));
    } else {
      socket.join(ADMIN_ROOM);
    }
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized — call initSocket() first');
  return io;
}

export function emitToAdmins(event: string, payload: unknown) {
  io?.to(ADMIN_ROOM).emit(event, payload);
}

export function emitToRider(riderId: string, event: string, payload: unknown) {
  io?.to(riderRoom(riderId)).emit(event, payload);
}
