use crate::models::Claims;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use rocket::http::Status;
use rocket::request::{FromRequest, Outcome, Request};
use rocket::serde::json::Json;
use std::env;

pub fn jwt_secret() -> String {
    env::var("JWT_SECRET").unwrap_or_else(|_| "seed-tracking-super-secret-key-change-in-production".to_string())
}

pub fn encode_token(user_id: &str, username: &str, role: &str, real_name: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = (chrono::Utc::now() + chrono::Duration::hours(24)).timestamp() as usize;
    let claims = Claims {
        sub: username.to_string(),
        user_id: user_id.to_string(),
        role: role.to_string(),
        real_name: real_name.to_string(),
        exp,
    };
    jsonwebtoken::encode(&Header::default(), &claims, &EncodingKey::from_secret(jwt_secret().as_bytes()))
}

pub fn decode_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let data = jsonwebtoken::decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

pub struct AuthUser {
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub real_name: String,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthUser {
    type Error = Json<crate::models::ApiResponse<()>>;

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth_header = req.headers().get_one("Authorization");
        if auth_header.is_none() {
            return Outcome::Error((
                Status::Unauthorized,
                Json(crate::models::ApiResponse::err("未提供认证令牌，请先登录")),
            ));
        }
        let token = auth_header.unwrap().trim_start_matches("Bearer ");
        match decode_token(token) {
            Ok(claims) => Outcome::Success(AuthUser {
                user_id: claims.user_id,
                username: claims.sub,
                role: claims.role,
                real_name: claims.real_name,
            }),
            Err(_) => Outcome::Error((
                Status::Unauthorized,
                Json(crate::models::ApiResponse::err("认证令牌无效或已过期，请重新登录")),
            )),
        }
    }
}

pub fn require_role(user: &AuthUser, allowed_roles: &[&str]) -> Result<(), String> {
    if allowed_roles.contains(&user.role.as_str()) {
        Ok(())
    } else {
        Err(format!("当前用户角色（{}）无权限执行此操作", role_label(&user.role)))
    }
}

pub fn role_label(role: &str) -> &str {
    match role {
        "registrar" => "苗种登记员",
        "auditor" => "苗种审核主管",
        "reviewer" => "水产养殖基地复核负责人",
        _ => "未知岗位",
    }
}

pub fn node_label(node: &str) -> &str {
    match node {
        "registration" => "苗种登记",
        "audit" => "苗种审核",
        "pond_entry" => "苗种入塘",
        "survival_observe" => "成活观察",
        "archive_review" => "批次归档复核",
        "done" => "已完成",
        _ => node,
    }
}

pub fn status_label(status: &str) -> &str {
    match status {
        "pending" => "待处理",
        "processing" => "处理中",
        "approved" => "审核通过",
        "completed" => "已完成",
        "rejected" => "已驳回",
        "correction" => "待补正",
        _ => status,
    }
}
