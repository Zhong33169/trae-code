// ============================================================
// Frontend API Client - fully aligned with backend routes
// backend/app/routes/inspection_routes.py
// ============================================================

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
  InspectionOrderSubmitValidateRequest,
  FaultReportCreateRequest,
  RecoveryConfirmCreateRequest,
  FaultReport,
  RecoveryConfirm,
  InspectionOrderInitiateRequest,
} from "~/types";

const BASE_URL =
  (import.meta as any).env?.VITE_BACKEND_URL || "http://localhost:8002";

function buildUrl(path: string, params?: Record<string, any>): string {
  const url = new URL(path, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  queryParams?: Record<string, any>
): Promise<ApiResponse<T>> {
  const url = buildUrl(path, queryParams);
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errText);
    } catch {
      parsed = { success: false, message: errText, data: null };
    }
    return parsed as ApiResponse<T>;
  }

  return response.json();
}

// ============================================================
// Public API
// ============================================================

export const api = {
  // ---------- Statistics ----------
  getStatistics: async (): Promise<ApiResponse<StatisticsResponse>> => {
    return request<StatisticsResponse>("/api/statistics", { method: "GET" });
  },

  // ---------- Queue ----------
  getQueue: async (
    userId: number,
    role: string
  ): Promise<ApiResponse<QueueItem[]>> => {
    return request<QueueItem[]>("/api/queue", { method: "GET" }, {
      user_id: userId,
      role,
    });
  },

  // ---------- Users ----------
  getUsers: async (): Promise<ApiResponse<User[]>> => {
    return request<User[]>("/api/users", { method: "GET" });
  },

  // ---------- Equipments ----------
  getEquipments: async (): Promise<ApiResponse<Equipment[]>> => {
    return request<Equipment[]>("/api/equipments", { method: "GET" });
  },

  // ---------- Inspection Orders ----------
  getInspections: async (
    filters?: Partial<{
      status: string;
      risk_level: string;
      location: string;
      user_id: number;
      role: string;
    }>
  ): Promise<ApiResponse<InspectionOrderListItem[]>> => {
    return request<InspectionOrderListItem[]>(
      "/api/inspections",
      { method: "GET" },
      filters || {}
    );
  },

  getInspectionDetail: async (
    id: number
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(`/api/inspections/${id}`, {
      method: "GET",
    });
  },

  getHighRiskInspections: async (): Promise<
    ApiResponse<InspectionOrderListItem[]>
  > => {
    return request<InspectionOrderListItem[]>(
      "/api/inspections/high-risk",
      { method: "GET" }
    );
  },

  initiateInspection: async (
    data: InspectionOrderInitiateRequest,
    userId: number
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(
      "/api/inspections",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      { user_id: userId }
    );
  },

  // Handle (办理): user_id must be a HANDLER
  handleInspection: async (
    id: number,
    data: InspectionOrderHandleRequest,
    userId: number
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(
      `/api/inspections/${id}/handle`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      { user_id: userId }
    );
  },

  // Review (复核): user_id must be a REVIEWER
  reviewInspection: async (
    id: number,
    data: InspectionOrderReviewRequest,
    userId: number
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(
      `/api/inspections/${id}/review`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      { user_id: userId }
    );
  },

  // Return (退回补正): user_id must be a REVIEWER
  returnInspection: async (
    id: number,
    data: InspectionOrderReturnRequest,
    userId: number
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(
      `/api/inspections/${id}/return`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      { user_id: userId }
    );
  },

  // Risk Level Change
  changeRiskLevel: async (
    id: number,
    data: RiskLevelChangeRequest,
    userId: number
  ): Promise<ApiResponse<InspectionOrderDetail>> => {
    return request<InspectionOrderDetail>(
      `/api/inspections/${id}/risk`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      { user_id: userId }
    );
  },

  // Pre-submit Validation
  validateSubmission: async (
    id: number,
    data: InspectionOrderSubmitValidateRequest
  ): Promise<ApiResponse<boolean>> => {
    return request<boolean>(`/api/inspections/${id}/validate`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // ---------- Fault Report ----------
  createFaultReport: async (
    data: FaultReportCreateRequest,
    userId: number
  ): Promise<ApiResponse<FaultReport>> => {
    return request<FaultReport>(
      "/api/fault-reports",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      { user_id: userId }
    );
  },

  // ---------- Recovery Confirm ----------
  confirmRecovery: async (
    data: RecoveryConfirmCreateRequest,
    userId: number
  ): Promise<ApiResponse<RecoveryConfirm>> => {
    return request<RecoveryConfirm>(
      "/api/recovery-confirms",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      { user_id: userId }
    );
  },
};

export default api;
