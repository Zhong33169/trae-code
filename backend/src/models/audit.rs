use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLog {
    pub id: String,
    pub material_id: Option<String>,
    pub attachment_id: Option<String>,
    pub operator_id: String,
    pub operator_name: String,
    pub operator_role: String,
    pub action: String,
    pub action_detail: Option<String>,
    pub result: String,
    pub fail_reason: Option<String>,
    pub batch_id: Option<String>,
    pub created_at: String,
    pub material_case_no: Option<String>,
    pub material_case_name: Option<String>,
    pub attachment_file_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub material_id: Option<String>,
    pub operator_id: Option<String>,
    pub result: Option<String>,
    pub keyword: Option<String>,
}
