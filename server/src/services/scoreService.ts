import type Database from "better-sqlite3";

export interface ScoreRecord {
  playerName: string;
  trackId: string;
  timeMs: number;
  createdAt: string;
}

export interface ScoreService {
  getTop(trackId: string, limit: number): ScoreRecord[];
  insertScore(playerName: string, trackId: string, timeMs: number): void;
}

interface ScoreRow {
  player_name: string;
  track_id: string;
  time_ms: number;
  created_at: string;
}

export class SQLiteScoreService implements ScoreService {
  constructor(private readonly db: Database.Database) {}

  getTop(trackId: string, limit: number): ScoreRecord[] {
    const rows = this.db
      .prepare(
        `SELECT player_name, track_id, time_ms, created_at
         FROM scores
         WHERE track_id = ?
         ORDER BY time_ms ASC, created_at ASC
         LIMIT ?`
      )
      .all(trackId, limit) as ScoreRow[];

    return rows.map((row) => ({
      playerName: row.player_name,
      trackId: row.track_id,
      timeMs: row.time_ms,
      createdAt: row.created_at
    }));
  }

  insertScore(playerName: string, trackId: string, timeMs: number): void {
    this.db
      .prepare(
        `INSERT INTO scores (player_name, track_id, time_ms)
         VALUES (?, ?, ?)`
      )
      .run(playerName, trackId, timeMs);
  }
}
