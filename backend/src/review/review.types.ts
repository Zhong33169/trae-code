export enum UserRole {
  FINANCIAL_ADVISOR = 'FINANCIAL_ADVISOR',
  COMPLIANCE_OFFICER = 'COMPLIANCE_OFFICER',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
}

export enum RiskLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum ReviewStatus {
  REGISTERED = 'REGISTERED',
  PENDING_CORRECTION = 'PENDING_CORRECTION',
  REVIEWING = 'REVIEWING',
  COMPLETED = 'COMPLETED',
}

export enum ReviewAction {
  REGISTER = 'REGISTER',
  SUBMIT_REVIEW = 'SUBMIT_REVIEW',
  REQUEST_CORRECTION = 'REQUEST_CORRECTION',
  CORRECT = 'CORRECT',
  CONFIRM_COMPLETE = 'CONFIRM_COMPLETE',
  REJECT = 'REJECT',
  APPROVE = 'APPROVE',
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
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
  risk_level: RiskLevel;
  status: ReviewStatus;
  priority: number;
  current_handler_id: string | null;
  current_role: UserRole | null;
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
  operator_role: UserRole;
  action: ReviewAction;
  from_status: ReviewStatus | null;
  to_status: ReviewStatus | null;
  opinion: string | null;
  result: string | null;
  evidence_json: string | null;
  version: number;
  created_at: string;
}

export const RISK_PRIORITY: Record<RiskLevel, number> = {
  [RiskLevel.HIGH]: 100,
  [RiskLevel.MEDIUM]: 50,
  [RiskLevel.LOW]: 10,
};

export const RISK_REQUIRED_EVIDENCE: Record<RiskLevel, string[]> = {
  [RiskLevel.HIGH]: ['客户身份证明', '交易授权书', '风险揭示书', '资金来源证明'],
  [RiskLevel.MEDIUM]: ['客户身份证明', '交易授权书', '风险揭示书'],
  [RiskLevel.LOW]: ['客户身份证明', '交易授权书'],
};

export const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.FINANCIAL_ADVISOR]: '理财顾问',
  [UserRole.COMPLIANCE_OFFICER]: '合规专员',
  [UserRole.BRANCH_MANAGER]: '营业部经理',
};

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  [ReviewStatus.REGISTERED]: '已登记',
  [ReviewStatus.PENDING_CORRECTION]: '待补正',
  [ReviewStatus.REVIEWING]: '复核中',
  [ReviewStatus.COMPLETED]: '办结',
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  [RiskLevel.HIGH]: '高风险',
  [RiskLevel.MEDIUM]: '中风险',
  [RiskLevel.LOW]: '低风险',
};

export const ACTION_LABEL: Record<ReviewAction, string> = {
  [ReviewAction.REGISTER]: '登记',
  [ReviewAction.SUBMIT_REVIEW]: '提交复核',
  [ReviewAction.REQUEST_CORRECTION]: '退回补正',
  [ReviewAction.CORRECT]: '补正提交',
  [ReviewAction.CONFIRM_COMPLETE]: '确认办结',
  [ReviewAction.REJECT]: '驳回',
  [ReviewAction.APPROVE]: '通过',
};
