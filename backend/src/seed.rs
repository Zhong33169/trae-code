use sqlx::SqlitePool;
use uuid::Uuid;
use bcrypt::hash;
use chrono::{Duration, Utc};

use crate::models::{roles, plan_status};

pub async fn seed_data(pool: &SqlitePool) -> anyhow::Result<()> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        return Ok(());
    }

    let password_hash = hash("123456", 4)?;

    let registrar_id = Uuid::new_v4().to_string();
    let auditor_id = Uuid::new_v4().to_string();
    let reviewer_id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO users (id, username, password_hash, real_name, role)
        VALUES (?, ?, ?, ?, ?)
        "#
    )
    .bind(&registrar_id)
    .bind("registrar")
    .bind(&password_hash)
    .bind("张登记")
    .bind(roles::REGISTRAR)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO users (id, username, password_hash, real_name, role)
        VALUES (?, ?, ?, ?, ?)
        "#
    )
    .bind(&auditor_id)
    .bind("auditor")
    .bind(&password_hash)
    .bind("李审核")
    .bind(roles::AUDITOR)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO users (id, username, password_hash, real_name, role)
        VALUES (?, ?, ?, ?, ?)
        "#
    )
    .bind(&reviewer_id)
    .bind("reviewer")
    .bind(&password_hash)
    .bind("王复核")
    .bind(roles::REVIEWER)
    .execute(pool)
    .await?;

    seed_plans(pool, &registrar_id, &auditor_id, &reviewer_id).await?;

    Ok(())
}

