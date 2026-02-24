import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export function createDatabase(dbPath: string): Database.Database {
  const resolvedPath = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const db = new Database(resolvedPath);
  const schemaPath = new URL("./schema.sql", import.meta.url);
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
  return db;
}
