use rocket_cors::{AllowedOrigins, AllowedHeaders, AllowedMethods, Cors, CorsOptions};
use rocket::http::Method;
use std::collections::HashSet;

pub fn cors_fairing() -> Cors {
    let allowed_origins = AllowedOrigins::some_exact(&[
        "http://localhost:3004",
        "http://127.0.0.1:3004",
    ]);

    let allowed_methods: AllowedMethods = vec![
        Method::Get,
        Method::Post,
        Method::Put,
        Method::Delete,
        Method::Patch,
        Method::Options,
    ].into_iter().map(From::from).collect();

    let allowed_headers = AllowedHeaders::some(&[
        "Authorization",
        "Accept",
        "Content-Type",
        "X-Requested-With",
        "X-Custom-Header",
    ]);

    let expose_headers: HashSet<String> = [
        "Authorization", "Content-Type", "Content-Length", "X-Request-Id",
    ].iter().map(|s| s.to_string()).collect();

    CorsOptions {
        allowed_origins,
        allowed_methods,
        allowed_headers,
        allow_credentials: true,
        expose_headers,
        max_age: Some(86400),
        fairing_route_base: "/".to_string(),
        ..Default::default()
    }
    .to_cors()
    .expect("Failed to create CORS fairing")
}
