import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import {
  TradeReview, ReviewRecord, User, ReviewStatus, UserRole, ReviewAction,
  RISK_PRIORITY, RISK_REQUIRED_EVIDENCE,
} from './review.types';
import { RegisterReviewDto, ProcessReviewDto, QueryReviewsDto } from './review.dto';

@Injectable()
export class ReviewService {
  constructor(private readonly db: DatabaseService) {}

  private get database() {
    return this.db.getDb();
  }

  generateCode(): string {
    const now = new Date();
    const ymd = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TR-${ymd}-${random}`;
  }

  private checkEvidence(riskLevel: string, evidence: string[]): { ok: boolean; missing: string[] } {
    const required = RISK_REQUIRED_EVIDENCE[riskLevel] || [];
    const missing = required.filter(r => !evidence.some(e => e && e.includes(r)));
    return { ok: missing.length === 0, missing };
  }

  private updateOverdueFlag(reviewId: string) {
    this.database.exec(
      `UPDATE trade_reviews SET is_overdue = CASE
        WHEN deadline IS NOT NULL AND deadline < datetime('now') AND status != 'COMPLETED' THEN 1
        ELSE 0
      END WHERE id = ?`,
    );
    const stmt = this.database.prepare(
      `UPDATE trade_reviews SET is_overdue = CASE
        WHEN deadline IS NOT NULL AND deadline < datetime('now') AND status != 'COMPLETED' THEN 1
        ELSE 0
      END WHERE id = ?`,
    );
    stmt.run(reviewId);
  }

  getUsers(): User[] {
    return this.database.prepare('SELECT * FROM users ORDER BY role, name').all() as User[];
  }

  getUserById(id: string): User {
    const user = this.database.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async register(dto: RegisterReviewDto): Promise<TradeReview> {
    const creator = this.getUserById(dto.created_by);
    if (creator.role !== UserRole.FINANCIAL_ADVISOR) {
      throw new ForbiddenException('仅理财顾问可以登记交易核查单');
    }

    const evidence = dto.evidence || [];
    const evidenceCheck = this.checkEvidence(dto.risk_level, evidence);
    if (!evidenceCheck.ok) {
      throw new BadRequestException(`缺少必填证据: ${evidenceCheck.missing.join('、')}`);
    }

    const code = this.generateCode();
    const id = uuidv4();
    const priority = RISK_PRIORITY[dto.risk_level];

    const stmt = this.database.prepare(`
      INSERT INTO trade_reviews (
        id, code, customer_name, trade_type, trade_amount, trade_date, account_no,
        risk_level, status, priority, current_handler_id, current_role, version,
        evidence_json, deadline, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultHandler = this.database
      .prepare("SELECT id FROM users WHERE role = 'COMPLIANCE_OFFICER' LIMIT 1")
      .get() as { id: string } | undefined;

    stmt.run(
      id, code, dto.customer_name, dto.trade_type, dto.trade_amount,
      dto.trade_date, dto.account_no, dto.risk_level, ReviewStatus.REGISTERED,
      priority, defaultHandler?.id || null, UserRole.COMPLIANCE_OFFICER,
      1, JSON.stringify(evidence), dto.deadline || null, dto.created_by,
    );

    this.insertRecord({
      review_id: id,
      operator_id: creator.id,
      operator_name: creator.name,
      operator_role: creator.role,
      action: ReviewAction.REGISTER,
      from_status: null,
      to_status: ReviewStatus.REGISTERED,
      opinion: `交易核查单已登记，风险等级: ${dto.risk_level}`,
      result: '登记成功',
      evidence_json: JSON.stringify(evidence),
      version: 1,
    });

    return this.findById(id);
  }

  private insertRecord(record: Omit<ReviewRecord, 'id' | 'created_at'>) {
    const stmt = this.database.prepare(`
      INSERT INTO review_records (
        id, review_id, operator_id, operator_name, operator_role, action,
        from_status, to_status, opinion, result, evidence_json, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      uuidv4(), record.review_id, record.operator_id, record.operator_name,
      record.operator_role, record.action, record.from_status, record.to_status,
      record.opinion, record.result, record.evidence_json, record.version,
    );
  }

  findById(id: string): TradeReview {
    this.updateOverdueFlag(id);
    const review = this.database.prepare('SELECT * FROM trade_reviews WHERE id = ?').get(id) as TradeReview;
    if (!review) throw new NotFoundException('交易核查单不存在');
    return review;
  }

  getRecords(reviewId: string): ReviewRecord[] {
    return this.database.prepare(
      'SELECT * FROM review_records WHERE review_id = ? ORDER BY created_at DESC, version DESC',
    ).all(reviewId) as ReviewRecord[];
  }

  findAll(query: QueryReviewsDto): TradeReview[] {
    let sql = 'SELECT * FROM trade_reviews WHERE 1=1';
    const params: any[] = [];

    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }
    if (query.risk_level) {
      sql += ' AND risk_level = ?';
      params.push(query.risk_level);
    }
    if (query.current_role) {
      sql += ' AND current_role = ?';
      params.push(query.current_role);
    }
    if (query.handler_id) {
      sql += ' AND current_handler_id = ?';
      params.push(query.handler_id);
    }
    if (query.keyword) {
      sql += ' AND (code LIKE ? OR customer_name LIKE ? OR account_no LIKE ?)';
      const kw = `%${query.keyword}%`;
      params.push(kw, kw, kw);
    }

    sql += ' ORDER BY is_overdue DESC, priority DESC, created_at DESC';

    const rows = this.database.prepare(sql).all(...params) as TradeReview[];
    rows.forEach(r => this.updateOverdueFlag(r.id));
    return this.database.prepare(sql).all(...params) as TradeReview[];
  }

  getStatistics(): any {
    const rows = this.database.prepare('SELECT * FROM trade_reviews').all() as TradeReview[];
    rows.forEach(r => this.updateOverdueFlag(r.id));

    const all = this.database.prepare('SELECT * FROM trade_reviews').all() as TradeReview[];
    const byStatus: Record<string, number> = {};
    const byRisk: Record<string, number> = {};
    let overdueCount = 0;

    all.forEach(r => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byRisk[r.risk_level] = (byRisk[r.risk_level] || 0) + 1;
      if (r.is_overdue) overdueCount++;
    });

    return {
      total: all.length,
      byStatus,
      byRisk,
      overdue: overdueCount,
      completed: byStatus[ReviewStatus.COMPLETED] || 0,
      pending: all.length - (byStatus[ReviewStatus.COMPLETED] || 0),
    };
  }

  submitReview(dto: ProcessReviewDto): TradeReview {
    const review = this.findById(dto.review_id);
    const operator = this.getUserById(dto.operator_id);

    if (operator.role !== UserRole.COMPLIANCE_OFFICER) {
      throw new ForbiddenException('仅合规专员可以提交复核');
    }
    if (review.version !== dto.expected_version) {
      throw new ConflictException(`版本冲突：当前版本 ${review.version}，请刷新后重试`);
    }
    if (![ReviewStatus.REGISTERED, ReviewStatus.PENDING_CORRECTION].includes(review.status as any)) {
      throw new BadRequestException(`当前状态 ${review.status} 不能提交复核`);
    }
    if (review.current_role !== UserRole.COMPLIANCE_OFFICER) {
      throw new ForbiddenException('当前不由合规专员处理');
    }

    const evidence = dto.evidence || [];
    const evidenceCheck = this.checkEvidence(review.risk_level, evidence);
    if (!evidenceCheck.ok) {
      this.insertRecord({
        review_id: review.id,
        operator_id: operator.id,
        operator_name: operator.name,
        operator_role: operator.role,
        action: ReviewAction.REJECT,
        from_status: review.status,
        to_status: review.status,
        opinion: dto.opinion || `证据不足，缺少: ${evidenceCheck.missing.join('、')}`,
        result: '证据校验未通过',
        evidence_json: JSON.stringify(evidence),
        version: review.version,
      });
      throw new BadRequestException(`缺少必填证据: ${evidenceCheck.missing.join('、')}`);
    }

    const manager = this.database
      .prepare("SELECT id, name FROM users WHERE role = 'BRANCH_MANAGER' LIMIT 1")
      .get() as { id: string; name: string } | undefined;

    const newVersion = review.version + 1;
    this.database.prepare(`
      UPDATE trade_reviews SET
        status = ?, current_handler_id = ?, current_role = ?,
        version = ?, evidence_json = ?, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(
      ReviewStatus.REVIEWING, manager?.id || null, UserRole.BRANCH_MANAGER,
      newVersion, JSON.stringify(evidence), review.id, review.version,
    );

    this.insertRecord({
      review_id: review.id,
      operator_id: operator.id,
      operator_name: operator.name,
      operator_role: operator.role,
      action: ReviewAction.SUBMIT_REVIEW,
      from_status: review.status,
      to_status: ReviewStatus.REVIEWING,
      opinion: dto.opinion || '核验通过，提交营业部经理复核',
      result: dto.result || '提交复核成功',
      evidence_json: JSON.stringify(evidence),
      version: newVersion,
    });

    return this.findById(review.id);
  }

  requestCorrection(dto: ProcessReviewDto): TradeReview {
    const review = this.findById(dto.review_id);
    const operator = this.getUserById(dto.operator_id);

    if (operator.role !== UserRole.COMPLIANCE_OFFICER) {
      throw new ForbiddenException('仅合规专员可以退回补正');
    }
    if (review.version !== dto.expected_version) {
      throw new ConflictException(`版本冲突：当前版本 ${review.version}，请刷新后重试`);
    }
    if (review.status !== ReviewStatus.REGISTERED && review.status !== ReviewStatus.REVIEWING) {
      throw new BadRequestException(`当前状态 ${review.status} 不能退回补正`);
    }

    const advisor = this.database
      .prepare("SELECT id, name FROM users WHERE role = 'FINANCIAL_ADVISOR' LIMIT 1")
      .get() as { id: string; name: string } | undefined;

    const newVersion = review.version + 1;
    this.database.prepare(`
      UPDATE trade_reviews SET
        status = ?, current_handler_id = ?, current_role = ?,
        version = ?, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(
      ReviewStatus.PENDING_CORRECTION, advisor?.id || review.created_by,
      UserRole.FINANCIAL_ADVISOR, newVersion, review.id, review.version,
    );

    this.insertRecord({
      review_id: review.id,
      operator_id: operator.id,
      operator_name: operator.name,
      operator_role: operator.role,
      action: ReviewAction.REQUEST_CORRECTION,
      from_status: review.status,
      to_status: ReviewStatus.PENDING_CORRECTION,
      opinion: dto.opinion || '请补正相关材料',
      result: dto.result || '已退回补正',
      evidence_json: dto.evidence ? JSON.stringify(dto.evidence) : null,
      version: newVersion,
    });

    return this.findById(review.id);
  }

  correct(dto: ProcessReviewDto): TradeReview {
    const review = this.findById(dto.review_id);
    const operator = this.getUserById(dto.operator_id);

    if (operator.role !== UserRole.FINANCIAL_ADVISOR) {
      throw new ForbiddenException('仅理财顾问可以补正');
    }
    if (review.version !== dto.expected_version) {
      throw new ConflictException(`版本冲突：当前版本 ${review.version}，请刷新后重试`);
    }
    if (review.status !== ReviewStatus.PENDING_CORRECTION) {
      throw new BadRequestException(`当前状态 ${review.status} 不能补正`);
    }

    const evidence = dto.evidence || [];
    const evidenceCheck = this.checkEvidence(review.risk_level, evidence);
    if (!evidenceCheck.ok) {
      this.insertRecord({
        review_id: review.id,
        operator_id: operator.id,
        operator_name: operator.name,
        operator_role: operator.role,
        action: ReviewAction.REJECT,
        from_status: review.status,
        to_status: review.status,
        opinion: dto.opinion || `补正证据不足，缺少: ${evidenceCheck.missing.join('、')}`,
        result: '补正证据校验未通过',
        evidence_json: JSON.stringify(evidence),
        version: review.version,
      });
      throw new BadRequestException(`补正缺少必填证据: ${evidenceCheck.missing.join('、')}`);
    }

    const officer = this.database
      .prepare("SELECT id, name FROM users WHERE role = 'COMPLIANCE_OFFICER' LIMIT 1")
      .get() as { id: string; name: string } | undefined;

    const newVersion = review.version + 1;
    this.database.prepare(`
      UPDATE trade_reviews SET
        status = ?, current_handler_id = ?, current_role = ?,
        version = ?, evidence_json = ?, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(
      ReviewStatus.REGISTERED, officer?.id || null, UserRole.COMPLIANCE_OFFICER,
      newVersion, JSON.stringify(evidence), review.id, review.version,
    );

    this.insertRecord({
      review_id: review.id,
      operator_id: operator.id,
      operator_name: operator.name,
      operator_role: operator.role,
      action: ReviewAction.CORRECT,
      from_status: review.status,
      to_status: ReviewStatus.REGISTERED,
      opinion: dto.opinion || '已补正相关材料',
      result: dto.result || '补正完成，提交重新核验',
      evidence_json: JSON.stringify(evidence),
      version: newVersion,
    });

    return this.findById(review.id);
  }

  confirmComplete(dto: ProcessReviewDto): TradeReview {
    const review = this.findById(dto.review_id);
    const operator = this.getUserById(dto.operator_id);

    if (operator.role !== UserRole.BRANCH_MANAGER) {
      throw new ForbiddenException('仅营业部经理可以确认办结');
    }
    if (review.version !== dto.expected_version) {
      throw new ConflictException(`版本冲突：当前版本 ${review.version}，请刷新后重试`);
    }
    if (review.status !== ReviewStatus.REVIEWING) {
      throw new BadRequestException(`当前状态 ${review.status} 不能办结`);
    }

    const evidence = dto.evidence || (review.evidence_json ? JSON.parse(review.evidence_json) : []);
    const evidenceCheck = this.checkEvidence(review.risk_level, evidence);
    if (!evidenceCheck.ok) {
      throw new BadRequestException(`办结前缺少必填证据: ${evidenceCheck.missing.join('、')}`);
    }

    const newVersion = review.version + 1;
    this.database.prepare(`
      UPDATE trade_reviews SET
        status = ?, current_handler_id = NULL, current_role = NULL,
        version = ?, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(ReviewStatus.COMPLETED, newVersion, review.id, review.version);

    this.insertRecord({
      review_id: review.id,
      operator_id: operator.id,
      operator_name: operator.name,
      operator_role: operator.role,
      action: ReviewAction.CONFIRM_COMPLETE,
      from_status: review.status,
      to_status: ReviewStatus.COMPLETED,
      opinion: dto.opinion || '复核通过，确认办结',
      result: dto.result || '已办结归档',
      evidence_json: JSON.stringify(evidence),
      version: newVersion,
    });

    return this.findById(review.id);
  }

  rejectReview(dto: ProcessReviewDto): TradeReview {
    const review = this.findById(dto.review_id);
    const operator = this.getUserById(dto.operator_id);

    if (operator.role !== UserRole.BRANCH_MANAGER) {
      throw new ForbiddenException('仅营业部经理可以驳回复核');
    }
    if (review.version !== dto.expected_version) {
      throw new ConflictException(`版本冲突：当前版本 ${review.version}，请刷新后重试`);
    }
    if (review.status !== ReviewStatus.REVIEWING) {
      throw new BadRequestException(`当前状态 ${review.status} 不能驳回`);
    }

    const officer = this.database
      .prepare("SELECT id, name FROM users WHERE role = 'COMPLIANCE_OFFICER' LIMIT 1")
      .get() as { id: string; name: string } | undefined;

    const newVersion = review.version + 1;
    this.database.prepare(`
      UPDATE trade_reviews SET
        status = ?, current_handler_id = ?, current_role = ?,
        version = ?, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(
      ReviewStatus.REGISTERED, officer?.id || null, UserRole.COMPLIANCE_OFFICER,
      newVersion, review.id, review.version,
    );

    this.insertRecord({
      review_id: review.id,
      operator_id: operator.id,
      operator_name: operator.name,
      operator_role: operator.role,
      action: ReviewAction.REJECT,
      from_status: review.status,
      to_status: ReviewStatus.REGISTERED,
      opinion: dto.opinion || '复核不通过，请重新核验',
      result: dto.result || '已驳回，退回合规专员',
      evidence_json: null,
      version: newVersion,
    });

    return this.findById(review.id);
  }

  getDetailWithRecords(id: string): { review: TradeReview; records: ReviewRecord[] } {
    const review = this.findById(id);
    const records = this.getRecords(id);
    return { review, records };
  }
}
