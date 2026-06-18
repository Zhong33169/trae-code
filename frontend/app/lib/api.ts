import type {
  User,
  TrainingProject,
  TrainingProjectListItem,
  Evidence,
  OperationLog,
  AppealRecord,
  Statistics,
  LabelMap,
  SubmitData,
  ReviewData,
  ReturnForCorrectionData,
  CorrectData,
  ConflictRecoveryData,
  AppealSubmitData,
  AppealReviewData,
  ProjectCreate,
  EvidenceCreate,
  Stage,
  Status,
} from "./types";

const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:8001/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    let message = `请求失败: ${res.status}`;
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getLabels: () => request<LabelMap>("/labels"),

  getUsers: () => request<User[]>("/users"),
  getUser: (id: number) => request<User>(`/users/${id}`),

  getProjects: (params?: {
    status?: Status;
    stage?: Stage;
    handler_id?: number;
    creator_id?: number;
  }) => {
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : "";
    return request<TrainingProjectListItem[]>(`/projects${qs}`);
  },

  getProject: (id: number) => request<TrainingProject>(`/projects/${id}`),
  createProject: (data: ProjectCreate) =>
    request<TrainingProject>("/projects", { method: "POST", body: JSON.stringify(data) }),

  getEvidences: (projectId: number) =>
    request<Evidence[]>(`/projects/${projectId}/evidences`),
  addEvidence: (projectId: number, data: EvidenceCreate) =>
    request<Evidence>(`/projects/${projectId}/evidences`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteEvidence: (projectId: number, evidenceId: number) =>
    request<void>(`/projects/${projectId}/evidences/${evidenceId}`, {
      method: "DELETE",
    }),

  getLogs: (projectId: number) =>
    request<OperationLog[]>(`/projects/${projectId}/logs`),
  getAppeals: (projectId: number) =>
    request<AppealRecord[]>(`/projects/${projectId}/appeals`),

  submitProject: (projectId: number, data: SubmitData, version?: number) => {
    const qs = version !== undefined ? `?version=${version}` : "";
    return request<TrainingProject>(`/projects/${projectId}/submit${qs}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  approveProject: (projectId: number, data: ReviewData, version?: number) => {
    const qs = version !== undefined ? `?version=${version}` : "";
    return request<TrainingProject>(`/projects/${projectId}/review/approve${qs}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  rejectProject: (projectId: number, data: ReviewData, version?: number) => {
    const qs = version !== undefined ? `?version=${version}` : "";
    return request<TrainingProject>(`/projects/${projectId}/review/reject${qs}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  returnProject: (projectId: number, data: ReturnForCorrectionData, version?: number) => {
    const qs = version !== undefined ? `?version=${version}` : "";
    return request<TrainingProject>(`/projects/${projectId}/return${qs}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  correctProject: (projectId: number, data: CorrectData, version?: number) => {
    const qs = version !== undefined ? `?version=${version}` : "";
    return request<TrainingProject>(`/projects/${projectId}/correct${qs}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  recoverConflict: (projectId: number, data: ConflictRecoveryData, version?: number) => {
    const qs = version !== undefined ? `?version=${version}` : "";
    return request<TrainingProject>(`/projects/${projectId}/recover${qs}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  submitAppeal: (projectId: number, data: AppealSubmitData, version?: number) => {
    const qs = version !== undefined ? `?version=${version}` : "";
    return request<TrainingProject>(`/projects/${projectId}/appeal${qs}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  reviewAppeal: (projectId: number, data: AppealReviewData, version?: number) => {
    const qs = version !== undefined ? `?version=${version}` : "";
    return request<TrainingProject>(`/projects/${projectId}/appeal/review${qs}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  archiveProject: (projectId: number, userId: number, version?: number) => {
    const qs = new URLSearchParams({ current_user_id: String(userId) });
    if (version !== undefined) qs.set("version", String(version));
    return request<TrainingProject>(`/projects/${projectId}/archive?${qs.toString()}`, {
      method: "POST",
    });
  },

  receiveProject: (projectId: number, userId: number, version?: number) => {
    const qs = new URLSearchParams({ current_user_id: String(userId) });
    if (version !== undefined) qs.set("version", String(version));
    return request<TrainingProject>(`/projects/${projectId}/receive?${qs.toString()}`, {
      method: "POST",
    });
  },

  markOverdue: (projectId: number, userId: number) => {
    const qs = new URLSearchParams({ current_user_id: String(userId) });
    return request<TrainingProject>(`/projects/${projectId}/mark-overdue?${qs.toString()}`, {
      method: "POST",
    });
  },

  getStatistics: () => request<Statistics>("/statistics"),
};
