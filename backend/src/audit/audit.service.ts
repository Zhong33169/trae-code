import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuditLog, TreatmentPlanStatus, User, MaterialItem, Attachment } from '../common/types';

interface AddLogParams {
  planId: string;
  user: User;
  action: string;
  fromStatus?: TreatmentPlanStatus;
  toStatus?: TreatmentPlanStatus;
  details?: string;
  materialChanges?: Array<{
    id: string;
    name: string;
    before?: { checked?: boolean; verified?: boolean };
    after?: { checked?: boolean; verified?: boolean };
    checked?: boolean;
    verified?: boolean;
  }>;
  attachmentChanges?: Array<{
    id?: string;
    name: string;
    type: string;
    changeType: 'add' | 'remove';
  }>;
  opinion?: string;
  rejectReason?: string;
  batchInfo?: {
    totalCount: number;
    successCount: number;
    failCount: number;
    successPlans: Array<{ id: string; planNo: string }>;
    failedPlans: Array<{ id: string; planNo?: string; reason?: string }>;
    opinion?: string;
    rejectReason?: string;
  };
}

@Injectable()
export class AuditService {
  private logs: AuditLog[] = [];

  addLog(params: AddLogParams): AuditLog {
    const log: AuditLog = {
      id: uuidv4(),
      planId: params.planId,
      userId: params.user.id,
      userName: params.user.name,
      userRole: params.user.role,
      action: params.action,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      details: params.details || '',
      timestamp: new Date().toISOString(),
      materialChanges: params.materialChanges,
      attachmentChanges: params.attachmentChanges,
      opinion: params.opinion,
      rejectReason: params.rejectReason,
      batchInfo: params.batchInfo,
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
