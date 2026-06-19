import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function initDb(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('registrar','reviewer','archiver')),
      display_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      dish_name TEXT NOT NULL,
      dish_category TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft','submitted','returned_to_registrar','reviewed','returned_to_reviewer','archived')),
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES users(id),
      current_handler TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('registration','verification','archive')),
      file_name TEXT NOT NULL,
      description TEXT,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_action_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      operator TEXT NOT NULL REFERENCES users(id),
      operator_role TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
    CREATE INDEX IF NOT EXISTS idx_orders_current_handler ON orders(current_handler);
    CREATE INDEX IF NOT EXISTS idx_evidence_order_id ON evidence(order_id);
    CREATE INDEX IF NOT EXISTS idx_action_logs_order_id ON order_action_logs(order_id);
  `);

  const userCount = database.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number };
  if (userCount.cnt === 0) {
    const hash = (pwd: string) => crypto.createHash("sha256").update(pwd).digest("hex");
    const insertUser = database.prepare(
      "INSERT INTO users (id, username, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)"
    );
    insertUser.run("u1", "registrar", hash("123456"), "registrar", "登记员-张三");
    insertUser.run("u2", "reviewer", hash("123456"), "reviewer", "审核主管-李四");
    insertUser.run("u3", "archiver", hash("123456"), "archiver", "复核负责人-王五");
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function hashPassword(pwd: string): string {
  return crypto.createHash("sha256").update(pwd).digest("hex");
}
