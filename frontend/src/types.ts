export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

export interface Material {
  id: number;
  event_id: number;
  name: string;
  material_type: string;
  content: string;
  step: string;
  uploaded_at: string;
}

export interface Action {
  id: number;
  event_id: number;
  action_type: string;
  opinion: string;
  result: string;
  actor_id: number;
  actor_role: string;
  actor_name?: string;
  created_at: string;
}

export interface Event {
  id: number;
  code: string;
  scan_token: string;
  title: string;
  description: string;
  event_type: string;
  severity: string;
  status: string;
  current_handler_role: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  deadline: string;
  version: number;
  creator_name?: string;
  materials?: Material[];
  actions?: Action[];
}

export interface AuditLog {
  id: number;
  event_id: number;
  event_code?: string;
  event_title?: string;
  action: string;
  actor_id: number;
  actor_role: string;
  actor_name?: string;
  detail: string;
  created_at: string;
  scan_record_id?: number | null;
  version_before?: number | null;
  version_after?: number | null;
  before_status?: string | null;
  after_status?: string | null;
  batch_id?: string | null;
  filter_role?: string | null;
  filter_status?: string | null;
  filter_event_type?: string | null;
}

export interface ScanCredential {
  scan_record_id: number;
  scan_token: string;
  event_id: number;
  scanner_id: number;
  scanner_role: string;
  scanned_at: string;
  event_code: string;
  event_version: number;
}

export interface Statistics {
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_role_queue: Record<string, number>;
  total: number;
  archived: number;
  active: number;
}

export interface ConfigItem {
  value: string;
  label: string;
}

export interface AppConfig {
  roles: ConfigItem[];
  statuses: ConfigItem[];
  event_types: ConfigItem[];
  severities: ConfigItem[];
  status_handler: Record<string, string | null>;
  valid_transitions: Record<string, string[]>;
}

export interface NotActionableItem {
  event_id: number;
  event_code: string;
  event_title: string;
  reason: string;
}

export interface EventFilters {
  role: string;
  status: string;
  event_type: string;
}

export interface QueueSummary {
  role: string;
  role_label: string;
  actionable: Event[];
  actionable_count: number;
  supplement_pending: Event[];
  supplement_pending_count: number;
  review_pending: Event[];
  review_pending_count: number;
  not_actionable: NotActionableItem[];
  not_actionable_count: number;
  total: number;
}

export const ROLE_LABELS: Record<string, string> = {
  registrar: "医疗事件登记员",
  supervisor: "医疗事件审核主管",
  reviewer: "三甲医院医务部复核负责人",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  submitted: "已提交",
  review_rejected: "审核退回",
  review_passed: "审核通过",
  archive_rejected: "复核退回",
  archived: "已归档",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  adverse_event: "不良事件",
  incident_report: "事件上报",
  rectification_tracking: "整改追踪",
};

export const SEVERITY_LABELS: Record<string, string> = {
  minor: "一般",
  moderate: "中度",
  major: "重大",
  critical: "特别重大",
};

export const STATUS_HANDLER: Record<string, string | null> = {
  draft: "registrar",
  submitted: "supervisor",
  review_rejected: "registrar",
  review_passed: "reviewer",
  archive_rejected: "supervisor",
  archived: null,
};
