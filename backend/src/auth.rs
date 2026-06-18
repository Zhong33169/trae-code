use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::env;
use uuid::Uuid;
use crate::models::Role;
use crate::errors::AppError;
use actix_web::{web, FromRequest, HttpRequest};
use std::future::{ready, Ready};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub user_id: String,
    pub username: String,
    pub name: String,
    pub role: String,
    pub exp: usize,
}

pub fn create_token(user_id: Uuid, username: &str, name: &str, role: &Role) -> Result<String, AppError> {
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "bank-inspection-secret-key".to_string());
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: username.to_string(),
        user_id: user_id.to_string(),
        username: username.to_string(),
        name: name.to_string(),
        role: role.as_str().to_string(),
        exp: expiration as usize,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )?;

    Ok(token)
}

pub fn verify_token(token: &str) -> Result<Claims, AppError> {
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "bank-inspection-secret-key".to_string());

    let validation = Validation::default();
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &validation,
    )?;

    Ok(token_data.claims)
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub username: String,
    pub name: String,
    pub role: Role,
}

impl FromRequest for AuthUser {
    type Error = AppError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut actix_web::dev::Payload) -> Self::Future {
        let result = extract_user_from_request(req);
        ready(result)
    }
}

fn extract_user_from_request(req: &HttpRequest) -> Result<AuthUser, AppError> {
    let auth_header = req
        .headers()
        .get("Authorization")
        .ok_or_else(|| AppError::AuthError("缺少认证信息".to_string()))?;

    let auth_str = auth_header
        .to_str()
        .map_err(|_| AppError::AuthError("认证信息格式错误".to_string()))?;

    if !auth_str.starts_with("Bearer ") {
        return Err(AppError::AuthError("认证信息格式错误".to_string()));
    }

    let token = &auth_str[7..];
    let claims = verify_token(token)?;

    let user_id = Uuid::parse_str(&claims.user_id)
        .map_err(|_| AppError::AuthError("用户ID格式错误".to_string()))?;

    let role = Role::from_str(&claims.role)
        .map_err(|_| AppError::AuthError("角色信息错误".to_string()))?;

    Ok(AuthUser {
        user_id,
        username: claims.username,
        name: claims.name,
        role,
    })
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
        Argon2,
    };

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::InternalError(format!("密码加密失败: {}", e)))?;

    Ok(password_hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    use argon2::{
        password_hash::{PasswordHash, PasswordVerifier},
        Argon2,
    };

    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::InternalError(format!("密码哈希解析失败: {}", e)))?;

    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}
