use serde::{Deserialize, Serialize};
use rocket::form::FromForm;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub real_name: String,
    pub role: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub success: bool,
    pub token: String,
    pub user: User,
    pub message: String,
}

pub fn role_name(role: &str) -> &'static str {
    match role {
        "registrar" => "诉讼材料登记员",
        "reviewer" => "诉讼材料审核主管",
        "verifier" => "法务服务中心复核负责人",
        _ => "未知角色",
    }
}

pub fn role_can(role: &str, action: &str) -> bool {
    match action {
        "register" => matches!(role, "registrar"),
        "review" => matches!(role, "reviewer"),
        "verify" => matches!(role, "verifier"),
        "archive" => matches!(role, "verifier"),
        "view_all" => true,
        "edit_material" => matches!(role, "registrar"),
        "manage_attachment" => matches!(role, "registrar" | "reviewer"),
        "reject_attachment" => matches!(role, "reviewer"),
        "return_material" => matches!(role, "reviewer"),
        "batch_process" => matches!(role, "reviewer" | "verifier"),
        "view_audit" => true,
        _ => false,
    }
}

#[derive(Debug, Serialize)]
pub struct RoleInfo {
    pub key: String,
    pub name: String,
    pub description: String,
}

pub fn all_roles() -> Vec<RoleInfo> {
    vec![
        RoleInfo {
            key: "registrar".into(),
            name: "诉讼材料登记员".into(),
            description: "负责发起材料登记、补充附件、处理退回".into(),
        },
        RoleInfo {
            key: "reviewer".into(),
            name: "诉讼材料审核主管".into(),
            description: "负责审核材料、处理附件、退回不合格材料".into(),
        },
        RoleInfo {
            key: "verifier".into(),
            name: "法务服务中心复核负责人".into(),
            description: "负责最终复核、归档、备注审计意见".into(),
        },
    ]
}
