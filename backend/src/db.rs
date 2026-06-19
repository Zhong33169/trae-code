use parking_lot::Mutex;
use rusqlite::Connection;
use std::fs;
use std::sync::Arc;

pub type DbPool = Arc<Mutex<Connection>>;

pub fn init_pool() -> DbPool {
    let data_dir = "data";
    fs::create_dir_all(data_dir).expect("Failed to create data directory");

    let conn = Connection::open("data/seed_tracking.db").expect("Failed to open database");
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .expect("Failed to set pragmas");
    Arc::new(Mutex::new(conn))
}

pub fn init_schema(pool: &DbPool) {
    let conn = pool.lock();
    conn.execute_batch(include_str!("schema.sql"))
        .expect("Failed to initialize schema");
}

pub fn seed_initial_data(pool: &DbPool) {
    let conn = pool.lock();

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))
        .unwrap_or(0);

    if count > 0 {
        return;
    }

    let registrar_pw = bcrypt::hash("registrar123", bcrypt::DEFAULT_COST).unwrap();
    let auditor_pw = bcrypt::hash("auditor123", bcrypt::DEFAULT_COST).unwrap();
    let reviewer_pw = bcrypt::hash("reviewer123", bcrypt::DEFAULT_COST).unwrap();

    conn.execute(
        "INSERT INTO users (id, username, password_hash, role, real_name) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "u_registrar",
            "registrar",
            registrar_pw,
            "registrar",
            "王登记员"
        ],
    ).unwrap();
    conn.execute(
        "INSERT INTO users (id, username, password_hash, role, real_name) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "u_auditor",
            "auditor",
            auditor_pw,
            "auditor",
            "李审核主管"
        ],
    ).unwrap();
    conn.execute(
        "INSERT INTO users (id, username, password_hash, role, real_name) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            "u_reviewer",
            "reviewer",
            reviewer_pw,
            "reviewer",
            "张复核负责人"
        ],
    ).unwrap();
}
