export interface User {
  id: number
  username: string
  display_name: string
  role: string
}

export interface Evidence {
  id: number
  order_id: number
  evidence_type: string
  evidence_type_display: string
  file_name: string
  file_url: string
  uploader_id: number
  uploader_name: string
  uploaded_at: string
  remark: string
}

export interface TradeOrder {
  id: number
  order_no: string
  customer_name: string
  country: string
  product_name: string
  quantity: number
  unit: string
  amount: number
  currency: string
  status: string
  status_display: string
  version: number
  sales_remark: string
  doc_remark: string
  confirm_remark: string
  exception_remark: string
  created_by_id: number
  created_by_name: string
  doc_handler_id: number | null
  doc_handler_name: string | null
  confirm_handler_id: number | null
  confirm_handler_name: string | null
  created_at: string
  updated_at: string
  submitted_at: string | null
  doc_processed_at: string | null
  confirmed_at: string | null
  evidences: Evidence[]
}

export interface BatchItemResult {
  order_id: number
  order_no: string
  item_status: string
  error_code: string | null
  error_message: string | null
}

export interface BatchOperation {
  id: number
  batch_no: string
  action: string
  action_display: string
  operator_id: number
  operator_name: string
  status: string
  status_display: string
  total_count: number
  success_count: number
  failed_count: number
  retry_count: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  remark: string
  items: BatchItemResult[]
}

export interface OrderHistory {
  id: number
  order_id: number
  operator_id: number
  operator_name: string
  action: string
  from_status: string
  from_status_display: string
  to_status: string
  to_status_display: string
  remark: string
  created_at: string
}

export const RoleLabels: Record<string, string> = {
  sales: '外贸业务员',
  doc_supervisor: '单证主管',
  biz_manager: '业务经理'
}

export const StatusColorClass: Record<string, string> = {
  draft: 'status-draft',
  pending_doc: 'status-pending_doc',
  doc_processing: 'status-doc_processing',
  doc_exception: 'status-doc_exception',
  doc_correction: 'status-doc_correction',
  pending_confirm: 'status-pending_confirm',
  confirm_exception: 'status-confirm_exception',
  confirm_correction: 'status-confirm_correction',
  completed: 'status-completed',
  rejected: 'status-rejected'
}

export const EvidenceTypeLabels: Record<string, string> = {
  inquiry: '客户询盘',
  quotation: '报价确认',
  contract: '订单签订'
}
