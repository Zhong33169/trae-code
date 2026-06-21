use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
#[allow(unused_imports)]
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: i64,
    pub role_code: String,
    pub role_name: String,
    pub description: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub real_name: String,
    pub role_id: i64,
    pub role_code: Option<String>,
    pub role_name: Option<String>,
    pub status: i64,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountsReceivable {
    pub id: i64,
    pub ar_no: String,
    pub buyer_name: String,
    pub supplier_name: String,
    pub amount: f64,
    pub invoice_no: Option<String>,
    pub invoice_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub status: String,
    pub status_name: Option<String>,
    pub remark: Option<String>,
    pub created_by: Option<i64>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub confirmation_count: Option<i64>,
    pub verified_amount: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfirmationOrder {
    pub id: i64,
    pub order_no: String,
    pub ar_id: i64,
    pub ar_no: String,
    pub buyer_name: String,
    pub supplier_name: String,
    pub amount: f64,
    pub confirm_amount: Option<f64>,
    pub status: String,
    pub status_name: Option<String>,
    pub current_handler_role: Option<String>,
    pub current_handler_name: Option<String>,
    pub reject_reason: Option<String>,
    pub advance_reason: Option<String>,
    pub shift: Option<String>,
    pub handover_from: Option<i64>,
    pub handover_from_name: Option<String>,
    pub handover_to: Option<i64>,
    pub handover_to_name: Option<String>,
    pub handover_time: Option<DateTime<Utc>>,
    pub created_by: Option<i64>,
    pub created_by_name: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub verification_count: Option<i64>,
    pub verified_amount: Option<f64>,
    pub allowed_actions: Option<Vec<String>>,
    pub visible_fields: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentVerification {
    pub id: i64,
    pub verify_no: String,
    pub order_id: i64,
    pub order_no: String,
    pub payment_amount: f64,
    pub payment_date: NaiveDate,
    pub payer_name: Option<String>,
    pub bank_slip_no: Option<String>,
    pub remark: Option<String>,
    pub status: String,
    pub status_name: Option<String>,
    pub created_by: Option<i64>,
    pub created_by_name: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLog {
    pub id: i64,
    pub user_id: Option<i64>,
    pub user_name: Option<String>,
    pub action: String,
    pub target_type: String,
    pub target_id: Option<i64>,
    pub target_no: Option<String>,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub remark: Option<String>,
    pub ip_address: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T: Serialize> {
    pub code: i32,
    pub message: String,
    pub data: Option<T>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            code: 0,
            message: "success".to_string(),
            data: Some(data),
        }
    }

    pub fn success_msg(msg: &str) -> Self {
        Self {
            code: 0,
            message: msg.to_string(),
            data: None,
        }
    }

    pub fn error(code: i32, msg: &str) -> Self {
        Self {
            code,
            message: msg.to_string(),
            data: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateArRequest {
    pub buyer_name: String,
    pub supplier_name: String,
    pub amount: f64,
    pub invoice_no: Option<String>,
    pub invoice_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateArRequest {
    pub buyer_name: Option<String>,
    pub supplier_name: Option<String>,
    pub amount: Option<f64>,
    pub invoice_no: Option<String>,
    pub invoice_date: Option<NaiveDate>,
    pub due_date: Option<NaiveDate>,
    pub status: Option<String>,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrderRequest {
    pub ar_id: i64,
    pub confirm_amount: Option<f64>,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitOrderRequest {
    pub order_id: i64,
    pub shift: String,
    pub handover_from: i64,
    pub handover_to: i64,
    pub advance_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApproveOrderRequest {
    pub order_id: i64,
    pub shift: String,
    pub handover_from: i64,
    pub handover_to: i64,
    pub advance_reason: String,
    pub confirm_amount: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectOrderRequest {
    pub order_id: i64,
    pub reject_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewOrderRequest {
    pub order_id: i64,
    pub shift: String,
    pub handover_from: i64,
    pub handover_to: i64,
    pub advance_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveOrderRequest {
    pub order_id: i64,
    pub advance_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSubmitRequest {
    pub order_ids: Vec<i64>,
    pub shift: String,
    pub handover_from: i64,
    pub handover_to: i64,
    pub advance_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResultItem {
    pub order_id: i64,
    pub order_no: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSubmitResponse {
    pub total: usize,
    pub success_count: usize,
    pub fail_count: usize,
    pub results: Vec<BatchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateVerificationRequest {
    pub order_id: i64,
    pub payment_amount: f64,
    pub payment_date: NaiveDate,
    pub payer_name: Option<String>,
    pub bank_slip_no: Option<String>,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsResponse {
    pub ar_total: i64,
    pub ar_total_amount: f64,
    pub ar_pending: i64,
    pub ar_confirmed: i64,
    pub order_total: i64,
    pub order_draft: i64,
    pub order_pending_audit: i64,
    pub order_pending_review: i64,
    pub order_archived: i64,
    pub order_returned: i64,
    pub verification_total: i64,
    pub verification_total_amount: f64,
    pub order_amount_by_status: Vec<StatusAmountItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusAmountItem {
    pub status: String,
    pub status_name: String,
    pub count: i64,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListQueryParams {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub status: Option<String>,
    pub keyword: Option<String>,
    pub ar_id: Option<i64>,
    pub target_type: Option<String>,
    pub target_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

pub fn status_to_name(status: &str) -> &str {
    match status {
        "draft" => "草稿",
        "pending_audit" => "待审核",
        "pending_review" => "待复核",
        "archived" => "已归档",
        "returned" => "已退回",
        "pending" => "待确权",
        "confirmed" => "已确权",
        "verified" => "已核销",
        _ => status,
    }
}

pub fn get_role_actions(role_code: &str, order_status: &str) -> Vec<String> {
    match (role_code, order_status) {
        ("registrar", "draft") => vec!["submit".to_string(), "edit".to_string(), "delete".to_string()],
        ("registrar", "returned") => vec!["resubmit".to_string(), "edit".to_string()],
        ("auditor", "pending_audit") => vec!["approve".to_string(), "reject".to_string(), "view".to_string()],
        ("reviewer", "pending_review") => vec!["archive".to_string(), "reject".to_string(), "view".to_string()],
        ("reviewer", "archived") => vec!["view".to_string(), "create_verification".to_string()],
        (_, "archived") => vec!["view".to_string()],
        _ => vec!["view".to_string()],
    }
}

pub fn get_role_visible_fields(role_code: &str) -> Vec<String> {
    match role_code {
        "registrar" => vec![
            "order_no".to_string(),
            "ar_no".to_string(),
            "buyer_name".to_string(),
            "supplier_name".to_string(),
            "amount".to_string(),
            "confirm_amount".to_string(),
            "status".to_string(),
            "reject_reason".to_string(),
            "created_at".to_string(),
        ],
        "auditor" => vec![
            "order_no".to_string(),
            "ar_no".to_string(),
            "buyer_name".to_string(),
            "supplier_name".to_string(),
            "amount".to_string(),
            "confirm_amount".to_string(),
            "status".to_string(),
            "advance_reason".to_string(),
            "reject_reason".to_string(),
            "shift".to_string(),
            "handover_from".to_string(),
            "handover_to".to_string(),
            "handover_time".to_string(),
            "created_at".to_string(),
        ],
        "reviewer" => vec![
            "order_no".to_string(),
            "ar_no".to_string(),
            "buyer_name".to_string(),
            "supplier_name".to_string(),
            "amount".to_string(),
            "confirm_amount".to_string(),
            "status".to_string(),
            "advance_reason".to_string(),
            "reject_reason".to_string(),
            "shift".to_string(),
            "handover_from".to_string(),
            "handover_to".to_string(),
            "handover_time".to_string(),
            "created_at".to_string(),
            "verified_amount".to_string(),
        ],
        _ => vec!["order_no".to_string(), "status".to_string()],
    }
}
