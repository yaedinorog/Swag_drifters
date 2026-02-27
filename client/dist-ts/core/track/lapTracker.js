import { segmentsIntersect } from "./geometry";
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
    }
    getState() {
        return { ...this.lapState };
    }
    update(previousPosition, currentPosition, nowMs) {
        const totalCheckpoints = this.track.asset.checkpoints.length;
        let lapCompleted = false;
        let completedLapTimeMs = null;
        let raceCompleted = false;
        // Find all checkpoints intersected in this frame
        const intersectedIndices = [];
        for (let i = 0; i < totalCheckpoints; i++) {
            const cp = this.track.asset.checkpoints[i];
            if (segmentsIntersect(previousPosition, currentPosition, cp.a, cp.b)) {
                intersectedIndices.push(i);
            }
        }
        if (intersectedIndices.length > 0) {
            let bestHitIndex = -1;
            let minForwardDist = Infinity;
            // Find the intersected checkpoint that progresses the lap without jumping too far ahead
            for (const i of intersectedIndices) {
                // Distance going forward along the track
                const forwardDist = (i - this.nextCheckpointIndex + totalCheckpoints) % totalCheckpoints;
                // Allow skipping up to roughly half the track's checkpoints at once, 
                // to avoid validating intersections with checkpoints going the wrong way
                if (forwardDist <= totalCheckpoints / 2) {
                    if (forwardDist < minForwardDist) {
                        minForwardDist = forwardDist;
                        bestHitIndex = i;
                    }
                }
            }
            if (bestHitIndex !== -1) {
                // If we hit the start/finish line
                if (bestHitIndex === 0) {
                    // Require having passed at least ~50% of the checkpoints to prevent massive cheating short-cuts
                    const requiredCheckpoints = Math.floor(totalCheckpoints / 2);
                    if (this.lapState.checkpointsPassed >= requiredCheckpoints) {
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
                        // Crossed start line, but without passing enough checkpoints. Just reset expectations.
                        this.nextCheckpointIndex = 1;
                    }
                }
                else {
                    // Regular checkpoint. Allow missed checkpoints to be credited.
                    this.lapState.checkpointsPassed += (minForwardDist + 1);
                    this.nextCheckpointIndex = (bestHitIndex + 1) % totalCheckpoints;
                }
            }
        }
        return { state: { ...this.lapState }, lapCompleted, completedLapTimeMs, raceCompleted };
    }
}
