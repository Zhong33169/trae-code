import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderRepository } from '../infrastructure/order.repository';
import { UserRepository } from '../infrastructure/user.repository';
import {
  ScanCodeError,
  ScanCodeErrorMessages,
  RoleStatusPermissions,
  OrderStatus,
  Role,
} from '../types';

@Injectable()
export class ScanService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async validateQrCode(qrCode: string, operatorId: string) {
    if (!qrCode || !qrCode.startsWith('QR-V-')) {
      throw new BadRequestException({
        error: ScanCodeError.INVALID_CODE,
        message: ScanCodeErrorMessages[ScanCodeError.INVALID_CODE],
        details: '二维码格式不正确，正确格式应为 QR-V-YYYYMMNNN',
      });
    }

    const order = await this.orderRepository.findByQrCode(qrCode);
    if (!order) {
      throw new BadRequestException({
        error: ScanCodeError.ORDER_NOT_FOUND,
        message: ScanCodeErrorMessages[ScanCodeError.ORDER_NOT_FOUND],
        details: `未找到二维码 ${qrCode} 对应的订单`,
      });
    }

    const operator = await this.userRepository.findById(operatorId);
    if (!operator) {
      throw new ForbiddenException({
        error: ScanCodeError.UNAUTHORIZED_ROLE,
        message: '操作人不存在',
      });
    }

    const allowedStatuses = RoleStatusPermissions[operator.role];
    if (!allowedStatuses.includes(order.status)) {
      throw new ForbiddenException({
        error: ScanCodeError.UNAUTHORIZED_ROLE,
        message: ScanCodeErrorMessages[ScanCodeError.UNAUTHORIZED_ROLE],
        details: {
          yourRole: operator.role,
          yourRoleLabel: this.getRoleLabel(operator.role),
          orderStatus: order.status,
          orderStatusLabel: this.getStatusLabel(order.status),
          allowedRolesForStatus: this.getAllowedRolesForStatus(order.status),
        },
      });
    }

    if (order.currentHandlerId !== operatorId) {
      throw new ForbiddenException({
        error: ScanCodeError.NOT_CURRENT_HANDLER,
        message: ScanCodeErrorMessages[ScanCodeError.NOT_CURRENT_HANDLER],
        details: {
          orderNo: order.orderNo,
          currentHandlerId: order.currentHandlerId,
          currentHandlerName: order.currentHandlerName,
          currentHandlerRole: order.currentHandlerRole,
          yourId: operatorId,
          yourName: operator.name,
        },
      });
    }

    if (order.status === OrderStatus.ARCHIVED || order.status === OrderStatus.REJECTED) {
      throw new BadRequestException({
        error: ScanCodeError.DUPLICATE_CODE,
        message: ScanCodeErrorMessages[ScanCodeError.DUPLICATE_CODE],
        details: {
          orderNo: order.orderNo,
          currentStatus: order.status,
          statusLabel: this.getStatusLabel(order.status),
          archivedAt: order.status === OrderStatus.ARCHIVED ? order.updatedAt : null,
        },
      });
    }

    const isLocked = await this.orderRepository.isLocked(order.id);
    if (isLocked) {
      const lockHolder = await this.orderRepository.getLockHolder(order.id);
      const holderUser = lockHolder ? await this.userRepository.findById(lockHolder) : null;
      throw new BadRequestException({
        error: ScanCodeError.CONCURRENT_MODIFICATION,
        message: ScanCodeErrorMessages[ScanCodeError.CONCURRENT_MODIFICATION],
        details: {
          lockHolder: holderUser?.name || '未知用户',
          lockHolderRole: holderUser?.role || 'unknown',
        },
      });
    }

    if (!order.hasAllRequiredMaterials()) {
      const missing = order.getMissingMaterials();
      throw new BadRequestException({
        error: ScanCodeError.EVIDENCE_MISSING,
        message: ScanCodeErrorMessages[ScanCodeError.EVIDENCE_MISSING],
        details: {
          missingMaterials: missing.map((m) => ({
            name: m.name,
            type: m.type,
          })),
        },
      });
    }

    return {
      success: true,
      orderId: order.id,
      orderNo: order.orderNo,
      order: {
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
        timeLimit: order.timeLimit,
        materials: order.materials,
      },
    };
  }

  async scanQrCode(qrCode: string, operatorId: string) {
    const validation = await this.validateQrCode(qrCode, operatorId);

    const order = await this.orderRepository.findById(validation.orderId);
    if (order) {
      order.scannedAt = new Date().toISOString();
      order.scannedBy = operatorId;
      await this.orderRepository.save(order);
    }

    return validation;
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

  private getAllowedRolesForStatus(status: OrderStatus): Array<{ role: Role; label: string }> {
    const mapping: Record<OrderStatus, Role[]> = {
      [OrderStatus.DRAFT]: [Role.REGISTRAR],
      [OrderStatus.PENDING_REGISTRATION]: [Role.REGISTRAR],
      [OrderStatus.PENDING_CORRECTION]: [Role.REGISTRAR],
      [OrderStatus.PENDING_REVIEW]: [Role.SUPERVISOR],
      [OrderStatus.PENDING_FINAL_REVIEW]: [Role.REVIEWER],
      [OrderStatus.ARCHIVED]: [],
      [OrderStatus.REJECTED]: [],
    };

    return (mapping[status] || []).map((role) => ({
      role,
      label: this.getRoleLabel(role),
    }));
  }
}
