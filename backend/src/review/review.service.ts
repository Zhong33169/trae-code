import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import {
  TradeReview, ReviewRecord, User, ReviewStatus, UserRole, ReviewAction,
  RISK_PRIORITY, RISK_REQUIRED_EVIDENCE,
} from './review.types';
import { RegisterReviewDto, ProcessReviewDto, QueryReviewsDto } from './review.dto';

interface ValidationResult {
  ok: boolean;
  error?: string;
  errorType?: 'role' | 'version' | 'status' | 'handler' | 'evidence';
}

interface ActionConfig {
  action: ReviewAction;
  allowedRoles: UserRole[];
  allowedStatuses: ReviewStatus[];
  targetHandlerRole?: UserRole;
  targetStatus?: ReviewStatus;
  requiresEvidence: boolean;
}

const ACTION_CONFIGS: Record<string, ActionConfig> = {
  submitReview: {
    action: ReviewAction.SUBMIT_REVIEW,
    allowedRoles: [UserRole.COMPLIANCE_OFFICER],
    allowedStatuses: [ReviewStatus.REGISTERED, ReviewStatus.PENDING_CORRECTION],
    targetHandlerRole: UserRole.BRANCH_MANAGER,
    targetStatus: ReviewStatus.REVIEWING,
    requiresEvidence: true,
  },
  requestCorrection: {
    action: ReviewAction.REQUEST_CORRECTION,
    allowedRoles: [UserRole.COMPLIANCE_OFFICER],
    allowedStatuses: [ReviewStatus.REGISTERED, ReviewStatus.REVIEWING],
    targetHandlerRole: UserRole.FINANCIAL_ADVISOR,
    targetStatus: ReviewStatus.PENDING_CORRECTION,
    requiresEvidence: false,
  },
  correct: {
    action: ReviewAction.CORRECT,
    allowedRoles: [UserRole.FINANCIAL_ADVISOR],
    allowedStatuses: [ReviewStatus.PENDING_CORRECTION],
    targetHandlerRole: UserRole.COMPLIANCE_OFFICER,
    targetStatus: ReviewStatus.REGISTERED,
    requiresEvidence: true,
  },
  confirmComplete: {
    action: ReviewAction.CONFIRM_COMPLETE,
    allowedRoles: [UserRole.BRANCH_MANAGER],
    allowedStatuses: [ReviewStatus.REVIEWING],
    targetHandlerRole: undefined,
    targetStatus: ReviewStatus.COMPLETED,
    requiresEvidence: true,
  },
  rejectReview: {
    action: ReviewAction.REJECT,
    allowedRoles: [UserRole.BRANCH_MANAGER],
    allowedStatuses: [ReviewStatus.REVIEWING],
    targetHandlerRole: UserRole.COMPLIANCE_OFFICER,
    targetStatus: ReviewStatus.REGISTERED,
    requiresEvidence: false,
  },
};

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
    const stmt = this.database.prepare(
      `UPDATE trade_reviews SET is_overdue = CASE
        WHEN deadline IS NOT NULL AND deadline < datetime('now') AND status != 'COMPLETED' THEN 1
        ELSE 0
      END WHERE id = ?`,
    );
    stmt.run(reviewId);
  }

  private validateProcess(
    review: TradeReview,
    operator: User,
    dto: ProcessReviewDto,
    config: ActionConfig,
  ): ValidationResult {
    if (!config.allowedRoles.includes(operator.role as UserRole)) {
      return {
        ok: false,
        error: `仅${config.allowedRoles.map(r => this.roleLabel(r)).join('/')}可以执行此操作`,
        errorType: 'role',
      };
    }
    if (review.current_role && review.current_role !== operator.role) {
      return {
        ok: false,
        error: `当前单据由${this.roleLabel(review.current_role)}处理，${this.roleLabel(operator.role)}无法操作`,
        errorType: 'handler',
      };
    }
    if (review.version !== dto.expected_version) {
      return {
        ok: false,
        error: `版本冲突：当前版本 v${review.version}，请刷新后重试`,
        errorType: 'version',
      };
    }
    if (!config.allowedStatuses.includes(review.status as ReviewStatus)) {
      return {
        ok: false,
        error: `当前状态「${this.statusLabel(review.status)}」不能执行此操作`,
        errorType: 'status',
      };
    }
    if (config.requiresEvidence) {
      const evidence = dto.evidence || [];
      const evCheck = this.checkEvidence(review.risk_level, evidence);
      if (!evCheck.ok) {
        return {
          ok: false,
          error: `缺少必填证据: ${evCheck.missing.join('、')}`,
          errorType: 'evidence',
        };
      }
    }
    return { ok: true };
  }

  private roleLabel(role: string): string {
    const map: Record<string, string> = {
      FINANCIAL_ADVISOR: '理财顾问',
      COMPLIANCE_OFFICER: '合规专员',
      BRANCH_MANAGER: '营业部经理',
    };
    return map[role] || role;
  }

  private statusLabel(status: string): string {
    const map: Record<string, string> = {
      REGISTERED: '已登记',
      PENDING_CORRECTION: '待补正',
      REVIEWING: '复核中',
      COMPLETED: '办结',
    };
    return map[status] || status;
  }

  private failWithRecord(
    review: TradeReview,
    operator: User,
    dto: ProcessReviewDto,
    result: ValidationResult,
  ): never {
    const evidence = dto.evidence || [];
    this.insertRecord({
      review_id: review.id,
      operator_id: operator.id,
      operator_name: operator.name,
      operator_role: operator.role as UserRole,
      action: ReviewAction.REJECT,
      from_status: review.status,
      to_status: review.status,
      opinion: `${dto.opinion || ''} [校验失败] ${result.error}`.trim(),
      result: `操作失败：${result.error}`,
      evidence_json: evidence.length > 0 ? JSON.stringify(evidence) : null,
      version: review.version,
    });
    if (result.errorType === 'role' || result.errorType === 'handler') {
      throw new ForbiddenException(result.error);
    } else if (result.errorType === 'version') {
      throw new ConflictException(result.error);
    } else {
      throw new BadRequestException(result.error);
    }
  }

  private executeProcess(
    dto: ProcessReviewDto,
    configKey: string,
  ): TradeReview {
    const config = ACTION_CONFIGS[configKey];
    const review = this.findById(dto.review_id);
    const operator = this.getUserById(dto.operator_id);

    const validation = this.validateProcess(review, operator, dto, config);
    if (!validation.ok) {
      this.failWithRecord(review, operator, dto, validation);
    }

    const evidence = dto.evidence || (review.evidence_json ? JSON.parse(review.evidence_json) : []);
    const newVersion = review.version + 1;

    let targetHandlerId: string | null = null;
    if (config.targetHandlerRole) {
      const handler = this.database
        .prepare(`SELECT id FROM users WHERE role = ? LIMIT 1`)
        .get(config.targetHandlerRole) as { id: string } | undefined;
      targetHandlerId = handler?.id || null;
      if (!targetHandlerId && config.targetHandlerRole === UserRole.FINANCIAL_ADVISOR) {
        targetHandlerId = review.created_by;
      }
    }

    this.database.prepare(`
      UPDATE trade_reviews SET
        status = ?, current_handler_id = ?, current_role = ?,
        version = ?, evidence_json = ?, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(
      config.targetStatus,
      config.targetHandlerRole ? targetHandlerId : null,
      config.targetHandlerRole || null,
      newVersion,
      config.requiresEvidence || evidence.length > 0 ? JSON.stringify(evidence) : review.evidence_json,
      review.id,
      review.version,
    );

    this.insertRecord({
      review_id: review.id,
      operator_id: operator.id,
      operator_name: operator.name,
      operator_role: operator.role as UserRole,
      action: config.action,
      from_status: review.status,
      to_status: config.targetStatus,
      opinion: dto.opinion || this.getDefaultOpinion(config.action, review.status, config.targetStatus),
      result: dto.result || this.getDefaultResult(config.action, config.targetStatus),
      evidence_json: evidence.length > 0 ? JSON.stringify(evidence) : null,
      version: newVersion,
    });

    return this.findById(review.id);
  }

  private getDefaultOpinion(action: ReviewAction, from: string, to: string): string {
    switch (action) {
      case ReviewAction.SUBMIT_REVIEW: return '核验通过，提交营业部经理复核';
      case ReviewAction.REQUEST_CORRECTION: return '请补正相关材料';
      case ReviewAction.CORRECT: return '已补正相关材料';
      case ReviewAction.CONFIRM_COMPLETE: return '复核通过，确认办结';
      case ReviewAction.REJECT: return '复核不通过，请重新核验';
      default: return `${this.statusLabel(from)} → ${this.statusLabel(to)}`;
    }
  }

  private getDefaultResult(action: ReviewAction, to?: ReviewStatus): string {
    switch (action) {
      case ReviewAction.SUBMIT_REVIEW: return '提交复核成功';
      case ReviewAction.REQUEST_CORRECTION: return '已退回补正';
      case ReviewAction.CORRECT: return '补正完成，提交重新核验';
      case ReviewAction.CONFIRM_COMPLETE: return '已办结归档';
      case ReviewAction.REJECT: return '已驳回，退回合规专员';
      default: return '操作成功';
    }
  }

  getUsers(): User[] {
    return this.database.prepare('SELECT * FROM users ORDER BY role, name').all() as User[];
  }

  getUserById(id: string): User {
    const user = this.database.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  register(dto: RegisterReviewDto): TradeReview {
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

    const defaultHandler = this.database
      .prepare("SELECT id FROM users WHERE role = 'COMPLIANCE_OFFICER' LIMIT 1")
      .get() as { id: string } | undefined;

    const stmt = this.database.prepare(`
      INSERT INTO trade_reviews (
        id, code, customer_name, trade_type, trade_amount, trade_date, account_no,
        risk_level, status, priority, current_handler_id, current_role, version,
        evidence_json, deadline, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
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

    const preRows = this.database.prepare(sql).all(...params) as TradeReview[];
    preRows.forEach(r => this.updateOverdueFlag(r.id));

    return this.database.prepare(sql).all(...params) as TradeReview[];
  }

  getStatistics(): any {
    const preAll = this.database.prepare('SELECT * FROM trade_reviews').all() as TradeReview[];
    preAll.forEach(r => this.updateOverdueFlag(r.id));

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
    return this.executeProcess(dto, 'submitReview');
  }

  requestCorrection(dto: ProcessReviewDto): TradeReview {
    return this.executeProcess(dto, 'requestCorrection');
  }

  correct(dto: ProcessReviewDto): TradeReview {
    return this.executeProcess(dto, 'correct');
  }

  confirmComplete(dto: ProcessReviewDto): TradeReview {
    return this.executeProcess(dto, 'confirmComplete');
  }

  rejectReview(dto: ProcessReviewDto): TradeReview {
    return this.executeProcess(dto, 'rejectReview');
  }

  getDetailWithRecords(id: string): { review: TradeReview; records: ReviewRecord[] } {
    const review = this.findById(id);
    const records = this.getRecords(id);
    return { review, records };
  }
}
