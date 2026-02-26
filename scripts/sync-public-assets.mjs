import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const carSrc = path.join(repoRoot, "Images", "car.png");
const carDest = path.join(repoRoot, "client", "public", "car.png");

fs.mkdirSync(path.dirname(carDest), { recursive: true });
fs.copyFileSync(carSrc, carDest);

console.log("Synced car asset into client/public (tracks are not overwritten).");
