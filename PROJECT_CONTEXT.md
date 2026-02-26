# Drift Loop MVP - Project Context

## 1. Project Overview

This repository contains a small racing MVP with drifting mechanics and leaderboard support.

- Client: Phaser 3 + TypeScript + Vite
- Server: Express + TypeScript + SQLite (`better-sqlite3`)
- Package manager: npm workspaces

Repository remote:
- `origin`: `https://github.com/yaedinorog/Swag_drifters.git`

## 2. Current Folder Structure

- `client/` - game client
- `server/` - leaderboard API
- `Images/` - public image assets used by client (car sprite)
- `.github/workflows/deploy-pages.yml` - GitHub Pages deployment workflow
- `TODO.md`, `TODO2.md` - backlog notes

## 3. Implemented Features

### Gameplay
- Top-down race on a loop track (`track_01`)
- 3-lap race flow
- Checkpoint-based lap validation
- Drift-focused handling model (ice-like sliding behavior)
- Handbrake support (`Space`)
- HUD: speed, lap, timer, drift indicator
- Result screen with final and best lap time

### Visual/UX
- Game scales to viewport (`Phaser.Scale.FIT`)
- Car sprite loaded from `Images/car.png`
- Improved track visuals (grass pattern, borders, lane guide, checkpoint markers)
- Timer formatting normalized to integer milliseconds (`mm:ss.mmm`)

### Leaderboard/API
- `GET /api/leaderboard?trackId=track_01&limit=10`
- `POST /api/leaderboard`
- SQLite storage + sorted top list by best time
- Server accepts numeric `timeMs` and rounds before saving
- API tests with Vitest + Supertest

## 4. Current Controls

- `W/S` or `Up/Down`: throttle/brake
- `A/D` or `Left/Right`: steering
- `Space`: handbrake
- `R`: restart current race (during race)
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

Default local URLs:
- Client: `http://localhost:5173`
- API: `http://localhost:3000`

## 6. Deployment Status (GitHub Pages)

Workflow exists:
- `.github/workflows/deploy-pages.yml`

Behavior:
- Triggers on push to `main` and manual dispatch
- Builds client with base path `/${repo-name}/`
- Publishes `client/dist` via GitHub Pages Actions

Required GitHub settings:
- Repository -> `Settings` -> `Pages`
- `Source`: `GitHub Actions`

## 7. Database + Git Ignore State

Ignored patterns include:
- `*.sqlite`
- `*.sqlite3`
- `server/server/data/`

## 8. Known Limitations

- Client is front-end only on GitHub Pages (API is not deployed there).
- Leaderboard submission from deployed Pages needs a reachable backend and proper CORS.
- No persistent game settings/profile yet.
- No replay/ghost system yet.

При любых глобальных изменениях проекта обновлять данный файл в соответствии с изменениями
