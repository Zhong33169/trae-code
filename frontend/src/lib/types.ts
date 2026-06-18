export interface User {
  id: string;
  username: string;
  display_name: string;
  role: 'REGISTRAR' | 'AUDITOR' | 'REVIEWER';
  created_at: string;
}

export interface FinancingApplication {
  id: string;
  application_no: string;
  applicant_name: string;
  applicant_id_card: string;
  company_name: string;
  company_credit_code: string;
  financing_amount: number;
  financing_term_months: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  current_handler: string;
  current_handler_name?: string;
  current_handler_role?: string;
  version: number;
  required_evidence: string[];
  submitted_evidence: string[];
  last_handler_id?: string;
  last_handler_name?: string;
  last_handler_role?: string;
  last_opinion?: string;
  last_result?: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface OperationRecord {
  id: string;
  application_id: string;
  operator_id: string;
  operator_name?: string;
  operator_role: string;
  action: string;
  from_status?: string;
  to_status?: string;
  from_risk_level?: string;
  to_risk_level?: string;
  opinion?: string;
  result: string;
  version_before: number;
  version_after: number;
  created_at: string;
}

export interface Statistics {
  total: number;
  total_amount: number;
  archived_amount: number;
  high_risk_count: number;
  count_by_status: Record<string, number>;
  count_by_risk: Record<string, number>;
  handler_queue: Array<{
    user_id: string;
    display_name: string;
    role: string;
    queue_count: number;
  }>;
}

export const ROLE_LABEL: Record<string, string> = {
  REGISTRAR: '融资申请登记员',
  AUDITOR: '融资申请审核主管',
  REVIEWER: '供应链金融平台复核负责人'
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_VERIFICATION: '待核验',
  VERIFICATION_PASSED: '核验通过待转',
  EVIDENCE_MISSING: '缺证据',
  OVERDUE: '逾期',
  RETURNED_FOR_CORRECTION: '退回补正',
  STATUS_CONFLICT: '状态冲突',
  REVIEW_PENDING: '待复核',
  ARCHIVED: '归档',
  REJECTED: '驳回'
};

export const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#6b7280',
  PENDING_VERIFICATION: '#2563eb',
  VERIFICATION_PASSED: '#0891b2',
  EVIDENCE_MISSING: '#d97706',
  OVERDUE: '#dc2626',
  RETURNED_FOR_CORRECTION: '#c2410c',
  STATUS_CONFLICT: '#7c3aed',
  REVIEW_PENDING: '#4f46e5',
  ARCHIVED: '#16a34a',
  REJECTED: '#991b1b'
};

export const RISK_LABEL: Record<string, string> = {
  LOW: '低风险',
  MEDIUM: '中风险',
  HIGH: '高风险',
  CRITICAL: '极高风险'
};

export const RISK_COLOR: Record<string, string> = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#ef4444',
  CRITICAL: '#991b1b'
};

export const RISK_BG: Record<string, string> = {
  LOW: '#f0fdf4',
  MEDIUM: '#fefce8',
  HIGH: '#fef2f2',
  CRITICAL: '#450a0a'
};

export const EVIDENCE_LABEL: Record<string, string> = {
  business_license: '营业执照',
  financial_statement: '财务报表',
  tax_certificate: '税务证明',
  collateral_document: '抵押物证明',
  loan_usage_proof: '贷款用途证明',
  credit_report: '征信报告',
  guarantee_agreement: '担保协议',
  inventory_report: '存货清单',
  trade_contracts: '贸易合同',
  customs_declaration: '报关单',
  guarantor_info: '保证人资料',
  audit_report: '审计报告'
};

export const ACTION_LABEL: Record<string, string> = {
  CREATE: '创建申请单',
  SUBMIT: '提交申请',
  CORRECT: '补正提交',
  VERIFY_PASS: '核验通过',
  VERIFY_FAIL_EVIDENCE: '核验不通过（缺证据）',
  VERIFY_FAIL_OVERDUE: '核验不通过（逾期）',
  VERIFY_RETURN_CORRECTION: '核验退回补正',
  VERIFY_CONFLICT: '核验状态冲突',
  REVIEW_PASS_ARCHIVE: '复核通过并归档',
  REVIEW_REJECT: '复核驳回',
  RISK_UPGRADE: '风险等级升级',
  RISK_DOWNGRADE: '风险等级降级',
  AUDIT_PASS: '复核通过',
  AUDIT_FAIL: '复核不通过'
};

export const RESULT_LABEL: Record<string, string> = {
  SUCCESS: '创建成功',
  SUBMITTED: '已提交',
  CORRECTED: '已补正',
  PASSED: '核验通过',
  EVIDENCE_MISSING: '证据缺失',
  OVERDUE: '存在逾期',
  RETURNED: '已退回',
  CONFLICT: '状态冲突',
  REVIEW_PENDING: '待复核',
  ARCHIVED: '已归档',
  REJECTED: '已驳回',
  RISK_UPGRADED: '已升级风险',
  RISK_DOWNGRADED: '已降级风险',
  VERSION_CONFLICT: '版本冲突'
};
