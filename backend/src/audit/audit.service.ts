import { Inject, Injectable } from '@nestjs/common';
import Database from 'better-sqlite3';

@Injectable()
export class AuditService {
  constructor(@Inject('DATABASE') private db: Database.Database) {}

  findAll(query: {
    invitationId?: string; operatorId?: string; action?: string;
    startDate?: string; endDate?: string; page?: string; pageSize?: string;
  }) {
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (query.invitationId) {
      where += ' AND invitation_id = ?';
      params.push(query.invitationId);
    }
    if (query.operatorId) {
      where += ' AND operator_id = ?';
      params.push(query.operatorId);
    }
    if (query.action) {
      where += ' AND action = ?';
      params.push(query.action);
    }
    if (query.startDate) {
      where += ' AND created_at >= ?';
      params.push(query.startDate);
    }
    if (query.endDate) {
      where += ' AND created_at <= ?';
      params.push(query.endDate);
    }

    const countRow = this.db.prepare(`SELECT COUNT(*) as total FROM audit_log ${where}`).get(...params) as { total: number };
    const rows = this.db.prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

    return {
      items: rows,
      total: countRow.total,
      page,
      pageSize,
      totalPages: Math.ceil(countRow.total / pageSize),
    };
  }
}
