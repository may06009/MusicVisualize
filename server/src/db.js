import Database from "better-sqlite3";
import dotenv from "dotenv";
dotenv.config();

const db = new Database(process.env.DB_PATH || "./data.db");
db.pragma("journal_mode = WAL");

// users 테이블 (email unique)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export default db;
