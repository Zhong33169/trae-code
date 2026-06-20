import { Inject, Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateInvitationDto } from './dto/update-invitation.dto';
import { SubmitDto } from './dto/submit.dto';
import { ApproveDto } from './dto/approve.dto';
import { RejectDto } from './dto/reject.dto';
import { ReviewDto } from './dto/review.dto';
import { ReviewRejectDto } from './dto/review-reject.dto';
import { BatchActionDto } from './dto/batch-action.dto';
import { GuestConfirmDto } from './dto/guest-confirm.dto';
import { CheckinFeedbackDto } from './dto/checkin-feedback.dto';

const USERS: Record<string, { name: string; role: string }> = {
  'registrar-001': { name: '张登记', role: 'registrar' },
  'reviewer-001': { name: '李审核', role: 'reviewer' },
  'final-reviewer-001': { name: '王复核', role: 'final_reviewer' },
};

@Injectable()
export class InvitationService {
  constructor(@Inject('DATABASE') private db: Database.Database) {}

  computeUrgency(deadline: string): string {
    const now = dayjs();
    const dl = dayjs(deadline);
    if (dl.isBefore(now) || dl.isSame(now, 'day')) return 'overdue';
    if (dl.isBefore(now.add(72, 'hour')) || dl.isSame(now.add(72, 'hour'), 'day')) return 'urgent';
    return 'normal';
  }

  private checkMaterialsComplete(invitationId: string): boolean {
    const row = this.db.prepare(
      "SELECT COUNT(*) as cnt FROM material WHERE invitation_id = ? AND category = '邀请函'"
    ).get(invitationId) as { cnt: number };
    return row.cnt > 0;
  }

