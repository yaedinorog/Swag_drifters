# Drift Loop MVP - Project Context

## 1. Project Overview

This repository contains a racing MVP with drifting mechanics, leaderboard support, and a built-in track editor.

- Client: Phaser 3 + TypeScript + Vite
- Server: Express + TypeScript + SQLite (`better-sqlite3`)
- Package manager: npm workspaces

Repository remote:
- `origin`: `https://github.com/yaedinorog/Swag_drifters.git`

## 2. Current Folder Structure

- `client/` - game + `/editor` mode
- `server/` - leaderboard API
- `tracks/` - shared track assets and manifest
- `tracks/schema/track.schema.json` - JSON schema for tracks
- `scripts/` - helper scripts (`sync-public-assets`, `postbuild-editor-entry`, `tracks-add`)
- `.github/workflows/deploy-pages.yml` - GitHub Pages deployment workflow

## 3. Implemented Features

### Gameplay
- Data-driven tracks loaded from `tracks/manifest.json`
- 3-lap race flow
- Segment-based checkpoint/lap validation
- Drift-focused handling model (ice-like sliding behavior)
- Handbrake support (`Space`)
- Race timer starts only after car movement
- HUD: speed, lap, timer, drift indicator
- Result screen with final and best lap time

### Track system
- Track asset format: `TrackAssetV1` (`centerline`, `roadWidth`, `spawn`, segment checkpoints)
- Runtime geometry generation from centerline (`TrackGeometryBuilder`)
- Point-on-track collision via generated road quads + broad-phase bounds
- Figure-eight tracks supported via union of generated road segments

### Track editor
- Available at `/editor`
- Create/edit/duplicate tracks
- Edit centerline points, road width, spawn, and manual checkpoints
- Validation: unique id, centerline closed/min points, checkpoint constraints, spawn on track
- Export track JSON + manifest patch; import existing track JSON

### Leaderboard/API
- `GET /api/leaderboard?trackId=...&limit=...`
- `POST /api/leaderboard`
- `trackId` validation uses `tracks/manifest.json` through server `TrackRegistry`
- SQLite storage + sorted top list by best time
- Server accepts numeric `timeMs` and rounds before saving
- API tests with Vitest + Supertest

## 4. Current Controls

- `W/S` or `Up/Down`: throttle/brake
- `A/D` or `Left/Right`: steering
- `Space`: handbrake
- `R`: restart current race
- Menu: `Enter/Space` open level select
- Level select: `Left/Right` choose track, `Enter/Space` start, `Esc` back
- Result screen:
  - `S` submit score
  - `R` retry
  - `M` menu

## 5. Build, Run, Test

From repo root:

- Install: `npm install`
- Dev (client + server): `npm run dev`
- Build all: `npm run build`
- Build client: `npm run build:client`
- Build server: `npm run build:server`
- Tests: `npm test`
- Add/update track from file: `npm run tracks:add -- --file <track.json>`

Default local URLs:
- Client game: `http://localhost:5173/`
- Client editor: `http://localhost:5173/editor`
- API: `http://localhost:3000`

## 6. Deployment Status (GitHub Pages)

Workflow exists:
- `.github/workflows/deploy-pages.yml`

Behavior:
- Triggers on push to `main` and manual dispatch
- Builds client with base path `/${repo-name}/`
- Syncs `tracks/` + `car.png` into `client/public` before build
- Publishes `client/dist` via GitHub Pages Actions
- Copies `dist/index.html` to `dist/editor/index.html` for direct `/editor` static path

Required GitHub settings:
- Repository -> `Settings` -> `Pages`
- `Source`: `GitHub Actions`

## 7. Database + Git Ignore State

Ignored patterns include:
- `*.sqlite`
- `*.sqlite3`
- `server/server/data/`
- generated `client/public/tracks/`
- generated `client/public/car.png`

## 8. Known Limitations

- Client on GitHub Pages is front-end only (API not deployed there).
- Leaderboard submission from deployed Pages needs a reachable backend + CORS.
- Editor is local/browser-side and does not auto-commit tracks to repo.
- No auth/collaboration/version history for track editing.

При любых глобальных изменениях проекта обновлять данный файл в соответствии с изменениями
