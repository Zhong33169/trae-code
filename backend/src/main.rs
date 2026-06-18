mod db;
mod handlers;
mod models;
mod auth;
mod errors;

use actix_web::{web, App, HttpServer, middleware::Logger};
use actix_cors::Cors;
use std::env;
use dotenvy::dotenv;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    env_logger::init();

    let pool = db::init_db().expect("Failed to initialize database");
    let data = web::Data::new(pool);

    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| "8003".to_string())
        .parse()
        .expect("PORT must be a number");

    log::info!("Starting server on port {}", port);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:3003")
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec!["Content-Type", "Authorization"])
            .max_age(3600);

        App::new()
            .app_data(data.clone())
            .wrap(Logger::default())
            .wrap(cors)
            .service(
                web::scope("/api")
                    .service(handlers::auth_handlers())
                    .service(handlers::inspection_handlers())
                    .service(handlers::handover_handlers())
                    .service(handlers::stats_handlers())
                    .service(handlers::log_handlers())
                    .service(handlers::reminder_handlers())
                    .service(handlers::corporate_handlers())
                    .service(handlers::user_handlers())
            )
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
