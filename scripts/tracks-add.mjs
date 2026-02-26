import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fileArgIndex = args.findIndex((arg) => arg === "--file");
if (fileArgIndex < 0 || !args[fileArgIndex + 1]) {
  throw new Error("Usage: npm run tracks:add -- --file <path-to-track-json>");
}

const sourcePath = path.resolve(process.cwd(), args[fileArgIndex + 1]);
const track = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (!track?.id || !track?.name) {
  throw new Error("Track json must contain id and name.");
}

const tracksDir = path.join(repoRoot, "tracks");
const manifestPath = path.join(tracksDir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const filename = `${track.id}.json`;
const targetPath = path.join(tracksDir, filename);
fs.copyFileSync(sourcePath, targetPath);

const existingIndex = manifest.tracks.findIndex((item) => item.id === track.id);
const manifestEntry = { id: track.id, name: track.name, file: filename };
if (existingIndex >= 0) {
  manifest.tracks[existingIndex] = manifestEntry;
} else {
  manifest.tracks.push(manifestEntry);
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Added/updated ${track.id} in tracks/manifest.json`);
