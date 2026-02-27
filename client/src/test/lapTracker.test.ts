import { describe, expect, it } from "vitest";
import { LapTracker } from "../core/track/lapTracker";
import { buildTrackGeometry } from "../core/track/geometry";
import type { RuntimeTrack, TrackAssetV1 } from "../core/track/types";

function makeTrack(): RuntimeTrack {
  const asset: TrackAssetV1 = {
    version: 1,
    id: "lap_track",
    name: "Lap Track",
    centerline: [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 120 },
      { x: 0, y: 120 },
      { x: 0, y: 0 }
    ],
    roadWidth: 40,
    spawn: { x: 10, y: 10, heading: 0 },
    checkpoints: [
      { id: "start_finish", a: { x: 0, y: 40 }, b: { x: 0, y: 80 } },
      { id: "cp_01", a: { x: 120, y: 40 }, b: { x: 120, y: 80 } }
    ],
    style: {
      grassColor: "#000000",
      asphaltColor: "#111111",
      borderColor: "#222222"
    }
  };
  return { asset, geometry: buildTrackGeometry(asset) };
}

describe("LapTracker", () => {
  it("does not complete lap before passing enough checkpoints", () => {
    const track = makeTrack();
    const tracker = new LapTracker(track, 0, 3);
    const result = tracker.update({ x: -10, y: 60 }, { x: 10, y: 60 }, 1000);
    expect(result.lapCompleted).toBe(false);
    expect(result.raceCompleted).toBe(false);
    expect(result.state.lapNumber).toBe(1);
  });

  it("completes lap after crossing checkpoints in order", () => {
    const track = makeTrack();
    const tracker = new LapTracker(track, 0, 1);

    const cpHit = tracker.update({ x: 110, y: 60 }, { x: 130, y: 60 }, 5000);
    expect(cpHit.lapCompleted).toBe(false);

    const finishHit = tracker.update({ x: 10, y: 60 }, { x: -10, y: 60 }, 12000);
    expect(finishHit.lapCompleted).toBe(true);
    expect(finishHit.completedLapTimeMs).toBe(12000);
    expect(finishHit.state.bestLapMs).toBe(12000);
    expect(finishHit.raceCompleted).toBe(true);
  });
});
