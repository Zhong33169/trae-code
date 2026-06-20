#[macro_use]
extern crate rocket;

mod auth;
mod db;
mod handlers;
mod models;

use rocket::fairing::AdHoc;
use rocket_cors::{AllowedHeaders, AllowedOrigins, Cors, CorsOptions};

fn make_cors() -> Cors {
    let allowed_origins = AllowedOrigins::some_exact(&[
        "http://localhost:3003",
        "http://127.0.0.1:3003",
    ]);

    CorsOptions {
        allowed_origins,
        allowed_methods: ["Get", "Post", "Put", "Delete", "Options"]
            .iter()
            .map(|s| s.parse().unwrap())
            .collect(),
        allowed_headers: AllowedHeaders::all(),
        allow_credentials: true,
        ..Default::default()
    }
    .to_cors()
    .expect("error building CORS")
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .attach(make_cors())
        .attach(AdHoc::on_ignite("DB Init", db::init_db))
        .mount(
            "/api",
            routes![
                handlers::login,
                handlers::current_user,
                handlers::get_users,
                handlers::list_ar,
                handlers::get_ar,
                handlers::create_ar,
                handlers::update_ar,
                handlers::list_orders,
                handlers::get_order,
                handlers::create_order,
                handlers::submit_order,
                handlers::approve_order,
                handlers::reject_order,
                handlers::review_order,
                handlers::archive_order,
                handlers::batch_submit,
                handlers::list_verifications,
                handlers::create_verification,
                handlers::get_stats,
                handlers::list_logs,
            ],
        )
}
