#[macro_use]
extern crate rocket;

mod db;
mod models;
mod handlers;
mod auth;
mod error;

use rocket::http::Method;
use rocket_cors::{AllowedOrigins, CorsOptions};

#[launch]
fn rocket() -> _ {
    let cors = CorsOptions::default()
        .allowed_origins(AllowedOrigins::all())
        .allowed_methods(
            vec![Method::Get, Method::Post, Method::Put, Method::Delete, Method::Options]
                .into_iter()
                .map(From::from)
                .collect(),
        )
        .allow_credentials(true);

    let pool = db::init_pool("nursing_care.db").expect("Failed to create database pool");
    db::init_db(&pool).expect("Failed to initialize database");

    rocket::build()
        .manage(pool)
        .attach(cors.to_cors().unwrap())
        .mount("/api/auth", handlers::auth::routes())
        .mount("/api/plans", handlers::plans::routes())
        .mount("/api/statistics", handlers::statistics::routes())
        .mount("/api/users", handlers::users::routes())
}
