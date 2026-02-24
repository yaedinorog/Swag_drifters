export interface Vector2 {
  x: number;
  y: number;
}

export interface CarState {
  position: Vector2;
  velocity: Vector2;
  heading: number;
  angularVelocity: number;
}

export interface InputState {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
}

export interface LapState {
  lapNumber: number;
  lapStartMs: number;
  bestLapMs: number | null;
  checkpointsPassed: number;
}

export interface LeaderboardEntry {
  playerName: string;
  timeMs: number;
  createdAt: string;
}

export interface RaceResult {
  finalTimeMs: number;
  bestLapMs: number;
}
