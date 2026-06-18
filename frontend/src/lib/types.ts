export const ROLE_LABEL: Record<string, string> = {
  FINANCIAL_ADVISOR: '理财顾问',
  COMPLIANCE_OFFICER: '合规专员',
  BRANCH_MANAGER: '营业部经理',
};

export const STATUS_LABEL: Record<string, string> = {
  REGISTERED: '已登记',
  PENDING_CORRECTION: '待补正',
  REVIEWING: '复核中',
  COMPLETED: '办结',
};

export const RISK_LABEL: Record<string, string> = {
  HIGH: '高风险',
  MEDIUM: '中风险',
  LOW: '低风险',
};

export const ACTION_LABEL: Record<string, string> = {
  REGISTER: '登记',
  SUBMIT_REVIEW: '提交复核',
  REQUEST_CORRECTION: '退回补正',
  CORRECT: '补正提交',
  CONFIRM_COMPLETE: '确认办结',
  REJECT: '驳回',
  APPROVE: '通过',
};

export const RISK_REQUIRED_EVIDENCE: Record<string, string[]> = {
  HIGH: ['客户身份证明', '交易授权书', '风险揭示书', '资金来源证明'],
  MEDIUM: ['客户身份证明', '交易授权书', '风险揭示书'],
  LOW: ['客户身份证明', '交易授权书'],
};

export interface User {
  id: string;
  name: string;
  role: string;
  created_at: string;
}

export interface TradeReview {
  id: string;
  code: string;
  customer_name: string;
  trade_type: string;
  trade_amount: number;
  trade_date: string;
  account_no: string;
  risk_level: string;
  status: string;
  priority: number;
  current_handler_id: string | null;
  current_role: string | null;
  version: number;
  evidence_json: string | null;
  deadline: string | null;
  is_overdue: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewRecord {
  id: string;
  review_id: string;
  operator_id: string;
  operator_name: string;
  operator_role: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  opinion: string | null;
  result: string | null;
  evidence_json: string | null;
  version: number;
  created_at: string;
}

export interface Statistics {
  total: number;
  byStatus: Record<string, number>;
  byRisk: Record<string, number>;
  overdue: number;
  completed: number;
  pending: number;
}

export const statusColor = (s: string): string => {
  switch (s) {
    case 'COMPLETED': return '#10b981';
    case 'REVIEWING': return '#3b82f6';
    case 'PENDING_CORRECTION': return '#f59e0b';
    case 'REGISTERED': return '#6366f1';
    default: return '#6b7280';
  }
};

export const riskColor = (r: string): string => {
  switch (r) {
    case 'HIGH': return '#ef4444';
    case 'MEDIUM': return '#f59e0b';
    case 'LOW': return '#10b981';
    default: return '#6b7280';
  }
};

export const fmtMoney = (n: number): string => '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
export const fmtDate = (s: string | null): string => {
  if (!s) return '-';
  return s.slice(0, 19).replace('T', ' ');
};
export const parseEvidence = (s: string | null): string[] => {
  if (!s) return [];
  try { return JSON.parse(s) as string[]; } catch { return []; }
};
