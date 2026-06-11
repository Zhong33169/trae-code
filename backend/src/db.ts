import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { BlockCode, UserRole, ActionTarget, ActionPayload } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', 'data.db');

let db: SqlJsDatabase;

export const BLOCK_HINTS: Record<BlockCode, string> = {
  wrong_role: '请切换到正确的角色后重试',
  wrong_status: '请确认订单当前状态是否与操作匹配，或先完成前置步骤',
  missing_evidence: '请补充至少1项必需证据后再提交',
  version_conflict: '请刷新页面获取最新版本后重试',
  duplicate_supplement: '该订单已有补录记录，可前往核验流程继续推进',
  archived: '已归档订单不可修改，如需变更请联系管理员',
  not_found: '订单不存在，请返回列表重新选择',
  unknown: '操作异常，请稍后重试或联系技术支持',
};

export const BLOCK_ACTION_TARGETS: Record<BlockCode, ActionTarget> = {
  wrong_role: 'switch_role',
  wrong_status: 'goto_detail',
  missing_evidence: 'add_evidence',
  version_conflict: 'refresh_version',
  duplicate_supplement: 'continue_verify',
  archived: 'no_action',
  not_found: 'no_action',
  unknown: 'no_action',
};

export function getBlockActionPayload(code: BlockCode, orderId?: string, actionAttempted?: 'supplement' | 'verify' | 'review'): ActionPayload {
  const payload: ActionPayload = {};
  const actionTarget = getBlockActionTarget(code);
  if (actionTarget === 'switch_role') {
    if (actionAttempted === 'supplement') payload.targetRole = 'receptionist';
    else if (actionAttempted === 'verify') payload.targetRole = 'room_supervisor';
    else if (actionAttempted === 'review') payload.targetRole = 'duty_manager';
  }
  if (orderId) {
    payload.orderId = orderId;
  }
  if (actionTarget === 'add_evidence') {
    payload.scrollTo = 'evidence';
  }
  if (actionTarget === 'continue_supplement' || actionTarget === 'continue_verify' || actionTarget === 'continue_review') {
    payload.scrollTo = 'action';
  }
  return payload;
}

export function getBlockHint(code: BlockCode): string {
  return BLOCK_HINTS[code] || BLOCK_HINTS.unknown;
}

export function getBlockActionTarget(code: BlockCode): ActionTarget {
  return BLOCK_ACTION_TARGETS[code] || 'no_action';
}

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

export function loadBlockAttempts(orderId: string): any[] {
  return prepare('SELECT * FROM block_attempts WHERE order_id = ? ORDER BY created_at DESC').all(orderId);
}

