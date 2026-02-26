import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "client", "dist");
const src = path.join(distDir, "index.html");
const editorDir = path.join(distDir, "editor");
const dest = path.join(editorDir, "index.html");

if (fs.existsSync(src)) {
  fs.mkdirSync(editorDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("Created dist/editor/index.html");
}
