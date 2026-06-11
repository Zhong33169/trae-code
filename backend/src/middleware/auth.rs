use actix_web::{
    body::EitherBody,
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpResponse, HttpMessage,
};
use futures_util::future::LocalBoxFuture;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use std::{
    future::{ready, Ready},
    rc::Rc,
};

use crate::models::{ApiResponse, JwtClaims};

pub struct AuthMiddleware {
    pub jwt_secret: String,
    pub allowed_roles: Option<Vec<String>>,
}

impl AuthMiddleware {
    pub fn new(jwt_secret: String, allowed_roles: Option<Vec<String>>) -> Self {
        AuthMiddleware {
            jwt_secret,
            allowed_roles,
        }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = AuthMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuthMiddlewareService {
            service: Rc::new(service),
            jwt_secret: self.jwt_secret.clone(),
            allowed_roles: self.allowed_roles.clone(),
        }))
    }
}

pub struct AuthMiddlewareService<S> {
    service: Rc<S>,
    jwt_secret: String,
    allowed_roles: Option<Vec<String>>,
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = self.service.clone();
        let jwt_secret = self.jwt_secret.clone();
        let allowed_roles = self.allowed_roles.clone();

        Box::pin(async move {
            let token = extract_token(&req);

            let token = match token {
                Some(t) => t,
                None => {
                    let response = HttpResponse::Unauthorized().json(ApiResponse::<()>::error(
                        401,
                        "未提供认证令牌",
                    ));
                    return Ok(req.into_response(response).map_into_right_body());
                }
            };

            let claims = match decode::<JwtClaims>(
                &token,
                &DecodingKey::from_secret(jwt_secret.as_bytes()),
                &Validation::new(Algorithm::HS256),
            ) {
                Ok(data) => data.claims,
                Err(e) => {
                    let msg = match e.kind() {
                        jsonwebtoken::errors::ErrorKind::ExpiredSignature => "认证令牌已过期",
                        jsonwebtoken::errors::ErrorKind::InvalidToken => "无效的认证令牌",
                        _ => "认证令牌验证失败",
                    };
                    let response = HttpResponse::Unauthorized()
                        .json(ApiResponse::<()>::error(401, msg));
                    return Ok(req.into_response(response).map_into_right_body());
                }
            };

            if let Some(roles) = &allowed_roles {
                if !roles.contains(&claims.role) {
                    let response = HttpResponse::Forbidden().json(ApiResponse::<()>::error(
                        403,
                        "权限不足，无法执行此操作",
                    ));
                    return Ok(req.into_response(response).map_into_right_body());
                }
            }

            req.extensions_mut().insert(claims);

            let res = service.call(req).await?;
            Ok(res.map_into_left_body())
        })
    }
}

fn extract_token(req: &ServiceRequest) -> Option<String> {
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                return Some(auth_str.trim_start_matches("Bearer ").to_string());
            }
        }
    }

    if let Some(cookie) = req.cookie("token") {
        return Some(cookie.value().to_string());
    }

    None
}

pub fn get_current_user(req: &actix_web::HttpRequest) -> Option<JwtClaims> {
    req.extensions().get::<JwtClaims>().cloned()
}
