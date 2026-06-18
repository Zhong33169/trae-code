use serde::{Deserialize, Serialize, Serializer, Deserializer};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub enum Role {
    Registrar,
    Auditor,
    Reviewer,
}

impl Serialize for Role {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for Role {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Role::from_str(&s).map_err(serde::de::Error::custom)
    }
}

impl Role {
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "registrar" => Ok(Role::Registrar),
            "auditor" => Ok(Role::Auditor),
            "reviewer" => Ok(Role::Reviewer),
            _ => Err(format!("Unknown role: {}", s)),
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            Role::Registrar => "registrar",
            Role::Auditor => "auditor",
            Role::Reviewer => "reviewer",
        }
    }

    pub fn display_name(&self) -> &str {
        match self {
            Role::Registrar => "资料年检登记员",
            Role::Auditor => "资料年检审核主管",
            Role::Reviewer => "银行网点复核负责人",
        }
    }
}

#[derive(Debug, Clone)]
pub enum FormStatus {
    Draft,
    PendingAudit,
    AuditRejected,
    PendingReview,
    ReviewRejected,
    Archived,
}

impl Serialize for FormStatus {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for FormStatus {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        FormStatus::from_str(&s).map_err(serde::de::Error::custom)
    }
}

impl FormStatus {
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "draft" => Ok(FormStatus::Draft),
            "pending_audit" => Ok(FormStatus::PendingAudit),
            "audit_rejected" => Ok(FormStatus::AuditRejected),
            "pending_review" => Ok(FormStatus::PendingReview),
            "review_rejected" => Ok(FormStatus::ReviewRejected),
            "archived" => Ok(FormStatus::Archived),
            _ => Err(format!("Unknown status: {}", s)),
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            FormStatus::Draft => "draft",
            FormStatus::PendingAudit => "pending_audit",
            FormStatus::AuditRejected => "audit_rejected",
            FormStatus::PendingReview => "pending_review",
            FormStatus::ReviewRejected => "review_rejected",
            FormStatus::Archived => "archived",
        }
    }

    pub fn display_name(&self) -> &str {
        match self {
            FormStatus::Draft => "草稿",
            FormStatus::PendingAudit => "待审核",
            FormStatus::AuditRejected => "审核退回",
            FormStatus::PendingReview => "待复核",
            FormStatus::ReviewRejected => "复核退回",
            FormStatus::Archived => "已归档",
        }
    }
}

#[derive(Debug, Clone)]
pub enum Shift {
    Morning,
    Afternoon,
    Night,
}

impl Serialize for Shift {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for Shift {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        Shift::from_str(&s).map_err(serde::de::Error::custom)
    }
}

impl Shift {
    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "morning" => Ok(Shift::Morning),
            "afternoon" => Ok(Shift::Afternoon),
            "night" => Ok(Shift::Night),
            _ => Err(format!("Unknown shift: {}", s)),
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            Shift::Morning => "morning",
            Shift::Afternoon => "afternoon",
            Shift::Night => "night",
        }
    }

    pub fn display_name(&self) -> &str {
        match self {
            Shift::Morning => "早班",
            Shift::Afternoon => "午班",
            Shift::Night => "夜班",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub name: String,
    pub role: Role,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorporateInfo {
    pub id: Uuid,
    pub company_name: String,
    pub credit_code: String,
    pub legal_representative: String,
    pub register_date: DateTime<Utc>,
    pub business_scope: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnualReminder {
    pub id: Uuid,
    pub corporate_id: Uuid,
    pub year: i32,
    pub due_date: DateTime<Utc>,
    pub is_sent: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandoverRecord {
    pub id: Uuid,
    pub form_id: Uuid,
    pub shift: Shift,
    pub handover_person_id: Uuid,
    pub handover_person_name: String,
    pub receiver_person_id: Uuid,
    pub receiver_person_name: String,
    pub confirm_time: Option<DateTime<Utc>>,
    pub remark: Option<String>,
    pub created_at: DateTime<Utc>,
    pub is_confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectionForm {
    pub id: Uuid,
    pub form_no: String,
    pub corporate_id: Uuid,
    pub corporate_name: String,
    pub year: i32,
    pub status: FormStatus,
    pub registrant_id: Uuid,
    pub registrant_name: String,
    pub auditor_id: Option<Uuid>,
    pub auditor_name: Option<String>,
    pub reviewer_id: Option<Uuid>,
    pub reviewer_name: Option<String>,
    pub current_handover_id: Option<Uuid>,
    pub business_license: Option<String>,
    pub annual_report: Option<String>,
    pub tax_certificate: Option<String>,
    pub other_materials: Option<String>,
    pub audit_opinion: Option<String>,
    pub review_opinion: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub audited_at: Option<DateTime<Utc>>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub archived_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFormRequest {
    pub corporate_id: Uuid,
    pub corporate_name: String,
    pub year: i32,
    pub business_license: Option<String>,
    pub annual_report: Option<String>,
    pub tax_certificate: Option<String>,
    pub other_materials: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFormRequest {
    pub business_license: Option<String>,
    pub annual_report: Option<String>,
    pub tax_certificate: Option<String>,
    pub other_materials: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct HandoverRequest {
    pub shift: String,
    pub receiver_person_id: Uuid,
    pub remark: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct HandoverConfirmRequest {
    pub confirm: bool,
}

#[derive(Debug, Deserialize)]
pub struct AuditRequest {
    pub opinion: Option<String>,
    pub pass: bool,
}

#[derive(Debug, Deserialize)]
pub struct ReviewRequest {
    pub opinion: Option<String>,
    pub pass: bool,
}

#[derive(Debug, Serialize)]
pub struct OperationLog {
    pub id: Uuid,
    pub form_id: Option<Uuid>,
    pub form_no: Option<String>,
    pub operator_id: Uuid,
    pub operator_name: String,
    pub action: String,
    pub action_display: String,
    pub detail: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub total: i64,
    pub draft: i64,
    pub pending_audit: i64,
    pub audit_rejected: i64,
    pub pending_review: i64,
    pub review_rejected: i64,
    pub archived: i64,
    pub by_role: StatsByRole,
    pub by_month: Vec<MonthlyStats>,
}

#[derive(Debug, Serialize)]
pub struct StatsByRole {
    pub registrar_count: i64,
    pub auditor_count: i64,
    pub reviewer_count: i64,
}

#[derive(Debug, Serialize)]
pub struct MonthlyStats {
    pub month: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}
