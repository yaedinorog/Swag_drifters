# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Drift Loop MVP** — 2D top-down drifting racing web app with a built-in track editor.

- `client/` — Phaser 3 + Vite + TypeScript frontend. Game at `/`, editor at `/editor`.
- `server/` — Express + SQLite leaderboard API on port 3000.
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
- **`scenes/`** — Phaser scenes: `BootScene` → `MenuScene` → `LevelSelectScene` → `RaceScene` → `ResultScene`. `PauseScene` overlays during race.
- **`editor/editorApp.ts`** — Track editor UI (separate entry point).
- **`services/api/leaderboardApi.ts`** — HTTP client for leaderboard.
- **`state/session.ts`** — Game session state.
- **`ui/hud.ts`** — In-game HUD.

Bootstrap (`main.ts`): loads track store from manifest → routes to game or editor based on URL path.

### Server (`server/src/`)
- **`app.ts`** — Express app, routes.
- **`db/database.ts`** — SQLite init (`server/data/scores.sqlite`).
- **`services/scoreService.ts`** — Score CRUD.
- **`tracks/trackRegistry.ts`** — Loads tracks from manifest for `trackId` whitelist validation.
- **`routes/leaderboard.ts`** — `GET /api/leaderboard?trackId=&limit=` and `POST /api/leaderboard`.

### Track System
- **Source of truth**: `client/public/tracks/manifest.json` — both client and server read from it.
- Track format (`TrackAssetV1`): `centerline` (array of `{x,y}`), `roadWidth`, `spawn` (`{x,y,heading}`), optional `checkpoints`.
- Custom (editor-created) tracks are saved to browser `localStorage` and merged at runtime.

## Coding Style

- TypeScript strict mode, ES modules, 2-space indent.
- `camelCase` for variables/functions, `PascalCase` for classes/scenes.
- Keep domain code inside package boundaries — do not import server code into client.
- Test files: `*.test.ts`. Client tests in `client/src/test/`; server tests near routes.

## Deployment

GitHub Actions (`.github/workflows/deploy-pages.yml`) deploys client to GitHub Pages on push to `main`. The backend is not deployed — leaderboard requires a separate server + CORS setup.
