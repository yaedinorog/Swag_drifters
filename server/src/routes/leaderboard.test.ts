import Database from "better-sqlite3";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { SQLiteScoreService } from "../services/scoreService.js";

function setupApp() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT NOT NULL,
      track_id TEXT NOT NULL,
      time_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const scoreService = new SQLiteScoreService(db);
  const app = createApp(scoreService);
  return { app, db };
}

describe("leaderboard routes", () => {
  let app: ReturnType<typeof setupApp>["app"];

  beforeEach(() => {
    ({ app } = setupApp());
  });

  it("accepts a valid score", async () => {
    const response = await request(app).post("/api/leaderboard").send({
      playerName: "RACER_1",
      trackId: "track_01",
      timeMs: 75234
    });
    expect(response.status).toBe(201);
  });

  it("rejects invalid payload", async () => {
    const response = await request(app).post("/api/leaderboard").send({
      playerName: "x",
      trackId: "track_01",
      timeMs: 999
    });
    expect(response.status).toBe(400);
  });

  it("returns sorted list by time", async () => {
    await request(app).post("/api/leaderboard").send({
      playerName: "AAA",
      trackId: "track_01",
      timeMs: 90000
    });
    await request(app).post("/api/leaderboard").send({
      playerName: "BBB",
      trackId: "track_01",
      timeMs: 80000
    });

    const response = await request(app).get("/api/leaderboard").query({
      trackId: "track_01",
      limit: 10
    });

    expect(response.status).toBe(200);
    expect(response.body[0].playerName).toBe("BBB");
    expect(response.body[1].playerName).toBe("AAA");
  });

  it("accepts floating time and rounds on save", async () => {
    const postResponse = await request(app).post("/api/leaderboard").send({
      playerName: "FLOATY",
      trackId: "track_01",
      timeMs: 75234.8
    });
    expect(postResponse.status).toBe(201);

    const getResponse = await request(app).get("/api/leaderboard").query({
      trackId: "track_01",
      limit: 10
    });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body[0].playerName).toBe("FLOATY");
    expect(getResponse.body[0].timeMs).toBe(75235);
  });
});
