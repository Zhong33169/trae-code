export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  roleName: string;
  phone?: string;
  department?: string;
  created_at?: string;
}

export interface SupervisionRecord {
  id: number;
  record_no: string;
  project_name: string;
  construction_unit: string;
  supervision_unit: string;
  location: string;
  record_date: string;
  weather: string;
  temperature: string;
  content: string;
  issues: string;
  requirement: string;
  status: string;
  statusName: string;
  version: number;
  current_handler_id?: number;
  current_handler_name?: string;
  created_by: number;
  created_by_name: string;
  deadline?: string;
  created_at: string;
  updated_at: string;
  handler_name?: string;
}

export interface Evidence {
  id: number;
  record_id: number;
  type: string;
  name: string;
  description: string;
  file_url: string;
  uploaded_by: number;
  uploaded_by_name: string;
  created_at: string;
}

export interface ReviewRecord {
  id: number;
  record_id: number;
  handler_id: number;
  handler_name: string;
  handler_role: string;
  handler_role_name: string;
  operation_type: string;
  operation_type_name: string;
  opinion: string;
  result: string;
  previous_status: string;
  previous_status_name: string;
  new_status: string;
  new_status_name: string;
  reject_reason?: string;
  version: number;
  created_at: string;
}

export interface OperationLog {
  id: number;
  record_id?: number;
  user_id: number;
  user_name: string;
  user_role: string;
  user_role_name: string;
  operation_type: string;
  operation_type_name: string;
  description: string;
  ip_address?: string;
  created_at: string;
  record_no?: string;
}

export interface AvailableOperation {
  operation: string;
  label: string;
}

export interface Statistics {
  byStatus: Record<string, number>;
  myPending: number;
  myCreated: number;
  todoCounts: {
    needCorrection?: number;
    draft?: number;
    pendingReview?: number;
    inReview?: number;
    pendingFinal?: number;
    inFinal?: number;
  };
  overdue: number;
  total: number;
}

export interface RecordDetailResponse {
  record: SupervisionRecord;
  evidences: Evidence[];
  reviewRecords: ReviewRecord[];
  operationLogs: OperationLog[];
  availableOperations: AvailableOperation[];
  lastReview?: ReviewRecord;
}
