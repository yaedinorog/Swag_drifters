import { createGame } from "./core/game";
import { loadTrackStore } from "./core/track/trackStore";
import { mountEditorApp } from "./editor/editorApp";
import "./styles.css";
const root = document.getElementById("app");
if (!root) {
    throw new Error("Root element #app not found.");
}
const appRoot = root;
function normalizeBase(baseUrl) {
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
function getModeFromPath(pathname) {
    const base = normalizeBase(import.meta.env.BASE_URL);
    const basePath = new URL(base, window.location.origin).pathname;
    const relativePath = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
    const normalized = relativePath.replace(/^\/+|\/+$/g, "");
    return normalized === "editor" ? "editor" : "game";
}
async function bootstrap() {
    await loadTrackStore();
    if (getModeFromPath(window.location.pathname) === "editor") {
        mountEditorApp(appRoot);
        return;
    }
    createGame(appRoot);
}
bootstrap().catch((error) => {
    console.error(error);
    appRoot.innerHTML = `<pre style="padding:16px;color:#fecaca;background:#1f2937;">${String(error)}</pre>`;
});
