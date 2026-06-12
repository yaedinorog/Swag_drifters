export interface CarHandlingConfig {
  acceleration: number;
  brakingForce: number;
  drag: number;
  baseGrip: number;
  driftGrip: number;
  handbrakeGripPenalty: number;
  maxSpeed: number;
  maxSteerRate: number;
  turnResponse: number;
  driftThreshold: number;
  offTrackDamping: number;
}

export const DEFAULT_HANDLING: CarHandlingConfig = {
  acceleration: 420,
  brakingForce: 460,
  drag: 0.65,
  baseGrip: 2,
  driftGrip: 0.5,
  handbrakeGripPenalty: 0.45,
  maxSpeed: 700,
  maxSteerRate: 3.7,
  turnResponse: 5.2,
  driftThreshold: 55,
  offTrackDamping: 0.95,
};

export const TURBO_HANDLING: CarHandlingConfig = {
  ...DEFAULT_HANDLING,
  acceleration: 620,
};
