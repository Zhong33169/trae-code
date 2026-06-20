import type {
  InspectionOrderListItem,
  InspectionOrderDetail,
  StatisticsResponse,
  QueueItem,
  User,
  Equipment,
  ApiResponse,
  InspectionOrderHandleRequest,
  InspectionOrderReviewRequest,
  InspectionOrderReturnRequest,
  RiskLevelChangeRequest,
  FaultReportRequest,
  RecoveryConfirmRequest,
  FaultReport,
  RecoveryConfirm,
} from "~/types";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8002";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  getStatistics: async (): Promise<ApiResponse<StatisticsResponse>> => {
    return request<StatisticsResponse>("/api/statistics");
  },

  getQueue: async (
    userId: number,
    role: string
  ): Promise<ApiResponse<QueueItem[]>> => {
    return request<QueueItem[]>(
      `/api/queue?user_id=${userId}&role=${role}`
    );
  },

  getInspections: async (): Promise<ApiResponse<InspectionOrderListItem[]>> => {
    return request<InspectionOrderListItem[]>("/api/inspections");
  },

  getHighRiskInspections: async (): Promise<
    ApiResponse<InspectionOrderListItem[]>
  > => {
    return request<InspectionOrderListItem[]>("/api/inspections/high-risk");
  },

  getInspectionDetail: async (
    id: number
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(`/api/inspections/${id}`);
  },

  handleInspection: async (
    id: number,
    data: InspectionOrderHandleRequest
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(`/api/inspections/${id}/handle`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  reviewInspection: async (
    id: number,
    data: InspectionOrderReviewRequest
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(`/api/inspections/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  returnInspection: async (
    id: number,
    data: InspectionOrderReturnRequest
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(`/api/inspections/${id}/return`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  changeRiskLevel: async (
    id: number,
    data: RiskLevelChangeRequest
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(`/api/inspections/${id}/risk`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  validateSubmission: async (
    id: number,
    action: string,
    data: any
  ): Promise<ApiResponse<boolean>> => {
    return request<boolean>(`/api/inspections/${id}/validate`, {
      method: "POST",
      body: JSON.stringify({ action, ...data }),
    });
  },

  createFaultReport: async (
    data: FaultReportRequest
  ): Promise<ApiResponse<FaultReport>> => {
    return request<FaultReport>("/api/fault-reports", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  confirmRecovery: async (
    data: RecoveryConfirmRequest
  ): Promise<ApiResponse<RecoveryConfirm>> => {
    return request<RecoveryConfirm>("/api/recovery-confirms", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getUsers: async (): Promise<ApiResponse<User[]>> => {
    return request<User[]>("/api/users");
  },

  getEquipments: async (): Promise<ApiResponse<Equipment[]>> => {
    return request<Equipment[]>("/api/equipments");
  },
};
