// Socket event name constants
export const SE = {
  // client → server
  JOIN_ROOM: "joinRoom",
  PLAYER_INPUT: "playerInput",
  PICK_TRACK: "pickTrack",
  NEXT_ROUND: "nextRound",

  // server → client
  ROOM_STATE: "roomState",
  PLAYER_JOINED: "playerJoined",
  PLAYER_LEFT: "playerLeft",
  HOST_CHANGED: "hostChanged",
  START_COUNTDOWN: "startCountdown",
  RACE_START: "raceStart",
  SNAPSHOT: "snapshot",
  LAP_COMPLETE: "lapComplete",
  PLAYER_FINISHED: "playerFinished",
  RACE_END: "raceEnd",
  JOIN_ERROR: "joinError",
} as const;

// ── Shared data shapes ────────────────────────────────────────────

export interface InputMessage {
  seq: number;
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  turbo: boolean;
}

export interface CarSnapshot {
  id: string;
  x: number;
  y: number;
  heading: number;
  vx: number;
  vy: number;
  angularVelocity: number;
  lapNumber: number;
  finished: boolean;
}

export interface SnapshotMessage {
  seq: number;
  serverTime: number;
  cars: CarSnapshot[];
}

export interface RaceResultEntry {
  playerId: string;
  playerName: string;
  position: number;
  totalTimeMs: number;
}

export interface PlayerInfo {
  id: string;
  playerName: string;
  isHost: boolean;
}

// ── Event payload types ───────────────────────────────────────────

export interface JoinRoomPayload {
  code: string;
  playerName: string;
}

export interface RoomStatePayload {
  code: string;
  players: PlayerInfo[];
  hostId: string;
  trackId: string;
  phase: "lobby" | "countdown" | "racing" | "results";
}

export interface StartCountdownPayload {
  trackId: string;
  spawnPositions: Record<string, { x: number; y: number; heading: number }>;
}

export interface LapCompletePayload {
  playerId: string;
  lapNumber: number;
  lapTimeMs: number;
}

export interface PlayerFinishedPayload {
  playerId: string;
  totalTimeMs: number;
  position: number;
}

export interface RaceEndPayload {
  results: RaceResultEntry[];
}
