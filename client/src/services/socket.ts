import { io, type Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "./socketEvents";

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!_socket) {
    throw new Error("Socket not initialized — call connectSocket() first");
  }
  return _socket;
}

export function connectSocket(): Promise<AppSocket> {
  if (_socket?.connected) return Promise.resolve(_socket);

  const url =
    (import.meta.env.VITE_SOCKET_URL as string | undefined) ??
    "http://localhost:3000";
  _socket = io(url, { autoConnect: false });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      _socket?.disconnect();
      _socket = null;
      reject(new Error("Connection timeout"));
    }, 10_000);

    _socket!.once("connect", () => {
      clearTimeout(timeout);
      resolve(_socket!);
    });
    _socket!.once("connect_error", (err) => {
      clearTimeout(timeout);
      _socket = null;
      reject(err);
    });
    _socket!.connect();
  });
}

export function disconnectSocket(): void {
  _socket?.disconnect();
  _socket = null;
}
