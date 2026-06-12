import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { OrderStatus, Role } from '../types';

let dbHelper: DatabaseHelper | null = null;

export class DatabaseHelper {
  private db: Database;
  private dbPath: string;

  constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  run(sql: string, params?: any[]): void {
    this.db.run(sql, params);
    this.save();
  }

  get(sql: string, params?: any[]): any | undefined {
    const stmt = this.db.prepare(sql);
    if (params) stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(sql: string, params?: any[]): any[] {
    const stmt = this.db.prepare(sql);
    if (params) stmt.bind(params);
    const rows: any[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  exec(sql: string): void {
    this.db.exec(sql);
    this.save();
  }

  save(): void {
    const data = this.db.export();
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }
}

export async function getDatabase(): Promise<DatabaseHelper> {
  if (dbHelper) return dbHelper;

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'stadium.db');

  const SQL = await initSqlJs();

  let db: Database;
  let needSeed = false;

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    needSeed = true;
  }

  dbHelper = new DatabaseHelper(db, dbPath);

  createTables(dbHelper);

  if (needSeed) {
    seedMockData(dbHelper);
  }

  dbHelper.save();

  return dbHelper;
}

function createTables(db: DatabaseHelper): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      qr_code TEXT NOT NULL UNIQUE,
      venue_name TEXT NOT NULL,
      venue_type TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      applicant_phone TEXT NOT NULL,
      applicant_id_card TEXT NOT NULL,
      status TEXT NOT NULL,
      current_handler_role TEXT,
      current_handler_id TEXT,
      current_handler_name TEXT,
      materials TEXT NOT NULL DEFAULT '[]',
      time_limit TEXT,
      registration_opinion TEXT,
      review_opinion TEXT,
      final_review_opinion TEXT,
      correction_request TEXT,
      scanned_at TEXT,
      scanned_by TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      comment TEXT,
      old_status TEXT,
      new_status TEXT,
      ip_address TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS scan_records (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      qr_code TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      result TEXT NOT NULL,
      message TEXT,
      details TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_qr_code ON orders(qr_code);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_handler_role ON orders(current_handler_role);
    CREATE INDEX IF NOT EXISTS idx_orders_handler_id ON orders(current_handler_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_order_id ON audit_logs(order_id);
    CREATE INDEX IF NOT EXISTS idx_scan_records_order_id ON scan_records(order_id);
  `);
}

function seedMockData(db: DatabaseHelper): void {
  const count = db.get('SELECT COUNT(*) as cnt FROM orders') as { cnt: number } | undefined;
  if (count && count.cnt > 0) return;

  const now = new Date();

  const mockOrders = [
    {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      order_no: 'VD202506001',
      qr_code: 'QR-V-202506001',
      venue_name: '主体育场',
      venue_type: '田径场',
      booking_date: '2025-06-15',
      booking_time: '09:00-11:00',
      applicant_name: '张三',
      applicant_phone: '13800138001',
      applicant_id_card: '110101199001011234',
      status: OrderStatus.PENDING_REGISTRATION,
      current_handler_role: Role.REGISTRAR,
      current_handler_id: 'reg1',
      current_handler_name: '李登记',
      materials: [
        { id: 'm1', name: '身份证复印件', type: 'id_card', uploaded: false, required: true },
        { id: 'm2', name: '场地使用申请书', type: 'application', uploaded: false, required: true },
        { id: 'm3', name: '活动方案', type: 'plan', uploaded: false, required: false },
      ],
      time_limit: {
        deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        remainingHours: 24,
        isOverdue: false,
      },
    },
    {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      order_no: 'VD202506002',
      qr_code: 'QR-V-202506002',
      venue_name: '篮球馆',
      venue_type: '篮球',
      booking_date: '2025-06-16',
      booking_time: '14:00-16:00',
      applicant_name: '李四',
      applicant_phone: '13800138002',
      applicant_id_card: '110101199002022345',
      status: OrderStatus.PENDING_CORRECTION,
      current_handler_role: Role.REGISTRAR,
      current_handler_id: 'reg1',
      current_handler_name: '李登记',
      correction_request: '请补充身份证正反面复印件',
      materials: [
        { id: 'm1', name: '身份证复印件', type: 'id_card', uploaded: true, required: true },
        { id: 'm2', name: '场地使用申请书', type: 'application', uploaded: true, required: true },
        { id: 'm3', name: '单位介绍信', type: 'introduction', uploaded: false, required: true },
      ],
      time_limit: {
        deadline: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        remainingHours: 12,
        isOverdue: false,
      },
    },
    {
      id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      order_no: 'VD202506003',
      qr_code: 'QR-V-202506003',
      venue_name: '游泳馆',
      venue_type: '游泳',
      booking_date: '2025-06-17',
      booking_time: '10:00-12:00',
      applicant_name: '王五',
      applicant_phone: '13800138003',
      applicant_id_card: '110101199003033456',
      status: OrderStatus.PENDING_REVIEW,
      current_handler_role: Role.SUPERVISOR,
      current_handler_id: 'sup1',
      current_handler_name: '王主管',
      registration_opinion: '材料齐全，符合场地使用规定',
      materials: [
        { id: 'm1', name: '身份证复印件', type: 'id_card', uploaded: true, required: true },
        { id: 'm2', name: '场地使用申请书', type: 'application', uploaded: true, required: true },
        { id: 'm3', name: '健康证明', type: 'health', uploaded: true, required: true },
      ],
      time_limit: {
        deadline: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        remainingHours: 48,
        isOverdue: false,
      },
    },
    {
      id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
      order_no: 'VD202506004',
      qr_code: 'QR-V-202506004',
      venue_name: '网球馆',
      venue_type: '网球',
      booking_date: '2025-06-18',
      booking_time: '15:00-17:00',
      applicant_name: '赵六',
      applicant_phone: '13800138004',
      applicant_id_card: '110101199004044567',
      status: OrderStatus.PENDING_FINAL_REVIEW,
      current_handler_role: Role.REVIEWER,
      current_handler_id: 'rev1',
      current_handler_name: '陈复核',
      registration_opinion: '材料齐全',
      review_opinion: '审核通过，符合使用规范',
      materials: [
        { id: 'm1', name: '身份证复印件', type: 'id_card', uploaded: true, required: true },
        { id: 'm2', name: '场地使用申请书', type: 'application', uploaded: true, required: true },
        { id: 'm3', name: '缴费凭证', type: 'payment', uploaded: true, required: true },
      ],
      time_limit: {
        deadline: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
        remainingHours: 72,
        isOverdue: false,
      },
    },
    {
      id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
      order_no: 'VD202506005',
      qr_code: 'QR-V-202506005',
      venue_name: '羽毛球馆',
      venue_type: '羽毛球',
      booking_date: '2025-06-10',
      booking_time: '08:00-10:00',
      applicant_name: '钱七',
      applicant_phone: '13800138005',
      applicant_id_card: '110101199005055678',
      status: OrderStatus.ARCHIVED,
      current_handler_role: Role.REVIEWER,
      current_handler_id: 'rev1',
      current_handler_name: '陈复核',
      registration_opinion: '材料齐全',
      review_opinion: '审核通过',
      final_review_opinion: '复核通过，已归档',
      materials: [
        { id: 'm1', name: '身份证复印件', type: 'id_card', uploaded: true, required: true },
        { id: 'm2', name: '场地使用申请书', type: 'application', uploaded: true, required: true },
      ],
      time_limit: {
        deadline: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        remainingHours: 0,
        isOverdue: true,
      },
    },
  ];

  const createdAt = now.toISOString();

  for (const order of mockOrders) {
    db.run(
      `INSERT INTO orders (
        id, order_no, qr_code, venue_name, venue_type, booking_date, booking_time,
        applicant_name, applicant_phone, applicant_id_card, status,
        current_handler_role, current_handler_id, current_handler_name,
        materials, time_limit, registration_opinion, review_opinion,
        final_review_opinion, correction_request, scanned_at, scanned_by,
        version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        order.order_no,
        order.qr_code,
        order.venue_name,
        order.venue_type,
        order.booking_date,
        order.booking_time,
        order.applicant_name,
        order.applicant_phone,
        order.applicant_id_card,
        order.status,
        order.current_handler_role,
        order.current_handler_id,
        order.current_handler_name,
        JSON.stringify(order.materials),
        JSON.stringify(order.time_limit),
        (order as any).registration_opinion || null,
        (order as any).review_opinion || null,
        (order as any).final_review_opinion || null,
        (order as any).correction_request || null,
        null,
        null,
        1,
        createdAt,
        createdAt,
      ],
    );
  }
}
