import { io, Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";

class SocketClient {
  private socket: Socket | null = null;
  private _playerId: string | null = null;

  get playerId(): string | null {
    return this._playerId;
  }

  connect(): Socket {
    if (this.socket?.connected) return this.socket;
    this.socket = io(SERVER_URL, { autoConnect: true });
    this.socket.on("connect", () => {
      this._playerId = this.socket!.id ?? null;
    });
    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this._playerId = null;
  }

  emit(event: string, data?: unknown): void {
    this.socket?.emit(event, data);
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.socket?.on(event, handler);
  }

  off(event: string, handler?: (...args: unknown[]) => void): void {
    this.socket?.off(event, handler);
  }

  get id(): string | null {
    return this.socket?.id ?? null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketClient = new SocketClient();
