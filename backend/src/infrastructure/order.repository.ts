import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { VenueOrder } from '../domain/venue-order.entity';
import { OrderStatus, Role, AuditLog } from '../types';
import { getDatabase } from './database';

@Injectable()
export class OrderRepository {
  private locks: Map<string, string> = new Map();

  async save(order: VenueOrder): Promise<VenueOrder> {
    const db = await getDatabase();

    const existing = db.get('SELECT version FROM orders WHERE id = ?', [order.id]) as
      | { version: number }
      | undefined;

    if (existing && existing.version !== order.version) {
      throw new Error('CONCURRENT_MODIFICATION');
    }

    order.version = (existing?.version || 0) + 1;
    order.updatedAt = new Date().toISOString();
    order.updateTimeLimit();

    db.run('BEGIN');

    try {
      db.run(
        `INSERT INTO orders (
          id, order_no, qr_code, venue_name, venue_type, booking_date, booking_time,
          applicant_name, applicant_phone, applicant_id_card, status,
          current_handler_role, current_handler_id, current_handler_name,
          materials, time_limit, registration_opinion, review_opinion,
          final_review_opinion, correction_request, scanned_at, scanned_by,
          version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          order_no = excluded.order_no,
          qr_code = excluded.qr_code,
          venue_name = excluded.venue_name,
          venue_type = excluded.venue_type,
          booking_date = excluded.booking_date,
          booking_time = excluded.booking_time,
          applicant_name = excluded.applicant_name,
          applicant_phone = excluded.applicant_phone,
          applicant_id_card = excluded.applicant_id_card,
          status = excluded.status,
          current_handler_role = excluded.current_handler_role,
          current_handler_id = excluded.current_handler_id,
          current_handler_name = excluded.current_handler_name,
          materials = excluded.materials,
          time_limit = excluded.time_limit,
          registration_opinion = excluded.registration_opinion,
          review_opinion = excluded.review_opinion,
          final_review_opinion = excluded.final_review_opinion,
          correction_request = excluded.correction_request,
          scanned_at = excluded.scanned_at,
          scanned_by = excluded.scanned_by,
          version = excluded.version,
          updated_at = excluded.updated_at`,
        [
          order.id,
          order.orderNo,
          order.qrCode,
          order.venueName,
          order.venueType,
          order.bookingDate,
          order.bookingTime,
          order.applicantName,
          order.applicantPhone,
          order.applicantIdCard,
          order.status,
          order.currentHandlerRole,
          order.currentHandlerId,
          order.currentHandlerName,
          JSON.stringify(order.materials),
          JSON.stringify(order.timeLimit),
          order.registrationOpinion || null,
          order.reviewOpinion || null,
          order.finalReviewOpinion || null,
          order.correctionRequest || null,
          order.scannedAt || null,
          order.scannedBy || null,
          order.version,
          order.createdAt,
          order.updatedAt,
        ],
      );

      for (const log of order.auditLogs) {
        db.run(
          `INSERT INTO audit_logs (
            id, order_id, action, operator_id, operator_name, operator_role,
            timestamp, comment, old_status, new_status, ip_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            log.id,
            log.orderId,
            log.action,
            log.operatorId,
            log.operatorName,
            log.operatorRole,
            log.timestamp,
            log.comment || null,
            log.oldStatus || null,
            log.newStatus || null,
            log.ipAddress || null,
          ],
        );
      }

      db.run('COMMIT');
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }

    return new VenueOrder({ ...order });
  }

  async findById(id: string): Promise<VenueOrder | null> {
    const db = await getDatabase();

    const row = db.get('SELECT * FROM orders WHERE id = ?', [id]) as any;
    if (!row) return null;

    const logs = db.all('SELECT * FROM audit_logs WHERE order_id = ? ORDER BY timestamp ASC', [id]);

    return this.rowToVenueOrder(row, logs);
  }

  async findByQrCode(qrCode: string): Promise<VenueOrder | null> {
    const db = await getDatabase();

    const row = db.get('SELECT * FROM orders WHERE qr_code = ?', [qrCode]) as any;
    if (!row) return null;

    const logs = db.all('SELECT * FROM audit_logs WHERE order_id = ? ORDER BY timestamp ASC', [row.id]);

    return this.rowToVenueOrder(row, logs);
  }

  async findAll(filters?: {
    status?: OrderStatus[];
    handlerRole?: Role;
    handlerId?: string;
  }): Promise<VenueOrder[]> {
    const db = await getDatabase();

    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];

    if (filters?.status?.length) {
      const placeholders = filters.status.map(() => '?').join(',');
      sql += ` AND status IN (${placeholders})`;
      params.push(...filters.status);
    }
    if (filters?.handlerRole) {
      sql += ' AND current_handler_role = ?';
      params.push(filters.handlerRole);
    }
    if (filters?.handlerId) {
      sql += ' AND current_handler_id = ?';
      params.push(filters.handlerId);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = db.all(sql, params);

    const result: VenueOrder[] = [];
    for (const row of rows) {
      const logs = db.all('SELECT * FROM audit_logs WHERE order_id = ? ORDER BY timestamp ASC', [row.id]);
      result.push(this.rowToVenueOrder(row, logs));
    }

    return result;
  }

  async findByIds(ids: string[]): Promise<VenueOrder[]> {
    if (ids.length === 0) return [];

    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.all(`SELECT * FROM orders WHERE id IN (${placeholders})`, ids);

    const result: VenueOrder[] = [];
    for (const row of rows) {
      const logs = db.all('SELECT * FROM audit_logs WHERE order_id = ? ORDER BY timestamp ASC', [row.id]);
      result.push(this.rowToVenueOrder(row, logs));
    }

    return result;
  }

  async acquireLock(orderId: string, operatorId: string): Promise<boolean> {
    if (this.locks.has(orderId)) {
      return false;
    }
    this.locks.set(orderId, operatorId);
    return true;
  }

  async releaseLock(orderId: string): Promise<void> {
    this.locks.delete(orderId);
  }

  async isLocked(orderId: string): Promise<boolean> {
    return this.locks.has(orderId);
  }

  async getLockHolder(orderId: string): Promise<string | null> {
    return this.locks.get(orderId) || null;
  }

  async saveScanRecord(record: {
    orderId?: string;
    qrCode: string;
    operatorId: string;
    operatorName: string;
    operatorRole: string;
    result: string;
    message?: string;
    details?: any;
  }): Promise<void> {
    const db = await getDatabase();

    db.run(
      `INSERT INTO scan_records (
        id, order_id, qr_code, operator_id, operator_name, operator_role,
        result, message, details, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        record.orderId || null,
        record.qrCode,
        record.operatorId,
        record.operatorName,
        record.operatorRole,
        record.result,
        record.message || null,
        record.details ? JSON.stringify(record.details) : null,
        new Date().toISOString(),
      ],
    );
  }

  async getScanRecords(orderId: string): Promise<any[]> {
    const db = await getDatabase();

    const rows = db.all('SELECT * FROM scan_records WHERE order_id = ? ORDER BY timestamp DESC', [orderId]);

    return rows.map((row: any) => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null,
    }));
  }

