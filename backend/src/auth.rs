use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rocket::http::Status;
use rocket::outcome::Outcome;
use rocket::request::{FromRequest, Request};
use serde::{Deserialize, Serialize};

const SECRET: &[u8] = b"scf-platform-super-secret-key-2025-change-in-production";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub user_id: i64,
    pub username: String,
    pub role_code: String,
    pub role_id: i64,
    pub real_name: String,
    pub exp: usize,
}

pub fn create_token(
    user_id: i64,
    username: &str,
    role_code: &str,
    role_id: i64,
    real_name: &str,
) -> Result<String, String> {
    let expiration = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .expect("valid timestamp")
        .timestamp() as usize;

    let claims = Claims {
        sub: username.to_string(),
        user_id,
        username: username.to_string(),
        role_code: role_code.to_string(),
        role_id,
        real_name: real_name.to_string(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(SECRET),
    )
    .map_err(|e| format!("JWT encode error: {}", e))
}

pub fn decode_token(token: &str) -> Result<Claims, String> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(SECRET),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| format!("JWT decode error: {}", e))
}

pub struct AuthUser {
    pub user_id: i64,
    pub username: String,
    pub role_code: String,
    pub role_id: i64,
    pub real_name: String,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthUser {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, (Status, Self::Error), Status> {
        let auth_header = request.headers().get_one("Authorization");

        match auth_header {
            Some(header) => {
                let token_str = if header.starts_with("Bearer ") {
                    &header[7..]
                } else {
                    header
                };

                match decode_token(token_str) {
                    Ok(claims) => Outcome::Success(AuthUser {
                        user_id: claims.user_id,
                        username: claims.username,
                        role_code: claims.role_code,
                        role_id: claims.role_id,
                        real_name: claims.real_name,
                    }),
                    Err(_) => Outcome::Error((Status::Unauthorized, ())),
                }
            }
            None => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}
