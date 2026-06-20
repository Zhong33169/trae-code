import { Module, Global } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_TOKEN = 'DATABASE';

const DDL = `
CREATE TABLE IF NOT EXISTS invitation (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('电视','报纸','网络','自媒体','其他')),
  event_name TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_location TEXT NOT NULL,
  deadline TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_review','review_rejected','pending_final','final_rejected','archived')),
  creator_id TEXT NOT NULL,
  creator_name TEXT NOT NULL,
  reviewer_id TEXT,
  reviewer_name TEXT,
  final_reviewer_id TEXT,
  final_reviewer_name TEXT,
  review_comment TEXT,
  final_comment TEXT,
  guest_confirmed INTEGER NOT NULL DEFAULT 0,
  checkin_completed INTEGER NOT NULL DEFAULT 0,
  materials_complete INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS material (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('邀请函','媒体资料','活动方案','其他')),
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invitation_id) REFERENCES invitation(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_role TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  before_status TEXT,
  after_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invitation_id) REFERENCES invitation(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invitation_status ON invitation(status);
CREATE INDEX IF NOT EXISTS idx_invitation_deadline ON invitation(deadline);
CREATE INDEX IF NOT EXISTS idx_invitation_creator ON invitation(creator_id);
CREATE INDEX IF NOT EXISTS idx_audit_invitation ON audit_log(invitation_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`;

const dbProvider = {
  provide: DATABASE_TOKEN,
  useFactory: () => {
    const dbPath = process.env.DB_PATH || './data/invitations.db';
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(DDL);
    return db;
  },
};

@Global()
@Module({
  providers: [dbProvider],
  exports: [dbProvider],
})
export class DatabaseModule {}
