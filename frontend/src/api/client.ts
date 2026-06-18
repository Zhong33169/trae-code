const API_BASE = 'http://localhost:8004/api';

export interface ApiResult<T = any> {
  code: number;
  data: T;
  message: string;
}

let token = '';
if (typeof window !== 'undefined') {
  token = localStorage.getItem('pp_token') || '';
}

export function setToken(t: string) {
  token = t;
  localStorage.setItem('pp_token', t);
}

export function clearToken() {
  token = '';
  localStorage.removeItem('pp_token');
  localStorage.removeItem('pp_user');
}

export function getToken() {
  return token;
}

export async function api<T = any>(
  path: string,
  options: RequestInit & { params?: Record<string, any> } = {},
): Promise<ApiResult<T>> {
  let url = API_BASE + path;
  if (options.params) {
    const qs = new URLSearchParams();
    for (const k of Object.keys(options.params)) {
      const v = options.params[k];
      if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const resp = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as any || {}) },
    });
    const data = await resp.json().catch(() => ({ code: resp.status, data: null, message: '响应解析失败' }));
    return data as ApiResult<T>;
  } catch (e: any) {
    return { code: -1, data: null as any, message: '网络错误：' + (e?.message || e) };
  }
}

export interface UserInfo {
  id: number;
  username: string;
  realName: string;
  role: 'REGISTER' | 'AUDIT' | 'REVIEW';
  roleName: string;
}

export interface PlanItem {
  id: number;
  planNo: string;
  title: string;
  status: string;
  statusName: string;
  channel?: string;
  planPublishTime?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; realName: string; role: string; roleName: string } | null;
  currentHandler: { id: number; realName: string; role: string; roleName: string } | null;
  currentHandlerRole?: string;
  currentHandlerRoleName?: string;
  awaitingAccept: HandoverItem | null;
}

export interface PlanDetail extends PlanItem {
  content?: string;
  targetAudience?: string;
  materialInfo?: string;
  auditRemark?: string;
  materialRemark?: string;
  deliveryRemark?: string;
  reviewRemark?: string;
  auditTime?: string;
  materialTime?: string;
  deliveryTime?: string;
  archiveTime?: string;
  handovers: HandoverItem[];
  logs: LogItem[];
  latestHandover: HandoverItem | null;
  permissions: Record<string, boolean>;
}

export interface HandoverItem {
  id?: number;
  state?: 'PENDING_ACCEPT' | 'ACCEPTED';
  stateName?: string;
  handFrom: { id: number; realName: string };
  handTo: { id: number; realName: string };
  fromShift: string;
  fromShiftName: string;
  toShift: string;
  toShiftName: string;
  confirmTime: string;
  acceptedAt?: string;
  remark?: string;
  acceptRemark?: string;
  createdAt?: string;
}

export interface LogItem {
  id: number;
  action: string;
  description: string;
  operator: { id: number; realName: string; roleName: string } | null;
  createdAt: string;
}

export interface StatResult {
  total: number;
  todayCount: number;
  closedCount: number;
  pendingCount: number;
  closedRate: number;
  byStatus: Record<string, number>;
  statusLabels: Record<string, string>;
  byRole: Record<string, number>;
  roleLabels: Record<string, string>;
  byBucket: Record<string, number>;
  bucketLabels: Record<string, string>;
}
