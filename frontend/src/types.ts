export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

export interface Patient {
  id: number;
  name: string;
  id_card: string;
  phone: string | null;
}

export interface Appointment {
  id: number;
  patient_id: number;
  appointment_date: string;
  department: string | null;
  doctor_name: string | null;
  status: string;
}

export interface Visit {
  id: number;
  patient_id: number;
  appointment_id: number | null;
  visit_date: string;
  triage_nurse: string | null;
  department: string | null;
  diagnosis: string | null;
}

export interface FollowUpVisit {
  id: number;
  patient_id: number;
  visit_id: number | null;
  follow_up_date: string;
  follow_up_type: string | null;
  content: string | null;
  operator: string | null;
}

export interface FollowUpRecord {
  id: number;
  record_no: string;
  patient_id: number;
  appointment_id: number | null;
  visit_id: number | null;
  follow_up_visit_id: number | null;
  status: string;
  version: number;
  follow_up_type: string | null;
  content: string | null;
  result: string | null;
  remarks: string | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  doctor_opinion: string | null;
  doctor_verified: boolean;
  doctor_verified_at: string | null;
  director_opinion: string | null;
  director_verified: boolean;
  director_verified_at: string | null;
  patient?: Patient;
  appointment?: Appointment;
  visit?: Visit;
  follow_up_visit_obj?: FollowUpVisit;
}

export interface RecordListResponse {
  total: number;
  items: FollowUpRecord[];
}

export interface EvidenceResponse {
  appointments: Appointment[];
  visits: Visit[];
  follow_up_visits: FollowUpVisit[];
}

export interface ApiError {
  detail: string;
  error_code: string;
  field: string | null;
}

export interface BatchResult {
  success: { id: number; record_no: string }[];
  failed: { id: number; error: string; error_code: string }[];
}

export const ROLE_NAMES: Record<string, string> = {
  triage_nurse: '导诊护士',
  gp_doctor: '全科医生',
  medical_director: '医务科主任',
};

export const STATUS_NAMES: Record<string, string> = {
  draft: '草稿',
  pending_doctor: '待医生处理',
  pending_director: '待主任确认',
  confirmed: '已确认',
  rejected: '已驳回',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: '#faad14',
  pending_doctor: '#1890ff',
  pending_director: '#722ed1',
  confirmed: '#52c41a',
  rejected: '#ff4d4f',
};
