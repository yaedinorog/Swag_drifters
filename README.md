# Drift Loop MVP

Small 2D top-down drifting racing web app MVP with a built-in track editor.

## Stack
- Client: TypeScript, Phaser 3, Vite
- Server: Node.js, Express, SQLite (`better-sqlite3`)

## Project structure
- `client/` game app (`/`) + editor mode (`/editor`)
- `server/` leaderboard API
- `tracks/` shared track data (`manifest.json` + `track_*.json` + schema)
- `scripts/` helper scripts for asset sync/build tasks

## Run locally
1. Install dependencies:
```bash
npm install
```
2. Start both client and server:
```bash
npm run dev
```
3. Open:
- Client (game): `http://localhost:5173/`
- Track editor: `http://localhost:5173/editor`
- API: `http://localhost:3000`

## Build & test
```bash
npm run build
npm test
```

## Tracks workflow
- Source of truth: `tracks/manifest.json` + `tracks/*.json`
- Client reads tracks at runtime from `tracks/manifest.json`
- Server validates leaderboard `trackId` against the same manifest
- Add/update track from file:
```bash
npm run tracks:add -- --file path/to/track.json
```

## API
- `GET /api/leaderboard?trackId=track_01&limit=10`
- `POST /api/leaderboard`

POST payload:
```json
{
  "playerName": "RACER1",
  "trackId": "track_01",
  "timeMs": 74321
}
```

## Controls
- `W/S` or `Up/Down`: throttle/brake
- `A/D` or `Left/Right`: steering
- `Space`: handbrake
- `R`: restart race
