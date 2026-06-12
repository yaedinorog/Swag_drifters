# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Drift Loop MVP** — 2D top-down drifting racing web app with a built-in track editor.

- `client/` — Phaser 3 + Vite + TypeScript frontend. Game at `/`, editor at `/editor`.
- `server/` — Minimal Express app (healthz only). Leaderboard was migrated to Firebase Firestore.
- `scripts/` — Asset sync, postbuild, and track import helpers.
- `client/public/tracks/` — Track data (`manifest.json`, `track_*.json`, schema).

## Commands (run from repo root)

```bash
npm install                                      # Install all workspace deps
npm run dev                                      # Client (:5173) + server (:3000) in parallel
npm run build                                    # Build both workspaces
npm test                                         # Run server then client tests
npm run tracks:add -- --file path/to/track.json  # Validate and import a track

npm --workspace client run test:watch            # Client tests in watch mode
npm --workspace client run coverage              # Client coverage report
npm --workspace server run start                 # Run built server from dist/
```

URLs: game `http://localhost:5173/`, editor `http://localhost:5173/editor`, API `http://localhost:3000`

## Architecture

### Client (`client/src/`)
- **`core/`** — Physics (`driftModel.ts`, `carHandling.ts`), track geometry/lap tracking, shared types and constants.
- **`scenes/`** — Phaser scenes: `BootScene` → `MenuScene` → `LevelSelectScene` → `RaceScene` → `ResultScene`. `PauseScene` overlays during race. Multiplayer: `MultiplayerLobbyScene` → `MultiplayerRaceScene` → `MultiplayerResultScene`.
- **`editor/editorApp.ts`** — Track editor UI (separate entry point).
- **`services/firebase.ts`** — Firebase init, exports `db` (Firestore instance).
- **`services/firestore/leaderboardService.ts`** — `getTopScores`, `getPlayerBest`, `submitScore`. Schema: `leaderboard/{trackId}/scores/{docId}`.
- **`services/api/leaderboardApi.ts`** — Still exists, exports `formatTime` used by ResultScene.
- **`state/session.ts`** — Game session state.
- **`state/playerProfile.ts`** — `getPlayerName`/`setPlayerName` persisted in localStorage (`drift_player_name`).
- **`ui/hud.ts`** — In-game HUD: speed, lap, timer, drift indicator, vertical turbo bar.

Bootstrap (`main.ts`): loads track store from manifest → routes to game or editor based on URL path.

### Server (`server/src/`)
Express + Socket.io v4. Entry: `index.ts` creates `http.Server`, attaches `attachSocketIO()` from `socket/index.ts`.
- `app.ts` — Express with `/healthz` only.
- `socket/index.ts` — Socket.io event handlers (joinRoom, playerInput, startRace, pickTrack, disconnect).
- `socket/roomManager.ts` — `Map<code, Room>`, phases: lobby/countdown/racing/results, staggered spawns.
- `socket/gameLoop.ts` — 60hz `setInterval` per room, broadcasts snapshots at 20hz.
- `socket/collision.ts` — circle hitbox (r=18px), elastic impulse on overlap.
- `physics/` — copy of `driftModel.ts`, `carHandling.ts`, `types.ts` (no Phaser dependency).
- `track/` — `trackLoader.ts` reads `client/public/tracks/`, `lapTracker.ts` ported from client.

### Leaderboard (Firebase Firestore)
- **Project**: `swag-drifters-leaderboard`, config hardcoded in `client/src/services/firebase.ts` (public by design, no secrets).
- **Schema**: `leaderboard/{trackId}/scores/{docId}` — fields: `playerName`, `timeMs`, `createdAt`.
- **CI**: GitHub Actions reads `VITE_FIREBASE_*` secrets during build. Local dev uses `client/.env` (gitignored, see `client/.env.example`).
- **Note**: Firestore database must be created manually in Firebase Console (production mode) before first use.

### Turbo System
- Charges while drifting (`DEFAULT_CAR.turbo.fillRate`), drains while Shift is held.
- When charge hits 0, turbo locks until Shift is released and re-pressed.
- `RaceScene` emits a blue particle flame effect (elongated ellipse texture, ADD blend mode) from the car rear during boost.

### Track System
- **Source of truth**: `client/public/tracks/manifest.json` — both client and server read from it.
- Track format (`TrackAssetV1`): `centerline` (array of `{x,y}`), `roadWidth`, `spawn` (`{x,y,heading}`), optional `checkpoints`.
- Custom (editor-created) tracks are saved to browser `localStorage` and merged at runtime.

## Coding Style

- TypeScript strict mode, ES modules, 2-space indent.
- `camelCase` for variables/functions, `PascalCase` for classes/scenes.
- Keep domain code inside package boundaries — do not import server code into client.
- Test files: `*.test.ts`. Client tests in `client/src/test/`; server tests near routes.

## Multiplayer Architecture

Server-authoritative physics over Socket.io v4 (added to existing Express). Server runs `driftModel.ts` for all cars, broadcasts snapshots. Client predicts own car locally, interpolates remote cars.

### Room system
- 4-digit code: type to join (exists) or create (new). Up to 6 players. Destroyed when all leave.
- Host = first player in room. Host presses Start and picks next track between rounds.
- Disconnected player's car disappears; rejoins next round.

### Network protocol
- Client → Server (60fps): `{ seq, throttle, brake, steer, handbrake }`
- Server → Client (20fps snapshots): `{ seq, cars: [{ id, x, y, heading, vx, vy, lapNumber }] }`
- Events: `joinRoom / roomState / playerJoined / playerLeft / startCountdown / raceStart / lapComplete / playerFinished / raceEnd`

### New files (multiplayer)
- `server/src/socket/index.ts` — Socket.io setup, event handlers
- `server/src/socket/roomManager.ts` — room state, player management
- `server/src/socket/gameLoop.ts` — 60hz physics tick for all cars in a room
- `server/src/socket/collision.ts` — circle-based car-car collision, elastic impulse
- `client/src/services/socket/socketClient.ts` — Socket.io client singleton
- `client/src/scenes/MultiplayerLobbyScene.ts` — room code entry + player list
- `client/src/scenes/MultiplayerRaceScene.ts` — race with prediction + remote interpolation
- `client/src/scenes/MultiplayerResultScene.ts` — results, host picks next track
- `shared/socketEvents.ts` — shared event type constants (used by both client and server)

### Deployment note
Server deployed to Render.com free tier. **No keep-alive pings** — cold start on first connection is acceptable. Free tier sleeps after 15 min inactivity.

## Deployment

GitHub Actions (`.github/workflows/deploy-pages.yml`) deploys client to GitHub Pages on push to `main`. The server is deployed to Render.com (free tier). The leaderboard runs entirely client-side via Firebase Firestore.
