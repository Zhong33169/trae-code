export interface User {
  id: string;
  name: string;
  role: string;
  role_name: string;
  dept: string;
}

export interface Consultation {
  id: string;
  title: string;
  patient_name: string;
  patient_id: string;
  dept: string;
  chief_complaint: string;
  consult_type: string;
  consult_dept: string;
  status: string;
  status_name: string;
  version: number;
  registrar_id: string;
  registrar_name: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  director_id: string | null;
  director_name: string | null;
  latest_opinion: string;
  latest_reject_reason: string;
  evidence_list: string;
  is_overdue: boolean;
  has_appeal: boolean;
  appeal_status: string;
  appeal_status_name: string;
  appeal_reason: string;
  deadline: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryRecord {
  id: string;
  consultation_id: string;
  operator_id: string;
  operator_name: string;
  operator_role: string;
  operator_role_name: string;
  action: string;
  action_name: string;
  from_status: string;
  from_status_name: string;
  to_status: string;
  to_status_name: string;
  opinion: string;
  reject_reason: string;
  version: number;
  created_at: string;
}

export interface Stats {
  total: number;
  draft: number;
  submitted: number;
  under_review: number;
  review_passed: number;
  under_final: number;
  archived: number;
  rejected: number;
  correction_requested: number;
  evidence_missing: number;
  status_conflict: number;
  appeal_total: number;
  overdue: number;
  resubmitted: number;
}

export type UserRole = 'registrar' | 'reviewer' | 'director';

export const ROLE_LABELS: Record<UserRole, string> = {
  registrar: '会诊申请登记员',
  reviewer: '会诊申请审核主管',
  director: '医务部复核负责人',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  submitted: '#3b82f6',
  under_review: '#8b5cf6',
  evidence_missing: '#f59e0b',
  overdue: '#ef4444',
  correction_requested: '#f97316',
  resubmitted: '#6366f1',
  review_passed: '#10b981',
  under_final: '#8b5cf6',
  status_conflict: '#dc2626',
  archived: '#059669',
  rejected: '#991b1b',
  appeal_submitted: '#ec4899',
  appeal_accepted: '#a855f7',
  appeal_rejected: '#6b7280',
  appeal_resolved: '#10b981',
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || '#6b7280';
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

export function parseEvidenceList(raw: string): string[] {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
