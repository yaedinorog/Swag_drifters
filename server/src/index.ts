import { createApp } from "./app.js";
import { createDatabase } from "./db/database.js";
import { SQLiteScoreService } from "./services/scoreService.js";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DB_PATH ?? "./server/data/scores.sqlite";

const db = createDatabase(dbPath);
const scoreService = new SQLiteScoreService(db);
const app = createApp(scoreService);

app.listen(port, () => {
  console.log(`Leaderboard API listening on http://localhost:${port}`);
});
