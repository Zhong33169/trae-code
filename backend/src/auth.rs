use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rocket::request::{FromRequest, Outcome, Request};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::AppError;
use crate::models::User;

const JWT_SECRET: &[u8] = b"nursing-care-jwt-secret-key-change-in-production";

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub role: String,
    pub real_name: String,
    pub exp: usize,
}

pub fn create_token(user: &User) -> Result<String, AppError> {
    let expiration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize
        + 86400;

    let claims = Claims {
        sub: user.id.clone(),
        username: user.username.clone(),
        role: user.role.clone(),
        real_name: user.real_name.clone(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET),
    )
    .map_err(|e| AppError::Auth(e.to_string()))
}

pub fn decode_token(token: &str) -> Result<Claims, AppError> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET),
        &Validation::default(),
    )
    .map_err(|e| AppError::Auth(format!("Invalid token: {}", e)))?;

    Ok(token_data.claims)
}

pub struct AuthUser {
    pub id: String,
    pub username: String,
    pub role: String,
    pub real_name: String,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthUser {
    type Error = AppError;

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let auth_header = req.headers().get_one("Authorization");

        let token = match auth_header {
            Some(header) => {
                if header.starts_with("Bearer ") {
                    &header[7..]
                } else {
                    return Outcome::Error((
                        rocket::http::Status::Unauthorized,
                        AppError::Auth("Invalid authorization format".into()),
                    ));
                }
            }
            None => {
                return Outcome::Error((
                    rocket::http::Status::Unauthorized,
                    AppError::Auth("Authorization header missing".into()),
                ));
            }
        };

        match decode_token(token) {
            Ok(claims) => Outcome::Success(AuthUser {
                id: claims.sub,
                username: claims.username,
                role: claims.role,
                real_name: claims.real_name,
            }),
            Err(e) => Outcome::Error((rocket::http::Status::Unauthorized, e)),
        }
    }
}
