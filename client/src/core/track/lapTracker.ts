import type { LapState, Vector2 } from "../types";
import { segmentsIntersect } from "./geometry";
import type { RuntimeTrack } from "./types";

export interface LapUpdateResult {
  state: LapState;
  lapCompleted: boolean;
  completedLapTimeMs: number | null;
  raceCompleted: boolean;
}

export class LapTracker {
  private readonly track: RuntimeTrack;
  private readonly totalLaps: number;
  private lapState: LapState;
  private nextCheckpointIndex: number;

  constructor(track: RuntimeTrack, raceStartMs: number, totalLaps: number) {
    this.track = track;
    this.totalLaps = totalLaps;
    this.lapState = {
      lapNumber: 1,
      lapStartMs: raceStartMs,
      bestLapMs: null,
      checkpointsPassed: 0
    };
    this.nextCheckpointIndex = 1;
  }

  getState(): LapState {
    return { ...this.lapState };
  }

  update(previousPosition: Vector2, currentPosition: Vector2, nowMs: number): LapUpdateResult {
    const targetCheckpoint = this.track.asset.checkpoints[this.nextCheckpointIndex];

    let lapCompleted = false;
    let completedLapTimeMs: number | null = null;
    let raceCompleted = false;

    if (
      segmentsIntersect(
        previousPosition,
        currentPosition,
        targetCheckpoint.a,
        targetCheckpoint.b
      )
    ) {
      if (this.nextCheckpointIndex === 0) {
        lapCompleted = true;
        completedLapTimeMs = nowMs - this.lapState.lapStartMs;
        this.lapState.bestLapMs =
          this.lapState.bestLapMs === null
            ? completedLapTimeMs
            : Math.min(this.lapState.bestLapMs, completedLapTimeMs);
        this.lapState.lapNumber += 1;
        this.lapState.lapStartMs = nowMs;
        this.lapState.checkpointsPassed = 0;
        this.nextCheckpointIndex = 1;
        raceCompleted = this.lapState.lapNumber > this.totalLaps;
      } else {
        this.lapState.checkpointsPassed += 1;
        this.nextCheckpointIndex = (this.nextCheckpointIndex + 1) % this.track.asset.checkpoints.length;
      }
    }

    return { state: { ...this.lapState }, lapCompleted, completedLapTimeMs, raceCompleted };
  }
}