  private rowToVenueOrder(row: any, logs: any[]): VenueOrder {
    return new VenueOrder({
      id: row.id,
      orderNo: row.order_no,
      qrCode: row.qr_code,
      venueName: row.venue_name,
      venueType: row.venue_type,
      bookingDate: row.booking_date,
      bookingTime: row.booking_time,
      applicantName: row.applicant_name,
      applicantPhone: row.applicant_phone,
      applicantIdCard: row.applicant_id_card,
      status: row.status,
      currentHandlerRole: row.current_handler_role,
      currentHandlerId: row.current_handler_id,
      currentHandlerName: row.current_handler_name,
      materials: JSON.parse(row.materials || '[]'),
      timeLimit: row.time_limit ? JSON.parse(row.time_limit) : undefined,
      registrationOpinion: row.registration_opinion || undefined,
      reviewOpinion: row.review_opinion || undefined,
      finalReviewOpinion: row.final_review_opinion || undefined,
      correctionRequest: row.correction_request || undefined,
      scannedAt: row.scanned_at || undefined,
      scannedBy: row.scanned_by || undefined,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      auditLogs: logs.map((log) => ({
        id: log.id,
        orderId: log.order_id,
        action: log.action,
        operatorId: log.operator_id,
        operatorName: log.operator_name,
        operatorRole: log.operator_role,
        timestamp: log.timestamp,
        comment: log.comment,
        oldStatus: log.old_status,
        newStatus: log.new_status,
        ipAddress: log.ip_address || undefined,
      })) as AuditLog[],
    });
  }
}
