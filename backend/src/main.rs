mod auth;
mod db;
mod handlers;
mod models;

use poem::{
    get, handler, listener::TcpListener, middleware::Cors, post, web::Json, EndpointExt, Route,
    Server,
};

#[handler]
fn hello() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "name": "选题单离线台账回填系统 API",
        "version": "1.0.0",
        "endpoints": {
            "auth": ["/api/auth/login (POST)", "/api/auth/me (GET)"],
            "topics": [
                "GET /api/topics?status=&anomaly=&keyword=",
                "GET /api/topics/:id",
                "POST /api/topics (registrar)",
                "POST /api/topics/:id/review (reviewer)",
                "POST /api/topics/:id/archive (archiver)",
                "POST /api/topics/:id/rectify (registrar)",
                "GET /api/topics/:id/attachments",
                "POST /api/topics/:id/attachments",
            ],
            "import": [
                "GET /api/import/batches",
                "GET /api/import/batches/:id/records",
                "POST /api/import/execute (registrar)",
                "POST /api/import/records/:id/process (registrar submit / reviewer resolve/ignore)",
            ],
            "audit": ["GET /api/audit/logs?topic_id="],
            "users": ["GET /api/users"],
        }
    }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=info,poem=info".into()),
        )
        .init();

    db::init_db()?;
    db::seed_demo_data()?;

    let api = Route::new()
        .at("/", get(hello))
        .at("/auth/login", post(handlers::handle_login))
        .at("/auth/me", get(handlers::handle_me))
        .at("/users", get(handlers::handle_list_users))
        .at(
            "/topics",
            get(handlers::handle_list_topics).post(handlers::handle_create_topic),
        )
        .at("/topics/:id", get(handlers::handle_get_topic))
        .at("/topics/:id/review", post(handlers::handle_review_topic))
        .at("/topics/:id/archive", post(handlers::handle_archive_topic))
        .at("/topics/:id/rectify", post(handlers::handle_rectify_topic))
        .at(
            "/topics/:id/attachments",
            get(handlers::handle_list_attachments).post(handlers::handle_add_attachment),
        )
        .at("/import/batches", get(handlers::handle_list_batches))
        .at(
            "/import/batches/:id/records",
            get(handlers::handle_batch_records),
        )
        .at("/import/execute", post(handlers::handle_execute_import))
        .at("/import/records/:id/process", post(handlers::handle_process_conflict))
        .at("/audit/logs", get(handlers::handle_list_audit));

    let app = Route::new().nest("/api", api).with(
        Cors::new()
            .allow_origin("http://localhost:3003")
            .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
            .allow_headers(vec![
                "Content-Type",
                "Authorization",
                "X-Requested-With",
            ])
            .allow_credentials(true),
    );

    tracing::info!("选题单离线台账回填系统后端启动：http://localhost:8003");
    tracing::info!("API 根路径：http://localhost:8003/api");

    Server::new(TcpListener::bind("0.0.0.0:8003"))
        .run(app)
        .await?;

    Ok(())
}
