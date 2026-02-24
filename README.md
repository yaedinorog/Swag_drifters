# Drift Loop MVP

Small 2D top-down drifting racing web app MVP.

## Stack
- Client: TypeScript, Phaser 3, Vite
- Server: Node.js, Express, SQLite (better-sqlite3)

## Project structure
- `client/` game client
- `server/` leaderboard API

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
- Client: `http://localhost:5173`
- API: `http://localhost:3000`

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

## MVP flow
- Menu -> race (3 laps) -> result screen
- Save score from result screen (`S`)
- Fetch and display Top 10 leaderboard
