import { isInsideRect } from "./trackConfig";
export class LapTracker {
    constructor(track, raceStartMs, totalLaps) {
        this.track = track;
        this.totalLaps = totalLaps;
        this.lapState = {
            lapNumber: 1,
            lapStartMs: raceStartMs,
            bestLapMs: null,
            checkpointsPassed: 0
        };
        this.nextCheckpointIndex = 1;
        this.insideCurrentCheckpoint = false;
    }
    getState() {
        return { ...this.lapState };
    }
    update(x, y, nowMs) {
        const targetCheckpoint = this.track.checkpoints[this.nextCheckpointIndex];
        const inside = isInsideRect(x, y, targetCheckpoint);
        let lapCompleted = false;
        let completedLapTimeMs = null;
        let raceCompleted = false;
        if (inside && !this.insideCurrentCheckpoint) {
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
            }
            else {
                this.lapState.checkpointsPassed += 1;
                this.nextCheckpointIndex = (this.nextCheckpointIndex + 1) % this.track.checkpoints.length;
            }
        }
        this.insideCurrentCheckpoint = inside;
        return { state: { ...this.lapState }, lapCompleted, completedLapTimeMs, raceCompleted };
    }
}
