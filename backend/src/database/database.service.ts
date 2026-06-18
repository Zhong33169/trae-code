import { Injectable, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: Database.Database;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'deviation.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  onModuleInit() {
    this.initializeTables();
  }

  private initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('FINANCIAL_ADVISOR','COMPLIANCE_OFFICER','BRANCH_MANAGER')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS trade_reviews (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        trade_type TEXT NOT NULL,
        trade_amount REAL NOT NULL,
        trade_date TEXT NOT NULL,
        account_no TEXT NOT NULL,
        risk_level TEXT NOT NULL CHECK(risk_level IN ('HIGH','MEDIUM','LOW')),
        status TEXT NOT NULL CHECK(status IN ('REGISTERED','PENDING_CORRECTION','REVIEWING','COMPLETED')),
        priority INTEGER NOT NULL DEFAULT 0,
        current_handler_id TEXT,
        current_role TEXT CHECK(current_role IN ('FINANCIAL_ADVISOR','COMPLIANCE_OFFICER','BRANCH_MANAGER')),
        version INTEGER NOT NULL DEFAULT 1,
        evidence_json TEXT,
        deadline TEXT,
        is_overdue INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS review_records (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        operator_role TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('REGISTER','SUBMIT_REVIEW','REQUEST_CORRECTION','CORRECT','CONFIRM_COMPLETE','REJECT','APPROVE')),
        from_status TEXT,
        to_status TEXT,
        opinion TEXT,
        result TEXT,
        evidence_json TEXT,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (review_id) REFERENCES trade_reviews(id),
        FOREIGN KEY (operator_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_review_status ON trade_reviews(status);
      CREATE INDEX IF NOT EXISTS idx_review_priority ON trade_reviews(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_review_risk ON trade_reviews(risk_level);
      CREATE INDEX IF NOT EXISTS idx_review_handler ON trade_reviews(current_handler_id);
      CREATE INDEX IF NOT EXISTS idx_records_review ON review_records(review_id, created_at DESC);
    `);
  }

  getDb(): Database.Database {
    return this.db;
  }
}
