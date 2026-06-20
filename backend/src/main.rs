mod db;
mod models;
mod middleware;
mod handlers;

use actix_web::{web, App, HttpServer, middleware::Logger};
use actix_cors::Cors;
use actix_files as fs;
use db::init_db;
use middleware::auth::AuthState;
use std::sync::Arc;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    let db = init_db("data/complaint.db").expect("Failed to initialize database");
    let db_data = web::Data::new(db);
    let auth_state = web::Data::new(AuthState::new());

    println!("Starting complaint backend on port 8005...");
    println!("Database: data/complaint.db");
    println!("CORS allowed: http://localhost:3005");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:3005")
            .allowed_origin("http://127.0.0.1:3005")
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec!["Content-Type", "Authorization"])
            .max_age(3600);

        App::new()
            .app_data(db_data.clone())
            .app_data(auth_state.clone())
            .wrap(cors)
            .wrap(Logger::default())
            .service(
                web::scope("/api")
                    .route("/auth/login", web::post().to(handlers::auth::login))
                    .route("/auth/logout", web::post().to(handlers::auth::logout))
                    .route("/auth/me", web::get().to(handlers::auth::get_current_user))
                    .route("/auth/session", web::get().to(handlers::auth::get_session))
                    .route("/users", web::get().to(handlers::auth::get_all_users))

                    .route("/tickets", web::get().to(handlers::tickets::list_tickets))
                    .route("/tickets", web::post().to(handlers::tickets::create_ticket))
                    .route("/tickets/{id}", web::get().to(handlers::tickets::get_ticket))
                    .route("/tickets/{id}", web::put().to(handlers::tickets::update_ticket))
                    .route("/tickets/{id}/process", web::post().to(handlers::tickets::start_process))
                    .route("/tickets/{id}/submit-review", web::post().to(handlers::tickets::submit_review))
                    .route("/tickets/{id}/return", web::post().to(handlers::tickets::return_ticket))
                    .route("/tickets/{id}/resubmit", web::post().to(handlers::tickets::resubmit_ticket))
                    .route("/tickets/{id}/archive", web::post().to(handlers::tickets::archive_ticket))
                    .route("/tickets/transitions", web::get().to(handlers::tickets::get_status_transitions))

                    .route("/tickets/{id}/attachments", web::get().to(handlers::attachments::list_attachments))
                    .route("/tickets/{id}/attachments", web::post().to(handlers::attachments::upload_attachment))
                    .route("/tickets/{ticket_id}/attachments/{attachment_id}", web::delete().to(handlers::attachments::delete_attachment))

                    .route("/tickets/{id}/audit-logs", web::get().to(handlers::audit::list_audit_logs))
                    .route("/audit-logs", web::get().to(handlers::audit::list_all_audit_logs))
                    .route("/audit-logs/failures", web::get().to(handlers::audit::list_failure_logs))

                    .route("/import", web::post().to(handlers::import::import_tickets))
                    .route("/import/batches", web::get().to(handlers::import::list_batches))
                    .route("/import/batches/{id}", web::get().to(handlers::import::get_batch))
                    .route("/import/batches/{id}/records", web::get().to(handlers::import::list_batch_records))
            )
            .service(
                fs::Files::new("/uploads", "./uploads")
                    .show_files_listing()
            )
    })
    .bind("0.0.0.0:8005")?
    .run()
    .await
}
