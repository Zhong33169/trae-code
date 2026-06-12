import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { OrderRepository } from '../infrastructure/order.repository';
import { UserRepository } from '../infrastructure/user.repository';
import { VenueOrder } from '../domain/venue-order.entity';
import {
  OrderAction,
  OrderStatus,
  Role,
  ScanCodeError,
  ScanCodeErrorMessages,
  AuditLog,
  MaterialItem,
  BatchProcessResult,
} from '../types';

interface ProcessOrderRequest {
  orderId: string;
  operatorId: string;
  action: OrderAction;
  comment: string;
  materials?: MaterialItem[];
  ipAddress?: string;
}

interface BatchProcessRequest {
  orderIds: string[];
  operatorId: string;
  action: OrderAction;
  comment: string;
  ipAddress?: string;
}



@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getOrderList(filters?: {
    status?: OrderStatus[];
    handlerRole?: Role;
    handlerId?: string;
  }) {
    const orders = await this.orderRepository.findAll(filters);
    return {
      total: orders.length,
      items: orders.map((o) => this.toOrderDto(o)),
    };
  }

  async getOrderDetail(orderId: string, operatorId: string) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new BadRequestException({
        error: ScanCodeError.ORDER_NOT_FOUND,
        message: ScanCodeErrorMessages[ScanCodeError.ORDER_NOT_FOUND],
      });
    }

    const operator = await this.userRepository.findById(operatorId);
    if (!operator) {
      throw new ForbiddenException('操作人不存在');
    }

    const canAccess = this.canUserAccessOrder(operator.role, order);
    if (!canAccess) {
      throw new ForbiddenException({
        error: ScanCodeError.UNAUTHORIZED_ROLE,
        message: ScanCodeErrorMessages[ScanCodeError.UNAUTHORIZED_ROLE],
        details: {
          yourRole: operator.role,
          orderStatus: order.status,
        },
      });
    }

    return this.toOrderDetailDto(order);
  }

  async submitRegistration(dto: {
    venueName: string;
    venueType: string;
    bookingDate: string;
    bookingTime: string;
    applicantName: string;
    applicantPhone: string;
    applicantIdCard: string;
    materials: MaterialItem[];
    comment: string;
    operatorId: string;
  }) {
    const operator = await this.userRepository.findById(dto.operatorId);
    if (!operator || operator.role !== Role.REGISTRAR) {
      throw new ForbiddenException('只有场地登记员可以提交登记');
    }

    const orderNo = this.generateOrderNo();
    const qrCode = this.generateQrCode(orderNo);

    const requiredMaterials = [
      { name: '身份证复印件', type: 'id_card', required: true },
      { name: '场地使用申请书', type: 'application', required: true },
    ];

    const materials: MaterialItem[] = requiredMaterials.map((rm) => ({
      id: uuidv4(),
      name: rm.name,
      type: rm.type,
      required: rm.required,
      uploaded: dto.materials?.find((m) => m.type === rm.type)?.uploaded || false,
      url: dto.materials?.find((m) => m.type === rm.type)?.url,
    }));

    const order = new VenueOrder({
      orderNo,
      qrCode,
      venueName: dto.venueName,
      venueType: dto.venueType,
      bookingDate: dto.bookingDate,
      bookingTime: dto.bookingTime,
      applicantName: dto.applicantName,
      applicantPhone: dto.applicantPhone,
      applicantIdCard: dto.applicantIdCard,
      status: OrderStatus.DRAFT,
      currentHandlerRole: Role.REGISTRAR,
      currentHandlerId: operator.id,
      currentHandlerName: operator.name,
      materials,
      timeLimit: {
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        remainingHours: 24,
        isOverdue: false,
      },
      registrationOpinion: dto.comment,
    });

    if (!order.hasAllRequiredMaterials()) {
      order.status = OrderStatus.PENDING_CORRECTION;
      order.correctionRequest = '请补充缺失的必填材料';
    } else {
      order.status = OrderStatus.PENDING_REVIEW;
      order.currentHandlerRole = Role.SUPERVISOR;
      const supervisors = await this.userRepository.findByRole(Role.SUPERVISOR);
      if (supervisors.length > 0) {
        order.currentHandlerId = supervisors[0].id;
        order.currentHandlerName = supervisors[0].name;
      }
    }

    this.addAuditLog(order, {
      action: OrderAction.SUBMIT_REGISTRATION,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      comment: dto.comment,
      oldStatus: OrderStatus.DRAFT,
      newStatus: order.status,
    });

    const saved = await this.orderRepository.save(order);
    return this.toOrderDetailDto(saved);
  }

  async processOrder(request: ProcessOrderRequest) {
    const { orderId, operatorId, action, comment, materials, ipAddress } = request;

    const lockAcquired = await this.orderRepository.acquireLock(orderId, operatorId);
    if (!lockAcquired) {
      const holder = await this.orderRepository.getLockHolder(orderId);
      const holderUser = holder ? await this.userRepository.findById(holder) : null;
      throw new BadRequestException({
        error: ScanCodeError.CONCURRENT_MODIFICATION,
        message: ScanCodeErrorMessages[ScanCodeError.CONCURRENT_MODIFICATION],
        details: {
          lockHolder: holderUser?.name || '未知用户',
        },
      });
    }

    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        throw new BadRequestException({
          error: ScanCodeError.ORDER_NOT_FOUND,
          message: ScanCodeErrorMessages[ScanCodeError.ORDER_NOT_FOUND],
        });
      }

      const operator = await this.userRepository.findById(operatorId);
      if (!operator) {
        throw new ForbiddenException('操作人不存在');
      }

      if (order.currentHandlerId !== operatorId) {
        throw new ForbiddenException({
          error: ScanCodeError.NOT_CURRENT_HANDLER,
          message: ScanCodeErrorMessages[ScanCodeError.NOT_CURRENT_HANDLER],
        });
      }

      if (!order.canTransition(action)) {
        throw new BadRequestException({
          error: ScanCodeError.WRONG_STATUS,
          message: ScanCodeErrorMessages[ScanCodeError.WRONG_STATUS],
          details: {
            currentStatus: order.status,
            attemptedAction: action,
            allowedActions: this.getAllowedActions(order.status),
          },
        });
      }

      if (materials) {
        order.materials = order.materials.map((m) => {
          const updated = materials.find((um) => um.id === m.id || um.type === m.type);
          return updated ? { ...m, ...updated } : m;
        });
      }

      if (
        (action === OrderAction.SUBMIT_REGISTRATION ||
          action === OrderAction.SUBMIT_CORRECTION) &&
        !order.hasAllRequiredMaterials()
      ) {
        const missing = order.getMissingMaterials();
        throw new BadRequestException({
          error: ScanCodeError.EVIDENCE_MISSING,
          message: ScanCodeErrorMessages[ScanCodeError.EVIDENCE_MISSING],
          details: {
            missingMaterials: missing.map((m) => ({ name: m.name, type: m.type })),
          },
        });
      }

      const oldStatus = order.status;
      const newStatus = order.getNextStatus(action);
      if (!newStatus) {
        throw new BadRequestException('无法获取下一个状态');
      }

      this.updateOpinionByAction(order, action, comment);

      if (action === OrderAction.REQUEST_CORRECTION) {
        order.correctionRequest = comment;
        order.timeLimit = {
          deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          remainingHours: 12,
          isOverdue: false,
        };
      }

      order.status = newStatus;
      this.updateHandlerByStatus(order, newStatus);

      this.addAuditLog(order, {
        action,
        operatorId: operator.id,
        operatorName: operator.name,
        operatorRole: operator.role,
        comment,
        oldStatus,
        newStatus,
        ipAddress,
      });

      const saved = await this.orderRepository.save(order);
      return this.toOrderDetailDto(saved);
    } finally {
      await this.orderRepository.releaseLock(orderId);
    }
  }

  async batchProcess(request: BatchProcessRequest): Promise<BatchProcessResult> {
    const result: BatchProcessResult = {
      success: [],
      failed: [],
    };

    for (const orderId of request.orderIds) {
      try {
        await this.processOrder({
          ...request,
          orderId,
        });
        result.success.push(orderId);
      } catch (error: any) {
        const order = await this.orderRepository.findById(orderId);
        result.failed.push({
          orderId,
          orderNo: order?.orderNo || '未知',
          error: error.response?.message || error.message || '处理失败',
          details: error.response?.details || null,
        });
      }
    }

    return result;
  }

  async getStatistics(operatorId: string) {
    const operator = await this.userRepository.findById(operatorId);
    if (!operator) {
      throw new ForbiddenException('操作人不存在');
    }

    const allOrders = await this.orderRepository.findAll();

    const stats = {
      total: allOrders.length,
      pendingCorrection: allOrders.filter(
        (o) => o.status === OrderStatus.PENDING_CORRECTION,
      ).length,
      pendingReview: allOrders.filter(
        (o) => o.status === OrderStatus.PENDING_REVIEW,
      ).length,
      pendingFinalReview: allOrders.filter(
        (o) => o.status === OrderStatus.PENDING_FINAL_REVIEW,
      ).length,
      archived: allOrders.filter((o) => o.status === OrderStatus.ARCHIVED).length,
      rejected: allOrders.filter((o) => o.status === OrderStatus.REJECTED).length,
      myTasks: allOrders.filter((o) => o.currentHandlerId === operatorId).length,
      overdue: allOrders.filter((o) => o.isOverdue()).length,
    };

    return {
      stats,
      role: operator.role,
      roleName: this.getRoleLabel(operator.role),
    };
  }

  async getAuditLogs(orderId: string) {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new BadRequestException('订单不存在');
    }

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      logs: order.auditLogs.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    };
  }

  private generateOrderNo(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `VD${year}${month}${random}`;
  }

  private generateQrCode(orderNo: string): string {
    return `QR-${orderNo}`;
  }

  private canUserAccessOrder(role: Role, order: VenueOrder): boolean {
    const permissions: Record<Role, OrderStatus[]> = {
      [Role.REGISTRAR]: [
        OrderStatus.DRAFT,
        OrderStatus.PENDING_REGISTRATION,
        OrderStatus.PENDING_CORRECTION,
      ],
      [Role.SUPERVISOR]: [OrderStatus.PENDING_REVIEW],
      [Role.REVIEWER]: [
        OrderStatus.PENDING_FINAL_REVIEW,
        OrderStatus.ARCHIVED,
        OrderStatus.REJECTED,
      ],
    };

    return (
      permissions[role]?.includes(order.status) ||
      order.auditLogs.some((log) => log.operatorRole === role)
    );
  }

  private getAllowedActions(status: OrderStatus): OrderAction[] {
    const actions: Record<OrderStatus, OrderAction[]> = {
      [OrderStatus.DRAFT]: [OrderAction.SUBMIT_REGISTRATION],
      [OrderStatus.PENDING_REGISTRATION]: [OrderAction.SUBMIT_REGISTRATION],
      [OrderStatus.PENDING_CORRECTION]: [OrderAction.SUBMIT_CORRECTION],
      [OrderStatus.PENDING_REVIEW]: [
        OrderAction.APPROVE_REVIEW,
        OrderAction.REQUEST_CORRECTION,
        OrderAction.REJECT_REVIEW,
      ],
      [OrderStatus.PENDING_FINAL_REVIEW]: [
        OrderAction.APPROVE_FINAL_REVIEW,
        OrderAction.REJECT_FINAL_REVIEW,
      ],
      [OrderStatus.ARCHIVED]: [],
      [OrderStatus.REJECTED]: [],
    };
    return actions[status] || [];
  }

  private updateOpinionByAction(
    order: VenueOrder,
    action: OrderAction,
    comment: string,
  ) {
    switch (action) {
      case OrderAction.SUBMIT_REGISTRATION:
      case OrderAction.SUBMIT_CORRECTION:
        order.registrationOpinion = comment;
        break;
      case OrderAction.APPROVE_REVIEW:
      case OrderAction.REQUEST_CORRECTION:
      case OrderAction.REJECT_REVIEW:
        order.reviewOpinion = comment;
        break;
      case OrderAction.APPROVE_FINAL_REVIEW:
      case OrderAction.REJECT_FINAL_REVIEW:
        order.finalReviewOpinion = comment;
        break;
    }
  }

  private async updateHandlerByStatus(order: VenueOrder, newStatus: OrderStatus) {
    const roleMap: Record<OrderStatus, Role | null> = {
      [OrderStatus.DRAFT]: Role.REGISTRAR,
      [OrderStatus.PENDING_REGISTRATION]: Role.REGISTRAR,
      [OrderStatus.PENDING_CORRECTION]: Role.REGISTRAR,
      [OrderStatus.PENDING_REVIEW]: Role.SUPERVISOR,
      [OrderStatus.PENDING_FINAL_REVIEW]: Role.REVIEWER,
      [OrderStatus.ARCHIVED]: null,
      [OrderStatus.REJECTED]: null,
    };

    const targetRole = roleMap[newStatus];
    if (targetRole) {
      const users = await this.userRepository.findByRole(targetRole);
      if (users.length > 0) {
        const randomIndex = Math.floor(Math.random() * users.length);
        order.currentHandlerRole = targetRole;
        order.currentHandlerId = users[randomIndex].id;
        order.currentHandlerName = users[randomIndex].name;
      }
    }
  }

  private addAuditLog(order: VenueOrder, log: Omit<AuditLog, 'id' | 'orderId' | 'timestamp'>) {
    const auditLog: AuditLog = {
      id: uuidv4(),
      orderId: order.id,
      timestamp: new Date().toISOString(),
      ...log,
    };
    order.auditLogs.push(auditLog);
  }

  private getRoleLabel(role: Role): string {
    const labels: Record<Role, string> = {
      [Role.REGISTRAR]: '场地登记员',
      [Role.SUPERVISOR]: '场地审核主管',
      [Role.REVIEWER]: '体育场馆复核负责人',
    };
    return labels[role] || role;
  }

  private getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      [OrderStatus.DRAFT]: '草稿',
      [OrderStatus.PENDING_REGISTRATION]: '待登记',
      [OrderStatus.PENDING_CORRECTION]: '待补正',
      [OrderStatus.PENDING_REVIEW]: '待审核',
      [OrderStatus.PENDING_FINAL_REVIEW]: '待复核',
      [OrderStatus.ARCHIVED]: '已归档',
      [OrderStatus.REJECTED]: '已驳回',
    };
    return labels[status] || status;
  }

  private toOrderDto(order: VenueOrder) {
    return {
      id: order.id,
      orderNo: order.orderNo,
      qrCode: order.qrCode,
      venueName: order.venueName,
      venueType: order.venueType,
      bookingDate: order.bookingDate,
      bookingTime: order.bookingTime,
      applicantName: order.applicantName,
      status: order.status,
      statusLabel: this.getStatusLabel(order.status),
      currentHandlerName: order.currentHandlerName,
      currentHandlerRole: order.currentHandlerRole,
      isOverdue: order.isOverdue(),
      timeLimit: order.timeLimit,
      hasAllMaterials: order.hasAllRequiredMaterials(),
      missingMaterialsCount: order.getMissingMaterials().length,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toOrderDetailDto(order: VenueOrder) {
    return {
      ...this.toOrderDto(order),
      applicantPhone: order.applicantPhone,
      applicantIdCard: order.applicantIdCard,
      currentHandlerId: order.currentHandlerId,
      materials: order.materials,
      registrationOpinion: order.registrationOpinion,
      reviewOpinion: order.reviewOpinion,
      finalReviewOpinion: order.finalReviewOpinion,
      correctionRequest: order.correctionRequest,
      auditLogs: order.auditLogs.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
      allowedActions: this.getAllowedActions(order.status).map((action) => ({
        action,
        label: this.getActionLabel(action),
      })),
      scannedAt: order.scannedAt,
      scannedBy: order.scannedBy,
      version: order.version,
    };
  }

  private getActionLabel(action: OrderAction): string {
    const labels: Record<OrderAction, string> = {
      [OrderAction.SUBMIT_REGISTRATION]: '提交登记',
      [OrderAction.REQUEST_CORRECTION]: '要求补正',
      [OrderAction.SUBMIT_CORRECTION]: '提交补正',
      [OrderAction.APPROVE_REVIEW]: '审核通过',
      [OrderAction.REJECT_REVIEW]: '审核驳回',
      [OrderAction.APPROVE_FINAL_REVIEW]: '复核通过归档',
      [OrderAction.REJECT_FINAL_REVIEW]: '复核驳回',
    };
    return labels[action] || action;
  }
}
