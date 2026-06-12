import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { TrackAssetV1, TrackManifest } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tracksDir = path.join(__dirname, "../../../", "client", "public", "tracks");

let cache: Map<string, TrackAssetV1> | null = null;

function parseJson(raw: string): unknown {
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

export async function loadAllTracks(): Promise<Map<string, TrackAssetV1>> {
  if (cache) return cache;

  const manifestRaw = await readFile(path.join(tracksDir, "manifest.json"), "utf-8");
  const manifest = parseJson(manifestRaw) as TrackManifest;

  const map = new Map<string, TrackAssetV1>();
  await Promise.all(
    manifest.tracks.map(async (item) => {
      const raw = await readFile(path.join(tracksDir, item.file), "utf-8");
      const track = parseJson(raw) as TrackAssetV1;
      map.set(item.id, track);
    })
  );

  cache = map;
  return map;
}

export async function getTrack(trackId: string): Promise<TrackAssetV1 | undefined> {
  const tracks = await loadAllTracks();
  return tracks.get(trackId);
}

export async function getDefaultTrackId(): Promise<string> {
  const tracks = await loadAllTracks();
  return tracks.keys().next().value ?? "track_01";
}

export function getTrackIds(): string[] {
  if (!cache) return [];
  return Array.from(cache.keys());
}
