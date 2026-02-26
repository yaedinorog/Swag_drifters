import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tracksSrc = path.join(repoRoot, "tracks");
const tracksDest = path.join(repoRoot, "client", "public", "tracks");
const carSrc = path.join(repoRoot, "Images", "car.png");
const carDest = path.join(repoRoot, "client", "public", "car.png");

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.rmSync(tracksDest, { recursive: true, force: true });
copyDirRecursive(tracksSrc, tracksDest);
fs.mkdirSync(path.dirname(carDest), { recursive: true });
fs.copyFileSync(carSrc, carDest);

console.log("Synced tracks and car asset into client/public");
