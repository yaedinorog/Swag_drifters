import type { LapState, Vector2 } from "../physics/types.js";
import type { TrackCheckpoint } from "./types.js";
import { segmentsIntersect } from "./geometry.js";

export interface LapUpdateResult {
  lapCompleted: boolean;
  completedLapTimeMs: number | null;
  raceCompleted: boolean;
  lapState: LapState;
}

export class LapTracker {
  private checkpoints: TrackCheckpoint[];
  private totalLaps: number;
  private state: LapState;
  private nextCheckpointIndex: number;

  constructor(checkpoints: TrackCheckpoint[], raceStartMs: number, totalLaps: number) {
    this.checkpoints = checkpoints;
    this.totalLaps = totalLaps;
    this.nextCheckpointIndex = 1;
    this.state = {
      lapNumber: 1,
      lapStartMs: raceStartMs,
      bestLapMs: null,
      checkpointsPassed: 0,
    };
  }

  getState(): LapState {
    return { ...this.state };
  }

  update(prevPos: Vector2, nextPos: Vector2, nowMs: number): LapUpdateResult {
    const total = this.checkpoints.length;
    let lapCompleted = false;
    let completedLapTimeMs: number | null = null;
    let raceCompleted = false;

    const hit: number[] = [];
    for (let i = 0; i < total; i++) {
      const cp = this.checkpoints[i];
      if (segmentsIntersect(prevPos, nextPos, cp.a, cp.b)) hit.push(i);
    }

    if (hit.length > 0) {
      let bestIdx = -1;
      let minDist = Infinity;
      for (const i of hit) {
        const fwd = (i - this.nextCheckpointIndex + total) % total;
        if (fwd <= total / 2 && fwd < minDist) {
          minDist = fwd;
          bestIdx = i;
        }
      }

      if (bestIdx !== -1) {
        if (bestIdx === 0) {
          const required = Math.floor(total / 2);
          if (this.state.checkpointsPassed >= required) {
            lapCompleted = true;
            completedLapTimeMs = nowMs - this.state.lapStartMs;
            this.state.bestLapMs =
              this.state.bestLapMs === null
                ? completedLapTimeMs
                : Math.min(this.state.bestLapMs, completedLapTimeMs);
            this.state.lapNumber += 1;
            this.state.lapStartMs = nowMs;
            this.state.checkpointsPassed = 0;
            this.nextCheckpointIndex = 1;
            raceCompleted = this.state.lapNumber > this.totalLaps;
          } else {
            this.nextCheckpointIndex = 1;
          }
        } else {
          this.state.checkpointsPassed += minDist + 1;
          this.nextCheckpointIndex = (bestIdx + 1) % total;
        }
      }
    }

    return { lapCompleted, completedLapTimeMs, raceCompleted, lapState: { ...this.state } };
  }
}
