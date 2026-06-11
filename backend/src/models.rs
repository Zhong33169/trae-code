use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};


#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub name: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DemandStatus {
    PendingRegistrar,
    PendingSupervisor,
    PendingReviewer,
    Completed,
    Rejected,
}

impl DemandStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            DemandStatus::PendingRegistrar => "pending_registrar",
            DemandStatus::PendingSupervisor => "pending_supervisor",
            DemandStatus::PendingReviewer => "pending_reviewer",
            DemandStatus::Completed => "completed",
            DemandStatus::Rejected => "rejected",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending_registrar" => Some(DemandStatus::PendingRegistrar),
            "pending_supervisor" => Some(DemandStatus::PendingSupervisor),
            "pending_reviewer" => Some(DemandStatus::PendingReviewer),
            "completed" => Some(DemandStatus::Completed),
            "rejected" => Some(DemandStatus::Rejected),
            _ => None,
        }
    }

    pub fn can_transition_to(&self, next: &DemandStatus, role: &str) -> bool {
        match (self, next) {
            (DemandStatus::PendingRegistrar, DemandStatus::PendingSupervisor) => role == "registrar",
            (DemandStatus::PendingSupervisor, DemandStatus::PendingReviewer) => role == "supervisor",
            (DemandStatus::PendingSupervisor, DemandStatus::Rejected) => role == "supervisor",
            (DemandStatus::PendingReviewer, DemandStatus::Completed) => role == "reviewer",
            (DemandStatus::PendingReviewer, DemandStatus::Rejected) => role == "reviewer",
            (DemandStatus::PendingSupervisor, DemandStatus::PendingRegistrar) => role == "supervisor",
            (DemandStatus::PendingReviewer, DemandStatus::PendingSupervisor) => role == "reviewer",
            _ => false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CreativeDemand {
    pub id: String,
    pub code: String,
    pub title: String,
    pub client_name: String,
    pub status: String,
    pub current_handler_role: String,
    pub current_handler_id: Option<String>,
    pub brief_materials: Option<String>,
    pub brief_deadline: Option<DateTime<Utc>>,
    pub brief_opinion: Option<String>,
    pub schedule_materials: Option<String>,
    pub schedule_deadline: Option<DateTime<Utc>>,
    pub schedule_opinion: Option<String>,
    pub confirmation_materials: Option<String>,
    pub confirmation_deadline: Option<DateTime<Utc>>,
    pub confirmation_opinion: Option<String>,
    pub attachments: Option<String>,
    pub remarks: Option<String>,
    pub processing_result: Option<String>,
    pub return_reason: Option<String>,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCreativeDemandRequest {
    pub title: String,
    pub client_name: String,
    pub brief_materials: Option<Vec<String>>,
    pub brief_deadline: Option<DateTime<Utc>>,
    pub brief_opinion: Option<String>,
    pub remarks: Option<String>,
    pub attachments: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCreativeDemandRequest {
    pub title: Option<String>,
    pub client_name: Option<String>,
    pub brief_materials: Option<Vec<String>>,
    pub brief_deadline: Option<DateTime<Utc>>,
    pub brief_opinion: Option<String>,
    pub schedule_materials: Option<Vec<String>>,
    pub schedule_deadline: Option<DateTime<Utc>>,
    pub schedule_opinion: Option<String>,
    pub confirmation_materials: Option<Vec<String>>,
    pub confirmation_deadline: Option<DateTime<Utc>>,
    pub confirmation_opinion: Option<String>,
    pub attachments: Option<Vec<String>>,
    pub remarks: Option<String>,
    pub processing_result: Option<String>,
    pub return_reason: Option<String>,
    pub version: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitionRequest {
    pub target_status: String,
    pub comments: Option<String>,
    pub version: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTransitionRequest {
    pub ids: Vec<String>,
    pub target_status: String,
    pub comments: Option<String>,
    pub versions: Option<Vec<i64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanRequest {
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResponse {
    pub success: bool,
    pub creative_demand: Option<CreativeDemand>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub is_current_handler: bool,
    pub current_handler_role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScanRecord {
    pub id: String,
    pub creative_demand_id: String,
    pub user_id: String,
    pub user_name: String,
    pub user_role: String,
    pub scan_result: String,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub scanned_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScanRecordWithDetails {
    pub id: String,
    pub creative_demand_id: String,
    pub creative_demand_code: Option<String>,
    pub creative_demand_title: Option<String>,
    pub user_id: String,
    pub user_name: String,
    pub user_role: String,
    pub scan_result: String,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub scanned_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanRecordListResponse {
    pub items: Vec<ScanRecordWithDetails>,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLog {
    pub id: String,
    pub creative_demand_id: Option<String>,
    pub user_id: String,
    pub user_name: String,
    pub user_role: String,
    pub action: String,
    pub old_status: Option<String>,
    pub new_status: Option<String>,
    pub details: Option<String>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub name: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub name: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatisticsResponse {
    pub total: i64,
    pub pending_registrar: i64,
    pub pending_supervisor: i64,
    pub pending_reviewer: i64,
    pub completed: i64,
    pub rejected: i64,
    pub my_tasks: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
}

impl CreativeDemand {
    pub fn can_be_handled_by(&self, role: &str) -> bool {
        self.current_handler_role == role
    }

    pub fn validate_transition_prerequisites(&self, target: &DemandStatus) -> Result<(), String> {
        match target {
            DemandStatus::PendingSupervisor => {
                if self.brief_materials.is_none() || self.brief_opinion.is_none() {
                    return Err("brief接收材料和处理意见必须完整填写".to_string());
                }
            }
            DemandStatus::PendingReviewer => {
                if self.schedule_materials.is_none() || self.schedule_opinion.is_none() {
                    return Err("创意排期材料和处理意见必须完整填写".to_string());
                }
            }
            DemandStatus::Completed => {
                if self.confirmation_materials.is_none() || self.confirmation_opinion.is_none() {
                    return Err("客户确认材料和处理意见必须完整填写".to_string());
                }
            }
            _ => {}
        }
        Ok(())
    }
}
