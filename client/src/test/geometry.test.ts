import { describe, expect, it } from "vitest";
import { buildTrackGeometry, isCenterlineClosed, isOnTrackFromGeometry } from "../core/track/geometry";
import type { TrackAssetV1 } from "../core/track/types";

const squareTrack: TrackAssetV1 = {
  version: 1,
  id: "square",
  name: "Square",
  centerline: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
    { x: 0, y: 0 }
  ],
  roadWidth: 40,
  spawn: { x: 10, y: 10, heading: 0 },
  checkpoints: [
    { id: "start_finish", a: { x: 0, y: 40 }, b: { x: 0, y: 60 } },
    { id: "cp_01", a: { x: 100, y: 40 }, b: { x: 100, y: 60 } }
  ],
  style: {
    grassColor: "#000000",
    asphaltColor: "#111111",
    borderColor: "#222222"
  }
};

describe("geometry", () => {
  it("detects closed centerline", () => {
    expect(isCenterlineClosed(squareTrack.centerline)).toBe(true);
    expect(isCenterlineClosed(squareTrack.centerline.slice(0, -1))).toBe(false);
  });

  it("buildTrackGeometry returns bounds and quads", () => {
    const geometry = buildTrackGeometry(squareTrack);
    expect(geometry.quads.length).toBeGreaterThan(0);
    expect(geometry.bounds.minX).toBeLessThan(geometry.bounds.maxX);
    expect(geometry.bounds.minY).toBeLessThan(geometry.bounds.maxY);
  });

  it("detects on/off track points", () => {
    const geometry = buildTrackGeometry(squareTrack);
    expect(isOnTrackFromGeometry(10, 10, geometry)).toBe(true);
    expect(isOnTrackFromGeometry(500, 500, geometry)).toBe(false);
  });
});