async fn seed_plans(
    pool: &SqlitePool,
    registrar_id: &str,
    auditor_id: &str,
    reviewer_id: &str,
) -> anyhow::Result<()> {
    let base_date = Utc::now() - Duration::days(5);

    let plans = vec![
        (
            "MP20250601001",
            "夏季促销活动媒体投放计划",
            "夏日电器有限公司",
            plan_status::DRAFT,
            1,
            registrar_id,
            base_date + Duration::hours(1),
            false,
        ),
        (
            "MP20250602002",
            "新品上市全媒体推广计划",
            "创新科技公司",
            plan_status::PENDING_AUDIT,
            2,
            registrar_id,
            base_date + Duration::hours(5),
            true,
        ),
        (
            "MP20250603003",
            "年终大促广告投放计划",
            "丰收购物平台",
            plan_status::PENDING_AUDIT,
            1,
            registrar_id,
            base_date + Duration::hours(10),
            true,
        ),
        (
            "MP20250604004",
            "品牌形象宣传计划",
            "品质生活集团",
            plan_status::AUDIT_APPROVED,
            3,
            registrar_id,
            base_date + Duration::hours(15),
            true,
        ),
        (
            "MP20250605005",
            "双十一大促媒体计划",
            "双十一电商公司",
            plan_status::AUDIT_REJECTED,
            2,
            registrar_id,
            base_date + Duration::hours(20),
            true,
        ),
        (
            "MP20250606006",
            "春节联欢晚会冠名计划",
            "春晚赞助商",
            plan_status::PENDING_REVIEW,
            4,
            registrar_id,
            base_date + Duration::hours(25),
            true,
        ),
        (
            "MP20250607007",
            "618年中促销计划",
            "618购物节公司",
            plan_status::PENDING_REVIEW,
            2,
            registrar_id,
            base_date + Duration::hours(30),
            true,
        ),
        (
            "MP20250608008",
            "世界杯赛事合作计划",
            "足球赞助商",
            plan_status::REVIEW_APPROVED,
            5,
            registrar_id,
            base_date + Duration::hours(35),
            true,
        ),
        (
            "MP20250609009",
            "开学季教育推广计划",
            "教育科技公司",
            plan_status::REVIEW_REJECTED,
            3,
            registrar_id,
            base_date + Duration::hours(40),
            true,
        ),
        (
            "MP20250610010",
            "周年庆活动媒体计划",
            "百年老店集团",
            plan_status::ARCHIVED,
            6,
            registrar_id,
            base_date + Duration::hours(45),
            true,
        ),
    ];

    for (plan_no, title, client_name, status, version, created_by, created_at, has_evidence) in plans {
        let plan_id = Uuid::new_v4().to_string();

        let submitted_at = if status != plan_status::DRAFT {
            Some(created_at + Duration::hours(1))
        } else {
            None
        };

        let approved_at = if status == plan_status::AUDIT_APPROVED
            || status == plan_status::PENDING_REVIEW
            || status == plan_status::REVIEW_APPROVED
            || status == plan_status::REVIEW_REJECTED
            || status == plan_status::ARCHIVED
        {
            Some(created_at + Duration::hours(3))
        } else {
            None
        };

        let reviewed_at = if status == plan_status::REVIEW_APPROVED
            || status == plan_status::REVIEW_REJECTED
            || status == plan_status::ARCHIVED
        {
            Some(created_at + Duration::hours(5))
        } else {
            None
        };

        let archived_at = if status == plan_status::ARCHIVED {
            Some(created_at + Duration::hours(7))
        } else {
            None
        };

        let reject_reason = if status == plan_status::AUDIT_REJECTED {
            Some("预算分配不合理，需要重新调整媒介组合".to_string())
        } else if status == plan_status::REVIEW_REJECTED {
            Some("排期与合同约定不符，请核实后重新提交".to_string())
        } else {
            None
        };

        sqlx::query(
            r#"
            INSERT INTO media_plans (
                id, plan_no, title, client_name, status, version, created_by,
                created_at, updated_at, submitted_at, approved_at, reviewed_at, archived_at,
                reject_reason, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&plan_id)
        .bind(plan_no)
        .bind(title)
        .bind(client_name)
        .bind(status)
        .bind(version)
        .bind(created_by)
        .bind(created_at)
        .bind(created_at + Duration::hours(2))
        .bind(submitted_at)
        .bind(approved_at)
        .bind(reviewed_at)
        .bind(archived_at)
        .bind(reject_reason.as_deref())
        .bind(Some("备注信息"))
        .execute(pool)
        .await?;

        seed_schedules(pool, &plan_id, title).await?;
        seed_budgets(pool, &plan_id).await?;

        if has_evidence {
            seed_evidences(pool, &plan_id, registrar_id).await?;
        }

        seed_operation_logs(pool, &plan_id, created_by, auditor_id, reviewer_id, status).await?;
    }

    Ok(())
}

async fn seed_schedules(
    pool: &SqlitePool,
    plan_id: &str,
    plan_title: &str,
) -> anyhow::Result<()> {
    let schedules = vec![
        ("腾讯视频", "首页banner", "2025-07-01", "2025-07-31", "每天4次轮播"),
        ("爱奇艺", "贴片广告", "2025-07-05", "2025-08-05", "每集前贴片"),
        ("抖音", "信息流广告", "2025-07-10", "2025-07-20", "每天10条"),
        ("微信朋友圈", "信息流广告", "2025-07-15", "2025-07-25", "每天5000次曝光"),
    ];

    for (media_name, ad_position, start_date, end_date, frequency) in schedules {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO media_schedules (id, plan_id, media_name, ad_position, start_date, end_date, frequency)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(plan_id)
        .bind(format!("{} - {}", plan_title, media_name).chars().take(50).collect::<String>())
        .bind(ad_position)
        .bind(start_date)
        .bind(end_date)
        .bind(frequency)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn seed_budgets(
    pool: &SqlitePool,
    plan_id: &str,
) -> anyhow::Result<()> {
    let budgets = vec![
        ("视频媒体投放", 500000.0, "视频广告"),
        ("社交媒体推广", 300000.0, "社交广告"),
        ("创意制作费", 80000.0, "制作费用"),
        ("监测服务费", 50000.0, "服务费用"),
    ];

    for (item_name, amount, category) in budgets {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO budgets (id, plan_id, item_name, amount, category)
            VALUES (?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(plan_id)
        .bind(item_name)
        .bind(amount)
        .bind(category)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn seed_evidences(
    pool: &SqlitePool,
    plan_id: &str,
    uploader_id: &str,
) -> anyhow::Result<()> {
    let evidences = vec![
        ("client_contract", "客户合同.pdf", "/files/contract.pdf"),
        ("media_quote", "媒体报价单.xlsx", "/files/quote.xlsx"),
        ("creative_mockup", "创意稿预览.png", "/files/creative.png"),
    ];

    for (evidence_type, name, file_path) in evidences {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO evidences (id, plan_id, evidence_type, name, file_path, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(plan_id)
        .bind(evidence_type)
        .bind(name)
        .bind(file_path)
        .bind(uploader_id)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn seed_operation_logs(
    pool: &SqlitePool,
    plan_id: &str,
    registrar_id: &str,
    auditor_id: &str,
    reviewer_id: &str,
    status: &str,
) -> anyhow::Result<()> {
    let mut logs: Vec<(&str, &str, Option<&str>, Option<&str>, &str)> = Vec::new();

    logs.push(("create", registrar_id, None, Some("draft"), "创建媒介计划单"));

    if status != plan_status::DRAFT {
        logs.push(("submit", registrar_id, Some("draft"), Some("pending_audit"), "提交审核"));
    }

    if status == plan_status::AUDIT_APPROVED
        || status == plan_status::PENDING_REVIEW
        || status == plan_status::REVIEW_APPROVED
        || status == plan_status::REVIEW_REJECTED
        || status == plan_status::ARCHIVED
    {
        logs.push(("approve", auditor_id, Some("pending_audit"), Some("audit_approved"), "审核通过"));
        logs.push(("submit", auditor_id, Some("audit_approved"), Some("pending_review"), "提交复核"));
    }

    if status == plan_status::AUDIT_REJECTED {
        logs.push(("reject", auditor_id, Some("pending_audit"), Some("audit_rejected"), "审核驳回：预算分配不合理"));
    }

    if status == plan_status::REVIEW_APPROVED || status == plan_status::ARCHIVED {
        logs.push(("review", reviewer_id, Some("pending_review"), Some("review_approved"), "复核通过"));
    }

    if status == plan_status::REVIEW_REJECTED {
        logs.push(("review_reject", reviewer_id, Some("pending_review"), Some("review_rejected"), "复核驳回：排期不符"));
    }

    if status == plan_status::ARCHIVED {
        logs.push(("archive", reviewer_id, Some("review_approved"), Some("archived"), "归档"));
    }

    for (operation, operator, old_status, new_status, remark) in logs {
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO operation_logs (id, plan_id, operator_id, operation, old_status, new_status, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(plan_id)
        .bind(operator)
        .bind(operation)
        .bind(old_status)
        .bind(new_status)
        .bind(remark)
        .execute(pool)
        .await?;
    }

    Ok(())
}
