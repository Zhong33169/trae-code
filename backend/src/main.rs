use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use dotenvy::dotenv;
use std::env;
use std::sync::Arc;

mod db;
mod models;
mod handlers;
mod services;
mod errors;

use db::AppState;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:./data/library.db?mode=rwc".to_string());
    let port: u16 = env::var("BACKEND_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .unwrap_or(8080);

    std::fs::create_dir_all("./data").ok();

    let pool = db::init_pool(&database_url).await;
    db::run_migrations(&pool).await;
    db::seed_sample_data(&pool).await;

    let state = Arc::new(AppState { pool });

    println!("Backend server starting on http://0.0.0.0:{}", port);

    HttpServer::new(move || {
        let cors = Cors::permissive();
        App::new()
            .app_data(web::Data::new(state.clone()))
            .wrap(cors)
            .service(
                web::scope("/api")
                    .route("/users", web::get().to(handlers::list_users))
                    .route("/records", web::get().to(handlers::list_records))
                    .route("/records", web::post().to(handlers::create_record))
                    .route("/records/{id}", web::get().to(handlers::get_record))
                    .route("/records/{id}", web::put().to(handlers::update_record))
                    .route("/records/{id}/submit", web::post().to(handlers::submit_record))
                    .route("/records/{id}/audit", web::post().to(handlers::audit_record))
                    .route("/records/{id}/review", web::post().to(handlers::review_record))
                    .route("/records/{id}/correct", web::post().to(handlers::correct_record))
                    .route("/records/{id}/process-records", web::get().to(handlers::list_process_records))
                    .route("/records/{id}/evidence", web::get().to(handlers::list_evidence))
                    .route("/records/{id}/evidence", web::post().to(handlers::add_evidence))
                    .route("/stats", web::get().to(handlers::get_stats))
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
