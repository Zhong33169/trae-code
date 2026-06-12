import { v4 as uuidv4 } from 'uuid';
import {
  OrderStatus,
  OrderAction,
  MaterialItem,
  TimeLimit,
  AuditLog,
  Role,
} from '../types';

export class VenueOrder {
  id: string;
  orderNo: string;
  qrCode: string;
  venueName: string;
  venueType: string;
  bookingDate: string;
  bookingTime: string;
  applicantName: string;
  applicantPhone: string;
  applicantIdCard: string;
  status: OrderStatus;
  currentHandlerRole: Role;
  currentHandlerId: string;
  currentHandlerName: string;
  materials: MaterialItem[];
  timeLimit: TimeLimit;
  registrationOpinion?: string;
  reviewOpinion?: string;
  finalReviewOpinion?: string;
  correctionRequest?: string;
  auditLogs: AuditLog[];
  version: number;
  createdAt: string;
  updatedAt: string;
  scannedAt?: string;
  scannedBy?: string;

  constructor(partial?: Partial<VenueOrder>) {
    Object.assign(this, partial);
    if (!this.id) this.id = uuidv4();
    if (!this.version) this.version = 1;
    if (!this.createdAt) this.createdAt = new Date().toISOString();
    if (!this.updatedAt) this.updatedAt = new Date().toISOString();
    if (!this.auditLogs) this.auditLogs = [];
    if (!this.materials) this.materials = [];
    if (!this.status) this.status = OrderStatus.DRAFT;
  }

  canTransition(action: OrderAction): boolean {
    const transitions = {
      [OrderStatus.DRAFT]: {
        [OrderAction.SUBMIT_REGISTRATION]: OrderStatus.PENDING_REVIEW,
      },
      [OrderStatus.PENDING_REGISTRATION]: {
        [OrderAction.SUBMIT_REGISTRATION]: OrderStatus.PENDING_REVIEW,
      },
      [OrderStatus.PENDING_CORRECTION]: {
        [OrderAction.SUBMIT_CORRECTION]: OrderStatus.PENDING_REVIEW,
      },
      [OrderStatus.PENDING_REVIEW]: {
        [OrderAction.APPROVE_REVIEW]: OrderStatus.PENDING_FINAL_REVIEW,
        [OrderAction.REQUEST_CORRECTION]: OrderStatus.PENDING_CORRECTION,
        [OrderAction.REJECT_REVIEW]: OrderStatus.REJECTED,
      },
      [OrderStatus.PENDING_FINAL_REVIEW]: {
        [OrderAction.APPROVE_FINAL_REVIEW]: OrderStatus.ARCHIVED,
        [OrderAction.REJECT_FINAL_REVIEW]: OrderStatus.REJECTED,
      },
      [OrderStatus.ARCHIVED]: {},
      [OrderStatus.REJECTED]: {},
    };

    return !!transitions[this.status]?.[action];
  }

  getNextStatus(action: OrderAction): OrderStatus | null {
    const transitions = {
      [OrderStatus.DRAFT]: {
        [OrderAction.SUBMIT_REGISTRATION]: OrderStatus.PENDING_REVIEW,
      },
      [OrderStatus.PENDING_REGISTRATION]: {
        [OrderAction.SUBMIT_REGISTRATION]: OrderStatus.PENDING_REVIEW,
      },
      [OrderStatus.PENDING_CORRECTION]: {
        [OrderAction.SUBMIT_CORRECTION]: OrderStatus.PENDING_REVIEW,
      },
      [OrderStatus.PENDING_REVIEW]: {
        [OrderAction.APPROVE_REVIEW]: OrderStatus.PENDING_FINAL_REVIEW,
        [OrderAction.REQUEST_CORRECTION]: OrderStatus.PENDING_CORRECTION,
        [OrderAction.REJECT_REVIEW]: OrderStatus.REJECTED,
      },
      [OrderStatus.PENDING_FINAL_REVIEW]: {
        [OrderAction.APPROVE_FINAL_REVIEW]: OrderStatus.ARCHIVED,
        [OrderAction.REJECT_FINAL_REVIEW]: OrderStatus.REJECTED,
      },
      [OrderStatus.ARCHIVED]: {},
      [OrderStatus.REJECTED]: {},
    };

    return transitions[this.status]?.[action] || null;
  }

  hasAllRequiredMaterials(): boolean {
    return this.materials.filter((m) => m.required).every((m) => m.uploaded);
  }

  getMissingMaterials(): MaterialItem[] {
    return this.materials.filter((m) => m.required && !m.uploaded);
  }

  isOverdue(): boolean {
    if (!this.timeLimit?.deadline) return false;
    return new Date() > new Date(this.timeLimit.deadline);
  }

  updateTimeLimit(): void {
    if (!this.timeLimit?.deadline) return;
    const now = new Date();
    const deadline = new Date(this.timeLimit.deadline);
    const diffMs = deadline.getTime() - now.getTime();
    this.timeLimit.remainingHours = Math.max(
      0,
      Math.ceil(diffMs / (1000 * 60 * 60)),
    );
    this.timeLimit.isOverdue = diffMs < 0;
  }
}
