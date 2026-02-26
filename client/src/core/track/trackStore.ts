import { DEFAULT_TRACK_ID } from "../constants";
import { buildTrackGeometry, isOnTrackFromGeometry } from "./geometry";
import type { RuntimeTrack, TrackAssetV1, TrackManifest, TrackManifestItem } from "./types";

let tracks: RuntimeTrack[] = [];
let loaded = false;

function assertTrackAsset(asset: TrackAssetV1): void {
  if (asset.version !== 1) {
    throw new Error(`Unsupported track asset version for '${asset.id}'.`);
  }
  if (asset.centerline.length < 4) {
    throw new Error(`Track '${asset.id}' centerline must have at least 4 points.`);
  }
  if (asset.roadWidth < 20) {
    throw new Error(`Track '${asset.id}' roadWidth is too small.`);
  }
  if (asset.checkpoints.length < 2) {
    throw new Error(`Track '${asset.id}' must have at least 2 checkpoints.`);
  }
  if (asset.checkpoints[0]?.id !== "start_finish") {
    throw new Error(`Track '${asset.id}' must start checkpoints with 'start_finish'.`);
  }
}

function normalizeBase(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load '${url}': ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function loadTrackAsset(baseUrl: string, item: TrackManifestItem): Promise<RuntimeTrack> {
  const loadedAsset = await fetchJson<TrackAssetV1>(`${baseUrl}tracks/${item.file}`);
  assertTrackAsset(loadedAsset);
  const asset =
    loadedAsset.id === item.id
      ? loadedAsset
      : {
          ...loadedAsset,
          id: item.id,
          name: item.name
        };
  if (loadedAsset.id !== item.id) {
    console.warn(
      `Track asset id mismatch for '${item.file}': manifest id '${item.id}', asset id '${loadedAsset.id}'. Using manifest id.`
    );
  }

  return {
    asset,
    geometry: buildTrackGeometry(asset)
  };
}

export async function loadTrackStore(baseUrl = import.meta.env.BASE_URL): Promise<void> {
  const normalizedBase = normalizeBase(baseUrl);
  const manifest = await fetchJson<TrackManifest>(`${normalizedBase}tracks/manifest.json`);

  if (manifest.version !== 1) {
    throw new Error("Unsupported tracks manifest version.");
  }

  const loadedTracks = await Promise.all(
    manifest.tracks.map((item) => loadTrackAsset(normalizedBase, item))
  );

  const ids = new Set<string>();
  loadedTracks.forEach((track) => {
    if (ids.has(track.asset.id)) {
      throw new Error(`Duplicate track id '${track.asset.id}' in manifest.`);
    }
    ids.add(track.asset.id);
  });

  tracks = loadedTracks;
  loaded = true;
}

function assertReady(): void {
  if (!loaded) {
    throw new Error("Track store is not loaded. Call loadTrackStore() first.");
  }
}

export function getTracks(): RuntimeTrack[] {
  assertReady();
  return tracks;
}

export function getTrackById(trackId: string): RuntimeTrack | undefined {
  assertReady();
  return tracks.find((track) => track.asset.id === trackId);
}

export function getDefaultTrackId(): string {
  assertReady();
  if (tracks.some((track) => track.asset.id === DEFAULT_TRACK_ID)) {
    return DEFAULT_TRACK_ID;
  }
  return tracks[0]?.asset.id ?? DEFAULT_TRACK_ID;
}

export function isOnTrack(x: number, y: number, track: RuntimeTrack): boolean {
  return isOnTrackFromGeometry(x, y, track.geometry);
}
