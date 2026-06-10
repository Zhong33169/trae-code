import api from "./api";

export interface BatchProcessItem {
  inspection_order_id: number;
  order_no: string;
  target_status: string;
  opinion?: string;
  signature?: string;
  current_version?: number;
}

export interface BatchProcessRequest {
  items: BatchProcessItem[];
  request_id?: string;
  operation: string;
}

export interface BatchItemResult {
  inspection_order_id: number;
  order_no: string;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
  previous_status: string | null;
  current_status: string | null;
  suggestion: string | null;
  next_step: string | null;
}

export interface BatchStatistics {
  total_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
}

export interface BatchProcessResult {
  success: boolean;
  message: string;
  statistics: BatchStatistics;
  results: BatchItemResult[];
  request_id: string | null;
  completed_at: string;
}

export async function batchProcess(data: BatchProcessRequest): Promise<BatchProcessResult> {
  const response = await api.post<BatchProcessResult>("/api/batch/process", data);
  return response.data;
}
