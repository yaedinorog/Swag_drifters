import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { createLeaderboardRouter } from "./routes/leaderboard.js";
import type { ScoreService } from "./services/scoreService.js";

export function createApp(scoreService: ScoreService) {
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
  app.use("/api/leaderboard", createLeaderboardRouter(scoreService));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
