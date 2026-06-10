#[macro_use]
extern crate rocket;

mod db;
mod models;
mod auth;
mod routes;

use rocket_cors::{AllowedOrigins, CorsOptions};
use std::env;

#[launch]
fn rocket() -> _ {
    drop(db::DB_CONN.lock().unwrap());

    let frontend_port = env::var("FRONTEND_PORT").unwrap_or_else(|_| "4321".to_string());
    let frontend_url = format!("http://localhost:{}", frontend_port);

    let cors = CorsOptions::default()
        .allowed_origins(AllowedOrigins::some_exact(&[
            frontend_url.as_str(),
            "http://localhost:4321",
            "http://localhost:3000",
            "http://127.0.0.1:4321",
            "http://127.0.0.1:3000",
        ]))
        .to_cors()
        .expect("Failed to create CORS fairing");

    let backend_port = env::var("BACKEND_PORT").unwrap_or_else(|_| "8000".to_string());
    let port: u16 = backend_port.parse().unwrap_or(8000);

    let config = rocket::Config {
        port,
        address: std::net::Ipv4Addr::UNSPECIFIED.into(),
        ..rocket::Config::default()
    };

    rocket::custom(config)
        .attach(cors)
        .mount("/api", routes![
            routes::auth::login,
            routes::applications::list_applications,
            routes::applications::get_application,
            routes::applications::create_application,
            routes::applications::update_application,
            routes::applications::submit_application,
            routes::applications::review_application,
            routes::applications::final_review_application,
            routes::applications::batch_review_applications,
            routes::applications::get_application_history,
            routes::stores::list_stores,
        ])
}
