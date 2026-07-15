import { io, Socket } from 'socket.io-client';

// VITE_API_URL includes a trailing /api (e.g. https://host/api) so axios's
// baseURL just works with relative paths like '/orders'. Socket.IO needs the
// bare origin instead — a path here is parsed as a *namespace*, and the
// server only serves the default namespace, so any suffix must be stripped.
function deriveSocketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!apiUrl) return 'http://localhost:4000';
  try {
    return new URL(apiUrl).origin;
  } catch {
    return apiUrl.replace(/\/api\/?$/, '');
  }
}

const SOCKET_URL = deriveSocketUrl();

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  socket = io(SOCKET_URL, {
    auth: { token: localStorage.getItem('token') },
    transports: ['websocket'],
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
