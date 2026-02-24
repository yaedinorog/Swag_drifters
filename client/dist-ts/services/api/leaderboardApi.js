const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
export async function fetchLeaderboard(trackId, limit = 10) {
    const url = new URL("/api/leaderboard", API_URL);
    url.searchParams.set("trackId", trackId);
    url.searchParams.set("limit", String(limit));
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard (${response.status})`);
    }
    const data = (await response.json());
    return data.map((entry) => ({
        playerName: entry.playerName,
        timeMs: entry.timeMs,
        createdAt: entry.createdAt
    }));
}
export async function submitScore(playerName, trackId, timeMs) {
    const url = new URL("/api/leaderboard", API_URL);
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName, trackId, timeMs })
    });
    if (!response.ok) {
        throw new Error(`Failed to submit score (${response.status})`);
    }
}
export function formatTime(ms) {
    const normalizedMs = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0;
    const totalSeconds = Math.floor(normalizedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const millis = normalizedMs % 1000;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}
