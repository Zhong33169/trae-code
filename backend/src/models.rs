use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Registrar,
    Reviewer,
    FinalReviewer,
}

impl UserRole {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "registrar" => Some(UserRole::Registrar),
            "reviewer" => Some(UserRole::Reviewer),
            "final_reviewer" => Some(UserRole::FinalReviewer),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Registrar => "registrar",
            UserRole::Reviewer => "reviewer",
            UserRole::FinalReviewer => "final_reviewer",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            UserRole::Registrar => "补货登记员",
            UserRole::Reviewer => "补货审核主管",
            UserRole::FinalReviewer => "连锁复核负责人",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub display_name: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserWithPassword {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub display_name: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApplicationStatus {
    Draft,
    PendingReview,
    Reviewed,
    NeedsCorrection,
    Archived,
}

impl ApplicationStatus {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(ApplicationStatus::Draft),
            "pending_review" => Some(ApplicationStatus::PendingReview),
            "reviewed" => Some(ApplicationStatus::Reviewed),
            "needs_correction" => Some(ApplicationStatus::NeedsCorrection),
            "archived" => Some(ApplicationStatus::Archived),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            ApplicationStatus::Draft => "draft",
            ApplicationStatus::PendingReview => "pending_review",
            ApplicationStatus::Reviewed => "reviewed",
            ApplicationStatus::NeedsCorrection => "needs_correction",
            ApplicationStatus::Archived => "archived",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            ApplicationStatus::Draft => "草稿",
            ApplicationStatus::PendingReview => "待审核",
            ApplicationStatus::Reviewed => "审核通过",
            ApplicationStatus::NeedsCorrection => "需补正",
            ApplicationStatus::Archived => "已归档",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplenishmentItem {
    pub sku: String,
    pub name: String,
    pub quantity: i32,
    pub unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Store {
    pub id: i64,
    pub store_no: String,
    pub store_name: String,
    pub address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplenishmentApplication {
    pub id: i64,
    pub application_no: String,
    pub store_id: i64,
    pub store_no: String,
    pub store_name: String,
    pub status: ApplicationStatus,
    pub current_version: i32,
    pub items: Vec<ReplenishmentItem>,
    pub evidence_store_replenishment: Option<String>,
    pub evidence_delivery_confirmation: Option<String>,
    pub evidence_registration: Option<String>,
    pub remarks: Option<String>,
    pub created_by: i64,
    pub created_by_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_by: Option<i64>,
    pub updated_by_name: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    Create,
    Submit,
    ReviewApprove,
    ReviewReject,
    Correct,
    FinalApprove,
    FinalReject,
}

impl ActionType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "create" => Some(ActionType::Create),
            "submit" => Some(ActionType::Submit),
            "review_approve" => Some(ActionType::ReviewApprove),
            "review_reject" => Some(ActionType::ReviewReject),
            "correct" => Some(ActionType::Correct),
            "final_approve" => Some(ActionType::FinalApprove),
            "final_reject" => Some(ActionType::FinalReject),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            ActionType::Create => "create",
            ActionType::Submit => "submit",
            ActionType::ReviewApprove => "review_approve",
            ActionType::ReviewReject => "review_reject",
            ActionType::Correct => "correct",
            ActionType::FinalApprove => "final_approve",
            ActionType::FinalReject => "final_reject",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            ActionType::Create => "创建申请",
            ActionType::Submit => "提交审核",
            ActionType::ReviewApprove => "审核通过",
            ActionType::ReviewReject => "审核驳回",
            ActionType::Correct => "补正提交",
            ActionType::FinalApprove => "复核归档",
            ActionType::FinalReject => "复核驳回",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationVersion {
    pub id: i64,
    pub application_id: i64,
    pub version: i32,
    pub status_from: Option<String>,
    pub status_to: String,
    pub items: Option<Vec<ReplenishmentItem>>,
    pub evidence_store_replenishment: Option<String>,
    pub evidence_delivery_confirmation: Option<String>,
    pub evidence_registration: Option<String>,
    pub remarks: Option<String>,
    pub action: ActionType,
    pub performed_by: i64,
    pub performed_by_name: String,
    pub performed_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub user: User,
    pub token: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateApplicationRequest {
    pub store_id: i64,
    pub items: Vec<ReplenishmentItem>,
    pub evidence_store_replenishment: Option<String>,
    pub evidence_delivery_confirmation: Option<String>,
    pub evidence_registration: Option<String>,
    pub remarks: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateApplicationRequest {
    pub current_version: i32,
    pub items: Option<Vec<ReplenishmentItem>>,
    pub evidence_store_replenishment: Option<String>,
    pub evidence_delivery_confirmation: Option<String>,
    pub evidence_registration: Option<String>,
    pub remarks: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitRequest {
    pub current_version: i32,
}

#[derive(Debug, Deserialize)]
pub struct ReviewRequest {
    pub current_version: i32,
    pub approved: bool,
    pub remarks: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchReviewItem {
    pub application_id: i64,
    pub current_version: i32,
}

#[derive(Debug, Deserialize)]
pub struct BatchReviewRequest {
    pub applications: Vec<BatchReviewItem>,
    pub approved: bool,
    pub remarks: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BatchResultItem {
    pub application_id: i64,
    pub application_no: String,
    pub success: bool,
    pub status: String,
    pub message: String,
    pub attempted_version: i32,
    pub new_version: Option<i32>,
    pub performer_role: Option<String>,
    pub performer_name: Option<String>,
    pub status_from: Option<String>,
    pub status_to: Option<String>,
    pub remarks: Option<String>,
    pub evidence_store_replenishment: Option<String>,
    pub evidence_delivery_confirmation: Option<String>,
    pub evidence_registration: Option<String>,
    pub items_count: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct BatchReviewResponse {
    pub results: Vec<BatchResultItem>,
    pub success_count: usize,
    pub failed_count: usize,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub error: String,
    pub details: Option<String>,
}
