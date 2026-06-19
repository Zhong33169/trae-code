#[macro_use]
extern crate rocket;

mod db;
mod models;
mod auth;
mod handlers;
use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::{Header, Method, Status};
use rocket::{Request, Response};

pub struct CORS;

#[rocket::async_trait]
impl Fairing for CORS {
    fn info(&self) -> Info {
        Info { name: "Add CORS headers to responses", kind: Kind::Response }
    }

    async fn on_response<'r>(&self, request: &'r Request<'_>, response: &mut Response<'r>) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH"));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
        if request.method() == Method::Options {
            response.set_status(Status::Ok);
        }
    }
}

#[launch]
fn rocket() -> _ {
    dotenvy::dotenv().ok();

    let db_pool = db::init_pool();
    db::init_schema(&db_pool);
    db::seed_initial_data(&db_pool);

    rocket::build()
        .manage(db_pool)
        .attach(CORS)
        .mount("/api/auth", handlers::auth::routes())
        .mount("/api/records", handlers::records::routes())
        .mount("/api/logs", handlers::logs::routes())
        .mount("/api/stats", handlers::stats::routes())
}
