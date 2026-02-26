import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface TrackManifest {
  version: number;
  tracks: Array<{ id: string; name: string; file: string }>;
}

export interface TrackRegistry {
  hasTrack(trackId: string): boolean;
  listTrackIds(): string[];
  checksum: string;
}

export class StaticTrackRegistry implements TrackRegistry {
  constructor(private readonly trackIds: Set<string>, public readonly checksum: string) {}

  hasTrack(trackId: string): boolean {
    return this.trackIds.has(trackId);
  }

  listTrackIds(): string[] {
    return Array.from(this.trackIds);
  }
}

function resolveDefaultManifestPath(): string {
  const fromCwd = path.resolve(process.cwd(), "tracks", "manifest.json");
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
  const fromRepoRoot = path.resolve(repoRoot, "tracks", "manifest.json");
  if (fs.existsSync(fromRepoRoot)) {
    return fromRepoRoot;
  }

  return fromCwd;
}

export function loadTrackRegistry(manifestPath = resolveDefaultManifestPath()): TrackRegistry {
  const raw = fs.readFileSync(manifestPath, "utf8");
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const parsed = JSON.parse(sanitized) as TrackManifest;

  if (parsed.version !== 1 || !Array.isArray(parsed.tracks)) {
    throw new Error("Invalid tracks manifest format.");
  }

  const trackIds = new Set<string>();
  parsed.tracks.forEach((track) => {
    if (!track?.id || typeof track.id !== "string") {
      throw new Error("Track manifest contains invalid id entry.");
    }
    if (trackIds.has(track.id)) {
      throw new Error(`Duplicate track id in manifest: ${track.id}`);
    }
    trackIds.add(track.id);
  });

  const checksum = crypto.createHash("sha256").update(sanitized).digest("hex");
  return new StaticTrackRegistry(trackIds, checksum);
}
