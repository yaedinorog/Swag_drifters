import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const carSrc = path.join(repoRoot, "Images", "car.png");
const carDest = path.join(repoRoot, "client", "public", "car.png");

fs.mkdirSync(path.dirname(carDest), { recursive: true });
if (fs.existsSync(carSrc)) {
    fs.copyFileSync(carSrc, carDest);
}

const tracksSrc = path.join(repoRoot, "tracks");
const tracksDest = path.join(repoRoot, "client", "public", "tracks");

fs.mkdirSync(tracksDest, { recursive: true });
const tracksFiles = fs.readdirSync(tracksSrc);
for (const file of tracksFiles) {
    if (!file.endsWith(".json")) continue;
    const srcPath = path.join(tracksSrc, file);
    const destPath = path.join(tracksDest, file);
    if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        continue;
    }
    const srcStat = fs.statSync(srcPath);
    const destStat = fs.statSync(destPath);
    if (srcStat.mtimeMs > destStat.mtimeMs) {
        fs.copyFileSync(srcPath, destPath);
    }
}

console.log("Synced car asset and tracks into client/public.");
