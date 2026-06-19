import { db } from './db';
import type {
  SampleRecord,
  SampleStatus,
  UserRole,
  OperationLog,
  SampleAppeal,
  SampleEvidence,
  TemperatureRecord,
  SampleStatusKey,
} from './types';
import { STATUS_GROUPS } from './types';
import { v4 as uuid } from 'uuid';

const now = () => new Date().toISOString();

export interface ValidationError {
  field?: string;
  message: string;
}

const ALLOWED_SUBMIT_STATUSES: SampleStatus[] = ['draft', 'evidence_missing'];
const ALLOWED_APPEAL_STATUSES: SampleStatus[] = ['qc_rejected', 'manager_rejected', 'evidence_missing', 'appeal_rejected'];

function validateSubmission(
  sample: SampleRecord,
  handler: string,
  role: UserRole,
  existingEvidenceCount: number,
  newEvidences: Omit<SampleEvidence, 'id' | 'sample_id' | 'uploaded_at'>[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (sample.current_handler !== handler) {
    errors.push({ field: 'handler', message: `当前处理人应为 ${sample.current_handler}，但提交人为 ${handler}` });
  }

  if (sample.current_role !== role) {
    errors.push({ field: 'role', message: `当前处理角色应为 ${sample.current_role}，但提交人角色为 ${role}` });
  }

  if (!ALLOWED_SUBMIT_STATUSES.includes(sample.status)) {
    errors.push({ field: 'status', message: `当前状态「${sample.status}」不可提交审核，仅「草稿」或「待补正证据」状态可提交` });
  }

  const newValid = newEvidences.filter(e => e.name.trim().length > 0);
  const combinedTotal = existingEvidenceCount + newValid.length;

  if (sample.status === 'draft') {
    if (combinedTotal < 2) {
      errors.push({ field: 'evidences', message: `首次提交至少需要 2 项证据（当前已有 ${existingEvidenceCount} 项 + 新增 ${newValid.length} 项 = ${combinedTotal} 项）` });
    }
    const hasPhoto = newValid.some(e => e.type === 'photo') || existingEvidenceCount > 0;
    const hasTemp = newValid.some(e => e.type === 'temperature');
    if (!hasPhoto) {
      errors.push({ field: 'evidences', message: '首次提交必须包含留样照片' });
    }
    if (!hasTemp && existingEvidenceCount === 0) {
      errors.push({ field: 'evidences', message: '首次提交必须包含温度记录' });
    }
  }

  if (sample.status === 'evidence_missing') {
    if (newValid.length === 0) {
      errors.push({ field: 'evidences', message: '补正需补充至少 1 项新证据（文件名不能为空）' });
    }
    if (combinedTotal <= sample.evidence_count) {
      errors.push({ field: 'evidences', message: `补正后证据总数须大于原 ${sample.evidence_count} 项（当前已有 ${existingEvidenceCount} 项 + 新增 ${newValid.length} 项 = ${combinedTotal} 项）` });
    }
  }

  return errors;
}

export const sampleService = {
  listByStatusGroup(group: string, role?: UserRole): SampleRecord[] {
    const statuses = (STATUS_GROUPS as any)[group] || [];
    if (statuses.length === 0) return [];
    const placeholders = statuses.map(() => '?').join(',');
    const params: any[] = [...statuses];
    let sql = `SELECT * FROM sample_records WHERE status IN (${placeholders})`;
    if (role) {
      sql += ' AND current_role = ?';
      params.push(role);
    }
    sql += ' ORDER BY updated_at DESC';
    return db.prepare(sql).all(...params) as SampleRecord[];
  },

  getById(id: string): SampleRecord | undefined {
    return db.prepare('SELECT * FROM sample_records WHERE id = ?').get(id) as SampleRecord | undefined;
  },

  create(input: Partial<SampleRecord> & { operator: string }): SampleRecord {
    const id = uuid();
    const record_no = 'YL' + Date.now().toString().slice(-8);
    const ts = now();
    const record: SampleRecord = {
      id,
      record_no,
      batch_no: input.batch_no!,
      product_name: input.product_name!,
      production_line: input.production_line!,
      sample_time: input.sample_time!,
      sample_temperature: input.sample_temperature!,
      storage_location: input.storage_location!,
      operator: input.operator,
      evidence_count: 0,
      status: 'draft',
      current_handler: input.current_handler || input.operator,
      current_role: 'clerk',
      version: 1,
      deadline: input.deadline || null,
      created_at: ts,
      updated_at: ts,
    };
    db.prepare(
      `INSERT INTO sample_records (
        id, record_no, batch_no, product_name, production_line, sample_time,
        sample_temperature, storage_location, operator, evidence_count, status,
        current_handler, current_role, version, deadline, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id, record.record_no, record.batch_no, record.product_name, record.production_line,
      record.sample_time, record.sample_temperature, record.storage_location, record.operator,
      record.evidence_count, record.status, record.current_handler, record.current_role,
      record.version, record.deadline, record.created_at, record.updated_at
    );
    this.log(record.id, record.operator, 'clerk', '建单', null, 'draft', '排产文员创建留样记录');
    return record;
  },

  submitForReview(
    id: string,
    handler: string,
    role: UserRole,
    version: number,
    evidences: Omit<SampleEvidence, 'id' | 'sample_id' | 'uploaded_at'>[]
  ): { ok: boolean; errors?: ValidationError[]; record?: SampleRecord } {
    const sample = this.getById(id);
    if (!sample) return { ok: false, errors: [{ message: '记录不存在' }] };
    if (sample.version !== version) {
      this.log(id, handler, role, '提交失败', sample.status, sample.status,
        `版本冲突：当前版本 ${sample.version}，提交版本 ${version}`);
      return { ok: false, errors: [{ field: 'version', message: `版本冲突：当前版本 ${sample.version}，提交版本 ${version}` }] };
    }

    const existingEvidences = this.listEvidences(id);
    const errors = validateSubmission(sample, handler, role, existingEvidences.length, evidences);
    if (errors.length > 0) {
      this.log(id, handler, role, '提交失败', sample.status, sample.status, JSON.stringify(errors.map(e => e.message)));
      return { ok: false, errors };
    }

    const ts = now();
    for (const ev of evidences) {
      if (!ev.name.trim()) continue;
      db.prepare(
        'INSERT INTO sample_evidences (id, sample_id, type, name, url, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuid(), id, ev.type, ev.name, ev.url, ts);
    }
    const totalCount = existingEvidences.length + evidences.filter(e => e.name.trim()).length;
    const newStatus: SampleStatus = 'pending_review';
    db.prepare(
      `UPDATE sample_records SET status = ?, current_handler = ?, current_role = ?,
       evidence_count = ?, version = version + 1, updated_at = ? WHERE id = ?`
    ).run(newStatus, '李主管', 'qc_supervisor', totalCount, ts, id);

    this.log(id, handler, role, '提交审核', sample.status, newStatus, `证据共 ${totalCount} 项（原有 ${existingEvidences.length} + 新增 ${evidences.filter(e => e.name.trim()).length}）`);
    return { ok: true, record: this.getById(id) };
  },

  qcReview(
    id: string,
    handler: string,
    role: UserRole,
    version: number,
    decision: 'approve' | 'reject' | 'need_evidence',
    opinion?: string
  ): { ok: boolean; errors?: ValidationError[]; record?: SampleRecord } {
    const sample = this.getById(id);
    if (!sample) return { ok: false, errors: [{ message: '记录不存在' }] };
    if (sample.version !== version) {
      this.log(id, handler, role, '推进失败', sample.status, sample.status,
        `版本冲突：当前版本 ${sample.version}，提交版本 ${version}`);
      return { ok: false, errors: [{ field: 'version', message: `版本冲突：当前版本 ${sample.version}，提交版本 ${version}` }] };
    }
    if (sample.status !== 'pending_review') {
      this.log(id, handler, role, '推进失败', sample.status, sample.status,
        `状态不匹配：当前状态「${sample.status}」不可审核，仅「待品控审核」可审核`);
      return { ok: false, errors: [{ field: 'status', message: `当前状态「${sample.status}」不可审核` }] };
    }
    if (sample.current_role !== 'qc_supervisor') {
      this.log(id, handler, role, '推进失败', sample.status, sample.status, `角色不匹配：当前处理角色应为 ${sample.current_role}`);
      return { ok: false, errors: [{ field: 'role', message: `仅品控主管可审核，当前处理角色为 ${sample.current_role}` }] };
    }
    if (sample.current_handler !== handler) {
      this.log(id, handler, role, '推进失败', sample.status, sample.status, `处理人不匹配：当前处理人应为 ${sample.current_handler}`);
      return { ok: false, errors: [{ field: 'handler', message: `当前处理人应为 ${sample.current_handler}，但提交人为 ${handler}` }] };
    }

    const ts = now();
    let newStatus: SampleStatus = sample.status;
    let nextHandler = sample.current_handler;
    let nextRole: UserRole = sample.current_role;
    let action = '';

    if (decision === 'approve') {
      newStatus = 'qc_approved';
      nextHandler = '王经理';
      nextRole = 'production_manager';
      action = '品控审核通过';
    } else if (decision === 'reject') {
      newStatus = 'qc_rejected';
      nextHandler = sample.operator;
      nextRole = 'clerk';
      action = '品控驳回';
    } else if (decision === 'need_evidence') {
      newStatus = 'evidence_missing';
      nextHandler = sample.operator;
      nextRole = 'clerk';
      action = '要求补正证据';
    }

    db.prepare(
      `UPDATE sample_records SET status = ?, current_handler = ?, current_role = ?,
       version = version + 1, updated_at = ? WHERE id = ?`
    ).run(newStatus, nextHandler, nextRole, ts, id);

    this.log(id, handler, role, action, sample.status, newStatus, opinion || '');
    return { ok: true, record: this.getById(id) };
  },

  managerReview(
    id: string,
    handler: string,
    role: UserRole,
    version: number,
    decision: 'approve' | 'reject',
    opinion?: string
  ): { ok: boolean; errors?: ValidationError[]; record?: SampleRecord } {
    const sample = this.getById(id);
    if (!sample) return { ok: false, errors: [{ message: '记录不存在' }] };
    if (sample.version !== version) {
      this.log(id, handler, role, '复核失败', sample.status, sample.status,
        `版本冲突：当前版本 ${sample.version}，提交版本 ${version}`);
      return { ok: false, errors: [{ field: 'version', message: `版本冲突：当前版本 ${sample.version}，提交版本 ${version}` }] };
    }
    if (sample.status !== 'qc_approved') {
      this.log(id, handler, role, '复核失败', sample.status, sample.status,
        `状态不匹配：当前状态「${sample.status}」不可复核`);
      return { ok: false, errors: [{ field: 'status', message: `当前状态「${sample.status}」不可复核，仅「品控通过待复核」可复核` }] };
    }
    if (sample.current_role !== 'production_manager') {
      this.log(id, handler, role, '复核失败', sample.status, sample.status, `角色不匹配：当前处理角色应为 ${sample.current_role}`);
      return { ok: false, errors: [{ field: 'role', message: `仅生产经理可复核` }] };
    }
    if (sample.current_handler !== handler) {
      this.log(id, handler, role, '复核失败', sample.status, sample.status, `处理人不匹配：当前处理人应为 ${sample.current_handler}`);
      return { ok: false, errors: [{ field: 'handler', message: `当前处理人应为 ${sample.current_handler}，但提交人为 ${handler}` }] };
    }

    const ts = now();
    const newStatus: SampleStatus = decision === 'approve' ? 'manager_approved' : 'manager_rejected';
    const nextHandler = decision === 'reject' ? sample.operator : sample.current_handler;
    const nextRole: UserRole = decision === 'reject' ? 'clerk' : sample.current_role;
    db.prepare(
      `UPDATE sample_records SET status = ?, current_handler = ?, current_role = ?,
       version = version + 1, updated_at = ? WHERE id = ?`
    ).run(newStatus, nextHandler, nextRole, ts, id);

    this.log(id, handler, role, decision === 'approve' ? '生产经理复核通过' : '生产经理复核驳回',
      sample.status, newStatus, opinion || '');
    return { ok: true, record: this.getById(id) };
  },

  submitAppeal(
    id: string,
    submitter: string,
    role: UserRole,
    reason: string,
    version: number
  ): { ok: boolean; errors?: ValidationError[]; record?: SampleRecord } {
    const sample = this.getById(id);
    if (!sample) return { ok: false, errors: [{ message: '记录不存在' }] };
    if (sample.version !== version) {
      this.log(id, submitter, role, '申诉失败', sample.status, sample.status,
        `版本冲突：当前版本 ${sample.version}，提交版本 ${version}`);
      return { ok: false, errors: [{ field: 'version', message: `版本冲突：当前版本 ${sample.version}，提交版本 ${version}` }] };
    }
    if (!ALLOWED_APPEAL_STATUSES.includes(sample.status)) {
      this.log(id, submitter, role, '申诉失败', sample.status, sample.status,
        `状态不可申诉：当前状态「${sample.status}」`);
      return { ok: false, errors: [{ field: 'status', message: `当前状态「${sample.status}」不可申诉，仅 ${ALLOWED_APPEAL_STATUSES.join('、')} 可申诉` }] };
    }
    if (role !== 'clerk') {
      this.log(id, submitter, role, '申诉失败', sample.status, sample.status, '仅排产文员可提交申诉');
      return { ok: false, errors: [{ field: 'role', message: '仅排产文员可提交申诉' }] };
    }
    if (sample.operator !== submitter) {
      this.log(id, submitter, role, '申诉失败', sample.status, sample.status,
        `处理人不匹配：仅登记员 ${sample.operator} 可申诉`);
      return { ok: false, errors: [{ field: 'handler', message: `仅登记员 ${sample.operator} 可对此记录申诉` }] };
    }
    if (!reason.trim()) {
      return { ok: false, errors: [{ field: 'reason', message: '申诉理由不能为空' }] };
    }

    const ts = now();
    const previousStatus = sample.status;
    const newStatus: SampleStatus = 'appeal_submitted';
    db.prepare(
      `UPDATE sample_records SET status = ?, current_handler = ?, current_role = ?,
       version = version + 1, updated_at = ? WHERE id = ?`
    ).run(newStatus, '李主管', 'qc_supervisor', ts, id);

    db.prepare(
      `INSERT INTO sample_appeals (id, sample_id, version, submitter, submitter_role,
       reason, status, review_opinion, reject_reason, previous_status, submitted_at, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uuid(), id, sample.version, submitter, role, reason, 'submitted', null, null, previousStatus, ts, null);

    this.log(id, submitter, role, '提交异常申诉', previousStatus, newStatus, reason);
    return { ok: true, record: this.getById(id) };
  },

  reviewAppeal(
    id: string,
    handler: string,
    role: UserRole,
    version: number,
    decision: 'accept' | 'reject',
    opinion: string,
    rejectReason?: string
  ): { ok: boolean; errors?: ValidationError[]; record?: SampleRecord } {
    const sample = this.getById(id);
    if (!sample) return { ok: false, errors: [{ message: '记录不存在' }] };
    if (sample.version !== version) {
      this.log(id, handler, role, '申诉复核失败', sample.status, sample.status,
        `版本冲突：当前版本 ${sample.version}，提交版本 ${version}`);
      return { ok: false, errors: [{ field: 'version', message: `版本冲突：当前版本 ${sample.version}，提交版本 ${version}` }] };
    }
    if (sample.status !== 'appeal_submitted') {
      this.log(id, handler, role, '申诉复核失败', sample.status, sample.status,
        `状态不匹配：当前状态「${sample.status}」不可复核申诉`);
      return { ok: false, errors: [{ field: 'status', message: `当前状态「${sample.status}」不可复核申诉，仅「申诉待受理」可复核` }] };
    }
    if (sample.current_role !== 'qc_supervisor') {
      this.log(id, handler, role, '申诉复核失败', sample.status, sample.status, '角色不匹配：仅品控主管可复核申诉');
      return { ok: false, errors: [{ field: 'role', message: '仅品控主管可复核申诉' }] };
    }
    if (sample.current_handler !== handler) {
      this.log(id, handler, role, '申诉复核失败', sample.status, sample.status,
        `处理人不匹配：当前处理人应为 ${sample.current_handler}`);
      return { ok: false, errors: [{ field: 'handler', message: `当前处理人应为 ${sample.current_handler}，但提交人为 ${handler}` }] };
    }

    const ts = now();
    const appeal = db.prepare(
      'SELECT * FROM sample_appeals WHERE sample_id = ? ORDER BY submitted_at DESC LIMIT 1'
    ).get(id) as SampleAppeal;
    if (!appeal) return { ok: false, errors: [{ message: '申诉记录不存在' }] };

    let newStatus: SampleStatus;
    if (decision === 'accept') {
      newStatus = 'qc_approved';
      db.prepare(
        `UPDATE sample_records SET status = ?, current_handler = ?, current_role = ?,
         version = version + 1, updated_at = ? WHERE id = ?`
      ).run(newStatus, '王经理', 'production_manager', ts, id);
      db.prepare(
        'UPDATE sample_appeals SET status = ?, review_opinion = ?, reviewed_at = ? WHERE id = ?'
      ).run('accepted', opinion, ts, appeal.id);
      this.log(id, handler, role, '申诉受理通过', sample.status, newStatus, opinion);
    } else {
      newStatus = 'appeal_rejected';
      db.prepare(
        `UPDATE sample_records SET current_handler = ?, current_role = ?,
         status = ?, version = version + 1, updated_at = ? WHERE id = ?`
      ).run(sample.operator, 'clerk', newStatus, ts, id);
      db.prepare(
        'UPDATE sample_appeals SET status = ?, review_opinion = ?, reject_reason = ?, reviewed_at = ? WHERE id = ?'
      ).run('rejected', opinion, rejectReason || '', ts, appeal.id);
      this.log(id, handler, role, '申诉驳回', sample.status, newStatus,
        `驳回原因: ${rejectReason || ''}; 意见: ${opinion}`);
    }

    return { ok: true, record: this.getById(id) };
  },

  resubmitAppeal(
    id: string,
    submitter: string,
    role: UserRole,
    reason: string,
    version: number
  ): { ok: boolean; errors?: ValidationError[]; record?: SampleRecord } {
    const sample = this.getById(id);
    if (!sample) return { ok: false, errors: [{ message: '记录不存在' }] };
    if (sample.version !== version) {
      this.log(id, submitter, role, '再次申诉失败', sample.status, sample.status,
        `版本冲突：当前版本 ${sample.version}，提交版本 ${version}`);
      return { ok: false, errors: [{ field: 'version', message: `版本冲突：当前版本 ${sample.version}，提交版本 ${version}` }] };
    }
    if (sample.status !== 'appeal_rejected') {
      this.log(id, submitter, role, '再次申诉失败', sample.status, sample.status,
        `状态不匹配：当前状态「${sample.status}」不可再次提交申诉`);
      return { ok: false, errors: [{ field: 'status', message: `仅申诉被驳回可再次提交，当前状态「${sample.status}」` }] };
    }
    if (role !== 'clerk') {
      this.log(id, submitter, role, '再次申诉失败', sample.status, sample.status, '仅排产文员可再次提交申诉');
      return { ok: false, errors: [{ field: 'role', message: '仅排产文员可再次提交申诉' }] };
    }
    if (sample.operator !== submitter) {
      this.log(id, submitter, role, '再次申诉失败', sample.status, sample.status,
        `处理人不匹配：仅登记员 ${sample.operator} 可申诉`);
      return { ok: false, errors: [{ field: 'handler', message: `仅登记员 ${sample.operator} 可对此记录申诉` }] };
    }
    if (!reason.trim()) {
      return { ok: false, errors: [{ field: 'reason', message: '申诉理由不能为空' }] };
    }

    const ts = now();
    const previousStatus = sample.status;
    const newStatus: SampleStatus = 'appeal_submitted';
    db.prepare(
      `UPDATE sample_records SET status = ?, current_handler = ?, current_role = ?,
       version = version + 1, updated_at = ? WHERE id = ?`
    ).run(newStatus, '李主管', 'qc_supervisor', ts, id);

    db.prepare(
      `INSERT INTO sample_appeals (id, sample_id, version, submitter, submitter_role,
       reason, status, review_opinion, reject_reason, previous_status, submitted_at, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uuid(), id, sample.version, submitter, role, reason, 'resubmitted', null, null, previousStatus, ts, null);

    this.log(id, submitter, role, '再次提交申诉', previousStatus, newStatus, reason);
    return { ok: true, record: this.getById(id) };
  },

  listEvidences(sampleId: string): SampleEvidence[] {
    return db.prepare('SELECT * FROM sample_evidences WHERE sample_id = ? ORDER BY uploaded_at')
      .all(sampleId) as SampleEvidence[];
  },

  listAppeals(sampleId: string): SampleAppeal[] {
    return db.prepare('SELECT * FROM sample_appeals WHERE sample_id = ? ORDER BY submitted_at DESC')
      .all(sampleId) as SampleAppeal[];
  },

  listLogs(sampleId: string): OperationLog[] {
    return db.prepare('SELECT * FROM sample_operation_logs WHERE sample_id = ? ORDER BY created_at DESC')
      .all(sampleId) as OperationLog[];
  },

  listTemperatures(sampleId: string): TemperatureRecord[] {
    return db.prepare('SELECT * FROM temperature_records WHERE sample_id = ? ORDER BY measure_time')
      .all(sampleId) as TemperatureRecord[];
  },

  addTemperature(sampleId: string, record: Omit<TemperatureRecord, 'id' | 'sample_id'>): TemperatureRecord {
    const id = uuid();
    db.prepare(
      `INSERT INTO temperature_records (id, sample_id, measure_time, temperature, location, recorder, is_abnormal, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, sampleId, record.measure_time, record.temperature, record.location, record.recorder,
      record.is_abnormal, record.remark || null);
    return { ...record, id, sample_id: sampleId };
  },

  log(
    sampleId: string,
    operator: string,
    operatorRole: UserRole,
    action: string,
    fromStatus: string | null,
    toStatus: string,
    remark?: string
  ) {
    db.prepare(
      `INSERT INTO sample_operation_logs (id, sample_id, operator, operator_role, action,
       from_status, to_status, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uuid(), sampleId, operator, operatorRole, action, fromStatus, toStatus, remark || null, now());
  },

  stats(): Record<string, number> {
    const rows = db.prepare('SELECT status, COUNT(*) as c FROM sample_records GROUP BY status').all() as { status: string; c: number }[];
    const result: Record<string, number> = {
      pending: 0, processing: 0, appeal: 0, completed: 0, rejected: 0, total: 0,
    };
    for (const row of rows) {
      result.total += row.c;
      for (const key of Object.keys(STATUS_GROUPS) as (keyof typeof STATUS_GROUPS)[]) {
        if (STATUS_GROUPS[key].includes(row.status as any)) {
          result[key] = (result[key] || 0) + row.c;
        }
      }
    }
    return result;
  },
};
