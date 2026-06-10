import api from "./api";

export interface ChargingPile {
  id: number;
  pile_code: string;
  pile_name: string;
  station_code: string;
  station_name: string;
  location: string | null;
  power_rating: string | null;
  qr_code: string;
  is_active: boolean;
  last_inspection_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface QRCodeRecord {
  id: number;
  qr_code_content: string;
  scan_time: string;
  result: string;
  result_label: string;
  scanned_by: number;
  inspection_order_id: number | null;
  charging_pile_id: number | null;
  location_evidence: string | null;
  photo_evidence_path: string | null;
  note: string | null;
  created_at: string;
}

export interface FaultReport {
  id: number;
  inspection_order_id: number;
  fault_code: string;
  fault_description: string;
  fault_level: string;
  fault_location: string | null;
  reported_by: number;
  reported_at: string;
  repair_deadline: string;
  repair_company: string | null;
  repair_contact: string | null;
  repair_phone: string | null;
  attachment_paths: string | null;
  report_opinion: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface RepairAcceptance {
  id: number;
  inspection_order_id: number;
  repair_company: string;
  repair_person: string;
  repair_phone: string | null;
  repair_start_date: string | null;
  repair_end_date: string | null;
  repair_content: string;
  parts_replaced: string | null;
  repair_cost: string | null;
  is_guarantee: boolean;
  acceptance_result: string;
  acceptance_check_items: string | null;
  acceptance_opinion: string | null;
  accepted_by: number;
  accepted_at: string;
  attachment_paths: string | null;
  material_complete: boolean;
  material_note: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface InspectionOrder {
  id: number;
  order_no: string;
  type: string;
  type_label: string;
  status: string;
  status_label: string;
  charging_pile_id: number;
  charging_pile: ChargingPile;
  inspection_date: string;
  inspector_name: string;
  appearance_check: string | null;
  appearance_note: string | null;
  cable_check: string | null;
  cable_note: string | null;
  connector_check: string | null;
  connector_note: string | null;
  display_check: string | null;
  display_note: string | null;
  charging_check: string | null;
  charging_note: string | null;
  emergency_stop_check: string | null;
  emergency_stop_note: string | null;
  grounding_check: string | null;
  grounding_note: string | null;
  overall_result: string | null;
  registrar_opinion: string | null;
  supervisor_opinion: string | null;
  supervisor_review_date: string | null;
  reviewer_opinion: string | null;
  reviewer_review_date: string | null;
  time_limit: string | null;
  is_overdue: boolean;
  created_by: number;
  created_at: string;
  updated_at: string | null;
  version: number;
  can_operate: boolean;
  allowed_actions: string[];
}

export interface InspectionOrderWithDetails extends InspectionOrder {
  qr_records: QRCodeRecord[];
  fault_report: FaultReport | null;
  repair_acceptance: RepairAcceptance | null;
}

export interface InspectionListResponse {
  total: number;
  items: InspectionOrder[];
  page: number;
  page_size: number;
  statistics: Record<string, number>;
}

export interface StatusUpdateRequest {
  target_status: string;
  opinion?: string;
  signature?: string;
  request_id?: string;
  current_version?: number;
}

export interface StatusUpdateResponse {
  success: boolean;
  message: string;
  data: InspectionOrder;
}

export async function getInspectionOrders(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  queue?: string;
  keyword?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
}): Promise<InspectionListResponse> {
  const response = await api.get<InspectionListResponse>("/api/inspections", { params });
  return response.data;
}

export async function getInspectionOrder(id: number): Promise<InspectionOrderWithDetails> {
  const response = await api.get<InspectionOrderWithDetails>(`/api/inspections/${id}`);
  return response.data;
}

export async function createInspectionOrder(data: Partial<InspectionOrder>): Promise<InspectionOrder> {
  const response = await api.post<InspectionOrder>("/api/inspections", data);
  return response.data;
}

export async function updateInspectionOrder(
  id: number,
  data: Partial<InspectionOrder>
): Promise<InspectionOrder> {
  const response = await api.put<InspectionOrder>(`/api/inspections/${id}`, data);
  return response.data;
}

export async function updateInspectionStatus(
  id: number,
  data: StatusUpdateRequest
): Promise<StatusUpdateResponse> {
  const response = await api.post<StatusUpdateResponse>(
    `/api/inspections/${id}/status`,
    data
  );
  return response.data;
}

export async function submitFaultReport(
  inspectionId: number,
  data: Partial<FaultReport>
): Promise<FaultReport> {
  const response = await api.post<FaultReport>(
    `/api/inspections/${inspectionId}/fault-report`,
    data
  );
  return response.data;
}

export async function submitRepairComplete(
  inspectionId: number,
  data?: { opinion?: string; signature?: string; request_id?: string; current_version?: number }
): Promise<any> {
  const response = await api.post(`/api/inspections/${inspectionId}/repair-complete`, data || {});
  return response.data;
}

export async function submitRepairAcceptance(
  inspectionId: number,
  data: Partial<RepairAcceptance>
): Promise<RepairAcceptance> {
  const response = await api.post<RepairAcceptance>(
    `/api/inspections/${inspectionId}/acceptance`,
    data
  );
  return response.data;
}

export async function getChargingPiles(params?: {
  page?: number;
  page_size?: number;
  keyword?: string;
  is_active?: boolean;
}): Promise<{ total: number; items: ChargingPile[] }> {
  const response = await api.get("/api/charging-piles", { params });
  return response.data;
}
