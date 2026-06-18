use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LitigationMaterial {
    pub id: String,
    pub case_no: String,
    pub case_name: String,
    pub plaintiff: Option<String>,
    pub defendant: Option<String>,
    pub court_name: Option<String>,
    pub case_type: Option<String>,
    pub status: String,
    pub priority: String,
    pub deadline: Option<String>,
    pub registered_by: String,
    pub registered_by_name: Option<String>,
    pub registered_at: String,
    pub reviewed_by: Option<String>,
    pub reviewed_by_name: Option<String>,
    pub reviewed_at: Option<String>,
    pub verified_by: Option<String>,
    pub verified_by_name: Option<String>,
    pub verified_at: Option<String>,
    pub archived_by: Option<String>,
    pub archived_by_name: Option<String>,
    pub archived_at: Option<String>,
    pub reject_reason: Option<String>,
    pub audit_remark: Option<String>,
    pub is_overdue: bool,
    pub overdue_hours: i64,
    pub attachments: Option<Vec<crate::models::attachment::Attachment>>,
    pub status_logs: Option<Vec<StatusLogEntry>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusLogEntry {
    pub id: String,
    pub material_id: String,
    pub from_status: Option<String>,
    pub to_status: String,
    pub operator_id: String,
    pub operator_name: String,
    pub action: String,
    pub remark: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateMaterialRequest {
    pub case_no: String,
    pub case_name: String,
    pub plaintiff: Option<String>,
    pub defendant: Option<String>,
    pub court_name: Option<String>,
    pub case_type: Option<String>,
    pub priority: Option<String>,
    pub deadline: Option<String>,
    pub operator_id: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMaterialRequest {
    pub case_name: Option<String>,
    pub plaintiff: Option<String>,
    pub defendant: Option<String>,
    pub court_name: Option<String>,
    pub case_type: Option<String>,
    pub priority: Option<String>,
    pub deadline: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewMaterialRequest {
    pub operator_id: String,
    pub pass: bool,
    pub reject_reason: Option<String>,
    pub audit_remark: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VerifyMaterialRequest {
    pub operator_id: String,
    pub pass: bool,
    pub reject_reason: Option<String>,
    pub audit_remark: Option<String>,
    pub archive: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct TakeTaskRequest {
    pub operator_id: String,
}

pub fn status_name(s: &str) -> &'static str {
    match s {
        "registered" => "待审核（已登记）",
        "reviewing" => "审核中",
        "review_passed" => "待复核（审核通过）",
        "returned" => "已退回补正",
        "verifying" => "复核中",
        "verified" => "待归档（复核通过）",
        "archived" => "已归档",
        _ => "未知状态",
    }
}

pub fn case_type_name(t: &str) -> &'static str {
    match t {
        "civil" => "民事案件",
        "commercial" => "商事案件",
        "labor" => "劳动争议",
        "ip" => "知识产权",
        "insurance" => "保险纠纷",
        "criminal" => "刑事案件",
        "admin" => "行政案件",
        _ => "其他",
    }
}

pub fn priority_name(p: &str) -> &'static str {
    match p {
        "urgent" => "紧急",
        "high" => "高",
        "normal" => "普通",
        "low" => "低",
        _ => "普通",
    }
}

pub fn action_name(a: &str) -> String {
    match a {
        "register" => "登记发起".into(),
        "start_review" => "领取审核".into(),
        "pass_review" => "审核通过".into(),
        "return_material" => "退回补正".into(),
        "resubmit" => "补正后重新提交".into(),
        "start_verify" => "领取复核".into(),
        "pass_verify" => "复核通过".into(),
        "reject_verify" => "复核不通过".into(),
        "archive" => "归档完成".into(),
        _ => a.to_string(),
    }
}

#[derive(Debug, Deserialize)]
pub struct MaterialListQuery {
    pub status: Option<String>,
    pub keyword: Option<String>,
    pub case_type: Option<String>,
    pub priority: Option<String>,
    pub is_overdue: Option<bool>,
    pub operator_role: Option<String>,
    pub operator_id: Option<String>,
}
