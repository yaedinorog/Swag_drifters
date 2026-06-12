import type { Vector2 } from "../physics/types.js";

export interface TrackCheckpoint {
  id: string;
  a: Vector2;
  b: Vector2;
}

export interface TrackAssetV1 {
  id: string;
  name: string;
  spawn: { x: number; y: number; heading: number };
  checkpoints: TrackCheckpoint[];
}

export interface TrackManifestItem {
  id: string;
  name: string;
  file: string;
}

export interface TrackManifest {
  version: 1;
  tracks: TrackManifestItem[];
}
