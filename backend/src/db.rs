use anyhow::{Context, Result};
use argon2::{Algorithm, Argon2, Params, Version};
use chrono::Utc;
use rand::RngCore;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use uuid::Uuid;

pub type DbPool = SqlitePool;

pub async fn init_pool(database_url: &str) -> Result<DbPool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .context("Failed to create database pool")?;
    Ok(pool)
}

pub async fn run_migrations(pool: &DbPool) -> Result<()> {
    let sql = include_str!("../migrations/001_initial_schema.sql");
    sqlx::query(sql).execute(pool).await.context("Failed to run migrations")?;
    Ok(())
}

fn hash_password(password: &str) -> Result<String> {
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    
    let params = Params::new(19456, 2, 1, Some(32)).map_err(|e| anyhow::anyhow!(e))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    
    let mut output = [0u8; 32];
    argon2.hash_password_into(password.as_bytes(), &salt, &mut output)
        .map_err(|e| anyhow::anyhow!(e))?;
    
    let salt_b64 = data_encoding::BASE64_NOPAD.encode(&salt);
    let hash_b64 = data_encoding::BASE64_NOPAD.encode(&output);
    
    Ok(format!("$argon2id$v=19$m=19456,t=2,p=1${}${}", salt_b64, hash_b64))
}

pub async fn init_default_users(pool: &DbPool) -> Result<()> {
    let users = [
        ("u001", "registrar1", "李登记", "registrar"),
        ("u002", "auditor1", "王审核", "auditor"),
        ("u003", "reviewer1", "张复核", "reviewer"),
    ];

    let password_hash = hash_password("123456")?;
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    for (id, username, real_name, role) in &users {
        let exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM users WHERE id = ? OR username = ?"
        )
        .bind(id)
        .bind(username)
        .fetch_optional(pool)
        .await?;

        if exists.is_none() {
            sqlx::query(
                "INSERT INTO users (id, username, password_hash, real_name, role, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(username)
            .bind(&password_hash)
            .bind(real_name)
            .bind(role)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await
            .with_context(|| format!("Failed to create user: {}", username))?;
            
            log::info!("Created default user: {} ({})", username, real_name);
        } else {
            sqlx::query(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?"
            )
            .bind(&password_hash)
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;
            
            log::info!("Updated password for user: {} ({})", username, real_name);
        }
    }

    Ok(())
}

pub async fn generate_task_no(pool: &DbPool) -> Result<String> {
    let now = Utc::now();
    let date_prefix = now.format("%Y%m%d").to_string();
    let prefix = format!("DY{}{}", date_prefix, "%");
    
    let max_no: Option<String> = sqlx::query_scalar(
        "SELECT task_no FROM sampling_tasks WHERE task_no LIKE ? ORDER BY task_no DESC LIMIT 1"
    )
    .bind(&prefix)
    .fetch_optional(pool)
    .await?;

    let seq = match max_no {
        Some(no) => {
            let suffix: u32 = no.chars().skip(10).collect::<String>().parse().unwrap_or(0);
            suffix + 1
        }
        None => 1,
    };

    Ok(format!("DY{}{:04}", date_prefix, seq))
}

pub fn new_uuid() -> String {
    Uuid::new_v4().to_string()
}

pub fn now_str() -> String {
    Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}
