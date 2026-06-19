mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod seed;
mod state;

use axum::http::Method;
use axum::routing::{get, post, put};
use axum::Router;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "media_plan_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenv::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./data/media_plan.db".to_string());

    let state = AppState::new(&database_url).await?;

    db::init_db(&state.pool).await?;

    if std::env::var("SEED_DATA").unwrap_or_else(|_| "true".to_string()) == "true" {
        seed::seed_data(&state.pool).await?;
        tracing::info!("Seed data loaded");
    }

    let cors = CorsLayer::new()
        .allow_origin("http://localhost:3001".parse::<axum::http::HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ])
        .allow_credentials(true);

    let app = Router::new()
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/me", get(handlers::auth::me))
        .route("/api/plans", get(handlers::plans::list_plans))
        .route("/api/plans/:id", get(handlers::plans::get_plan))
        .route("/api/plans", post(handlers::plans::create_plan))
        .route("/api/plans/:id", put(handlers::plans::update_plan))
        .route("/api/plans/:id/submit", post(handlers::plans::submit_plan))
        .route("/api/plans/:id/approve", post(handlers::plans::approve_plan))
        .route("/api/plans/:id/reject", post(handlers::plans::reject_plan))
        .route("/api/plans/:id/review", post(handlers::plans::review_plan))
        .route("/api/plans/:id/archive", post(handlers::plans::archive_plan))
        .route("/api/plans/batch-review", post(handlers::batch::batch_review))
        .route("/api/plans/:id/schedules", get(handlers::schedules::list_schedules))
        .route("/api/plans/:id/budgets", get(handlers::budgets::list_budgets))
        .route("/api/plans/:id/evidences", get(handlers::evidences::list_evidences))
        .route("/api/todo", get(handlers::plans::todo_list))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8001").await?;
    tracing::info!("Server listening on 0.0.0.0:8001");

    axum::serve(listener, app).await?;

    Ok(())
}
