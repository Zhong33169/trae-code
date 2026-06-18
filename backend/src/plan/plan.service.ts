import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Brackets } from 'typeorm';
import { PropagandaPlan } from '../entities/propaganda-plan.entity';
import { HandoverRecord } from '../entities/handover-record.entity';
import { OperationLog } from '../entities/operation-log.entity';
import { User } from '../entities/user.entity';
import {
  PlanStatus, UserRole, STATUS_NAME, SHIFT_NAME, ROLE_NAME, Shift,
  HandoverState, HANDOVER_STATE_NAME, PlanBucket, PLAN_BUCKET_NAME,
} from '../common/constants';
import { PaginatedResult } from '../common/dto';

const generatePlanNo = () => {
  const d = new Date();
  const s = d.getFullYear().toString()
    + (d.getMonth() + 1).toString().padStart(2, '0')
    + d.getDate().toString().padStart(2, '0')
    + d.getHours().toString().padStart(2, '0')
    + d.getMinutes().toString().padStart(2, '0');
  return 'PP' + s + Math.floor(Math.random() * 9000 + 1000).toString();
};

@Injectable()
export class PlanService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PropagandaPlan) private readonly planRepo: Repository<PropagandaPlan>,
    @InjectRepository(HandoverRecord) private readonly handoverRepo: Repository<HandoverRecord>,
    @InjectRepository(OperationLog) private readonly logRepo: Repository<OperationLog>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  private async addLog(
    planId: number | null, operatorId: number, action: string, description: string,
    beforeState?: any, afterState?: any,
  ) {
    await this.logRepo.save({
      planId, operatorId, action, description,
      beforeState: beforeState ? JSON.stringify(beforeState) : null,
      afterState: afterState ? JSON.stringify(afterState) : null,
    });
  }

  private getHandlerRoleByStatus(status: PlanStatus): UserRole | null {
    switch (status) {
      case PlanStatus.DRAFT:
      case PlanStatus.NEED_CORRECT:
      case PlanStatus.MATERIAL_REJECTED:
        return UserRole.REGISTER;
      case PlanStatus.PENDING_AUDIT:
      case PlanStatus.MATERIAL_PENDING:
        return UserRole.AUDIT;
      case PlanStatus.AUDIT_PASSED:
      case PlanStatus.MATERIAL_APPROVED:
      case PlanStatus.DELIVERY_PENDING:
        return UserRole.AUDIT;
      case PlanStatus.DELIVERY_CONFIRMED:
      case PlanStatus.ARCHIVED:
        return UserRole.REVIEW;
      default:
        return null;
    }
  }

  async list(
    user: User,
    params: {
      page?: number; pageSize?: number; keyword?: string; status?: PlanStatus; onlyMine?: boolean;
      handoverState?: HandoverState; receiverId?: number;
    },
  ): Promise<PaginatedResult<any>> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, params.pageSize || 20);
    const qb = this.planRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.createdBy', 'creator')
      .leftJoinAndSelect('p.currentHandler', 'handler')
      .leftJoinAndSelect('p.awaitingAccept', 'awa')
      .leftJoinAndSelect('awa.handFrom', 'awaF')
      .leftJoinAndSelect('awa.handTo', 'awaT')
      .leftJoinAndMapOne('p.latestHandover', HandoverRecord, 'lh',
        'lh.planId = p.id AND lh.id = (SELECT MAX(h2.id) FROM handover_records h2 WHERE h2.planId = p.id)')
      .leftJoinAndSelect('lh.handFrom', 'lhF')
      .leftJoinAndSelect('lh.handTo', 'lhT')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('p.id', 'DESC');

    if (params.keyword) {
      qb.andWhere(new Brackets(q => {
        q.where('p.planNo LIKE :k', { k: `%${params.keyword}%` })
          .orWhere('p.title LIKE :k', { k: `%${params.keyword}%` });
      }));
    }
    if (params.status) qb.andWhere('p.status = :st', { st: params.status });
    if (params.handoverState) {
      qb.andWhere('lh.state = :hs', { hs: params.handoverState });
    }
    if (params.receiverId) {
      qb.andWhere('lh.handToId = :rid', { rid: params.receiverId });
    }
    if (params.onlyMine) {
      qb.andWhere(new Brackets(q => {
        q.where('p.createdById = :uid', { uid: user.id })
          .orWhere('p.currentHandlerId = :uid', { uid: user.id })
          .orWhere('awaT.id = :uid', { uid: user.id })
          .orWhere('lhT.id = :uid AND lh.state = :accepted', { uid: user.id, accepted: HandoverState.ACCEPTED });
      }));
    }

    const [rows, total] = await qb.getManyAndCount();
    const list = rows.map(r => this.serializePlan(r, user));
    return { list, total, page, pageSize };
  }

  async detail(id: number, user: User) {
    const plan = await this.planRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.createdBy', 'creator')
      .leftJoinAndSelect('p.currentHandler', 'handler')
      .leftJoinAndSelect('p.awaitingAccept', 'awa')
      .leftJoinAndSelect('awa.handFrom', 'awaF')
      .leftJoinAndSelect('awa.handTo', 'awaT')
      .leftJoinAndMapMany('p.handovers', HandoverRecord, 'h', 'h.planId = p.id')
      .leftJoinAndSelect('h.handFrom', 'hf')
      .leftJoinAndSelect('h.handTo', 'ht')
      .leftJoinAndMapMany('p.logs', OperationLog, 'l', 'l.planId = p.id')
      .leftJoinAndSelect('l.operator', 'op')
      .where('p.id = :id', { id })
      .orderBy('h.id', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .getOne();
    if (!plan) throw new NotFoundException('传播计划单不存在');
    if (!plan.latestHandover && plan.handovers?.length) plan.latestHandover = plan.handovers[0];
    return this.serializePlanDetail(plan, user);
  }

  private serializeHandover(h: HandoverRecord) {
    return {
      id: h.id,
      state: h.state,
      stateName: HANDOVER_STATE_NAME[h.state],
      handFrom: h.handFrom ? { id: h.handFrom.id, realName: h.handFrom.realName } : null,
      handTo: h.handTo ? { id: h.handTo.id, realName: h.handTo.realName } : null,
      fromShift: h.fromShift,
      fromShiftName: SHIFT_NAME[h.fromShift],
      toShift: h.toShift,
      toShiftName: SHIFT_NAME[h.toShift],
      confirmTime: h.confirmTime,
      acceptedAt: h.acceptedAt,
      remark: h.remark,
      acceptRemark: h.acceptRemark,
      createdAt: h.createdAt,
    };
  }

  private serializePlan(p: PropagandaPlan, _user: User) {
    return {
      id: p.id,
      planNo: p.planNo,
      title: p.title,
      status: p.status,
      statusName: STATUS_NAME[p.status],
      channel: p.channel,
      planPublishTime: p.planPublishTime,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      createdBy: p.createdBy ? {
        id: p.createdBy.id, realName: p.createdBy.realName, role: p.createdBy.role,
        roleName: ROLE_NAME[p.createdBy.role as UserRole],
      } : null,
      currentHandler: p.currentHandler ? {
        id: p.currentHandler.id, realName: p.currentHandler.realName, role: p.currentHandler.role,
        roleName: ROLE_NAME[p.currentHandler.role as UserRole],
      } : null,
      currentHandlerRole: p.currentHandlerRole,
      currentHandlerRoleName: p.currentHandlerRole ? ROLE_NAME[p.currentHandlerRole] : null,
      awaitingAccept: p.awaitingAccept ? this.serializeHandover(p.awaitingAccept) : null,
      latestHandover: p.latestHandover ? this.serializeHandover(p.latestHandover) : null,
    };
  }

  private serializePlanDetail(p: PropagandaPlan, user: User) {
    const base = this.serializePlan(p, user);
    const permissions = this.getPermissions(p, user);
    const handovers = (p.handovers || []).map(h => this.serializeHandover(h));
    const logs = (p.logs || []).map(l => ({
      id: l.id,
      action: l.action,
      description: l.description,
      operator: l.operator ? { id: l.operator.id, realName: l.operator.realName, roleName: ROLE_NAME[l.operator.role as UserRole] } : null,
      createdAt: l.createdAt,
    }));
    return {
      ...base,
      content: p.content,
      targetAudience: p.targetAudience,
      materialInfo: p.materialInfo,
      auditRemark: p.auditRemark,
      materialRemark: p.materialRemark,
      deliveryRemark: p.deliveryRemark,
      reviewRemark: p.reviewRemark,
      auditTime: p.auditTime,
      materialTime: p.materialTime,
      deliveryTime: p.deliveryTime,
      archiveTime: p.archiveTime,
      handovers,
      logs,
      permissions,
      latestHandover: handovers[0] || null,
    };
  }

  private getPermissions(p: PropagandaPlan, user: User) {
    const s = p.status;
    const role = user.role;
    const result: Record<string, boolean> = {
      canEdit: false, canSubmitAudit: false, canAuditPass: false, canAuditReject: false,
      canMaterialSubmit: false, canMaterialApprove: false, canMaterialReject: false,
      canDeliveryConfirm: false, canArchive: false, canHandover: false, canAcceptHandover: false,
    };
    if (p.awaitingAccept) {
      if (p.awaitingAccept.state === HandoverState.PENDING_ACCEPT && p.awaitingAccept.handToId === user.id) {
        result.canAcceptHandover = true;
      }
      return result;
    }
    if (role === UserRole.REGISTER) {
      if (p.currentHandlerId === user.id) {
        if (s === PlanStatus.DRAFT || s === PlanStatus.NEED_CORRECT) {
          result.canEdit = true; result.canSubmitAudit = true;
        }
        if (s === PlanStatus.MATERIAL_REJECTED) {
          result.canEdit = true; result.canMaterialSubmit = true;
        }
        if (!this.isClosed(s)) {
          result.canHandover = true;
        }
      }
    } else if (role === UserRole.AUDIT) {
      if (s === PlanStatus.PENDING_AUDIT && p.currentHandlerId === user.id) {
        result.canAuditPass = true; result.canAuditReject = true;
      }
      if (s === PlanStatus.MATERIAL_PENDING && p.currentHandlerId === user.id) {
        result.canMaterialApprove = true; result.canMaterialReject = true;
      }
      if (s === PlanStatus.AUDIT_PASSED && p.currentHandlerId === user.id) {
        result.canMaterialSubmit = true;
      }
      if ((s === PlanStatus.MATERIAL_APPROVED || s === PlanStatus.DELIVERY_PENDING) && p.currentHandlerId === user.id) {
        result.canDeliveryConfirm = true;
      }
      if (p.currentHandlerId === user.id && !this.isClosed(s)) {
        result.canHandover = true;
      }
    } else if (role === UserRole.REVIEW) {
      if (s === PlanStatus.DELIVERY_CONFIRMED) {
        result.canArchive = true;
      }
    }
    return result;
  }

  private ensureNotAwaitingAccept(plan: PropagandaPlan, userId: number, action: string) {
    if (!plan.awaitingAccept) return;
    if (plan.awaitingAccept.state === HandoverState.PENDING_ACCEPT) {
      if (plan.awaitingAccept.handToId === userId) {
        throw new ForbiddenException(`该单据交接待接收；请先点击【确认接收】后再执行${action}`);
      }
      throw new ForbiddenException(
        `该单据当前交接给【${plan.awaitingAccept.handTo?.realName}】，处于【待接收】状态；` +
        `您不是接收人，无法执行${action}`,
      );
    }
  }

  private isClosed(s: PlanStatus) {
    return s === PlanStatus.ARCHIVED;
  }

  async create(user: User, data: { title: string; content?: string; channel?: string; targetAudience?: string; planPublishTime?: string }) {
    if (!data.title?.trim()) throw new BadRequestException('标题不能为空');
    const planNo = generatePlanNo();
    const plan = this.planRepo.create({
      planNo,
      title: data.title.trim(),
      content: data.content || null,
      channel: data.channel || null,
      targetAudience: data.targetAudience || null,
      planPublishTime: data.planPublishTime ? new Date(data.planPublishTime) : null,
      status: PlanStatus.DRAFT,
      currentHandlerRole: UserRole.REGISTER,
      currentHandlerId: user.id,
      createdById: user.id,
    });
    const saved = await this.planRepo.save(plan);
    await this.addLog(saved.id, user.id, 'CREATE', `创建传播计划单 ${planNo}`);
    return { id: saved.id, planNo: saved.planNo };
  }

  async update(id: number, user: User, data: any) {
    const plan = await this.planRepo.findOne({ where: { id }, relations: ['currentHandler', 'awaitingAccept', 'awaitingAccept.handTo'] });
    if (!plan) throw new NotFoundException('传播计划单不存在');
    this.ensureNotAwaitingAccept(plan, user.id, '编辑');
    const perms = this.getPermissions(plan, user);
    if (!perms.canEdit) {
      const why = user.role !== UserRole.REGISTER
        ? `当前岗位【${ROLE_NAME[user.role]}】无编辑权限（仅登记员可编辑草稿/补正单）`
        : plan.currentHandlerId !== user.id
          ? `该单据当前处理人为【${plan.currentHandler?.realName || plan.currentHandlerId}】，您不是当前处理人，无法编辑`
          : `当前状态【${STATUS_NAME[plan.status]}】不允许编辑；仅草稿、需补正、素材不通过状态允许编辑`;
      throw new ForbiddenException('无法编辑：' + why);
    }
    const before = { ...plan };
    if (data.title !== undefined) plan.title = data.title;
    if (data.content !== undefined) plan.content = data.content;
    if (data.channel !== undefined) plan.channel = data.channel;
    if (data.targetAudience !== undefined) plan.targetAudience = data.targetAudience;
    if (data.planPublishTime !== undefined) plan.planPublishTime = data.planPublishTime ? new Date(data.planPublishTime) : null;
    if (data.materialInfo !== undefined) plan.materialInfo = data.materialInfo;
    const saved = await this.planRepo.save(plan);
    await this.addLog(plan.id, user.id, 'UPDATE', `编辑传播计划单 ${plan.planNo}`, before, saved);
    return { id: saved.id };
  }

  async submitAudit(id: number, user: User) {
    return this.dataSource.transaction(async (mgr) => {
      const plan = await mgr.findOne(PropagandaPlan, { where: { id }, relations: ['currentHandler', 'awaitingAccept', 'awaitingAccept.handTo'] });
      if (!plan) throw new NotFoundException('传播计划单不存在');
      this.ensureNotAwaitingAccept(plan, user.id, '提交审核');
      if (user.role !== UserRole.REGISTER) {
        throw new ForbiddenException(`当前岗位【${ROLE_NAME[user.role]}】无提交审核权限；提交审核仅支持【传播计划登记员】`);
      }
      if (plan.status !== PlanStatus.DRAFT && plan.status !== PlanStatus.NEED_CORRECT) {
        throw new BadRequestException(`当前状态【${STATUS_NAME[plan.status]}】不允许提交审核；仅草稿或需补正状态可提交审核`);
      }
      if (plan.currentHandlerId !== user.id) {
        throw new ForbiddenException(`仅当前处理人可提交审核；当前处理人为【${plan.currentHandler?.realName || plan.currentHandlerId}】，您不是当前处理人`);
      }
      const before = { status: plan.status };
      plan.status = PlanStatus.PENDING_AUDIT;
      plan.currentHandlerRole = UserRole.AUDIT;
      plan.currentHandlerId = null;
      const saved = await mgr.save(plan);
      await mgr.save(OperationLog, {
        planId: plan.id, operatorId: user.id, action: 'SUBMIT_AUDIT',
        description: `提交审核：${plan.planNo}，进入待审核状态`,
        beforeState: JSON.stringify(before), afterState: JSON.stringify({ status: saved.status }),
      });
      return { id: saved.id, status: saved.status, statusName: STATUS_NAME[saved.status] };
    });
  }

  async audit(id: number, user: User, pass: boolean, remark?: string) {
    return this.dataSource.transaction(async (mgr) => {
      const plan = await mgr.findOne(PropagandaPlan, { where: { id }, relations: ['currentHandler', 'awaitingAccept', 'awaitingAccept.handTo'] });
      if (!plan) throw new NotFoundException('传播计划单不存在');
      this.ensureNotAwaitingAccept(plan, user.id, '审核');
      if (user.role !== UserRole.AUDIT) {
        throw new ForbiddenException(`当前岗位【${ROLE_NAME[user.role]}】无审核权限；审核仅支持【传播计划审核主管】`);
      }
      if (plan.status !== PlanStatus.PENDING_AUDIT) {
        throw new BadRequestException(`当前状态【${STATUS_NAME[plan.status]}】不允许审核；仅待审核状态可执行审核`);
      }
      if (plan.currentHandlerId && plan.currentHandlerId !== user.id) {
        throw new ForbiddenException(`该单据当前处理人为【${plan.currentHandler?.realName || plan.currentHandlerId}】，已被其他审核员接单，您无法重复处理`);
      }
      const before = { status: plan.status };
      if (pass) {
        plan.status = PlanStatus.AUDIT_PASSED;
        plan.currentHandlerRole = UserRole.AUDIT;
        plan.currentHandlerId = user.id;
      } else {
        plan.status = PlanStatus.NEED_CORRECT;
        plan.currentHandlerRole = UserRole.REGISTER;
        plan.currentHandlerId = plan.createdById;
      }
      plan.auditRemark = remark || null;
      plan.auditTime = new Date();
      const saved = await mgr.save(plan);
      await mgr.save(OperationLog, {
        planId: plan.id, operatorId: user.id,
        action: pass ? 'AUDIT_PASS' : 'AUDIT_REJECT',
        description: `审核${pass ? '通过' : '退回补正'}：${plan.planNo}${remark ? '，备注：' + remark : ''}`,
        beforeState: JSON.stringify(before), afterState: JSON.stringify({ status: saved.status }),
      });
      return { id: saved.id, status: saved.status, statusName: STATUS_NAME[saved.status] };
    });
  }

  async submitMaterial(id: number, user: User, data: { materialInfo?: string }) {
    return this.dataSource.transaction(async (mgr) => {
      const plan = await mgr.findOne(PropagandaPlan, { where: { id }, relations: ['currentHandler', 'awaitingAccept', 'awaitingAccept.handTo'] });
      if (!plan) throw new NotFoundException('传播计划单不存在');
      this.ensureNotAwaitingAccept(plan, user.id, '提交素材审核');
      if (plan.status !== PlanStatus.AUDIT_PASSED && plan.status !== PlanStatus.MATERIAL_REJECTED) {
        throw new BadRequestException(`当前状态【${STATUS_NAME[plan.status]}】不允许提交素材审核；仅审核通过 / 素材不通过状态可提交`);
      }
      if (user.role === UserRole.REGISTER && plan.currentHandlerId !== user.id) {
        throw new ForbiddenException(`登记员仅可提交自己当前持有的单据素材；当前处理人为【${plan.currentHandler?.realName || plan.currentHandlerId}】，您不是当前处理人`);
      }
      if (user.role === UserRole.AUDIT && plan.currentHandlerId !== user.id) {
        throw new ForbiddenException(`审核主管仅可提交自己持有的待办单据；当前处理人为【${plan.currentHandler?.realName || plan.currentHandlerId}】`);
      }
      if (user.role !== UserRole.REGISTER && user.role !== UserRole.AUDIT) {
        throw new ForbiddenException(`当前岗位【${ROLE_NAME[user.role]}】无提交素材权限`);
      }
      if (data.materialInfo) plan.materialInfo = data.materialInfo;
      if (!plan.materialInfo?.trim()) throw new BadRequestException('素材信息不能为空');
      const before = { status: plan.status };
      plan.status = PlanStatus.MATERIAL_PENDING;
      plan.currentHandlerRole = UserRole.AUDIT;
      plan.currentHandlerId = null;
      const saved = await mgr.save(plan);
      await mgr.save(OperationLog, {
        planId: plan.id, operatorId: user.id, action: 'SUBMIT_MATERIAL',
        description: `提交素材审核：${plan.planNo}，进入待素材审核`,
        beforeState: JSON.stringify(before), afterState: JSON.stringify({ status: saved.status }),
      });
      return { id: saved.id, status: saved.status, statusName: STATUS_NAME[saved.status] };
    });
  }

  async auditMaterial(id: number, user: User, pass: boolean, remark?: string) {
    return this.dataSource.transaction(async (mgr) => {
      const plan = await mgr.findOne(PropagandaPlan, { where: { id }, relations: ['currentHandler', 'awaitingAccept', 'awaitingAccept.handTo'] });
      if (!plan) throw new NotFoundException('传播计划单不存在');
      this.ensureNotAwaitingAccept(plan, user.id, '素材审核');
      if (user.role !== UserRole.AUDIT) {
        throw new ForbiddenException(`当前岗位【${ROLE_NAME[user.role]}】无素材审核权限；仅【传播计划审核主管】可执行素材审核`);
      }
      if (plan.status !== PlanStatus.MATERIAL_PENDING) {
        throw new BadRequestException(`当前状态【${STATUS_NAME[plan.status]}】不允许素材审核；仅待素材审核状态可执行`);
      }
      if (plan.currentHandlerId && plan.currentHandlerId !== user.id) {
        throw new ForbiddenException(`该单据当前处理人为【${plan.currentHandler?.realName || plan.currentHandlerId}】，已被其他审核员处理`);
      }
      const before = { status: plan.status };
      if (pass) {
        plan.status = PlanStatus.MATERIAL_APPROVED;
        plan.currentHandlerRole = UserRole.AUDIT;
        plan.currentHandlerId = user.id;
      } else {
        plan.status = PlanStatus.MATERIAL_REJECTED;
        plan.currentHandlerRole = UserRole.REGISTER;
        plan.currentHandlerId = plan.createdById;
      }
      plan.materialRemark = remark || null;
      plan.materialTime = new Date();
      const saved = await mgr.save(plan);
      await mgr.save(OperationLog, {
        planId: plan.id, operatorId: user.id,
        action: pass ? 'MATERIAL_PASS' : 'MATERIAL_REJECT',
        description: `素材审核${pass ? '通过' : '不通过'}：${plan.planNo}${remark ? '，备注：' + remark : ''}`,
        beforeState: JSON.stringify(before), afterState: JSON.stringify({ status: saved.status }),
      });
      return { id: saved.id, status: saved.status, statusName: STATUS_NAME[saved.status] };
    });
  }

  async confirmDelivery(id: number, user: User, remark?: string) {
    return this.dataSource.transaction(async (mgr) => {
      const plan = await mgr.findOne(PropagandaPlan, { where: { id }, relations: ['currentHandler', 'awaitingAccept', 'awaitingAccept.handTo'] });
      if (!plan) throw new NotFoundException('传播计划单不存在');
      this.ensureNotAwaitingAccept(plan, user.id, '投放确认');
      if (user.role !== UserRole.AUDIT) {
        throw new ForbiddenException(`当前岗位【${ROLE_NAME[user.role]}】无投放确认权限；仅【传播计划审核主管】可确认投放`);
      }
      if (plan.status !== PlanStatus.MATERIAL_APPROVED && plan.status !== PlanStatus.DELIVERY_PENDING) {
        throw new BadRequestException(`当前状态【${STATUS_NAME[plan.status]}】不允许确认投放；仅素材通过/待投放确认状态可执行`);
      }
      if (plan.currentHandlerId !== user.id) {
        throw new ForbiddenException(`投放确认必须由当前处理人【${plan.currentHandler?.realName || plan.currentHandlerId}】执行`);
      }
      const before = { status: plan.status };
      plan.status = PlanStatus.DELIVERY_CONFIRMED;
      plan.currentHandlerRole = UserRole.REVIEW;
      plan.currentHandlerId = null;
      plan.deliveryRemark = remark || null;
      plan.deliveryTime = new Date();
      const saved = await mgr.save(plan);
      await mgr.save(OperationLog, {
        planId: plan.id, operatorId: user.id, action: 'DELIVERY_CONFIRM',
        description: `确认投放：${plan.planNo}${remark ? '，备注：' + remark : ''}`,
        beforeState: JSON.stringify(before), afterState: JSON.stringify({ status: saved.status }),
      });
      return { id: saved.id, status: saved.status, statusName: STATUS_NAME[saved.status] };
    });
  }

  async archive(id: number, user: User, remark?: string) {
    return this.dataSource.transaction(async (mgr) => {
      const plan = await mgr.findOne(PropagandaPlan, { where: { id }, relations: ['awaitingAccept', 'awaitingAccept.handTo'] });
      if (!plan) throw new NotFoundException('传播计划单不存在');
      this.ensureNotAwaitingAccept(plan, user.id, '归档');
      if (user.role !== UserRole.REVIEW) {
        throw new ForbiddenException(`当前岗位【${ROLE_NAME[user.role]}】无归档权限；复核归档仅支持【公关传播团队复核负责人】`);
      }
      if (plan.status !== PlanStatus.DELIVERY_CONFIRMED) {
        throw new BadRequestException(`当前状态【${STATUS_NAME[plan.status]}】不允许归档；只有投放已确认的单据才能复核归档（闭环终点）`);
      }
      const before = { status: plan.status };
      plan.status = PlanStatus.ARCHIVED;
      plan.currentHandlerRole = UserRole.REVIEW;
      plan.currentHandlerId = user.id;
      plan.reviewRemark = remark || null;
      plan.archiveTime = new Date();
      const saved = await mgr.save(plan);
      await mgr.save(OperationLog, {
        planId: plan.id, operatorId: user.id, action: 'ARCHIVE',
        description: `复核归档：${plan.planNo}，流程闭环完成${remark ? '，备注：' + remark : ''}`,
        beforeState: JSON.stringify(before), afterState: JSON.stringify({ status: saved.status }),
      });
      return { id: saved.id, status: saved.status, statusName: STATUS_NAME[saved.status] };
    });
  }

  async handover(
    planId: number, user: User,
    data: { toUserId: number; fromShift: Shift; toShift: Shift; remark?: string },
  ) {
    return this.dataSource.transaction(async (mgr) => {
      const plan = await mgr.findOne(PropagandaPlan, { where: { id: planId }, relations: ['currentHandler', 'awaitingAccept', 'awaitingAccept.handTo'] });
      if (!plan) throw new NotFoundException('传播计划单不存在');
      this.ensureNotAwaitingAccept(plan, user.id, '交接');
      const VALID_SHIFTS = [Shift.MORNING, Shift.AFTERNOON, Shift.NIGHT];
      if (!VALID_SHIFTS.includes(data.fromShift)) {
        throw new BadRequestException(`fromShift 必须是 MORNING/AFTERNOON/NIGHT，收到：${data.fromShift}`);
      }
      if (!VALID_SHIFTS.includes(data.toShift)) {
        throw new BadRequestException(`toShift 必须是 MORNING/AFTERNOON/NIGHT，收到：${data.toShift}`);
      }
      if (this.isClosed(plan.status)) {
        throw new BadRequestException(`当前状态【${STATUS_NAME[plan.status]}】已归档，流程闭环，不允许交接`);
      }
      if (plan.currentHandlerId !== user.id) {
        throw new ForbiddenException(
          `仅当前处理人可发起交接；当前处理人为【${plan.currentHandler?.realName || plan.currentHandlerId}】`,
        );
      }
      const toUser = await mgr.findOne(User, { where: { id: data.toUserId, active: true } });
      if (!toUser) throw new BadRequestException(`接收人 ID=${data.toUserId} 不存在或已禁用`);
      if (toUser.role !== plan.currentHandlerRole) {
        throw new BadRequestException(
          `接收人岗位必须为【${ROLE_NAME[plan.currentHandlerRole]}】；` +
          `当前接收人【${toUser.realName}】岗位为【${ROLE_NAME[toUser.role as UserRole]}】，不匹配`,
        );
      }
      if (toUser.id === user.id) throw new BadRequestException('交接双方不能为同一人，请选择其他同事');

      const confirmTime = new Date();
      const savedHandover = await mgr.save(HandoverRecord, {
        planId,
        handFromId: user.id,
        handToId: toUser.id,
        fromShift: data.fromShift,
        toShift: data.toShift,
        state: HandoverState.PENDING_ACCEPT,
        confirmTime,
        remark: data.remark || null,
      });
      const before = { currentHandlerId: plan.currentHandlerId, awaitingAcceptId: plan.awaitingAcceptId };
      plan.currentHandlerId = toUser.id;
      plan.awaitingAcceptId = savedHandover.id;
      plan.updatedAt = new Date();
      const saved = await mgr.save(plan);
      await mgr.save(OperationLog, {
        planId: plan.id, operatorId: user.id, action: 'HANDOVER',
        description: `${SHIFT_NAME[data.fromShift]}${user.realName} → ${SHIFT_NAME[data.toShift]}${toUser.realName}，已提交交接，待${toUser.realName}确认接收${data.remark ? '，备注：' + data.remark : ''}`,
        beforeState: JSON.stringify(before),
        afterState: JSON.stringify({
          currentHandlerId: toUser.id,
          awaitingAcceptId: savedHandover.id,
          handTo: toUser.realName,
          confirmTime,
        }),
      });
      return {
        id: saved.id,
        awaitingAccept: {
          id: savedHandover.id,
          state: HandoverState.PENDING_ACCEPT,
          stateName: HANDOVER_STATE_NAME[HandoverState.PENDING_ACCEPT],
          handFrom: { id: user.id, realName: user.realName },
          handTo: { id: toUser.id, realName: toUser.realName },
          fromShift: data.fromShift,
          fromShiftName: SHIFT_NAME[data.fromShift],
          toShift: data.toShift,
          toShiftName: SHIFT_NAME[data.toShift],
          confirmTime,
          remark: data.remark || null,
        },
      };
    });
  }

  async acceptHandover(planId: number, user: User, data: { acceptRemark?: string }) {
    await this.dataSource.transaction(async (mgr) => {
      const plan = await mgr.findOne(PropagandaPlan, {
        where: { id: planId },
        relations: ['awaitingAccept', 'awaitingAccept.handFrom', 'awaitingAccept.handTo'],
      });
      if (!plan) throw new NotFoundException('传播计划单不存在');
      if (!plan.awaitingAccept) {
        throw new BadRequestException('该单据当前没有待接收的交接');
      }
      if (plan.awaitingAccept.state !== HandoverState.PENDING_ACCEPT) {
        throw new BadRequestException(
          `交接状态为【${HANDOVER_STATE_NAME[plan.awaitingAccept.state]}】，无需再次确认`,
        );
      }
      if (plan.awaitingAccept.handToId !== user.id) {
        throw new ForbiddenException(
          `该交接指定接收人为【${plan.awaitingAccept.handTo?.realName}】，` +
          `您不是指定接收人，无法确认接收`,
        );
      }
      const acceptedAt = new Date();
      plan.awaitingAccept.state = HandoverState.ACCEPTED;
      plan.awaitingAccept.acceptedAt = acceptedAt;
      plan.awaitingAccept.acceptRemark = data.acceptRemark || null;
      await mgr.save(HandoverRecord, plan.awaitingAccept);
      const before = { awaitingAcceptId: plan.awaitingAcceptId };
      const toShift = plan.awaitingAccept.toShift;
      plan.awaitingAcceptId = null;
      plan.awaitingAccept = null as any;
      plan.updatedAt = new Date();
      await mgr.save(plan);
      await mgr.save(OperationLog, {
        planId: plan.id, operatorId: user.id, action: 'ACCEPT_HANDOVER',
        description: `${SHIFT_NAME[toShift]}${user.realName}已确认接收，可继续办理${data.acceptRemark ? '，备注：' + data.acceptRemark : ''}`,
        beforeState: JSON.stringify(before),
        afterState: JSON.stringify({ awaitingAcceptId: null, acceptedAt }),
      });
    });
    return this.detail(planId, user);
  }

  async listReceivers(role: UserRole, excludeUserId?: number) {
    const where: any = { role, active: true };
    const rows = await this.userRepo.find({ where });
    return rows.filter(r => r.id !== excludeUserId).map(r => ({
      id: r.id, realName: r.realName, username: r.username,
      role: r.role, roleName: ROLE_NAME[r.role as UserRole],
    }));
  }

  async batchAudit(user: User, ids: number[], pass: boolean, remark?: string) {
    if (!ids?.length) throw new BadRequestException('请选择单据');
    if (user.role !== UserRole.AUDIT) throw new ForbiddenException('仅审核主管可批量操作');
    const results = [];
    for (const id of ids) {
      try {
        const r = await this.audit(id, user, pass, remark);
        results.push({ id, success: true, ...r });
      } catch (e: any) {
        results.push({ id, success: false, message: e.message });
      }
    }
    return results;
  }

  async statistics(_user: User) {
    const all = await this.planRepo.find({ select: ['status', 'currentHandlerRole', 'createdAt', 'awaitingAcceptId'] });
    const byStatus: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    const byBucket: Record<string, number> = { [PlanBucket.PENDING_ACCEPT]: 0, [PlanBucket.PROCESSING]: 0, [PlanBucket.ARCHIVED]: 0 };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let todayCount = 0; let closedCount = 0;
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      if (r.currentHandlerRole) byRole[r.currentHandlerRole] = (byRole[r.currentHandlerRole] || 0) + 1;
      if (r.createdAt >= today) todayCount++;
      if (r.status === PlanStatus.ARCHIVED) {
        closedCount++;
        byBucket[PlanBucket.ARCHIVED]++;
      } else if (r.awaitingAcceptId) {
        byBucket[PlanBucket.PENDING_ACCEPT]++;
      } else {
        byBucket[PlanBucket.PROCESSING]++;
      }
    }
    const handovers = await this.handoverRepo.find({ relations: ['handFrom', 'handTo'], order: { id: 'DESC' }, take: 10 });
    const handoverTotal = await this.handoverRepo.count();
    const handoverByState: Record<string, number> = { [HandoverState.PENDING_ACCEPT]: 0, [HandoverState.ACCEPTED]: 0 };
    const handoverByFromRole: Record<string, number> = {};
    const handoverByFromShift: Record<string, number> = {};
    const handoverByToRole: Record<string, number> = {};
    const handoverByToShift: Record<string, number> = {};
    for (const h of handovers) {
      handoverByState[h.state] = (handoverByState[h.state] || 0) + 1;
      if (h.handFrom?.role) handoverByFromRole[h.handFrom.role] = (handoverByFromRole[h.handFrom.role] || 0) + 1;
      if (h.fromShift) handoverByFromShift[h.fromShift] = (handoverByFromShift[h.fromShift] || 0) + 1;
      if (h.handTo?.role) handoverByToRole[h.handTo.role] = (handoverByToRole[h.handTo.role] || 0) + 1;
      if (h.toShift) handoverByToShift[h.toShift] = (handoverByToShift[h.toShift] || 0) + 1;
    }
    const allHandovers = await this.handoverRepo.find({ relations: ['handFrom', 'handTo'] });
    for (const h of allHandovers.slice(10)) {
      handoverByState[h.state] = (handoverByState[h.state] || 0) + 1;
      if (h.handFrom?.role) handoverByFromRole[h.handFrom.role] = (handoverByFromRole[h.handFrom.role] || 0) + 1;
      if (h.fromShift) handoverByFromShift[h.fromShift] = (handoverByFromShift[h.fromShift] || 0) + 1;
      if (h.handTo?.role) handoverByToRole[h.handTo.role] = (handoverByToRole[h.handTo.role] || 0) + 1;
      if (h.toShift) handoverByToShift[h.toShift] = (handoverByToShift[h.toShift] || 0) + 1;
    }
    const latestHandoverLogs = handovers.slice(0, 10).map(h => ({
      id: h.id, planId: h.planId, state: h.state, stateName: HANDOVER_STATE_NAME[h.state],
      handFrom: h.handFrom ? { id: h.handFrom.id, realName: h.handFrom.realName, role: h.handFrom.role, roleName: ROLE_NAME[h.handFrom.role] } : null,
      handTo: h.handTo ? { id: h.handTo.id, realName: h.handTo.realName, role: h.handTo.role, roleName: ROLE_NAME[h.handTo.role] } : null,
      fromShift: h.fromShift, fromShiftName: SHIFT_NAME[h.fromShift],
      toShift: h.toShift, toShiftName: SHIFT_NAME[h.toShift],
      confirmTime: h.confirmTime, acceptedAt: h.acceptedAt, remark: h.remark, acceptRemark: h.acceptRemark,
    }));
    const handoverFromRoleLabels: Record<string, string> = {};
    const handoverToRoleLabels: Record<string, string> = {};
    Object.keys(ROLE_NAME).forEach(k => { handoverFromRoleLabels[k] = ROLE_NAME[k as UserRole]; handoverToRoleLabels[k] = ROLE_NAME[k as UserRole]; });
    const handoverFromShiftLabels: Record<string, string> = {};
    const handoverToShiftLabels: Record<string, string> = {};
    Object.keys(SHIFT_NAME).forEach(k => { handoverFromShiftLabels[k] = SHIFT_NAME[k as Shift]; handoverToShiftLabels[k] = SHIFT_NAME[k as Shift]; });
    const handoverStateLabels: Record<string, string> = {};
    Object.keys(HANDOVER_STATE_NAME).forEach(k => { handoverStateLabels[k] = HANDOVER_STATE_NAME[k as HandoverState]; });
    const statusLabels: Record<string, string> = {};
    Object.keys(STATUS_NAME).forEach(k => { statusLabels[k] = STATUS_NAME[k as PlanStatus]; });
    const roleLabels: Record<string, string> = {};
    Object.keys(ROLE_NAME).forEach(k => { roleLabels[k] = ROLE_NAME[k as UserRole]; });
    const bucketLabels: Record<string, string> = {};
    Object.keys(PLAN_BUCKET_NAME).forEach(k => { bucketLabels[k] = PLAN_BUCKET_NAME[k as PlanBucket]; });
    return {
      total: all.length,
      todayCount,
      closedCount,
      pendingCount: all.length - closedCount,
      closedRate: all.length ? +(closedCount / all.length * 100).toFixed(1) : 0,
      byStatus,
      statusLabels,
      byRole,
      roleLabels,
      byBucket,
      bucketLabels,
      handoverTotal,
      handoverByState,
      handoverStateLabels,
      handoverByFromRole,
      handoverFromRoleLabels,
      handoverByFromShift,
      handoverFromShiftLabels,
      handoverByToRole,
      handoverToRoleLabels,
      handoverByToShift,
      handoverToShiftLabels,
      latestHandoverLogs,
    };
  }
}
