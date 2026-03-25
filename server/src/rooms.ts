import { randomUUID } from "crypto";
import type { RoomSettings, RoomSummary, RoomSnapshot } from "./socketEvents.js";

export type { RoomSettings, RoomSummary, RoomSnapshot };

export interface RoomState {
  id: string;
  hostSocketId: string;
  status: "waiting" | "loading" | "racing" | "paused" | "results";
  settings: RoomSettings;
  players: Map<string, string>; // socketId -> nickname
  trackList: string[];
  currentTrackIndex: number;
  sessionScores: Map<string, number>;
  finishTimes: Map<string, number>;
  readySet: Set<string>;
  dnfTimer?: ReturnType<typeof setTimeout>;
}

export const rooms = new Map<string, RoomState>();

export function createRoom(
  hostSocketId: string,
  hostNickname: string,
  settings: RoomSettings
): RoomState {
  const room: RoomState = {
    id: randomUUID(),
    hostSocketId,
    status: "waiting",
    settings,
    players: new Map([[hostSocketId, hostNickname]]),
    trackList: [],
    currentTrackIndex: 0,
    sessionScores: new Map([[hostSocketId, 0]]),
    finishTimes: new Map(),
    readySet: new Set()
  };
  rooms.set(room.id, room);
  return room;
}

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

export function getRoomBySocket(socketId: string): RoomState | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return undefined;
}

export function toSnapshot(room: RoomState): RoomSnapshot {
  const host = room.players.get(room.hostSocketId) ?? "Unknown";
  return {
    id: room.id,
    hostNickname: host,
    playerCount: room.players.size,
    status: room.status,
    players: [...room.players.entries()].map(([socketId, nickname]) => ({
      socketId,
      nickname
    })),
    settings: room.settings
  };
}

export function listPublicRooms(): RoomSummary[] {
  return [...rooms.values()].map((room) => ({
    id: room.id,
    hostNickname: room.players.get(room.hostSocketId) ?? "Unknown",
    playerCount: room.players.size,
    status: room.status
  }));
}

export function joinRoom(
  room: RoomState,
  socketId: string,
  nickname: string
): void {
  room.players.set(socketId, nickname);
  room.sessionScores.set(socketId, 0);
}

export function leaveRoom(socketId: string): {
  room?: RoomState;
  newHostId?: string;
} {
  const room = getRoomBySocket(socketId);
  if (!room) return {};

  clearTimeout(room.dnfTimer);
  room.players.delete(socketId);
  room.sessionScores.delete(socketId);
  room.readySet.delete(socketId);
  room.finishTimes.delete(socketId);

  if (room.players.size === 0) {
    rooms.delete(room.id);
    return { room };
  }

  let newHostId: string | undefined;
  if (room.hostSocketId === socketId) {
    newHostId = [...room.players.keys()][0]!;
    room.hostSocketId = newHostId;
  }

  return { room, newHostId };
}
