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

pub async fn seed_demo_data(pool: &DbPool) -> Result<()> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sampling_tasks")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    if count > 0 {
        log::info!("Demo data already exists ({} tasks), skipping seed", count);
        return Ok(());
    }

    log::info!("Seeding demo data...");

    let tasks_sql = "
INSERT OR IGNORE INTO sampling_tasks (id,task_no,order_no,style_no,style_name,customer_name,fabric_type,color,size_spec,quantity,current_node,status,priority,order_sampling_started_at,order_sampling_completed_at,sample_confirmation_started_at,sample_confirmation_completed_at,production_scheduling_started_at,production_scheduling_completed_at,archived_at,registrar_id,auditor_id,reviewer_id,created_at,updated_at) VALUES
('demo001','DY20260601001','ORD-2026-001','ST-001','春季风衣','优衣库','涤纶混纺','卡其色','S/M/L/XL',3,'order_sampling','pending','high','2026-06-10 01:00:00',NULL,NULL,NULL,NULL,NULL,NULL,'u001','u002',NULL,'2026-06-10 01:00:00','2026-06-10 01:00:00'),
('demo002','DY20260601002','ORD-2026-002','ST-002','夏季T恤','ZARA','纯棉','白色','XS/S/M/L',10,'sample_confirmation','processing','normal','2026-06-09 00:00:00','2026-06-10 01:00:00','2026-06-10 01:00:00',NULL,NULL,NULL,NULL,'u001','u002',NULL,'2026-06-09 00:00:00','2026-06-09 00:00:00'),
('demo003','DY20260601003','ORD-2026-003','ST-003','秋季西装外套','H&M','羊毛混纺','深灰色','M/L/XL/XXL',5,'production_scheduling','processing','high','2026-06-08 00:00:00','2026-06-08 23:00:00','2026-06-09 00:00:00','2026-06-09 23:00:00','2026-06-10 01:00:00',NULL,NULL,'u001','u002','u003','2026-06-08 00:00:00','2026-06-08 00:00:00'),
('demo004','DY20260602001','ORD-2026-004','ST-004','冬季羽绒服','波司登','尼龙','黑色','S/M/L/XL/XXL',8,'order_sampling','processing','urgent','2026-06-09 00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,'u001','u002',NULL,'2026-06-09 00:00:00','2026-06-09 00:00:00'),
('demo005','DY20260602002',NULL,'ST-005','运动休闲裤','耐克','弹力棉','深蓝色','S/M/L/XL',6,'archived','archived','normal','2026-06-08 00:00:00','2026-06-08 23:00:00','2026-06-09 00:00:00','2026-06-09 23:00:00','2026-06-10 01:00:00','2026-06-11 07:00:00','2026-06-11 07:00:00','u001','u002','u003','2026-06-08 00:00:00','2026-06-08 00:00:00')";
    sqlx::query(tasks_sql).execute(pool).await?;

    let node_records_sql = "
INSERT OR IGNORE INTO node_records (id,task_id,node_type,operator_id,action,remark,abnormal_reason,started_at,completed_at,is_timeout,timeout_hours,created_at) VALUES
('nr001','demo001','order_sampling','u001','create',NULL,NULL,'2026-06-10 01:00:00',NULL,0,0,'2026-06-10 01:00:00'),
('nr002','demo002','order_sampling','u001','create',NULL,NULL,'2026-06-09 00:00:00','2026-06-10 01:00:00',0,0,'2026-06-09 00:00:00'),
('nr003','demo002','sample_confirmation','u002','process',NULL,NULL,'2026-06-10 01:00:00',NULL,1,6,'2026-06-10 01:00:00'),
('nr004','demo003','order_sampling','u001','create',NULL,NULL,'2026-06-08 00:00:00','2026-06-08 23:00:00',0,0,'2026-06-08 00:00:00'),
('nr005','demo003','sample_confirmation','u002','create',NULL,NULL,'2026-06-09 00:00:00','2026-06-09 23:00:00',0,0,'2026-06-09 00:00:00'),
('nr006','demo003','production_scheduling','u002','process',NULL,NULL,'2026-06-10 01:00:00',NULL,1,6,'2026-06-10 01:00:00'),
('nr007','demo004','order_sampling','u001','create',NULL,NULL,'2026-06-09 00:00:00',NULL,1,31,'2026-06-09 00:00:00'),
('nr008','demo005','order_sampling','u001','create',NULL,NULL,'2026-06-08 00:00:00','2026-06-08 23:00:00',0,0,'2026-06-08 00:00:00'),
('nr009','demo005','sample_confirmation','u002','process',NULL,NULL,'2026-06-09 00:00:00','2026-06-09 23:00:00',0,0,'2026-06-09 00:00:00'),
('nr010','demo005','production_scheduling','u002','process',NULL,NULL,'2026-06-10 01:00:00','2026-06-11 07:00:00',1,6,'2026-06-10 01:00:00')";
    sqlx::query(node_records_sql).execute(pool).await?;

    let op_logs_sql = "
INSERT OR IGNORE INTO operation_logs (id,task_id,user_id,action,from_status,to_status,from_node,to_node,detail,ip_address,created_at) VALUES
('ol001','demo001','u001','创建任务',NULL,'pending',NULL,'order_sampling','创建打样任务: DY20260601001','127.0.0.1','2026-06-10 01:00:00'),
('ol002','demo002','u001','创建任务',NULL,'pending',NULL,'order_sampling','创建打样任务: DY20260601002','127.0.0.1','2026-06-09 00:00:00'),
('ol003','demo002','u002','审核通过','pending','processing','order_sampling','sample_confirmation','审核通过任务: DY20260601002','127.0.0.1','2026-06-10 01:00:00'),
('ol004','demo003','u001','创建任务',NULL,'pending',NULL,'order_sampling','创建打样任务: DY20260601003','127.0.0.1','2026-06-08 00:00:00'),
('ol005','demo003','u002','审核通过','pending','processing','order_sampling','sample_confirmation','审核通过任务: DY20260601003','127.0.0.1','2026-06-08 23:00:00'),
('ol006','demo003','u002','确认通过','processing','processing','sample_confirmation','production_scheduling','确认通过任务: DY20260601003','127.0.0.1','2026-06-09 23:00:00'),
('ol007','demo004','u001','创建任务',NULL,'processing',NULL,'order_sampling','创建打样任务: DY20260602001','127.0.0.1','2026-06-09 00:00:00'),
('ol008','demo005','u001','创建任务',NULL,'pending',NULL,'order_sampling','创建打样任务: DY20260602002','127.0.0.1','2026-06-08 00:00:00'),
('ol009','demo005','u002','审核通过','pending','processing','order_sampling','sample_confirmation','审核通过任务: DY20260602002','127.0.0.1','2026-06-08 23:00:00'),
('ol010','demo005','u003','复核归档','processing','archived','production_scheduling','archived','复核归档任务: DY20260602002','127.0.0.1','2026-06-11 07:00:00')";
    sqlx::query(op_logs_sql).execute(pool).await?;

    log::info!("Demo data seeded: 5 tasks, 10 node records, 10 operation logs");
    Ok(())
}

pub fn new_uuid() -> String {
    Uuid::new_v4().to_string()
}

pub fn now_str() -> String {
    Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}
