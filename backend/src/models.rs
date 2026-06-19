use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub real_name: String,
    pub role: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
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
pub struct Claims {
    pub sub: String,
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaPlan {
    pub id: String,
    pub plan_no: String,
    pub title: String,
    pub client_name: String,
    pub status: String,
    pub version: i64,
    pub created_by: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub approved_at: Option<DateTime<Utc>>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub archived_at: Option<DateTime<Utc>>,
    pub remark: Option<String>,
    pub reject_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePlanRequest {
    pub title: String,
    pub client_name: String,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePlanRequest {
    pub title: Option<String>,
    pub client_name: Option<String>,
    pub remark: Option<String>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApproveRequest {
    pub version: i64,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectRequest {
    pub version: i64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewRequest {
    pub version: i64,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitRequest {
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveRequest {
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchPlanItem {
    pub plan_id: String,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchReviewRequest {
    pub items: Vec<BatchPlanItem>,
    pub action: String,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResultItem {
    pub plan_id: String,
    pub plan_no: String,
    pub success: bool,
    pub status: String,
    pub message: String,
    pub need_retry: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchReviewResponse {
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub need_retry: usize,
    pub results: Vec<BatchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaSchedule {
    pub id: String,
    pub plan_id: String,
    pub media_name: String,
    pub ad_position: String,
    pub start_date: String,
    pub end_date: String,
    pub frequency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Budget {
    pub id: String,
    pub plan_id: String,
    pub item_name: String,
    pub amount: f64,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Evidence {
    pub id: String,
    pub plan_id: String,
    pub evidence_type: String,
    pub name: String,
    pub file_path: String,
    pub uploaded_by: String,
    pub uploaded_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanListQuery {
    pub status: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OperationLog {
    pub id: String,
    pub plan_id: String,
    pub operator_id: String,
    pub operation: String,
    pub old_status: Option<String>,
    pub new_status: Option<String>,
    pub remark: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLogWithOperator {
    pub id: String,
    pub plan_id: String,
    pub operator_id: String,
    pub operator_name: String,
    pub operation: String,
    pub old_status: Option<String>,
    pub new_status: Option<String>,
    pub remark: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanDetailResponse {
    pub plan: MediaPlan,
    pub schedules: Vec<MediaSchedule>,
    pub budgets: Vec<Budget>,
    pub evidences: Vec<Evidence>,
    pub operation_logs: Vec<OperationLogWithOperator>,
    pub created_by_name: String,
}

impl User {
    pub fn new(username: &str, password_hash: &str, real_name: &str, role: &str) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            username: username.to_string(),
            password_hash: password_hash.to_string(),
            real_name: real_name.to_string(),
            role: role.to_string(),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        }
    }
}

pub mod roles {
    pub const REGISTRAR: &str = "registrar";
    pub const AUDITOR: &str = "auditor";
    pub const REVIEWER: &str = "reviewer";

    pub fn role_name(role: &str) -> &str {
        match role {
            REGISTRAR => "媒介计划登记员",
            AUDITOR => "媒介计划审核主管",
            REVIEWER => "广告代理公司复核负责人",
            _ => "未知角色",
        }
    }
}

pub mod plan_status {
    pub const DRAFT: &str = "draft";
    pub const PENDING_AUDIT: &str = "pending_audit";
    pub const AUDIT_APPROVED: &str = "audit_approved";
    pub const AUDIT_REJECTED: &str = "audit_rejected";
    pub const PENDING_REVIEW: &str = "pending_review";
    pub const REVIEW_APPROVED: &str = "review_approved";
    pub const REVIEW_REJECTED: &str = "review_rejected";
    pub const ARCHIVED: &str = "archived";

    pub fn status_name(status: &str) -> &str {
        match status {
            DRAFT => "草稿",
            PENDING_AUDIT => "待审核",
            AUDIT_APPROVED => "审核通过",
            AUDIT_REJECTED => "审核驳回",
            PENDING_REVIEW => "待复核",
            REVIEW_APPROVED => "复核通过",
            REVIEW_REJECTED => "复核驳回",
            ARCHIVED => "已归档",
            _ => "未知状态",
        }
    }

    pub fn can_transition(from: &str, to: &str) -> bool {
        matches!(
            (from, to),
            (DRAFT, PENDING_AUDIT)
                | (PENDING_AUDIT, AUDIT_APPROVED)
                | (PENDING_AUDIT, AUDIT_REJECTED)
                | (AUDIT_REJECTED, DRAFT)
                | (AUDIT_APPROVED, PENDING_REVIEW)
                | (PENDING_REVIEW, REVIEW_APPROVED)
                | (PENDING_REVIEW, REVIEW_REJECTED)
                | (REVIEW_REJECTED, PENDING_AUDIT)
                | (REVIEW_APPROVED, ARCHIVED)
        )
    }
}
