import cors from "cors";
import express from "express";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
