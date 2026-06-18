use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Registrar,
    Auditor,
    Reviewer,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Registrar => "registrar",
            UserRole::Auditor => "auditor",
            UserRole::Reviewer => "reviewer",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "registrar" => Some(UserRole::Registrar),
            "auditor" => Some(UserRole::Auditor),
            "reviewer" => Some(UserRole::Reviewer),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Draft,
    Registered,
    Verifying,
    VerifyPassed,
    VerifyReturned,
    AppealSubmitted,
    AppealAccepted,
    AppealRejectedCorrection,
    AppealResubmitted,
    Reviewing,
    ReviewConfirmed,
    ReviewReturned,
    Archived,
}

impl OrderStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            OrderStatus::Draft => "draft",
            OrderStatus::Registered => "registered",
            OrderStatus::Verifying => "verifying",
            OrderStatus::VerifyPassed => "verify_passed",
            OrderStatus::VerifyReturned => "verify_returned",
            OrderStatus::AppealSubmitted => "appeal_submitted",
            OrderStatus::AppealAccepted => "appeal_accepted",
            OrderStatus::AppealRejectedCorrection => "appeal_rejected_correction",
            OrderStatus::AppealResubmitted => "appeal_resubmitted",
            OrderStatus::Reviewing => "reviewing",
            OrderStatus::ReviewConfirmed => "review_confirmed",
            OrderStatus::ReviewReturned => "review_returned",
            OrderStatus::Archived => "archived",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(OrderStatus::Draft),
            "registered" => Some(OrderStatus::Registered),
            "verifying" => Some(OrderStatus::Verifying),
            "verify_passed" => Some(OrderStatus::VerifyPassed),
            "verify_returned" => Some(OrderStatus::VerifyReturned),
            "appeal_submitted" => Some(OrderStatus::AppealSubmitted),
            "appeal_accepted" => Some(OrderStatus::AppealAccepted),
            "appeal_rejected_correction" => Some(OrderStatus::AppealRejectedCorrection),
            "appeal_resubmitted" => Some(OrderStatus::AppealResubmitted),
            "reviewing" => Some(OrderStatus::Reviewing),
            "review_confirmed" => Some(OrderStatus::ReviewConfirmed),
            "review_returned" => Some(OrderStatus::ReviewReturned),
            "archived" => Some(OrderStatus::Archived),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub name: String,
    pub role: String,
    pub company: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceItem {
    pub name: String,
    pub url: String,
    pub uploaded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SparePartOrderDb {
    pub id: String,
    pub order_no: String,
    pub title: String,
    pub part_name: String,
    pub part_model: String,
    pub quantity: i64,
    pub reason: String,
    pub station_name: String,
    pub status: String,
    pub current_handler_id: String,
    pub current_handler_name: String,
    pub current_handler_role: String,
    pub version: i64,
    pub evidence: String,
    pub registrar_id: String,
    pub registrar_name: String,
    pub appeal_reason: Option<String>,
    pub review_opinion: Option<String>,
    pub reject_reason: Option<String>,
    pub original_status: Option<String>,
    pub deadline: Option<String>,
    pub is_overdue: bool,
    pub is_evidence_missing: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SparePartOrder {
    pub id: String,
    pub order_no: String,
    pub title: String,
    pub part_name: String,
    pub part_model: String,
    pub quantity: i64,
    pub reason: String,
    pub station_name: String,
    pub status: String,
    pub current_handler_id: String,
    pub current_handler_name: String,
    pub current_handler_role: String,
    pub version: i64,
    pub evidence: Vec<EvidenceItem>,
    pub registrar_id: String,
    pub registrar_name: String,
    pub appeal_reason: Option<String>,
    pub review_opinion: Option<String>,
    pub reject_reason: Option<String>,
    pub original_status: Option<String>,
    pub deadline: Option<String>,
    pub is_overdue: bool,
    pub is_evidence_missing: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<SparePartOrderDb> for SparePartOrder {
    fn from(db: SparePartOrderDb) -> Self {
        let evidence: Vec<EvidenceItem> = serde_json::from_str(&db.evidence).unwrap_or_default();
        SparePartOrder {
            id: db.id,
            order_no: db.order_no,
            title: db.title,
            part_name: db.part_name,
            part_model: db.part_model,
            quantity: db.quantity,
            reason: db.reason,
            station_name: db.station_name,
            status: db.status,
            current_handler_id: db.current_handler_id,
            current_handler_name: db.current_handler_name,
            current_handler_role: db.current_handler_role,
            version: db.version,
            evidence,
            registrar_id: db.registrar_id,
            registrar_name: db.registrar_name,
            appeal_reason: db.appeal_reason,
            review_opinion: db.review_opinion,
            reject_reason: db.reject_reason,
            original_status: db.original_status,
            deadline: db.deadline,
            is_overdue: db.is_overdue,
            is_evidence_missing: db.is_evidence_missing,
            created_at: db.created_at,
            updated_at: db.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProcessRecord {
    pub id: String,
    pub order_id: String,
    pub handler_id: String,
    pub handler_name: String,
    pub handler_role: String,
    pub action: String,
    pub opinion: String,
    pub from_status: String,
    pub to_status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderStats {
    pub total: i64,
    pub registered: i64,
    pub verifying: i64,
    pub reviewing: i64,
    pub appeal: i64,
    pub archived: i64,
    pub overdue: i64,
    pub evidence_missing: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderListResponse {
    pub orders: Vec<SparePartOrder>,
    pub total: i64,
    pub stats: OrderStats,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ActionRequest {
    pub order_id: String,
    pub version: i64,
    pub handler_id: String,
    pub opinion: Option<String>,
    pub evidence: Option<Vec<EvidenceItem>>,
    pub appeal_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateOrderRequest {
    pub title: String,
    pub part_name: String,
    pub part_model: String,
    pub quantity: i64,
    pub reason: String,
    pub station_name: String,
    pub registrar_id: String,
    pub evidence: Option<Vec<EvidenceItem>>,
}

pub fn new_uuid() -> String {
    Uuid::new_v4().to_string()
}

pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
