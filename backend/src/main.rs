mod auth;
mod db;
mod errors;
mod handlers;
mod middleware;
mod models;
mod workflow;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, middleware::Logger};
use std::sync::Mutex;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let conn = db::init_db().expect("Failed to initialize database");
    let data = web::Data::new(Mutex::new(conn));

    println!("Server starting on http://0.0.0.0:8003");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:3003")
            .allowed_methods(vec!["GET", "POST", "PUT", "OPTIONS"])
            .allowed_headers(vec!["Content-Type", "Authorization"])
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(data.clone())
            .service(
                web::scope("/api")
                    .service(
                        web::scope("/auth")
                            .route("/login", web::post().to(handlers::login))
                            .route("/me", web::get().to(handlers::me)),
                    )
                    .service(
                        web::scope("/appointments")
                            .route("", web::get().to(handlers::list_appointments))
                            .route("", web::post().to(handlers::create_appointment))
                            .route("/batch-review", web::post().to(handlers::batch_review))
                            .route("/batch-archive", web::post().to(handlers::batch_archive))
                            .route("/{id}", web::get().to(handlers::get_appointment))
                            .route("/{id}/correct", web::put().to(handlers::correct_appointment))
                            .route("/{id}/review", web::put().to(handlers::review_appointment))
                            .route("/{id}/archive", web::put().to(handlers::archive_appointment))
                            .route("/{id}/evidence", web::get().to(handlers::list_evidence))
                            .route("/{id}/evidence", web::post().to(handlers::add_evidence)),
                    )
                    .service(
                        web::scope("/batches")
                            .route("", web::get().to(handlers::list_batches))
                            .route("/{id}", web::get().to(handlers::get_batch_detail)),
                    ),
            )
    })
    .bind("0.0.0.0:8003")?
    .run()
    .await
}
