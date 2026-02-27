import type { Vector2 } from "../types";

export interface TrackStyle {
  grassColor: string;
  asphaltColor: string;
  borderColor: string;
}

export interface TrackCheckpoint {
  id: string;
  a: Vector2;
  b: Vector2;
}

export interface TrackAssetV1 {
  version: 1;
  id: string;
  name: string;
  centerline: Vector2[];
  roadWidth: number;
  curveTension?: number;
  spawn: { x: number; y: number; heading: number };
  checkpoints: TrackCheckpoint[];
  style: TrackStyle;
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

export type Quad = [Vector2, Vector2, Vector2, Vector2];

export interface TrackGeometry {
  sampledCenterline: Vector2[];
  quads: Quad[];
  leftEdge: Vector2[];
  rightEdge: Vector2[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface RuntimeTrack {
  asset: TrackAssetV1;
  geometry: TrackGeometry;
}
