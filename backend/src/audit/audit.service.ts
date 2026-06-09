import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuditLog, TreatmentPlanStatus, User } from '../common/types';

@Injectable()
export class AuditService {
  private logs: AuditLog[] = [];

  addLog(params: {
    planId: string;
    user: User;
    action: string;
    fromStatus?: TreatmentPlanStatus;
    toStatus?: TreatmentPlanStatus;
    details?: string;
  }): AuditLog {
    const log: AuditLog = {
      id: uuidv4(),
      planId: params.planId,
      userId: params.user.id,
      userName: params.user.name,
      action: params.action,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      details: params.details || '',
      timestamp: new Date().toISOString(),
    };
    this.logs.unshift(log);
    return log;
  }

  getLogsByPlanId(planId: string): AuditLog[] {
    return this.logs.filter(l => l.planId === planId);
  }

  getAllLogs(): AuditLog[] {
    return this.logs;
  }
}
