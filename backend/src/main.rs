mod db;
mod models;
mod handlers;
mod routes;

use db::init_database;
use poem::{endpoint::EndpointExt, listener::TcpListener, Route, Server};
use poem_openapi::OpenApiService;
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
        .init();

    let db_path = std::env::var("DATABASE_URL").unwrap_or_else(|_| "./data/ticket.db".to_string());
    let pool = init_database(&db_path).await?;
    tracing::info!("数据库连接池初始化完成");

    handlers::init_sample_data(&pool).await?;
    tracing::info!("样例数据初始化完成");

    let api_service = OpenApiService::new(routes::Api, "工单管理系统 API", "1.0")
        .server("http://localhost:8009");

    let swagger_ui = api_service.swagger_ui();
    let spec = api_service.spec_endpoint();

    let app = Route::new()
        .nest("/api", api_service)
        .nest("/swagger", swagger_ui)
        .nest("/openapi.json", spec)
        .data(pool);

    tracing::info!("服务器启动在 http://localhost:8009");
    tracing::info!("Swagger UI: http://localhost:8009/swagger");

    Server::new(TcpListener::bind("0.0.0.0:8009"))
        .run(app)
        .await?;

    Ok(())
}
