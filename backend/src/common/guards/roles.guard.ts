import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { ModuleRef } from '@nestjs/core';
import { AuditAction } from '../../entities/audit-log.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('未登录');
    }

    if (!requiredRoles.includes(user.role)) {
      const orderId = request.params?.id || request.body?.ids?.[0] || null;
      const action = this.getAuditActionFromContext(context);
      const roleLabel: Record<string, string> = {
        [UserRole.REGISTRAR]: '登记员',
        [UserRole.SUPERVISOR]: '主管',
        [UserRole.REVIEWER]: '复核负责人',
      };
      const requiredRoleLabels = requiredRoles.map(r => roleLabel[r] || r).join('/');
      const failReason = `权限拒绝：${roleLabel[user.role] || user.role}无权执行「${action}」操作，需要${requiredRoleLabels}角色`;

      try {
        const { AuditLogService } = await import('../../audit/audit-log.service');
        const auditLogService = this.moduleRef.get(AuditLogService, { strict: false });
        if (auditLogService) {
          await auditLogService.create({
            orderId,
            userId: user.id,
            action,
            description: `${roleLabel[user.role] || user.name}尝试执行「${action}」操作被权限拒绝`,
            success: false,
            failReason,
            beforeData: orderId ? { permissionCheck: true } : undefined,
            afterData: {
              operatorRole: user.role,
              operatorName: user.name,
              requiredRoles,
              attemptedAction: action,
            },
          });
        }
      } catch (_) {}

      throw new ForbiddenException(failReason);
    }

    return true;
  }

  private getAuditActionFromContext(context: ExecutionContext): AuditAction {
    const handlerName = context.getHandler().name;
    const actionMap: Record<string, AuditAction> = {
      create: AuditAction.CREATE,
      update: AuditAction.UPDATE,
      submitForReview: AuditAction.SUBMIT,
      reviewApprove: AuditAction.REVIEW_APPROVE,
      reviewReject: AuditAction.REVIEW_REJECT,
      submitForFinalReview: AuditAction.SUBMIT,
      finalApprove: AuditAction.FINAL_APPROVE,
      finalReject: AuditAction.FINAL_REJECT,
      ship: AuditAction.SHIP,
      deliver: AuditAction.DELIVER,
      sign: AuditAction.SIGN,
      archive: AuditAction.ARCHIVE,
      markException: AuditAction.EXCEPTION,
      markMaterialsMissing: AuditAction.EXCEPTION,
      markTimeout: AuditAction.EXCEPTION,
      returnOrder: AuditAction.RETURN,
      rectify: AuditAction.RECTIFY,
      uploadAttachment: AuditAction.UPDATE,
      batchProcess: AuditAction.UPDATE,
    };
    return actionMap[handlerName] || AuditAction.UPDATE;
  }
}
