import type { CarState } from "../physics/types.js";
import type { LapTracker } from "../track/lapTracker.js";
import { buildTrackGeometry } from "../track/geometry.js";
import type { TrackAssetV1, TrackGeometry } from "../track/types.js";

export type RoomPhase = "lobby" | "countdown" | "racing" | "results";

export interface PlayerState {
  socketId: string;
  playerName: string;
  isHost: boolean;
  carState: CarState;
  spawnState: CarState;
  lastInput: {
    throttle: number;
    brake: number;
    steer: number;
    handbrake: boolean;
    turbo: boolean;
  };
  lapTracker: LapTracker | null;
  lapNumber: number;
  finished: boolean;
  totalTimeMs: number;
  finishPosition: number;
  raceStartMs: number;
  lastInputSeq: number;
}

export interface Room {
  code: string;
  phase: RoomPhase;
  players: Map<string, PlayerState>;
  hostId: string;
  trackId: string;
  track: TrackAssetV1 | null;
  trackGeometry: TrackGeometry | null;
  finishCount: number;
}

const rooms = new Map<string, Room>();

const SPAWN_ROW_GAP = 90;
const SPAWN_COL_GAP = 55;

function buildSpawnState(track: TrackAssetV1, playerIndex: number): CarState {
  const { x, y, heading } = track.spawn;
  const col = playerIndex % 2;
  const row = Math.floor(playerIndex / 2);

  const backX = -Math.cos(heading) * row * SPAWN_ROW_GAP;
  const backY = -Math.sin(heading) * row * SPAWN_ROW_GAP;
  const rightX = Math.sin(heading) * (col === 0 ? -1 : 1) * (SPAWN_COL_GAP / 2);
  const rightY = -Math.cos(heading) * (col === 0 ? -1 : 1) * (SPAWN_COL_GAP / 2);

  return {
    position: { x: x + backX + rightX, y: y + backY + rightY },
    velocity: { x: 0, y: 0 },
    heading,
    angularVelocity: 0,
  };
}

export function getOrCreateRoom(code: string): Room {
  if (!rooms.has(code)) {
    rooms.set(code, {
      code,
      phase: "lobby",
      players: new Map(),
      hostId: "",
      trackId: "track_01",
      track: null,
      trackGeometry: null,
      finishCount: 0,
    });
  }
  return rooms.get(code)!;
}

export function addPlayer(room: Room, socketId: string, playerName: string): PlayerState {
  const isHost = room.players.size === 0;
  const dummySpawn: CarState = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    heading: 0,
    angularVelocity: 0,
  };
  const player: PlayerState = {
    socketId,
    playerName,
    isHost,
    carState: dummySpawn,
    spawnState: dummySpawn,
    lastInput: { throttle: 0, brake: 0, steer: 0, handbrake: false, turbo: false },
    lapTracker: null,
    lapNumber: 1,
    finished: false,
    totalTimeMs: 0,
    finishPosition: 0,
    raceStartMs: 0,
    lastInputSeq: -1,
  };
  if (isHost) room.hostId = socketId;
  room.players.set(socketId, player);
  return player;
}

export function removePlayer(room: Room, socketId: string): void {
  room.players.delete(socketId);
  if (room.hostId === socketId) {
    const next = room.players.values().next().value;
    if (next) {
      next.isHost = true;
      room.hostId = next.socketId;
    }
  }
}

export function assignSpawns(room: Room): Record<string, { x: number; y: number; heading: number }> {
  // Build geometry once per race so the game loop has an identical isOnTrack
  // implementation to the client (both use the same splined quad polygons).
  room.trackGeometry = buildTrackGeometry(room.track!);

  const result: Record<string, { x: number; y: number; heading: number }> = {};
  let index = 0;
  for (const [id, player] of room.players) {
    const spawn = buildSpawnState(room.track!, index++);
    player.carState = spawn;
    player.spawnState = spawn;
    result[id] = { x: spawn.position.x, y: spawn.position.y, heading: spawn.heading };
  }
  return result;
}

export function resetForNextRound(room: Room): void {
  room.finishCount = 0;
  room.phase = "lobby";
  for (const player of room.players.values()) {
    player.finished = false;
    player.totalTimeMs = 0;
    player.finishPosition = 0;
    player.lapNumber = 1;
    player.lapTracker = null;
    player.lastInputSeq = -1;
  }
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
}

export function getRoomBySocketId(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return undefined;
}
