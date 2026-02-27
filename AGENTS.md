# Repository Guidelines

## Project Structure & Module Organization
This repo is an npm workspace with two packages:
- `client/`: Phaser + Vite TypeScript frontend (game at `/`, editor at `/editor`).
- `server/`: Express + SQLite TypeScript API for leaderboard endpoints.

Key paths:
- `client/src/`: game/editor source (`core/`, `scenes/`, `services/`, `state/`, `ui/`).
- `client/src/test/`: client Vitest suite.
- `server/src/`: API source (`routes/`, `services/`, `db/`, `tracks/`).
- `scripts/`: workspace scripts (asset sync, postbuild, track import).
- `.github/workflows/deploy-pages.yml`: Pages deploy pipeline for client build.

## Build, Test, and Development Commands
Run from repository root:
- `npm install`: install workspace dependencies.
- `npm run dev`: run client (`:5173`) and server (`:3000`) in parallel.
- `npm run build`: build both workspaces (`client/dist`, `server/dist`).
- `npm test`: run server then client tests.
- `npm run tracks:add -- --file path/to/track.json`: validate/import a track file.

Package-specific:
- `npm --workspace client run test:watch`: watch-mode frontend tests.
- `npm --workspace client run coverage`: client coverage report.
- `npm --workspace server run start`: run built API from `server/dist`.

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules), `strict` mode enabled via `tsconfig.base.json`.
- Indentation: 2 spaces; keep imports grouped and use explicit named exports where practical.
- Naming: `camelCase` for variables/functions, `PascalCase` for classes/scenes, kebab/suffix patterns for files (for example `trackRegistry.ts`, `leaderboard.test.ts`).
- Keep domain code inside package boundaries (do not import server runtime code into client).

## Testing Guidelines
- Framework: Vitest in both `client` and `server`.
- Test file pattern: `*.test.ts` (server tests can live near routes; client tests live in `client/src/test`).
- Add tests for gameplay logic, API validation, and regressions before merging.
- Run full suite with `npm test`; run targeted workspace tests during development.

## Commit & Pull Request Guidelines
- Current history uses short, lowercase summaries (for example `fixed tests`, `added pause menu`).
- Prefer concise imperative commit subjects, optionally scoped (example: `server: validate trackId format`).
- PRs should include:
  - what changed and why,
  - linked issue/task (if applicable),
  - test evidence (`npm test`, targeted commands),
  - screenshots/video for UI/editor changes.
