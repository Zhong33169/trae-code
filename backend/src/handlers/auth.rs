use actix_web::{web, HttpResponse, Responder, HttpRequest, post};
use argon2::{Algorithm, Argon2, Params, Version, PasswordHash, PasswordVerifier};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header, Algorithm as JwtAlgorithm};
use sqlx::SqlitePool;

use crate::db::{new_uuid, now_str};
use crate::models::{
    ApiResponse, LoginRequest, LoginResponse, User, UserInfo, JwtClaims, role_display_name,
};

async fn log_operation(
    pool: &SqlitePool,
    user_id: &str,
    action: &str,
    detail: Option<&str>,
    ip: Option<&str>,
) {
    let _ = sqlx::query(
        "INSERT INTO operation_logs (id, user_id, action, detail, ip_address, created_at) 
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(new_uuid())
    .bind(user_id)
    .bind(action)
    .bind(detail)
    .bind(ip)
    .bind(now_str())
    .execute(pool)
    .await;
}

fn get_client_ip(req: &HttpRequest) -> String {
    req.connection_info()
        .peer_addr()
        .unwrap_or("unknown")
        .to_string()
}

fn verify_password(password: &str, password_hash: &str) -> bool {
    if let Ok(parsed_hash) = PasswordHash::new(password_hash) {
        let argon2 = Argon2::new(
            Algorithm::Argon2id,
            Version::V0x13,
            Params::new(19456, 2, 1, Some(32)).unwrap(),
        );
        argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok()
    } else {
        false
    }
}

fn generate_token(
    user: &User,
    jwt_secret: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = (Utc::now() + Duration::hours(24)).timestamp() as usize;
    let claims = JwtClaims {
        sub: user.username.clone(),
        user_id: user.id.clone(),
        username: user.username.clone(),
        role: user.role.clone(),
        exp,
    };

    encode(
        &Header::new(JwtAlgorithm::HS256),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
}

#[post("/login")]
async fn login(
    req: HttpRequest,
    pool: web::Data<SqlitePool>,
    jwt_secret: web::Data<String>,
    form: web::Json<LoginRequest>,
) -> impl Responder {
    let ip = get_client_ip(&req);

    let user: Option<User> = match sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE username = ?"
    )
    .bind(&form.username)
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(u) => u,
        Err(e) => {
            log::error!("Database error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "数据库查询失败")
            );
        }
    };

    let user = match user {
        Some(u) => u,
        None => {
            log_operation(
                pool.get_ref(),
                "unknown",
                "登录失败",
                Some(&format!("用户名不存在: {}", form.username)),
                Some(&ip),
            )
            .await;
            return HttpResponse::Unauthorized().json(
                ApiResponse::<()>::error(401, "用户名或密码错误")
            );
        }
    };

    if !verify_password(&form.password, &user.password_hash) {
        log_operation(
            pool.get_ref(),
            &user.id,
            "登录失败",
            Some("密码错误"),
            Some(&ip),
        )
        .await;
        return HttpResponse::Unauthorized().json(
            ApiResponse::<()>::error(401, "用户名或密码错误")
        );
    }

    let token = match generate_token(&user, jwt_secret.get_ref()) {
        Ok(t) => t,
        Err(e) => {
            log::error!("JWT generation error: {}", e);
            return HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(500, "令牌生成失败")
            );
        }
    };

    log_operation(
        pool.get_ref(),
        &user.id,
        "登录成功",
        Some(&format!("用户 {} 登录系统", user.username)),
        Some(&ip),
    )
    .await;

    let user_info = UserInfo {
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        role: user.role.clone(),
        role_name: role_display_name(&user.role).to_string(),
    };

    HttpResponse::Ok().json(ApiResponse::success(LoginResponse {
        token,
        user: user_info,
    }))
}

pub fn init_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .service(login)
    );
}
