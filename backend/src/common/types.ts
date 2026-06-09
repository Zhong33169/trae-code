export enum UserRole {
  RECEPTIONIST = 'receptionist',
  DENTIST = 'dentist',
  DIRECTOR = 'director',
}

export enum TreatmentPlanStatus {
  DRAFT = 'draft',
  PENDING_VERIFICATION = 'pending_verification',
  VERIFICATION_REJECTED = 'verification_rejected',
  PENDING_REVIEW = 'pending_review',
  REVIEW_REJECTED = 'review_rejected',
  ARCHIVED = 'archived',
}

export enum UrgencyLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  OVERDUE = 'overdue',
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  store: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  checked: boolean;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface TreatmentPlan {
  id: string;
  planNo: string;
  patientName: string;
  patientPhone: string;
  store: string;
  status: TreatmentPlanStatus;
  urgencyLevel: UrgencyLevel;
  createdAt: string;
  deadline: string;
  receptionistId: string;
  dentistId?: string;
  directorId?: string;
  materials: MaterialItem[];
  attachments: Attachment[];
  remarks: string;
  verificationOpinion?: string;
  verificationResult?: 'pass' | 'reject';
  verifiedAt?: string;
  reviewOpinion?: string;
  reviewResult?: 'pass' | 'reject';
  reviewedAt?: string;
  rejectReason?: string;
  version: number;
}

export interface AuditLog {
  id: string;
  planId: string;
  userId: string;
  userName: string;
  action: string;
  fromStatus?: TreatmentPlanStatus;
  toStatus?: TreatmentPlanStatus;
  details: string;
  timestamp: string;
}
