import { createApp } from "./app.js";
import { createDatabase } from "./db/database.js";
import { SQLiteScoreService } from "./services/scoreService.js";
import { loadTrackRegistry } from "./tracks/trackRegistry.js";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DB_PATH ?? "./server/data/scores.sqlite";

const db = createDatabase(dbPath);
const scoreService = new SQLiteScoreService(db);
const trackRegistry = loadTrackRegistry();
console.log(`Loaded ${trackRegistry.listTrackIds().length} tracks (manifest checksum: ${trackRegistry.checksum.slice(0, 12)}...)`);
const app = createApp(scoreService, trackRegistry);

app.listen(port, () => {
  console.log(`Leaderboard API listening on http://localhost:${port}`);
});
