use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::Path;
use anyhow::Result;

pub type DbPool = SqlitePool;

pub async fn init_pool(database_path: &str) -> Result<DbPool> {
    let options = SqliteConnectOptions::new()
        .filename(database_path)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect_with(options)
        .await?;
    Ok(pool)
}

pub async fn run_migrations(pool: &DbPool) -> Result<()> {
    let schema = include_str!("../schema.sql");
    sqlx::query(schema).execute(pool).await?;
    Ok(())
}

pub async fn init_database(db_path: &str) -> Result<DbPool> {
    let path = Path::new(db_path);
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let pool = init_pool(db_path).await?;
    run_migrations(&pool).await?;
    Ok(pool)
}
