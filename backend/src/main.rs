#![macro_use]
extern crate rocket;

mod db;
mod models;
mod routes;
mod cors;

use std::sync::Mutex;
use rusqlite::Connection;

pub struct DbConn {
    pub conn: Mutex<Connection>,
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error> {
    let conn = db::init::init_database().expect("Failed to initialize database");
    
    rocket::build()
        .manage(DbConn { conn: Mutex::new(conn) })
        .attach(cors::cors_fairing())
        .mount("/api/auth", routes::auth::routes())
        .mount("/api/materials", routes::materials::routes())
        .mount("/api/audit", routes::audit::routes())
        .launch()
        .await?;

    Ok(())
}
