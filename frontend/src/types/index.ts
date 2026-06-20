export interface User {
  id: number;
  username: string;
  real_name: string;
  role: string;
  role_label: string;
}

export interface LoginResponse {
  success: boolean;
  user: User | null;
  token: string | null;
  message: string;
}

export type BookingStatus = string;
export type LoadingStatus = string;
export type BlStatus = string;
export type ModuleType = 'booking' | 'loading' | 'bl';

export interface Booking {
  id: number;
  form_no: string;
  batch_no: string;
  customer: string;
  forwarder: string;
  port_of_loading: string;
  port_of_discharge: string;
  container_type: string;
  container_qty: number;
  cargo_desc: string;
  weight: string;
  volume: string;
  etd: string;
  eta: string;
  bl_no: string;
  vessel: string;
  so_no: string;
  booking_status: BookingStatus;
  booking_status_label: string;
  loading_status: LoadingStatus;
  loading_status_label: string;
  bl_status: BlStatus;
  bl_status_label: string;
  is_exception: boolean;
  exception_type: string | null;
  exception_note: string | null;
  status_mismatch: string[];
  return_reason: string | null;
  audit_remark: string | null;
  result_note: string | null;
  offline_booking_status: string | null;
  offline_loading_status: string | null;
  offline_bl_status: string | null;
  deadline: string | null;
  submitter_name: string | null;
  reviewer_name: string | null;
  archivist_name: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingListResponse {
  total: number;
  items: Booking[];
}

export interface BookingListParams {
  module: ModuleType;
  keyword?: string;
  booking_status?: string;
  loading_status?: string;
  bl_status?: string;
  is_exception?: string;
  exception_type?: string;
  page?: number;
  size?: number;
}

export interface OperationLog {
  action: string;
  action_label: string;
  operator_name: string;
  role: string;
  role_label: string;
  from_status: string | null;
  to_status: string | null;
  remark: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface AuditLog {
  audit_type: string;
  audit_type_label: string;
  auditor_name: string;
  result: string;
  result_label: string;
  fail_reason: string | null;
  remark: string | null;
  created_at: string;
}

export interface Attachment {
  id: number;
  category: string;
  category_label: string;
  file_name: string;
  file_size: number;
  uploader_name: string;
  file_url: string;
  created_at: string;
}

export interface OfflineRecord {
  id: number;
  field_name: string;
  new_value: string;
  source: string | null;
  operator_name: string;
  remark: string | null;
  created_at: string;
}

export interface ValidateResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BatchResult {
  id: number;
  form_no: string;
  success: boolean;
  message: string;
}

export interface BatchResponse {
  results: BatchResult[];
  success_count: number;
  fail_count: number;
}

export interface EnumItem {
  value: string;
  label: string;
}

export interface MetaEnums {
  [key: string]: EnumItem[];
}
