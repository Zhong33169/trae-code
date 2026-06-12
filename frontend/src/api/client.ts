import type {
  User,
  SamplingTask,
  PaginatedResponse,
  Evidence,
  BatchResult,
  ApiResponse,
  EvidenceType,
  BatchSubmitItem,
} from "../types";

const API_BASE_URL = "http://localhost:8006";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = localStorage.getItem("auth_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data: ApiResponse<T> = await response.json();

  if (data.code !== 0) {
    throw new Error(data.message || "请求失败");
  }

  return data.data;
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: (params: LoginParams) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  me: () => request<User>("/api/auth/me"),
};

export interface TaskListParams {
  status?: string;
  keyword?: string;
  page?: number;
  size?: number;
}

export interface CreateEvidenceParams {
  type: EvidenceType;
  title: string;
  description: string;
  file_url?: string;
}

export interface CreateTaskParams {
  task_no: string;
  project_name: string;
  sample_location: string;
  sample_type: string;
  evidences: CreateEvidenceParams[];
}

export interface UpdateTaskParams {
  task_no?: string;
  project_name?: string;
  sample_location?: string;
  sample_type?: string;
  version: number;
  evidences?: CreateEvidenceParams[];
}

export interface SupervisorReviewParams {
  version: number;
  pass: boolean;
  reason?: string;
}

export interface ReviewerReviewParams {
  version: number;
  approve: boolean;
  reason?: string;
}

export interface BatchReviewItem {
  id: number;
  version: number;
  pass: boolean;
  reason?: string;
}

export const taskApi = {
  list: (params: TaskListParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.keyword) searchParams.set("keyword", params.keyword);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.size) searchParams.set("size", String(params.size));

    const query = searchParams.toString();
    return request<PaginatedResponse<SamplingTask>>(
      `/api/tasks${query ? `?${query}` : ""}`
    );
  },

  get: (id: number | string) =>
    request<SamplingTask>(`/api/tasks/${id}`),

  create: (data: CreateTaskParams) =>
    request<SamplingTask>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number | string, data: UpdateTaskParams) =>
    request<SamplingTask>(`/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  submit: (id: number | string, version: number) =>
    request<SamplingTask>(`/api/tasks/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ version }),
    }),

  supervisorReview: (
    id: number | string,
    data: SupervisorReviewParams
  ) =>
    request<SamplingTask>(`/api/tasks/${id}/supervisor-review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  reviewerReview: (
    id: number | string,
    data: ReviewerReviewParams
  ) =>
    request<SamplingTask>(`/api/tasks/${id}/reviewer-review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getEvidences: (id: number | string) =>
    request<Evidence[]>(`/api/tasks/${id}/evidences`),

  addEvidence: (id: number | string, data: CreateEvidenceParams) =>
    request<Evidence>(`/api/tasks/${id}/evidences`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const batchApi = {
  registrarSubmit: (items: BatchSubmitItem[]) =>
    request<BatchResult>("/api/batch/registrar-submit", {
      method: "POST",
      body: JSON.stringify(items),
    }),

  supervisorReview: (items: BatchReviewItem[]) =>
    request<BatchResult>("/api/batch/supervisor-review", {
      method: "POST",
      body: JSON.stringify(items),
    }),

  reviewerReview: (items: BatchReviewItem[]) =>
    request<BatchResult>("/api/batch/reviewer-review", {
      method: "POST",
      body: JSON.stringify(items),
    }),
};
