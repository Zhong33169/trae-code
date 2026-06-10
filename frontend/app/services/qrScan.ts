import api from "./api";
import { QRCodeRecord } from "./inspection";

export interface QRCodeScanRequest {
  qr_code_content: string;
  inspection_order_id?: number;
  location_evidence?: string;
  photo_evidence_path?: string;
  note?: string;
  request_id?: string;
}

export interface ScanResultResponse {
  success: boolean;
  result: string;
  result_label: string;
  message: string;
  record_id: number | null;
  inspection_order_id: number | null;
  inspection_order_no: string | null;
  scan_time: string | null;
  next_step: string | null;
  suggestion: string | null;
}

export async function scanQRCode(data: QRCodeScanRequest): Promise<ScanResultResponse> {
  const response = await api.post<ScanResultResponse>("/api/qr-scan/scan", data);
  return response.data;
}

export async function getQRCodeRecords(params?: {
  page?: number;
  page_size?: number;
  inspection_order_id?: number;
  result?: string;
  scanned_by?: number;
  start_date?: string;
  end_date?: string;
}): Promise<{ total: number; items: QRCodeRecord[] }> {
  const response = await api.get("/api/qr-scan/records", { params });
  return response.data;
}

export async function getQRCodeRecord(id: number): Promise<QRCodeRecord> {
  const response = await api.get<QRCodeRecord>(`/api/qr-scan/records/${id}`);
  return response.data;
}
