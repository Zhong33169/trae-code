import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', 'data.db');

let db: SqlJsDatabase;

export interface PreparedResult {
  get: (...params: any[]) => any;
  all: (...params: any[]) => any[];
  run: (...params: any[]) => void;
}

export function prepare(sql: string): PreparedResult {
  return {
    get: (...params: any[]): any => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      let result: any = undefined;
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
      stmt.free();
      return result;
    },
    all: (...params: any[]): any[] => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results: any[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    },
    run: (...params: any[]): void => {
      db.run(sql, params);
      saveDb();
    },
  };
}

export function exec(sql: string): void {
  db.exec(sql);
  saveDb();
}

function saveDb(): void {
  try {
    const data = db.export();
    writeFileSync(DB_PATH, Buffer.from(data));
  } catch {}
}

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('receptionist','room_supervisor','duty_manager')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      guest_name TEXT NOT NULL,
      guest_phone TEXT,
      room_number TEXT,
      supplement_reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending_supplement' CHECK(status IN ('pending_supplement','pending_verification','pending_review','archived')),
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      stage TEXT NOT NULL CHECK(stage IN ('registration','verification','archive')),
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      operator_id TEXT NOT NULL REFERENCES users(id),
      operator_role TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedData();
  saveDb();
}

function seedData(): void {
  const userCount = prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (userCount && userCount.cnt > 0) return;

  db.run("INSERT INTO users (id, username, password_hash, role) VALUES ('u1', 'receptionist1', '123456', 'receptionist')");
  db.run("INSERT INTO users (id, username, password_hash, role) VALUES ('u2', 'supervisor1', '123456', 'room_supervisor')");
  db.run("INSERT INTO users (id, username, password_hash, role) VALUES ('u3', 'manager1', '123456', 'duty_manager')");

  db.run("INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by) VALUES ('o1', 'ORD-20260611-001', '张三', NULL, '1201', NULL, 'pending_supplement', 1, 'u1')");
  db.run("INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by) VALUES ('o2', 'ORD-20260611-002', '李四', NULL, '1503', '入住时系统故障未录入', 'pending_verification', 2, 'u1')");
  db.run("INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by) VALUES ('o3', 'ORD-20260611-003', '王五', NULL, '1808', 'VIP客户延迟退房补录', 'pending_review', 3, 'u1')");
  db.run("INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by) VALUES ('o4', 'ORD-20260611-004', '赵六', NULL, '2105', '团队入住补录', 'archived', 4, 'u1')");
  db.run("INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by) VALUES ('o5', 'ORD-20260611-005', '孙七', NULL, '0902', '换房补录', 'pending_verification', 2, 'u1')");
  db.run("INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by) VALUES ('o6', 'ORD-20260611-006', '周八', NULL, '0611', NULL, 'pending_supplement', 1, 'u1')");

  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e1', 'o2', 'registration', '身份证扫描', '住客身份证正面扫描件')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e2', 'o3', 'registration', '身份证扫描', '住客身份证正面扫描件')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e3', 'o3', 'verification', '客房检查记录', '客房设施检查确认单')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e4', 'o4', 'registration', '身份证扫描', '住客身份证正面扫描件')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e5', 'o4', 'verification', '客房检查记录', '客房设施检查确认单')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e6', 'o4', 'archive', '归档确认书', '值班经理归档确认签字')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e7', 'o5', 'registration', '身份证扫描', '住客身份证正面扫描件')");

  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a1', 'o4', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a2', 'o4', 'verify', 'u2', 'room_supervisor', '核验通过')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a3', 'o4', 'review', 'u3', 'duty_manager', '复核归档完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a4', 'o3', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a5', 'o3', 'verify', 'u2', 'room_supervisor', '核验通过')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a6', 'o2', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a7', 'o5', 'supplement', 'u1', 'receptionist', '补录登记完成')");
}
