import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackAssetV1, TrackManifest } from "../core/track/types";

const manifest: TrackManifest = {
  version: 1,
  tracks: [
    { id: "track_01", name: "Track 01", file: "track_01.json" }
  ]
};

const baseTrack: TrackAssetV1 = {
  version: 1,
  id: "track_01",
  name: "Track 01",
  centerline: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
    { x: 0, y: 0 }
  ],
  roadWidth: 50,
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

function mockFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.endsWith("/tracks/manifest.json")) {
        return {
          ok: true,
          json: async () => manifest
        } as Response;
      }
      if (value.endsWith("/tracks/track_01.json")) {
        return {
          ok: true,
          json: async () => baseTrack
        } as Response;
      }
      return { ok: false, status: 404, statusText: "Not Found" } as Response;
    })
  );
}

describe("trackStore", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mockFetch();
  });

  it("loads tracks from manifest", async () => {
    const store = await import("../core/track/trackStore");
    await store.loadTrackStore("http://example.com/");
    const track = store.getTrackById("track_01");
    expect(track?.asset.name).toBe("Track 01");
  });

  it("overrides manifest track with localStorage track", async () => {
    const customTrack: TrackAssetV1 = {
      ...baseTrack,
      name: "Custom Track 01"
    };
    localStorage.setItem("swag_custom_tracks_v1", JSON.stringify([customTrack]));
    const store = await import("../core/track/trackStore");
    await store.loadTrackStore("http://example.com/");
    const track = store.getTrackById("track_01");
    expect(track?.asset.name).toBe("Custom Track 01");
  });

  it("injectTestTrack replaces existing track", async () => {
    const store = await import("../core/track/trackStore");
    await store.loadTrackStore("http://example.com/");
    const injected: TrackAssetV1 = {
      ...baseTrack,
      name: "Injected"
    };
    store.injectTestTrack(injected);
    const track = store.getTrackById("track_01");
    expect(track?.asset.name).toBe("Injected");
  });

  it("getDefaultTrackId falls back to first track", async () => {
    const store = await import("../core/track/trackStore");
    await store.loadTrackStore("http://example.com/");
    expect(store.getDefaultTrackId()).toBe("track_01");
  });
});
