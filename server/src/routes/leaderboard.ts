import { Router } from "express";
import type { ScoreService } from "../services/scoreService.js";
import type { TrackRegistry } from "../tracks/trackRegistry.js";

const playerNamePattern = /^[A-Za-z0-9_ ]{3,16}$/;

function parseLimit(raw: unknown): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    return null;
  }
  if (value < 1 || value > 50) {
    return null;
  }
  return value;
}

export function createLeaderboardRouter(scoreService: ScoreService, trackRegistry: TrackRegistry): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const trackId = String(req.query.trackId ?? "");
    const limit = req.query.limit === undefined ? 10 : parseLimit(req.query.limit);

    if (limit === null) {
      res.status(400).json({ error: "Invalid limit" });
      return;
    }

    const result = scoreService.getTop(trackId, limit);
    res.json(result);
  });

  router.post("/", (req, res) => {
    const playerName = String(req.body?.playerName ?? "").trim();
    const trackId = String(req.body?.trackId ?? "").trim();
    const rawTimeMs = Number(req.body?.timeMs);
    const timeMs = Math.round(rawTimeMs);

    if (!playerNamePattern.test(playerName)) {
      res.status(400).json({ error: "Invalid playerName" });
      return;
    }
    if (!Number.isFinite(rawTimeMs) || timeMs < 10_000 || timeMs > 3_600_000) {
      res.status(400).json({ error: "Invalid timeMs" });
      return;
    }

    scoreService.insertScore(playerName, trackId, timeMs);
    res.status(201).json({ ok: true });
  });

  return router;
}
