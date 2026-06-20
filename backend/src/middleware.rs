use actix_web::{FromRequest, HttpRequest, dev::Payload};
use std::future::{Ready, ready};
use crate::auth::verify_token;
use crate::errors::AppError;

pub struct AuthClaims {
    pub sub: String,
    pub role: String,
}

impl FromRequest for AuthClaims {
    type Error = AppError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        let auth_header = match req.headers().get("Authorization") {
            Some(v) => match v.to_str() {
                Ok(s) => s,
                Err(_) => return ready(Err(AppError::Unauthorized("无效的认证头".into()))),
            },
            None => return ready(Err(AppError::Unauthorized("缺少认证令牌".into()))),
        };

        if !auth_header.starts_with("Bearer ") {
            return ready(Err(AppError::Unauthorized("无效的认证令牌格式".into())));
        }

        let token = &auth_header[7..];
        match verify_token(token) {
            Ok(claims) => ready(Ok(AuthClaims {
                sub: claims.sub,
                role: claims.role,
            })),
            Err(_) => ready(Err(AppError::Unauthorized("认证令牌无效或已过期".into()))),
        }
    }
}
