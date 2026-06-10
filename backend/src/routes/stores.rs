use rocket::serde::json::Json;
use rusqlite::params;

use crate::models::Store;
use crate::db::DB_CONN;
use crate::auth::AuthenticatedUser;

#[get("/stores")]
pub fn list_stores(_auth: AuthenticatedUser) -> Json<Vec<Store>> {
    let conn = DB_CONN.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, store_no, store_name, address FROM stores ORDER BY store_no").unwrap();
    
    let stores = stmt.query_map([], |row| {
        Ok(Store {
            id: row.get(0)?,
            store_no: row.get(1)?,
            store_name: row.get(2)?,
            address: row.get(3)?,
        })
    }).unwrap();

    let result: Vec<Store> = stores.filter_map(|s| s.ok()).collect();
    Json(result)
}