export function recordBlockAttempt(params: {
  id: string;
  orderId: string;
  operatorId: string;
  operatorRole: UserRole;
  actionAttempted: 'supplement' | 'verify' | 'review';
  code: BlockCode;
  reason: string;
  submittedVersion: number | null;
  currentVersion: number;
}): void {
  const actionTarget = getBlockActionTarget(params.code);
  const actionPayload = getBlockActionPayload(params.code, params.orderId, params.actionAttempted);
  prepare(`
    INSERT INTO block_attempts (
      id, order_id, operator_id, operator_role, action_attempted, code, reason, action_hint,
      action_target, action_payload, submitted_version, current_version, resolve_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    params.id,
    params.orderId,
    params.operatorId,
    params.operatorRole,
    params.actionAttempted,
    params.code,
    params.reason,
    getBlockHint(params.code),
    actionTarget,
    JSON.stringify(actionPayload),
    params.submittedVersion,
    params.currentVersion
  );
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

  db.run(`
    CREATE TABLE IF NOT EXISTS block_attempts (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      operator_id TEXT NOT NULL REFERENCES users(id),
      operator_role TEXT NOT NULL,
      action_attempted TEXT NOT NULL CHECK(action_attempted IN ('supplement','verify','review')),
      code TEXT NOT NULL,
      reason TEXT NOT NULL,
      action_hint TEXT NOT NULL,
      action_target TEXT NOT NULL,
      action_payload TEXT,
      submitted_version INTEGER,
      current_version INTEGER NOT NULL,
      resolve_status TEXT NOT NULL DEFAULT 'pending' CHECK(resolve_status IN ('pending','resolved','ignored')),
      resolve_remark TEXT,
      resolved_at TEXT,
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
  db.run("INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by) VALUES ('o7', 'ORD-20260611-007', '钱九', NULL, '1107', '会议团队补录', 'pending_supplement', 3, 'u1')");
  db.run("INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by) VALUES ('o8', 'ORD-20260611-008', '吴十', NULL, '1415', '长住客续住补录', 'pending_verification', 2, 'u1')");
  db.run("INSERT INTO orders (id, order_no, guest_name, guest_phone, room_number, supplement_reason, status, version, created_by) VALUES ('o9', 'ORD-20260611-009', '郑十一', NULL, '2002', '促销活动补录', 'pending_verification', 4, 'u1')");

  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e1', 'o2', 'registration', '身份证扫描', '住客身份证正面扫描件')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e2', 'o3', 'registration', '身份证扫描', '住客身份证正面扫描件')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e3', 'o3', 'verification', '客房检查记录', '客房设施检查确认单')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e4', 'o4', 'registration', '身份证扫描', '住客身份证正面扫描件')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e5', 'o4', 'verification', '客房检查记录', '客房设施检查确认单')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e6', 'o4', 'archive', '归档确认书', '值班经理归档确认签字')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e7', 'o5', 'registration', '身份证扫描', '住客身份证正面扫描件')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e8', 'o7', 'registration', '身份证扫描', '住客身份证正面扫描件')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e9', 'o8', 'registration', '入住登记表', '纸质入住登记表')");
  db.run("INSERT INTO evidence_items (id, order_id, stage, type, description) VALUES ('e10', 'o9', 'registration', '身份证扫描', '住客身份证正面扫描件')");

  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a1', 'o4', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a2', 'o4', 'verify', 'u2', 'room_supervisor', '核验通过')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a3', 'o4', 'review', 'u3', 'duty_manager', '复核归档完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a4', 'o3', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a5', 'o3', 'verify', 'u2', 'room_supervisor', '核验通过')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a6', 'o2', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a7', 'o5', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a8', 'o7', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a9', 'o7', 'verify', 'u2', 'room_supervisor', '核验退回：证据不完整')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a10', 'o8', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a11', 'o9', 'supplement', 'u1', 'receptionist', '补录登记完成')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a12', 'o9', 'verify', 'u2', 'room_supervisor', '核验通过')");
  db.run("INSERT INTO audit_logs (id, order_id, action, operator_id, operator_role, detail) VALUES ('a13', 'o9', 'review', 'u3', 'duty_manager', '复核退回：信息有误')");

  db.run("INSERT INTO block_attempts (id, order_id, operator_id, operator_role, action_attempted, code, reason, action_hint, action_target, action_payload, submitted_version, current_version, resolve_status) VALUES ('b1', 'o2', 'u1', 'receptionist', 'supplement', 'wrong_status', '订单状态不是待补录，无法补录', '请确认订单当前状态是否与操作匹配，或先完成前置步骤', 'goto_detail', '{\"orderId\":\"o2\"}', 2, 2, 'pending')");
  db.run("INSERT INTO block_attempts (id, order_id, operator_id, operator_role, action_attempted, code, reason, action_hint, action_target, action_payload, submitted_version, current_version, resolve_status) VALUES ('b2', 'o4', 'u3', 'duty_manager', 'review', 'archived', '已归档订单不可修改', '已归档订单不可修改，如需变更请联系管理员', 'no_action', '{}', 4, 4, 'pending')");
  db.run("INSERT INTO block_attempts (id, order_id, operator_id, operator_role, action_attempted, code, reason, action_hint, action_target, action_payload, submitted_version, current_version, resolve_status, resolve_remark, resolved_at) VALUES ('b3', 'o7', 'u1', 'receptionist', 'supplement', 'duplicate_supplement', '该订单已有补录记录，不可重复补录', '该订单已有补录记录，可前往核验流程继续推进', 'continue_verify', '{\"orderId\":\"o7\",\"scrollTo\":\"action\"}', 3, 3, 'resolved', '已切换到客房主管角色继续推进', datetime('now'))");
  db.run("INSERT INTO block_attempts (id, order_id, operator_id, operator_role, action_attempted, code, reason, action_hint, action_target, action_payload, submitted_version, current_version, resolve_status, resolve_remark, resolved_at) VALUES ('b4', 'o9', 'u2', 'room_supervisor', 'verify', 'version_conflict', '订单已被他人修改，请刷新后重试（版本冲突）', '请刷新页面获取最新版本后重试', 'refresh_version', '{\"orderId\":\"o9\"}', 3, 4, 'resolved', '已刷新版本重新提交', datetime('now'))");
  db.run("INSERT INTO block_attempts (id, order_id, operator_id, operator_role, action_attempted, code, reason, action_hint, action_target, action_payload, submitted_version, current_version, resolve_status) VALUES ('b5', 'o3', 'u1', 'receptionist', 'supplement', 'wrong_role', '仅前厅接待可以补录登记', '请切换到正确的角色后重试', 'switch_role', '{\"targetRole\":\"receptionist\"}', 3, 3, 'pending')");
  db.run("INSERT INTO block_attempts (id, order_id, operator_id, operator_role, action_attempted, code, reason, action_hint, action_target, action_payload, submitted_version, current_version, resolve_status) VALUES ('b6', 'o6', 'u1', 'receptionist', 'supplement', 'missing_evidence', '补录登记必须至少提供1项登记证据', '请补充至少1项必需证据后再提交', 'add_evidence', '{\"orderId\":\"o6\",\"scrollTo\":\"evidence\"}', 1, 1, 'pending')");
}
