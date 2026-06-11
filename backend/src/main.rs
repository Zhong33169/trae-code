use actix_cors::Cors;
use actix_web::{web, App, HttpServer, middleware::Logger};
use dotenvy::dotenv;
use std::env;

mod db;
mod models;
mod middleware {
    pub mod auth;
}
mod handlers {
    pub mod auth;
    pub mod tasks;
    pub mod statistics;
}

use db::{init_pool, run_migrations, init_default_users, seed_demo_data};
use middleware::auth::AuthMiddleware;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://./data/sampling.db?mode=rwc".to_string());
    let server_host = env::var("SERVER_HOST")
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    let server_port = env::var("SERVER_PORT")
        .unwrap_or_else(|_| "8002".to_string());
    let jwt_secret = env::var("JWT_SECRET")
        .unwrap_or_else(|_| "garment-sampling-tracker-jwt-secret-key-2026".to_string());

    std::fs::create_dir_all("./data").ok();

    let pool = match init_pool(&database_url).await {
        Ok(p) => p,
        Err(e) => {
            log::error!("Failed to initialize database pool: {}", e);
            return Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()));
        }
    };

    if let Err(e) = run_migrations(&pool).await {
        log::error!("Failed to run migrations: {}", e);
        return Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()));
    }

    if let Err(e) = init_default_users(&pool).await {
        log::error!("Failed to initialize default users: {}", e);
        return Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()));
    }

    if let Err(e) = seed_demo_data(&pool).await {
        log::warn!("Failed to seed demo data: {}", e);
    }

    let bind_addr = format!("{}:{}", server_host, server_port);
    log::info!("Server starting on {}", bind_addr);
    log::info!("Default users: registrar1/123456, auditor1/123456, reviewer1/123456");

    let jwt_secret_clone = jwt_secret.clone();
    let registrar_jwt = jwt_secret.clone();
    let auditor_jwt = jwt_secret.clone();
    let reviewer_jwt = jwt_secret.clone();
    let all_roles_jwt = jwt_secret.clone();

    HttpServer::new(move || {
        let cors = Cors::permissive()
            .allowed_origin_fn(|_, _| true)
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec!["Authorization", "Content-Type"])
            .expose_headers(vec!["Authorization"])
            .max_age(3600);

        App::new()
            .app_data(web::Data::new(pool.clone()))
            .app_data(web::Data::new(jwt_secret_clone.clone()))
            .wrap(Logger::default())
            .wrap(cors)
            .service(
                web::scope("/api")
                    .configure(handlers::auth::init_routes)
                    .service(
                        web::scope("")
                            .wrap(AuthMiddleware::new(all_roles_jwt.clone(), None))
                            .configure(handlers::tasks::init_routes)
                            .configure(handlers::statistics::init_routes)
                    )
            )
            .default_service(web::route().to(|| async {
                actix_web::HttpResponse::NotFound().json(models::ApiResponse::<()>::error(404, "接口不存在"))
            }))
    })
    .bind(&bind_addr)?
    .run()
    .await?;

    Ok(())
}
