pub mod db;
pub mod models;
pub mod service;

use poem::{
    get, handler, listener::TcpListener, post, web::Data, web::Json, web::Path, web::Query,
    EndpointExt, Error, IntoResponse, Route, Server,
};
use poem::http::StatusCode;
use poem::middleware::Cors;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::db::{init_pool, run_migrations, seed_data};
use crate::models::*;

#[derive(Debug, Deserialize)]
struct ListOrdersQuery {
    status: Option<String>,
    role: Option<String>,
    user_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: String,
}

fn bad_request(msg: impl Into<String>) -> Error {
    Error::from_string(msg.into(), StatusCode::BAD_REQUEST)
}

fn internal_error(msg: impl Into<String>) -> Error {
    Error::from_string(msg.into(), StatusCode::INTERNAL_SERVER_ERROR)
}

fn not_found(msg: impl Into<String>) -> Error {
    Error::from_string(msg.into(), StatusCode::NOT_FOUND)
}

#[handler]
async fn list_users(Data(pool): Data<&Arc<sqlx::SqlitePool>>) -> Result<impl IntoResponse, Error> {
    service::list_users(pool.as_ref())
        .await
        .map(Json)
        .map_err(|e| internal_error(e.to_string()))
}

#[handler]
async fn list_orders(
    Data(pool): Data<&Arc<sqlx::SqlitePool>>,
    Query(query): Query<ListOrdersQuery>,
) -> Result<impl IntoResponse, Error> {
    service::list_orders(
        pool.as_ref(),
        query.status.as_deref(),
        query.role.as_deref(),
        query.user_id.as_deref(),
    )
    .await
    .map(Json)
    .map_err(|e| internal_error(e.to_string()))
}

#[handler]
async fn get_order(
    Data(pool): Data<&Arc<sqlx::SqlitePool>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, Error> {
    service::get_order_detail(pool.as_ref(), &id)
        .await
        .map(Json)
        .map_err(|e| not_found(e.to_string()))
}

#[handler]
async fn get_order_records(
    Data(pool): Data<&Arc<sqlx::SqlitePool>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, Error> {
    service::get_order_records(pool.as_ref(), &id)
        .await
        .map(Json)
        .map_err(|e| internal_error(e.to_string()))
}

#[handler]
async fn create_order(
    Data(pool): Data<&Arc<sqlx::SqlitePool>>,
    Json(body): Json<CreateOrderRequest>,
) -> Result<impl IntoResponse, Error> {
    service::create_order(pool.as_ref(), &body)
        .await
        .map(Json)
        .map_err(|e| bad_request(e.to_string()))
}

#[handler]
async fn submit_order(
    Data(pool): Data<&Arc<sqlx::SqlitePool>>,
    Json(body): Json<ActionRequest>,
) -> Result<impl IntoResponse, Error> {
    service::handle_submit(pool.as_ref(), &body)
        .await
        .map(Json)
        .map_err(|e| bad_request(e.to_string()))
}

#[derive(Debug, Deserialize)]
struct VerifyRequest {
    order_id: String,
    version: i64,
    handler_id: String,
    opinion: Option<String>,
    evidence: Option<Vec<EvidenceItem>>,
    appeal_reason: Option<String>,
    decision: Option<String>,
}

#[handler]
async fn verify_order(
    Data(pool): Data<&Arc<sqlx::SqlitePool>>,
    Json(body): Json<VerifyRequest>,
) -> Result<impl IntoResponse, Error> {
    let pass = body.decision.as_deref() == Some("pass");
    let req = ActionRequest {
        order_id: body.order_id,
        version: body.version,
        handler_id: body.handler_id,
        opinion: body.opinion,
        evidence: body.evidence,
        appeal_reason: body.appeal_reason,
    };
    service::handle_verify(pool.as_ref(), &req, pass)
        .await
        .map(Json)
        .map_err(|e| bad_request(e.to_string()))
}

#[handler]
async fn appeal_order(
    Data(pool): Data<&Arc<sqlx::SqlitePool>>,
    Json(body): Json<ActionRequest>,
) -> Result<impl IntoResponse, Error> {
    service::handle_submit(pool.as_ref(), &body)
        .await
        .map(Json)
        .map_err(|e| bad_request(e.to_string()))
}

#[derive(Debug, Deserialize)]
struct ReviewRequest {
    order_id: String,
    version: i64,
    handler_id: String,
    opinion: Option<String>,
    evidence: Option<Vec<EvidenceItem>>,
    appeal_reason: Option<String>,
    decision: Option<String>,
}

#[handler]
async fn review_order(
    Data(pool): Data<&Arc<sqlx::SqlitePool>>,
    Json(body): Json<ReviewRequest>,
) -> Result<impl IntoResponse, Error> {
    let decision = body.decision.clone().unwrap_or_else(|| "confirm".to_string());
    let req = ActionRequest {
        order_id: body.order_id,
        version: body.version,
        handler_id: body.handler_id,
        opinion: body.opinion,
        evidence: body.evidence,
        appeal_reason: body.appeal_reason,
    };
    service::handle_review(pool.as_ref(), &req, &decision)
        .await
        .map(Json)
        .map_err(|e| bad_request(e.to_string()))
}

#[handler]
async fn archive_order(
    Data(pool): Data<&Arc<sqlx::SqlitePool>>,
    Json(body): Json<ActionRequest>,
) -> Result<impl IntoResponse, Error> {
    service::handle_archive(pool.as_ref(), &body)
        .await
        .map(Json)
        .map_err(|e| bad_request(e.to_string()))
}

#[handler]
fn health() -> &'static str {
    "ok"
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8003);

    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:data.db?mode=rwc".to_string());

    tracing::info!("Connecting to database: {}", db_url);
    let pool = init_pool(&db_url).await?;
    tracing::info!("Running migrations...");
    run_migrations(&pool).await?;
    tracing::info!("Seeding demo data...");
    seed_data(&pool).await?;

    let pool = Arc::new(pool);

    let api = Route::new()
        .at("/health", get(health))
        .at("/users", get(list_users))
        .at("/orders", get(list_orders).post(create_order))
        .at("/orders/:id", get(get_order))
        .at("/orders/:id/records", get(get_order_records))
        .at("/orders/submit", post(submit_order))
        .at("/orders/verify", post(verify_order))
        .at("/orders/appeal", post(appeal_order))
        .at("/orders/review", post(review_order))
        .at("/orders/archive", post(archive_order));

    let app = Route::new()
        .nest("/api", api)
        .data(pool)
        .with(
            Cors::new()
                .allow_origin_regex(".*")
                .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
                .allow_headers(vec!["*"]),
        );

    let listener = TcpListener::bind(format!("0.0.0.0:{}", port));
    tracing::info!("Server starting on port {}", port);
    Server::new(listener).run(app).await?;

    Ok(())
}
