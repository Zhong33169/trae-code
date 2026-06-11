use axum::{
    http::Method,
    routing::{get, post, put},
    Router,
};
use dotenvy::dotenv;
use sqlx::SqlitePool;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
mod models;
mod handlers;
mod middleware;
mod services;
mod db;

use config::AppConfig;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub config: Arc<AppConfig>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "creative_demand_backend=debug,tower_http=debug,axum=debug".into()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Arc::new(AppConfig::from_env());

    let pool = SqlitePool::connect(&config.database_url).await?;
    db::init_db(&pool).await?;
    db::seed_initial_data(&pool).await?;

    let cors = CorsLayer::new()
        .allow_origin(config.frontend_origin.parse::<axum::http::HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ])
        .allow_credentials(true);

    let state = AppState {
        pool: pool.clone(),
        config: config.clone(),
    };

    let auth_routes = Router::new()
        .route("/login", post(handlers::auth::login));

    let api_routes = Router::new()
        .route("/creative-demands", get(handlers::creative_demand::list))
        .route("/creative-demands", post(handlers::creative_demand::create))
        .route("/creative-demands/:id", get(handlers::creative_demand::get))
        .route("/creative-demands/:id", put(handlers::creative_demand::update))
        .route("/creative-demands/scan", post(handlers::creative_demand::scan))
        .route("/creative-demands/scan-records", get(handlers::creative_demand::get_scan_records))
        .route("/creative-demands/:id/scan-records", get(handlers::creative_demand::get_scan_records_for_demand))
        .route("/creative-demands/:id/transition", post(handlers::creative_demand::transition))
        .route("/creative-demands/batch-transition", post(handlers::creative_demand::batch_transition))
        .route("/creative-demands/statistics", get(handlers::creative_demand::statistics))
        .route("/audit-logs", get(handlers::audit_log::list))
        .route("/users/me", get(handlers::auth::me))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            middleware::auth::auth_middleware,
        ));

    let app = Router::new()
        .nest("/api/auth", auth_routes)
        .nest("/api", api_routes)
        .route("/health", get(|| async { "OK" }))
        .layer(cors)
        .with_state(state);

    let addr: SocketAddr = format!("0.0.0.0:{}", config.port).parse()?;
    tracing::info!("Server listening on {}", addr);
    tracing::info!("Frontend origin allowed: {}", config.frontend_origin);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
