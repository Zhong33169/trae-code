import { Injectable, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { getDb } from './database';
import {
  HarvestRecord,
  HarvestStatus,
  Role,
  StatusQueueMap,
  ScanResult,
  ScanRecord,
  AuditLog,
  ProcessComment,
} from './types';
import { v4 as uuidv4 } from 'uuid';

export interface CreateHarvestDto {
  batch_no: string;
  crop_type: string;
  crop_name: string;
  harvest_date: string;
  harvest_area: number;
  estimated_weight: number;
  field_location: string;
  planter: string;
  materials?: string;
}

export interface SubmitVerifyDto {
  comment?: string;
  deadline?: string;
  version?: number;
}

export interface ProcessDto {
  action: 'PASS' | 'REJECT' | 'CORRECT' | 'REVIEW_PASS' | 'REVIEW_REJECT';
  comment: string;
  actual_weight?: number;
  deadline?: string;
  version?: number;
}

export interface ScanVerifyDto {
  scan_code: string;
  credential: string;
  remark?: string;
  version?: number;
}

export interface BatchProcessDto {
  ids: string[];
  action: 'SUBMIT' | 'VERIFY_PASS' | 'REVIEW_PASS';
  comment: string;
}

@Injectable()
export class HarvestService {
  private db = getDb();

  generateRecordNo(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `HS${date}`;
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM harvest_records WHERE record_no LIKE ? || '%'")
      .get(prefix) as { cnt: number };
    const seq = String(row.cnt + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }

  findAll(userId: string, userRole: Role, filters?: { status?: string; keyword?: string }): HarvestRecord[] {
    let sql = 'SELECT * FROM harvest_records WHERE 1=1';
    const params: any[] = [];

    if (userRole === Role.FIELD_ADMIN) {
      sql += ' AND created_by = ?';
      params.push(userId);
    } else if (userRole === Role.TECHNICIAN) {
      sql += ' AND current_queue IN (?, ?)';
      params.push(Role.TECHNICIAN, Role.FIELD_ADMIN);
    }

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.keyword) {
      sql += ' AND (record_no LIKE ? OR crop_name LIKE ? OR batch_no LIKE ?)';
      const kw = `%${filters.keyword}%`;
      params.push(kw, kw, kw);
    }

    sql += ' ORDER BY created_at DESC';
    return this.db.prepare(sql).all(...params) as HarvestRecord[];
  }

  findById(id: string): HarvestRecord | undefined {
    return this.db.prepare('SELECT * FROM harvest_records WHERE id = ?').get(id) as HarvestRecord | undefined;
  }

  getScanRecords(harvestId: string): ScanRecord[] {
    return this.db
      .prepare('SELECT * FROM scan_records WHERE harvest_record_id = ? ORDER BY scanned_at DESC')
      .all(harvestId) as ScanRecord[];
  }

  getAuditLogs(harvestId: string): AuditLog[] {
    return this.db
      .prepare('SELECT * FROM audit_logs WHERE harvest_record_id = ? ORDER BY created_at DESC')
      .all(harvestId) as AuditLog[];
  }

  getComments(harvestId: string): ProcessComment[] {
    return this.db
      .prepare('SELECT * FROM process_comments WHERE harvest_record_id = ? ORDER BY created_at DESC')
      .all(harvestId) as ProcessComment[];
  }

  getStatistics(userId: string, userRole: Role) {
    let baseSql = 'SELECT status, COUNT(*) as cnt FROM harvest_records WHERE 1=1';
    const params: any[] = [];

    if (userRole === Role.FIELD_ADMIN) {
      baseSql += ' AND created_by = ?';
      params.push(userId);
    }

    const sql = `${baseSql} GROUP BY status`;
    const rows = this.db.prepare(sql).all(...params) as { status: string; cnt: number }[];

    const result = {
      total: 0,
      pending_correction: 0,
      pending_verification: 0,
      pending_review: 0,
      archived: 0,
      draft: 0,
    };

    for (const row of rows) {
      result.total += row.cnt;
      if (row.status === HarvestStatus.PENDING_CORRECTION) result.pending_correction = row.cnt;
      if (row.status === HarvestStatus.SUBMITTED) result.pending_verification = row.cnt;
      if (row.status === HarvestStatus.PENDING_REVIEW) result.pending_review = row.cnt;
      if (row.status === HarvestStatus.VERIFIED) result.pending_review += row.cnt;
      if (row.status === HarvestStatus.ARCHIVED) result.archived = row.cnt;
      if (row.status === HarvestStatus.DRAFT) result.draft = row.cnt;
    }

    return result;
  }

  create(userId: string, dto: CreateHarvestDto): HarvestRecord {
    const id = uuidv4();
    const recordNo = this.generateRecordNo();

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO harvest_records (
            id, record_no, batch_no, crop_type, crop_name, harvest_date,
            harvest_area, estimated_weight, field_location, planter,
            status, current_queue, materials, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          recordNo,
          dto.batch_no,
          dto.crop_type,
          dto.crop_name,
          dto.harvest_date,
          dto.harvest_area,
          dto.estimated_weight,
          dto.field_location,
          dto.planter,
          HarvestStatus.DRAFT,
          StatusQueueMap[HarvestStatus.DRAFT],
          dto.materials || '',
          userId
        );

      this.logAudit(id, userId, this.getUserName(userId), '创建采收记录', null, HarvestStatus.DRAFT, '创建草稿');
    });

    tx();
    return this.findById(id)!;
  }

  update(id: string, userId: string, dto: Partial<CreateHarvestDto> & { version?: number }): HarvestRecord {
    const record = this.findById(id);
    if (!record) throw new BadRequestException('记录不存在');
    if (record.created_by !== userId) throw new ForbiddenException('无权限修改');
    if (record.status !== HarvestStatus.DRAFT && record.status !== HarvestStatus.PENDING_CORRECTION) {
      throw new BadRequestException('当前状态不可修改');
    }
    if (dto.version !== undefined && dto.version !== record.version) {
      throw new ConflictException('记录已被修改，请刷新后重试');
    }

    this.db
      .prepare(
        `UPDATE harvest_records SET
          batch_no = COALESCE(?, batch_no),
          crop_type = COALESCE(?, crop_type),
          crop_name = COALESCE(?, crop_name),
          harvest_date = COALESCE(?, harvest_date),
          harvest_area = COALESCE(?, harvest_area),
          estimated_weight = COALESCE(?, estimated_weight),
          field_location = COALESCE(?, field_location),
          planter = COALESCE(?, planter),
          materials = COALESCE(?, materials),
          updated_at = CURRENT_TIMESTAMP,
          version = version + 1
        WHERE id = ? AND version = ?`
      )
      .run(
        dto.batch_no ?? null,
        dto.crop_type ?? null,
        dto.crop_name ?? null,
        dto.harvest_date ?? null,
        dto.harvest_area ?? null,
        dto.estimated_weight ?? null,
        dto.field_location ?? null,
        dto.planter ?? null,
        dto.materials ?? null,
        id,
        record.version
      );

    const updated = this.findById(id);
    if (!updated || updated.version === record.version) {
      throw new ConflictException('记录已被修改，请刷新后重试');
    }

    return updated;
  }

  submitForVerification(id: string, userId: string, dto: SubmitVerifyDto): HarvestRecord {
    const record = this.findById(id);
    if (!record) throw new BadRequestException('记录不存在');
    if (record.created_by !== userId) throw new ForbiddenException('无权限提交');
    if (record.status !== HarvestStatus.DRAFT && record.status !== HarvestStatus.PENDING_CORRECTION) {
      throw new BadRequestException('当前状态不可提交');
    }
    if (dto.version !== undefined && dto.version !== record.version) {
      throw new ConflictException('记录已被修改，请刷新后重试');
    }

    if (!record.materials || record.materials.trim().length === 0) {
      throw new BadRequestException('请上传采收凭证材料');
    }

    const tx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `UPDATE harvest_records SET
            status = ?,
            current_queue = ?,
            deadline = ?,
            updated_at = CURRENT_TIMESTAMP,
            version = version + 1
          WHERE id = ? AND version = ?`
        )
        .run(
          HarvestStatus.SUBMITTED,
          StatusQueueMap[HarvestStatus.SUBMITTED],
          dto.deadline || null,
          id,
          record.version
        );

      if (result.changes === 0) {
        throw new ConflictException('记录已被修改，请刷新后重试');
      }

      this.addComment(id, userId, this.getUserName(userId), dto.comment || '提交核验', 'SUBMIT');
      this.logAudit(
        id,
        userId,
        this.getUserName(userId),
        '提交核验',
        record.status,
        HarvestStatus.SUBMITTED,
        dto.comment
      );
    });

    tx();
    return this.findById(id)!;
  }

  scanVerify(id: string, userId: string, userRole: Role, dto: ScanVerifyDto): { result: ScanResult; message: string } {
    const record = this.findById(id);
    if (!record) {
      this.saveScanRecord(id, dto.scan_code, userId, ScanResult.INVALID_CODE, dto.credential, dto.remark);
      return { result: ScanResult.INVALID_CODE, message: '无效的采收记录编号' };
    }
    if (dto.version !== undefined && dto.version !== record.version) {
      return { result: ScanResult.STATUS_ERROR, message: '记录已被修改，请刷新后重试' };
    }

    if (userRole !== Role.TECHNICIAN) {
      this.saveScanRecord(id, dto.scan_code, userId, ScanResult.OPERATOR_MISMATCH, dto.credential, dto.remark);
      return { result: ScanResult.OPERATOR_MISMATCH, message: '仅农技员可执行扫码核验' };
    }

    if (record.status !== HarvestStatus.SUBMITTED) {
      this.saveScanRecord(id, dto.scan_code, userId, ScanResult.STATUS_ERROR, dto.credential, dto.remark);
      return { result: ScanResult.STATUS_ERROR, message: `当前状态[${record.status}]不可扫码核验` };
    }

    if (dto.scan_code !== record.record_no) {
      this.saveScanRecord(id, dto.scan_code, userId, ScanResult.INVALID_CODE, dto.credential, dto.remark);
      return { result: ScanResult.INVALID_CODE, message: '二维码与记录编号不匹配' };
    }

    const existingScan = this.db
      .prepare(
        `SELECT * FROM scan_records 
         WHERE harvest_record_id = ? AND result = 'SUCCESS' AND scanned_at > ?
         ORDER BY scanned_at DESC LIMIT 1`
      )
      .get(id, record.updated_at);
    if (existingScan) {
      this.saveScanRecord(id, dto.scan_code, userId, ScanResult.DUPLICATE_SCAN, dto.credential, dto.remark);
      return { result: ScanResult.DUPLICATE_SCAN, message: '该记录已完成扫码核验，请勿重复操作' };
    }

    if (!dto.credential || dto.credential.trim().length === 0) {
      return { result: ScanResult.STATUS_ERROR, message: '请上传现场核验凭证' };
    }

    const tx = this.db.transaction(() => {
      this.saveScanRecord(id, dto.scan_code, userId, ScanResult.SUCCESS, dto.credential, dto.remark);

      const updateResult = this.db
        .prepare(
          `UPDATE harvest_records SET
            status = ?,
            current_queue = ?,
            updated_at = CURRENT_TIMESTAMP,
            version = version + 1
          WHERE id = ? AND version = ?`
        )
        .run(
          HarvestStatus.VERIFIED,
          StatusQueueMap[HarvestStatus.VERIFIED],
          id,
          record.version
        );

      if (updateResult.changes === 0) {
        throw new ConflictException('记录已被修改，请刷新后重试');
      }

      this.logAudit(
        id,
        userId,
        this.getUserName(userId),
        '扫码核验通过',
        record.status,
        HarvestStatus.VERIFIED,
        `扫码时间: ${new Date().toLocaleString()}, 凭证: ${dto.credential}`
      );
    });

    tx();
    return { result: ScanResult.SUCCESS, message: '扫码核验通过' };
  }

  processRecord(id: string, userId: string, userRole: Role, dto: ProcessDto): HarvestRecord {
    const record = this.findById(id);
    if (!record) throw new BadRequestException('记录不存在');
    if (dto.version !== undefined && dto.version !== record.version) {
      throw new ConflictException('记录已被修改，请刷新后重试');
    }

    const validTransitions: Record<string, { roles: Role[]; actions: string[] }> = {
      [HarvestStatus.SUBMITTED]: {
        roles: [Role.TECHNICIAN],
        actions: ['PASS', 'REJECT'],
      },
      [HarvestStatus.PENDING_CORRECTION]: {
        roles: [Role.TECHNICIAN],
        actions: ['PASS', 'REJECT'],
      },
      [HarvestStatus.VERIFIED]: {
        roles: [Role.COOP_DIRECTOR],
        actions: ['REVIEW_PASS', 'REVIEW_REJECT'],
      },
      [HarvestStatus.PENDING_REVIEW]: {
        roles: [Role.COOP_DIRECTOR],
        actions: ['REVIEW_PASS', 'REVIEW_REJECT'],
      },
    };

    const transition = validTransitions[record.status];
    if (!transition) {
      throw new BadRequestException('当前状态不可处理');
    }
    if (!transition.roles.includes(userRole)) {
      throw new ForbiddenException('当前角色无权限处理此记录');
    }
    if (!transition.actions.includes(dto.action)) {
      throw new BadRequestException(`当前状态不支持操作: ${dto.action}`);
    }

    if (!dto.comment || dto.comment.trim().length === 0) {
      throw new BadRequestException('请填写处理意见');
    }

    let newStatus: HarvestStatus;
    let actionName: string;

    switch (dto.action) {
      case 'PASS':
        newStatus = HarvestStatus.PENDING_REVIEW;
        actionName = '核验通过';
        break;
      case 'REJECT':
        newStatus = HarvestStatus.PENDING_CORRECTION;
        actionName = '驳回补正';
        if (!dto.deadline) {
          throw new BadRequestException('驳回时请设置补正时限');
        }
        break;
      case 'REVIEW_PASS':
        newStatus = HarvestStatus.ARCHIVED;
        actionName = '复核通过归档';
        if (dto.actual_weight === undefined) {
          throw new BadRequestException('请填写实际过磅重量');
        }
        break;
      case 'REVIEW_REJECT':
        newStatus = HarvestStatus.PENDING_CORRECTION;
        actionName = '复核驳回';
        break;
      default:
        throw new BadRequestException('未知操作');
    }

    const tx = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `UPDATE harvest_records SET
            status = ?,
            current_queue = ?,
            actual_weight = COALESCE(?, actual_weight),
            deadline = COALESCE(?, deadline),
            updated_at = CURRENT_TIMESTAMP,
            version = version + 1
          WHERE id = ? AND version = ?`
        )
        .run(
          newStatus,
          StatusQueueMap[newStatus],
          dto.actual_weight ?? null,
          dto.deadline ?? null,
          id,
          record.version
        );

      if (result.changes === 0) {
        throw new ConflictException('记录已被修改，请刷新后重试');
      }

      this.addComment(id, userId, this.getUserName(userId), dto.comment, dto.action);
      this.logAudit(id, userId, this.getUserName(userId), actionName, record.status, newStatus, dto.comment);
    });

    tx();
    return this.findById(id)!;
  }

  batchProcess(userId: string, userRole: Role, dto: BatchProcessDto) {
    if (dto.ids.length === 0) {
      throw new BadRequestException('请选择要处理的记录');
    }

    const results: { id: string; success: boolean; message: string }[] = [];

    for (const id of dto.ids) {
      try {
        const record = this.findById(id);
        if (!record) {
          results.push({ id, success: false, message: '记录不存在' });
          continue;
        }

        if (dto.action === 'SUBMIT') {
          if (userRole !== Role.FIELD_ADMIN || record.created_by !== userId) {
            results.push({ id, success: false, message: '无权限提交' });
            continue;
          }
          if (record.status !== HarvestStatus.DRAFT && record.status !== HarvestStatus.PENDING_CORRECTION) {
            results.push({ id, success: false, message: '状态不支持提交' });
            continue;
          }
          this.submitForVerification(id, userId, { comment: dto.comment });
          results.push({ id, success: true, message: '提交成功' });
        } else if (dto.action === 'VERIFY_PASS') {
          if (userRole !== Role.TECHNICIAN) {
            results.push({ id, success: false, message: '无权限核验' });
            continue;
          }
          if (record.status !== HarvestStatus.SUBMITTED && record.status !== HarvestStatus.PENDING_CORRECTION) {
            results.push({ id, success: false, message: '状态不支持核验' });
            continue;
          }
          this.processRecord(id, userId, userRole, { action: 'PASS', comment: dto.comment });
          results.push({ id, success: true, message: '核验通过' });
        } else if (dto.action === 'REVIEW_PASS') {
          if (userRole !== Role.COOP_DIRECTOR) {
            results.push({ id, success: false, message: '无权限复核' });
            continue;
          }
          if (record.status !== HarvestStatus.VERIFIED && record.status !== HarvestStatus.PENDING_REVIEW) {
            results.push({ id, success: false, message: '状态不支持复核' });
            continue;
          }
          this.processRecord(id, userId, userRole, {
            action: 'REVIEW_PASS',
            comment: dto.comment,
            actual_weight: record.estimated_weight,
          });
          results.push({ id, success: true, message: '复核通过' });
        }
      } catch (e: any) {
        results.push({ id, success: false, message: e.message });
      }
    }

    return {
      total: dto.ids.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      details: results,
    };
  }

  private saveScanRecord(
    harvestId: string,
    scanCode: string,
    userId: string,
    result: ScanResult,
    credential?: string,
    remark?: string
  ) {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO scan_records (id, harvest_record_id, scan_code, scanned_by, result, credential, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, harvestId, scanCode, userId, result, credential || '', remark || '');
  }

  private addComment(
    harvestId: string,
    userId: string,
    userName: string,
    comment: string,
    actionType: string
  ) {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO process_comments (id, harvest_record_id, operator_id, operator_name, comment, action_type)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, harvestId, userId, userName, comment, actionType);
  }

  private logAudit(
    harvestId: string,
    operatorId: string,
    operatorName: string,
    action: string,
    oldStatus: string | null,
    newStatus: string | null,
    remark?: string
  ) {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO audit_logs (id, harvest_record_id, operator_id, operator_name, action, old_status, new_status, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, harvestId, operatorId, operatorName, action, oldStatus, newStatus, remark || '');
  }

  private getUserName(userId: string): string {
    const row = this.db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined;
    return row?.name || '未知用户';
  }

  initDemoData(adminId: string) {
    const count = this.db.prepare('SELECT COUNT(*) as cnt FROM harvest_records').get() as { cnt: number };
    if (count.cnt > 0) return;

    const techRow = this.db.prepare("SELECT id FROM users WHERE role = 'TECHNICIAN' LIMIT 1").get() as { id: string } | undefined;
    const directorRow = this.db.prepare("SELECT id FROM users WHERE role = 'COOP_DIRECTOR' LIMIT 1").get() as { id: string } | undefined;
    const techId = techRow?.id || adminId;
    const directorId = directorRow?.id || adminId;

    const adminName = this.getUserName(adminId);
    const techName = this.getUserName(techId);
    const directorName = this.getUserName(directorId);

    const scenarios: Array<{
      dto: CreateHarvestDto;
      finalStatus: HarvestStatus;
      version: number;
    }> = [
      {
        dto: {
          batch_no: 'B202501001',
          crop_type: '蔬菜',
          crop_name: '西红柿',
          harvest_date: '2025-06-15',
          harvest_area: 5.5,
          estimated_weight: 2500,
          field_location: 'A区3号棚',
          planter: '李种植户',
          materials: '[{"type":"photo","name":"采收现场照片1","url":"demo/tomato_1.jpg"},{"type":"photo","name":"过磅单","url":"demo/tomato_weight.pdf"}]',
        },
        finalStatus: HarvestStatus.DRAFT,
        version: 1,
      },
      {
        dto: {
          batch_no: 'B202501002',
          crop_type: '蔬菜',
          crop_name: '黄瓜',
          harvest_date: '2025-06-16',
          harvest_area: 3.2,
          estimated_weight: 1800,
          field_location: 'B区1号棚',
          planter: '王种植户',
          materials: '[{"type":"photo","name":"采收现场照片","url":"demo/cucumber_1.jpg"}]',
        },
        finalStatus: HarvestStatus.SUBMITTED,
        version: 2,
      },
      {
        dto: {
          batch_no: 'B202501003',
          crop_type: '水果',
          crop_name: '草莓',
          harvest_date: '2025-06-17',
          harvest_area: 2.0,
          estimated_weight: 500,
          field_location: 'C区2号棚',
          planter: '张种植户',
          materials: '',
        },
        finalStatus: HarvestStatus.DRAFT,
        version: 1,
      },
      {
        dto: {
          batch_no: 'B202501004',
          crop_type: '蔬菜',
          crop_name: '生菜',
          harvest_date: '2025-06-14',
          harvest_area: 4.0,
          estimated_weight: 1200,
          field_location: 'A区1号棚',
          planter: '赵种植户',
          materials: '[{"type":"photo","name":"不合格现场照片","url":"demo/lettuce_bad.jpg"}]',
        },
        finalStatus: HarvestStatus.PENDING_CORRECTION,
        version: 3,
      },
      {
        dto: {
          batch_no: 'B202501005',
          crop_type: '粮食',
          crop_name: '小麦',
          harvest_date: '2025-06-12',
          harvest_area: 12.0,
          estimated_weight: 6000,
          field_location: 'D区大田',
          planter: '孙种植户',
          materials: '[{"type":"photo","name":"采收照片","url":"demo/wheat_1.jpg"},{"type":"photo","name":"扫码凭证","url":"demo/wheat_scan.jpg"}]',
        },
        finalStatus: HarvestStatus.VERIFIED,
        version: 3,
      },
      {
        dto: {
          batch_no: 'B202501006',
          crop_type: '蔬菜',
          crop_name: '茄子',
          harvest_date: '2025-06-10',
          harvest_area: 2.8,
          estimated_weight: 900,
          field_location: 'B区3号棚',
          planter: '周种植户',
          materials: '[{"type":"photo","name":"采收照片","url":"demo/eggplant_1.jpg"}]',
        },
        finalStatus: HarvestStatus.PENDING_REVIEW,
        version: 4,
      },
      {
        dto: {
          batch_no: 'B202501007',
          crop_type: '水果',
          crop_name: '西瓜',
          harvest_date: '2025-06-08',
          harvest_area: 8.0,
          estimated_weight: 4500,
          field_location: 'E区5号棚',
          planter: '吴种植户',
          materials: '[{"type":"photo","name":"采收照片","url":"demo/watermelon_1.jpg"},{"type":"photo","name":"过磅单","url":"demo/watermelon_weight.pdf"}]',
        },
        finalStatus: HarvestStatus.ARCHIVED,
        version: 5,
      },
    ];

    for (let i = 0; i < scenarios.length; i++) {
      const s = scenarios[i];
      const record = this.create(adminId, s.dto);

      if (s.finalStatus === HarvestStatus.DRAFT) continue;

      this.submitForVerification(record.id, adminId, {
        comment: s.finalStatus === HarvestStatus.PENDING_CORRECTION ? '提交核验（后续会被驳回）' : '申请核验',
        deadline: '2025-06-25',
      });

      if (s.finalStatus === HarvestStatus.SUBMITTED) continue;

      if (s.finalStatus === HarvestStatus.PENDING_CORRECTION) {
        this.processRecord(record.id, techId, Role.TECHNICIAN, {
          action: 'REJECT',
          comment: '生菜叶片有虫眼，不符合采收标准，请补正后重新提交',
          deadline: '2025-06-22',
        });
        continue;
      }

      if (s.finalStatus === HarvestStatus.PENDING_REVIEW) {
        this.processRecord(record.id, techId, Role.TECHNICIAN, {
          action: 'PASS',
          comment: '现场核验合格，材料齐全，提交复核',
        });
        continue;
      }

      if (s.finalStatus === HarvestStatus.VERIFIED || s.finalStatus === HarvestStatus.ARCHIVED) {
        const scanId = uuidv4();
        this.db
          .prepare(
            `INSERT INTO scan_records (id, harvest_record_id, scan_code, scanned_by, result, credential, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            scanId,
            record.id,
            record.record_no,
            techId,
            'SUCCESS',
            `现场核验凭证_${s.dto.crop_name}.jpg`,
            '现场检查合格'
          );

        const verifiedRecord = this.findById(record.id)!;
        this.db
          .prepare(
            `UPDATE harvest_records SET status = ?, current_queue = ?, updated_at = CURRENT_TIMESTAMP, version = ? WHERE id = ?`
          )
          .run(HarvestStatus.VERIFIED, StatusQueueMap[HarvestStatus.VERIFIED], verifiedRecord.version + 1, record.id);

        this.logAudit(
          record.id,
          techId,
          techName,
          '扫码核验通过',
          HarvestStatus.SUBMITTED,
          HarvestStatus.VERIFIED,
          `扫码时间: 2025-06-${12 + i} 09:3${i}:00, 凭证: 现场核验凭证_${s.dto.crop_name}.jpg`
        );

        if (s.finalStatus === HarvestStatus.VERIFIED) continue;
      }

      if (s.finalStatus === HarvestStatus.ARCHIVED) {
        this.processRecord(record.id, directorId, Role.COOP_DIRECTOR, {
          action: 'REVIEW_PASS',
          comment: '复核通过，重量相符，准予归档',
          actual_weight: s.dto.estimated_weight * 0.98,
        });
      }
    }
  }
}
