export enum Role {
  FIELD_ADMIN = 'FIELD_ADMIN',
  TECHNICIAN = 'TECHNICIAN',
  COOP_DIRECTOR = 'COOP_DIRECTOR',
}

export enum HarvestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PENDING_CORRECTION = 'PENDING_CORRECTION',
  VERIFIED = 'VERIFIED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  ARCHIVED = 'ARCHIVED',
  REJECTED = 'REJECTED',
}

export enum ScanResult {
  SUCCESS = 'SUCCESS',
  INVALID_CODE = 'INVALID_CODE',
  DUPLICATE_SCAN = 'DUPLICATE_SCAN',
  OPERATOR_MISMATCH = 'OPERATOR_MISMATCH',
  STATUS_ERROR = 'STATUS_ERROR',
}

export const RoleLabelMap: Record<Role, string> = {
  [Role.FIELD_ADMIN]: '田间管理员',
  [Role.TECHNICIAN]: '农技员',
  [Role.COOP_DIRECTOR]: '合作社主任',
};

export const StatusLabelMap: Record<HarvestStatus, string> = {
  [HarvestStatus.DRAFT]: '草稿',
  [HarvestStatus.SUBMITTED]: '待核验',
  [HarvestStatus.PENDING_CORRECTION]: '待补正',
  [HarvestStatus.VERIFIED]: '已核验',
  [HarvestStatus.PENDING_REVIEW]: '待复核',
  [HarvestStatus.ARCHIVED]: '已归档',
  [HarvestStatus.REJECTED]: '已驳回',
};

export const StatusColorMap: Record<HarvestStatus, string> = {
  [HarvestStatus.DRAFT]: 'default',
  [HarvestStatus.SUBMITTED]: 'processing',
  [HarvestStatus.PENDING_CORRECTION]: 'warning',
  [HarvestStatus.VERIFIED]: 'processing',
  [HarvestStatus.PENDING_REVIEW]: 'processing',
  [HarvestStatus.ARCHIVED]: 'success',
  [HarvestStatus.REJECTED]: 'error',
};

export const ScanResultLabelMap: Record<ScanResult, string> = {
  [ScanResult.SUCCESS]: '核验通过',
  [ScanResult.INVALID_CODE]: '无效码',
  [ScanResult.DUPLICATE_SCAN]: '重复扫码',
  [ScanResult.OPERATOR_MISMATCH]: '扫码人不匹配',
  [ScanResult.STATUS_ERROR]: '状态错误',
};

export const ScanResultColorMap: Record<ScanResult, string> = {
  [ScanResult.SUCCESS]: 'success',
  [ScanResult.INVALID_CODE]: 'error',
  [ScanResult.DUPLICATE_SCAN]: 'warning',
  [ScanResult.OPERATOR_MISMATCH]: 'error',
  [ScanResult.STATUS_ERROR]: 'error',
};

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
}

export interface HarvestRecord {
  id: string;
  record_no: string;
  batch_no: string;
  crop_type: string;
  crop_name: string;
  harvest_date: string;
  harvest_area: number;
  estimated_weight: number;
  actual_weight?: number;
  field_location: string;
  planter: string;
  status: HarvestStatus;
  current_queue: Role;
  materials?: string;
  deadline?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ScanRecord {
  id: string;
  harvest_record_id: string;
  scan_code: string;
  scanned_by: string;
  scanned_at: string;
  result: ScanResult;
  credential?: string;
  remark?: string;
}

export interface AuditLog {
  id: string;
  harvest_record_id?: string;
  operator_id: string;
  operator_name: string;
  action: string;
  old_status?: string;
  new_status?: string;
  remark?: string;
  created_at: string;
}

export interface ProcessComment {
  id: string;
  harvest_record_id: string;
  operator_id: string;
  operator_name: string;
  comment: string;
  action_type: string;
  created_at: string;
}

export interface Statistics {
  total: number;
  pending_correction: number;
  pending_verification: number;
  pending_review: number;
  archived: number;
  draft: number;
}
