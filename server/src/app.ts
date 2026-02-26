import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { createLeaderboardRouter } from "./routes/leaderboard.js";
import type { ScoreService } from "./services/scoreService.js";
import type { TrackRegistry } from "./tracks/trackRegistry.js";

export function createApp(scoreService: ScoreService, trackRegistry: TrackRegistry) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(
    "/api/leaderboard",
    rateLimit({
      windowMs: 60_000,
      max: 30
    })
  );
  app.use("/api/leaderboard", createLeaderboardRouter(scoreService, trackRegistry));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
