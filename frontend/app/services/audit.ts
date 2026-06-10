import api from "./api";

export interface AuditLog {
  id: number;
  inspection_order_id: number | null;
  order_no: string | null;
  action: string;
  action_label: string;
  from_status: string | null;
  to_status: string | null;
  operator_id: number;
  operator_name: string | null;
  operator_role: string | null;
  detail: string | null;
  opinion: string | null;
  signature: string | null;
  error_code: string | null;
  error_message: string | null;
  suggestion: string | null;
  next_step: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditStatistics {
  total_operations: number;
  operations_by_action: Record<string, number>;
  operations_by_role: Record<string, number>;
  operations_by_status: Record<string, number>;
  operations_today: number;
  operations_this_week: number;
  average_processing_time: number | null;
}

export async function getAuditLogs(params?: {
  page?: number;
  page_size?: number;
  inspection_order_id?: number;
  operator_id?: number;
  action?: string;
  start_date?: string;
  end_date?: string;
}): Promise<{ total: number; items: AuditLog[] }> {
  const response = await api.get("/api/audit/logs", { params });
  return response.data;
}

export async function getAuditStatistics(): Promise<AuditStatistics> {
  const response = await api.get<AuditStatistics>("/api/audit/statistics");
  return response.data;
}

export async function getInspectionAuditLogs(
  inspectionId: number,
  params?: { page?: number; page_size?: number }
): Promise<{ total: number; items: AuditLog[] }> {
  const response = await api.get(`/api/audit/inspection/${inspectionId}`, { params });
  return response.data;
}