  private updateMaterialsComplete(invitationId: string): void {
    const complete = this.checkMaterialsComplete(invitationId) ? 1 : 0;
    this.db.prepare('UPDATE invitation SET materials_complete = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(complete, invitationId);
  }

  private createAuditLog(params: {
    invitationId: string; operatorId: string; operatorName: string; operatorRole: string;
    action: string; detail: string; beforeStatus: string | null; afterStatus: string;
  }) {
    this.db.prepare(`
      INSERT INTO audit_log (id, invitation_id, operator_id, operator_name, operator_role, action, detail, before_status, after_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      uuidv4(), params.invitationId, params.operatorId, params.operatorName,
      params.operatorRole, params.action, params.detail, params.beforeStatus, params.afterStatus
    );
  }

  private getUser(id: string): { name: string; role: string } | undefined {
    return USERS[id];
  }

  private getInvitation(id: string): any {
    const row = this.db.prepare('SELECT * FROM invitation WHERE id = ?').get(id);
    if (!row) throw new NotFoundException(`邀请单 ${id} 不存在`);
    return row;
  }

  findAll(query: { status?: string; urgency?: string; keyword?: string; page?: string; pageSize?: string; role?: string; operatorId?: string }) {
    const page = parseInt(query.page || '1', 10);
    const pageSize = parseInt(query.pageSize || '10', 10);
    const offset = (page - 1) * pageSize;
    const now = dayjs();

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (query.status) {
      where += ' AND status = ?';
      params.push(query.status);
    }
    if (query.urgency) {
      if (query.urgency === 'overdue') {
        where += " AND deadline <= datetime('now')";
      } else if (query.urgency === 'urgent') {
        where += " AND deadline > datetime('now') AND deadline <= datetime('now', '+72 hours')";
      } else if (query.urgency === 'normal') {
        where += " AND deadline > datetime('now', '+72 hours')";
      }
    }
    if (query.keyword) {
      where += ' AND (title LIKE ? OR event_name LIKE ? OR creator_name LIKE ?)';
      const kw = `%${query.keyword}%`;
      params.push(kw, kw, kw);
    }
    if (query.role && query.operatorId) {
      if (query.role === 'registrar') {
        where += ' AND creator_id = ?';
        params.push(query.operatorId);
      } else if (query.role === 'reviewer') {
        where += ' AND status IN (?, ?, ?)';
        params.push('pending_review', 'review_rejected', 'final_rejected');
      } else if (query.role === 'final_reviewer') {
        where += ' AND status IN (?, ?)';
        params.push('pending_final', 'final_rejected');
      }
    }

    const countRow = this.db.prepare(`SELECT COUNT(*) as total FROM invitation ${where}`).get(...params) as { total: number };
    const rows = this.db.prepare(`SELECT * FROM invitation ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

    const items = rows.map((row: any) => ({
      ...row,
      guest_confirmed: !!row.guest_confirmed,
      checkin_completed: !!row.checkin_completed,
      materials_complete: !!row.materials_complete,
      urgency: this.computeUrgency(row.deadline),
    }));

    return {
      items,
      total: countRow.total,
      page,
      pageSize,
      totalPages: Math.ceil(countRow.total / pageSize),
    };
  }

  findOne(id: string) {
    const invitation = this.getInvitation(id);
    const materials = this.db.prepare('SELECT * FROM material WHERE invitation_id = ?').all(id);
    const auditLogs = this.db.prepare('SELECT * FROM audit_log WHERE invitation_id = ? ORDER BY created_at DESC').all(id);
    return {
      ...invitation,
      guest_confirmed: !!invitation.guest_confirmed,
      checkin_completed: !!invitation.checkin_completed,
      materials_complete: !!invitation.materials_complete,
      urgency: this.computeUrgency(invitation.deadline),
      materials,
      auditLogs,
    };
  }

  create(dto: CreateInvitationDto & { operatorId: string; operatorRole: string }) {
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    if (dto.operatorRole !== 'registrar') throw new ForbiddenException('只有登记员可以创建邀请单');

    const id = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    this.db.prepare(`
      INSERT INTO invitation (id, title, media_type, event_name, event_date, event_location, deadline,
        status, creator_id, creator_name, guest_confirmed, checkin_completed, materials_complete, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 0, 0, 0, 1, ?, ?)
    `).run(id, dto.title, dto.mediaType, dto.eventName, dto.eventDate, dto.eventLocation, dto.deadline,
      dto.operatorId, user.name, now, now);

    this.createAuditLog({
      invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
      action: 'create', detail: '创建媒体邀约单', beforeStatus: null, afterStatus: 'draft',
    });

    return this.findOne(id);
  }

  update(id: string, dto: UpdateInvitationDto & { operatorId: string; operatorRole: string; expectedVersion?: number }) {
    const inv = this.getInvitation(id);
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    if (dto.operatorRole !== 'registrar') throw new ForbiddenException('只有登记员可以修改邀请单');
    if (inv.status !== 'draft' && inv.status !== 'review_rejected') {
      throw new BadRequestException('只有草稿或审核退回状态可以修改');
    }
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== inv.version) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `修改版本冲突: 期望v${dto.expectedVersion}，当前v${inv.version}`,
        beforeStatus: inv.status, afterStatus: inv.status,
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    const fields: string[] = [];
    const values: any[] = [];
    const changedFields: string[] = [];

    if (dto.title !== undefined) { fields.push('title = ?'); values.push(dto.title); changedFields.push(`标题→${dto.title}`); }
    if (dto.mediaType !== undefined) { fields.push('media_type = ?'); values.push(dto.mediaType); changedFields.push(`媒体类型→${dto.mediaType}`); }
    if (dto.eventName !== undefined) { fields.push('event_name = ?'); values.push(dto.eventName); changedFields.push(`活动名称→${dto.eventName}`); }
    if (dto.eventDate !== undefined) { fields.push('event_date = ?'); values.push(dto.eventDate); changedFields.push(`活动日期→${dto.eventDate}`); }
    if (dto.eventLocation !== undefined) { fields.push('event_location = ?'); values.push(dto.eventLocation); changedFields.push(`活动地点→${dto.eventLocation}`); }
    if (dto.deadline !== undefined) { fields.push('deadline = ?'); values.push(dto.deadline); changedFields.push(`截止时间→${dto.deadline}`); }
    if (dto.guestConfirmed !== undefined) { fields.push('guest_confirmed = ?'); values.push(dto.guestConfirmed ? 1 : 0); }
    if (dto.checkinCompleted !== undefined) { fields.push('checkin_completed = ?'); values.push(dto.checkinCompleted ? 1 : 0); }

    if (fields.length === 0) return this.findOne(id);

    fields.push('version = version + 1', "updated_at = datetime('now')");
    values.push(id, inv.version);

    const result = this.db.prepare(`UPDATE invitation SET ${fields.join(', ')} WHERE id = ? AND version = ?`).run(...values);
    if (result.changes === 0) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `修改DB版本冲突(乐观锁)`,
        beforeStatus: inv.status, afterStatus: inv.status,
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    if (changedFields.length > 0) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'update', detail: inv.status === 'review_rejected' ? `补正修改: ${changedFields.join(', ')}` : `修改: ${changedFields.join(', ')}`,
        beforeStatus: inv.status, afterStatus: inv.status,
      });
    }

    return this.findOne(id);
  }

  submit(id: string, dto: SubmitDto) {
    const inv = this.getInvitation(id);
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    if (dto.operatorRole !== 'registrar') throw new ForbiddenException('只有登记员可以提交邀请单');
    if (inv.status !== 'draft' && inv.status !== 'review_rejected') {
      throw new BadRequestException('只有草稿或审核退回状态可以提交');
    }
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== inv.version) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `提交版本冲突: 期望v${dto.expectedVersion}，当前v${inv.version}`,
        beforeStatus: inv.status, afterStatus: 'pending_review',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    const result = this.db.prepare(`
      UPDATE invitation SET status = 'pending_review', version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(id, inv.version);
    if (result.changes === 0) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `提交DB版本冲突(乐观锁)`,
        beforeStatus: inv.status, afterStatus: 'pending_review',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    this.createAuditLog({
      invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
      action: 'submit', detail: inv.status === 'review_rejected' ? '修改后重新提交审核' : '提交审核',
      beforeStatus: inv.status, afterStatus: 'pending_review',
    });

    return this.findOne(id);
  }

  approve(id: string, dto: ApproveDto) {
    const inv = this.getInvitation(id);
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    if (dto.operatorRole !== 'reviewer') throw new ForbiddenException('只有审核主管可以审核通过');
    if (inv.status !== 'pending_review') throw new BadRequestException('只有待审核状态可以审核');
    if (!dto.guestConfirmed) throw new BadRequestException('嘉宾未确认，无法审核通过');
    if (!inv.materials_complete) throw new BadRequestException('材料不完整，无法审核通过');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== inv.version) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `审核通过版本冲突: 期望v${dto.expectedVersion}，当前v${inv.version}`,
        beforeStatus: inv.status, afterStatus: 'pending_final',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    const result = this.db.prepare(`
      UPDATE invitation SET status = 'pending_final', reviewer_id = ?, reviewer_name = ?,
        review_comment = ?, guest_confirmed = ?, version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(dto.operatorId, user.name, dto.reviewComment, dto.guestConfirmed ? 1 : 0, id, inv.version);
    if (result.changes === 0) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `审核通过DB版本冲突(乐观锁)`,
        beforeStatus: inv.status, afterStatus: 'pending_final',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    this.createAuditLog({
      invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
      action: 'approve', detail: dto.reviewComment,
      beforeStatus: inv.status, afterStatus: 'pending_final',
    });

    return this.findOne(id);
  }

  reject(id: string, dto: RejectDto) {
    const inv = this.getInvitation(id);
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    if (dto.operatorRole !== 'reviewer') throw new ForbiddenException('只有审核主管可以退回');
    if (inv.status !== 'pending_review') throw new BadRequestException('只有待审核状态可以退回');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== inv.version) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `退回版本冲突: 期望v${dto.expectedVersion}，当前v${inv.version}`,
        beforeStatus: inv.status, afterStatus: 'review_rejected',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    const result = this.db.prepare(`
      UPDATE invitation SET status = 'review_rejected', reviewer_id = ?, reviewer_name = ?,
        review_comment = ?, version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(dto.operatorId, user.name, dto.reviewComment, id, inv.version);
    if (result.changes === 0) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `退回DB版本冲突(乐观锁)`,
        beforeStatus: inv.status, afterStatus: 'review_rejected',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    this.createAuditLog({
      invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
      action: 'reject', detail: dto.reviewComment,
      beforeStatus: inv.status, afterStatus: 'review_rejected',
    });

    return this.findOne(id);
  }

  review(id: string, dto: ReviewDto) {
    const inv = this.getInvitation(id);
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    if (dto.operatorRole !== 'final_reviewer') throw new ForbiddenException('只有复核负责人可以复核归档');
    if (inv.status !== 'pending_final') throw new BadRequestException('只有待复核状态可以复核');
    if (!inv.guest_confirmed) throw new BadRequestException('嘉宾未确认，无法归档');
    if (!dto.checkinCompleted) throw new BadRequestException('签到未完成，无法归档');
    if (!inv.materials_complete) throw new BadRequestException('材料不完整，无法归档');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== inv.version) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `复核归档版本冲突: 期望v${dto.expectedVersion}，当前v${inv.version}`,
        beforeStatus: inv.status, afterStatus: 'archived',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    const result = this.db.prepare(`
      UPDATE invitation SET status = 'archived', final_reviewer_id = ?, final_reviewer_name = ?,
        final_comment = ?, checkin_completed = ?, version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(dto.operatorId, user.name, dto.finalComment, dto.checkinCompleted ? 1 : 0, id, inv.version);
    if (result.changes === 0) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `复核归档DB版本冲突(乐观锁)`,
        beforeStatus: inv.status, afterStatus: 'archived',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    this.createAuditLog({
      invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
      action: 'review', detail: dto.finalComment,
      beforeStatus: inv.status, afterStatus: 'archived',
    });

    return this.findOne(id);
  }

  reviewReject(id: string, dto: ReviewRejectDto) {
    const inv = this.getInvitation(id);
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    if (dto.operatorRole !== 'final_reviewer') throw new ForbiddenException('只有复核负责人可以复核退回');
    if (inv.status !== 'pending_final') throw new BadRequestException('只有待复核状态可以复核退回');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== inv.version) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `复核退回版本冲突: 期望v${dto.expectedVersion}，当前v${inv.version}`,
        beforeStatus: inv.status, afterStatus: 'final_rejected',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    const result = this.db.prepare(`
      UPDATE invitation SET status = 'final_rejected', final_reviewer_id = ?, final_reviewer_name = ?,
        final_comment = ?, version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(dto.operatorId, user.name, dto.finalComment, id, inv.version);
    if (result.changes === 0) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `复核退回DB版本冲突(乐观锁)`,
        beforeStatus: inv.status, afterStatus: 'final_rejected',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    this.createAuditLog({
      invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
      action: 'review-reject', detail: dto.finalComment,
      beforeStatus: inv.status, afterStatus: 'final_rejected',
    });

    return this.findOne(id);
  }

  reprocess(id: string, dto: ApproveDto) {
    const inv = this.getInvitation(id);
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    if (dto.operatorRole !== 'reviewer') throw new ForbiddenException('只有审核主管可以重新办理');
    if (inv.status !== 'final_rejected') throw new BadRequestException('只有复核退回状态可以重新办理');
    if (!dto.guestConfirmed) throw new BadRequestException('嘉宾未确认，无法重新办理');
    if (!inv.materials_complete) throw new BadRequestException('材料不完整，无法重新办理');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== inv.version) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `重新办理版本冲突: 期望v${dto.expectedVersion}，当前v${inv.version}`,
        beforeStatus: inv.status, afterStatus: 'pending_review',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    const result = this.db.prepare(`
      UPDATE invitation SET status = 'pending_review', version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(id, inv.version);
    if (result.changes === 0) {
      this.createAuditLog({
        invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
        action: 'version_conflict', detail: `重新办理DB版本冲突(乐观锁)`,
        beforeStatus: inv.status, afterStatus: 'pending_review',
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    this.createAuditLog({
      invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
      action: 'reprocess', detail: dto.reviewComment || '复核退回后重新办理',
      beforeStatus: inv.status, afterStatus: 'pending_review',
    });

    return this.findOne(id);
  }

  batchAction(dto: BatchActionDto) {
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');

    const success: { id: string; beforeStatus: string; afterStatus: string }[] = [];
    const failed: { id: string; reason: string }[] = [];

    for (const id of dto.ids) {
      try {
        const inv = this.getInvitation(id);
        if (!inv) { failed.push({ id, reason: '邀请单不存在' }); continue; }

        let beforeStatus = inv.status;
        let afterStatus = '';
        let updateSql = '';
        let updateParams: any[] = [];
        let auditAction = '';
        let auditDetail = dto.comment || '';

        const expectedVersion = dto.itemVersions ? dto.itemVersions[id] : undefined;
        if (expectedVersion !== undefined && expectedVersion !== inv.version) {
          this.createAuditLog({
            invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
            action: 'version_conflict', detail: `批量${dto.action}版本冲突: 期望v${expectedVersion}，当前v${inv.version}`,
            beforeStatus: inv.status, afterStatus: afterStatus || inv.status,
          });
          failed.push({ id, reason: '版本冲突，请刷新后重试' }); continue;
        }

        if (dto.action === 'approve') {
          if (dto.operatorRole !== 'reviewer') { failed.push({ id, reason: '只有审核主管可以审核通过' }); continue; }
          if (inv.status !== 'pending_review') { failed.push({ id, reason: '状态不是待审核' }); continue; }
          if (!inv.guest_confirmed) { failed.push({ id, reason: '嘉宾未确认' }); continue; }
          if (!inv.materials_complete) { failed.push({ id, reason: '材料不完整' }); continue; }
          afterStatus = 'pending_final';
          auditAction = 'approve';
          if (!auditDetail) auditDetail = '批量审核通过';
          updateSql = `UPDATE invitation SET status = 'pending_final', reviewer_id = ?, reviewer_name = ?,
            review_comment = ?, version = version + 1, updated_at = datetime('now')
            WHERE id = ? AND version = ?`;
          updateParams = [dto.operatorId, user.name, auditDetail, id, inv.version];
        } else if (dto.action === 'reject') {
          if (dto.operatorRole !== 'reviewer') { failed.push({ id, reason: '只有审核主管可以退回' }); continue; }
          if (inv.status !== 'pending_review') { failed.push({ id, reason: '状态不是待审核' }); continue; }
          afterStatus = 'review_rejected';
          auditAction = 'reject';
          if (!auditDetail) auditDetail = '批量退回';
          updateSql = `UPDATE invitation SET status = 'review_rejected', reviewer_id = ?, reviewer_name = ?,
            review_comment = ?, version = version + 1, updated_at = datetime('now')
            WHERE id = ? AND version = ?`;
          updateParams = [dto.operatorId, user.name, auditDetail, id, inv.version];
        } else if (dto.action === 'review') {
          if (dto.operatorRole !== 'final_reviewer') { failed.push({ id, reason: '只有复核负责人可以复核归档' }); continue; }
          if (inv.status !== 'pending_final') { failed.push({ id, reason: '状态不是待复核' }); continue; }
          if (!inv.guest_confirmed) { failed.push({ id, reason: '嘉宾未确认' }); continue; }
          if (!inv.checkin_completed) { failed.push({ id, reason: '签到未完成' }); continue; }
          if (!inv.materials_complete) { failed.push({ id, reason: '材料不完整' }); continue; }
          afterStatus = 'archived';
          auditAction = 'review';
          if (!auditDetail) auditDetail = '批量复核归档';
          updateSql = `UPDATE invitation SET status = 'archived', final_reviewer_id = ?, final_reviewer_name = ?,
            final_comment = ?, version = version + 1, updated_at = datetime('now')
            WHERE id = ? AND version = ?`;
          updateParams = [dto.operatorId, user.name, auditDetail, id, inv.version];
        } else if (dto.action === 'review-reject') {
          if (dto.operatorRole !== 'final_reviewer') { failed.push({ id, reason: '只有复核负责人可以复核退回' }); continue; }
          if (inv.status !== 'pending_final') { failed.push({ id, reason: '状态不是待复核' }); continue; }
          afterStatus = 'final_rejected';
          auditAction = 'review-reject';
          if (!auditDetail) auditDetail = '批量复核退回';
          updateSql = `UPDATE invitation SET status = 'final_rejected', final_reviewer_id = ?, final_reviewer_name = ?,
            final_comment = ?, version = version + 1, updated_at = datetime('now')
            WHERE id = ? AND version = ?`;
          updateParams = [dto.operatorId, user.name, auditDetail, id, inv.version];
        } else if (dto.action === 'reprocess') {
          if (dto.operatorRole !== 'reviewer') { failed.push({ id, reason: '只有审核主管可以重新办理' }); continue; }
          if (inv.status !== 'final_rejected') { failed.push({ id, reason: '状态不是复核退回' }); continue; }
          if (!inv.guest_confirmed) { failed.push({ id, reason: '嘉宾未确认' }); continue; }
          if (!inv.materials_complete) { failed.push({ id, reason: '材料不完整' }); continue; }
          afterStatus = 'pending_review';
          auditAction = 'reprocess';
          if (!auditDetail) auditDetail = '批量重新办理';
          updateSql = `UPDATE invitation SET status = 'pending_review', version = version + 1, updated_at = datetime('now')
            WHERE id = ? AND version = ?`;
          updateParams = [id, inv.version];
        } else {
          failed.push({ id, reason: `不支持的操作: ${dto.action}` }); continue;
        }

        const result = this.db.prepare(updateSql).run(...updateParams);
        if (result.changes === 0) {
          this.createAuditLog({
            invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
            action: 'version_conflict', detail: `批量${dto.action}DB版本冲突(乐观锁)`,
            beforeStatus, afterStatus,
          });
          failed.push({ id, reason: '版本冲突，请刷新后重试' }); continue;
        }

        this.createAuditLog({
          invitationId: id, operatorId: dto.operatorId, operatorName: user.name, operatorRole: dto.operatorRole,
          action: auditAction, detail: auditDetail,
          beforeStatus, afterStatus,
        });

        success.push({ id, beforeStatus, afterStatus });
      } catch (e: any) {
        failed.push({ id, reason: e.message || '操作失败' });
      }
    }

    return { success, failed };
  }

  getStats(role?: string, operatorId?: string) {
    let baseQuery = 'SELECT status, COUNT(*) as count FROM invitation';
    const params: any[] = [];

    if (role && operatorId) {
      if (role === 'registrar') {
        baseQuery += ' WHERE creator_id = ?';
        params.push(operatorId);
      } else if (role === 'reviewer') {
        baseQuery += " WHERE status IN ('pending_review', 'review_rejected', 'final_rejected')";
      } else if (role === 'final_reviewer') {
        baseQuery += " WHERE status IN ('pending_final', 'final_rejected')";
      }
    }

    const statusRows = this.db.prepare(`${baseQuery} GROUP BY status`).all(...params) as { status: string; count: number }[];

    let urgencyBase = 'SELECT deadline FROM invitation';
    const urgencyParams: any[] = [];
    if (role && operatorId) {
      if (role === 'registrar') {
        urgencyBase += ' WHERE creator_id = ?';
        urgencyParams.push(operatorId);
      } else if (role === 'reviewer') {
        urgencyBase += " WHERE status IN ('pending_review', 'review_rejected', 'final_rejected')";
      } else if (role === 'final_reviewer') {
        urgencyBase += " WHERE status IN ('pending_final', 'final_rejected')";
      }
    }

    const deadlineRows = this.db.prepare(urgencyBase).all(...urgencyParams) as { deadline: string }[];
    const urgencyCounts: Record<string, number> = { overdue: 0, urgent: 0, normal: 0 };
    for (const row of deadlineRows) {
      const u = this.computeUrgency(row.deadline);
      urgencyCounts[u]++;
    }

    const total = statusRows.reduce((sum, r) => sum + r.count, 0);

    const statusMap: Record<string, number> = {};
    for (const r of statusRows) statusMap[r.status] = r.count;

    return {
      total,
      byStatus: statusMap,
      byUrgency: urgencyCounts,
    };
  }

  addMaterial(invitationId: string, file: Express.Multer.File, operatorId: string) {
    this.getInvitation(invitationId);
    const user = this.getUser(operatorId);
    if (!user) throw new BadRequestException('用户不存在');

    const id = uuidv4();
    const category = this.inferCategory(file.originalname);
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const fs = require('fs');
    const path = require('path');
    const destDir = path.join(uploadDir, invitationId);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, file.originalname);
    fs.writeFileSync(destPath, file.buffer);

    this.db.prepare(`
      INSERT INTO material (id, invitation_id, file_name, file_type, file_size, file_path, category, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, invitationId, file.originalname, file.mimetype, file.size, destPath, category, operatorId);

    this.updateMaterialsComplete(invitationId);

    return this.findOne(invitationId);
  }

  private inferCategory(fileName: string): string {
    if (fileName.includes('邀请函') || fileName.includes('邀请')) return '邀请函';
    if (fileName.includes('媒体资料') || fileName.includes('资料')) return '媒体资料';
    if (fileName.includes('活动方案') || fileName.includes('方案')) return '活动方案';
    return '其他';
  }

  guestConfirm(invitationId: string, dto: GuestConfirmDto) {
    const inv = this.getInvitation(invitationId);
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    const opRole = dto.operatorRole || user.role;
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== inv.version) {
      this.createAuditLog({
        invitationId, operatorId: dto.operatorId, operatorName: user.name, operatorRole: opRole,
        action: 'version_conflict', detail: `嘉宾确认版本冲突: 期望v${dto.expectedVersion}，当前v${inv.version}`,
        beforeStatus: inv.status, afterStatus: inv.status,
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    const result = this.db.prepare(`
      UPDATE invitation SET guest_confirmed = ?, version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(dto.confirmed ? 1 : 0, invitationId, inv.version);
    if (result.changes === 0) {
      this.createAuditLog({
        invitationId, operatorId: dto.operatorId, operatorName: user.name, operatorRole: opRole,
        action: 'version_conflict', detail: `嘉宾确认DB版本冲突(乐观锁)`,
        beforeStatus: inv.status, afterStatus: inv.status,
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    this.createAuditLog({
      invitationId, operatorId: dto.operatorId, operatorName: user.name, operatorRole: opRole,
      action: 'guest_confirm', detail: dto.confirmed ? '嘉宾已确认' : '嘉宾取消确认',
      beforeStatus: inv.status, afterStatus: inv.status,
    });

    return this.findOne(invitationId);
  }

  checkinFeedback(invitationId: string, dto: CheckinFeedbackDto) {
    const inv = this.getInvitation(invitationId);
    const user = this.getUser(dto.operatorId);
    if (!user) throw new BadRequestException('用户不存在');
    const opRole = dto.operatorRole || user.role;
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== inv.version) {
      this.createAuditLog({
        invitationId, operatorId: dto.operatorId, operatorName: user.name, operatorRole: opRole,
        action: 'version_conflict', detail: `签到反馈版本冲突: 期望v${dto.expectedVersion}，当前v${inv.version}`,
        beforeStatus: inv.status, afterStatus: inv.status,
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    const result = this.db.prepare(`
      UPDATE invitation SET checkin_completed = ?, version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND version = ?
    `).run(dto.completed ? 1 : 0, invitationId, inv.version);
    if (result.changes === 0) {
      this.createAuditLog({
        invitationId, operatorId: dto.operatorId, operatorName: user.name, operatorRole: opRole,
        action: 'version_conflict', detail: `签到反馈DB版本冲突(乐观锁)`,
        beforeStatus: inv.status, afterStatus: inv.status,
      });
      throw new ConflictException('版本冲突，请刷新后重试');
    }

    this.createAuditLog({
      invitationId, operatorId: dto.operatorId, operatorName: user.name, operatorRole: opRole,
      action: 'checkin_feedback', detail: dto.completed ? '签到完成' : '签到未完成',
      beforeStatus: inv.status, afterStatus: inv.status,
    });

    return this.findOne(invitationId);
  }
}
