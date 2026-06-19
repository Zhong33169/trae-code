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

    seed_batch_audit_history(pool).await?;

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

    for (i, (plan_no, title, client_name, status, version, created_by, created_at, has_evidence)) in plans.into_iter().enumerate() {
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

        // 第1条计划单（缺证据草稿）增加批量提交缺证据审计样例
        if i == 0 {
            sqlx::query(
                r#"
                INSERT INTO operation_logs (id, plan_id, operator_id, operation, old_status, new_status, remark, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&plan_id)
            .bind(registrar_id)
            .bind("batch_submit_retry")
            .bind(Some("draft"))
            .bind(Some("draft"))
            .bind(Some("提交前请至少上传一份证据材料"))
            .bind(Some(created_at + Duration::hours(3)))
            .execute(pool)
            .await?;

            // 增加批量审核错状态审计样例
            sqlx::query(
                r#"
                INSERT INTO operation_logs (id, plan_id, operator_id, operation, old_status, new_status, remark, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&plan_id)
            .bind(auditor_id)
            .bind("batch_approve_failed")
            .bind(Some("draft"))
            .bind(Some("draft"))
            .bind(Some("当前状态 '草稿' 不允许审核通过"))
            .bind(Some(created_at + Duration::hours(4)))
            .execute(pool)
            .await?;
        }

        // 第5条计划单（pending_audit，v6）增加版本冲突审计样例
        if i == 4 {
            sqlx::query(
                r#"
                INSERT INTO operation_logs (id, plan_id, operator_id, operation, old_status, new_status, remark, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&plan_id)
            .bind(auditor_id)
            .bind("batch_approve_retry")
            .bind(Some("pending_audit"))
            .bind(Some("pending_audit"))
            .bind(Some("版本冲突：当前版本为 v6，你基于 v5 操作，请刷新后重试"))
            .bind(Some(created_at + Duration::hours(5)))
            .execute(pool)
            .await?;
        }

        // 第7条计划单（audit_rejected）增加批量复核错状态审计样例
        if i == 6 {
            sqlx::query(
                r#"
                INSERT INTO operation_logs (id, plan_id, operator_id, operation, old_status, new_status, remark, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&plan_id)
            .bind(reviewer_id)
            .bind("batch_review_failed")
            .bind(Some("audit_rejected"))
            .bind(Some("audit_rejected"))
            .bind(Some("当前角色 '广告代理公司复核负责人' 无权限执行批量 'review' 操作"))
            .bind(Some(created_at + Duration::hours(3)))
            .execute(pool)
            .await?;
        }
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

async fn seed_batch_audit_history(pool: &SqlitePool) -> anyhow::Result<()> {
    let plans: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT id, plan_no, status FROM media_plans ORDER BY plan_no"
    )
    .fetch_all(pool)
    .await?;

    let users: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT id, real_name, role FROM users ORDER BY role"
    )
    .fetch_all(pool)
    .await?;

    let registrar_id = users.iter().find(|(_, _, r)| r == "registrar").map(|(id, _, _)| id.clone()).unwrap_or_default();
    let auditor_id = users.iter().find(|(_, _, r)| r == "auditor").map(|(id, _, _)| id.clone()).unwrap_or_default();
    let reviewer_id = users.iter().find(|(_, _, r)| r == "reviewer").map(|(id, _, _)| id.clone()).unwrap_or_default();

    let mut batch_history: Vec<(String, &str, Option<String>, Option<String>, &str, &str)> = Vec::new();

    // 登记员批量提交成功样例：第2、3条 pending_audit
    for (plan_id, _, _) in plans.iter().filter(|(_, plan_no, _)| plan_no.as_str() == "MP20250602002" || plan_no.as_str() == "MP20250603003") {
        batch_history.push((
            plan_id.clone(),
            "batch_submit",
            Some("draft".to_string()),
            Some("pending_audit".to_string()),
            "批量提交审核成功",
            registrar_id.as_str(),
        ));
    }

    // 审核员批量审核通过成功样例：第4条 audit_approved / 第8条 review_approved
    for (plan_id, _, _) in plans.iter().filter(|(_, plan_no, _)| plan_no.as_str() == "MP20250604004" || plan_no.as_str() == "MP20250608008") {
        batch_history.push((
            plan_id.clone(),
            "batch_approve",
            Some("pending_audit".to_string()),
            Some("pending_review".to_string()),
            "批量审核通过",
            auditor_id.as_str(),
        ));
    }

    // 复核员批量复核成功样例：第4条 audit_approved / 第10条 archived
    for (plan_id, _, _) in plans.iter().filter(|(_, plan_no, _)| plan_no.as_str() == "MP20250604004" || plan_no.as_str() == "MP20250610010") {
        batch_history.push((
            plan_id.clone(),
            "batch_review",
            Some("pending_review".to_string()),
            Some("review_approved".to_string()),
            "批量复核通过",
            reviewer_id.as_str(),
        ));
    }

    // 审核员批量审核失败样例：第7条 audit_rejected（错状态）
    if let Some((plan_id, _, _)) = plans.iter().find(|(_, plan_no, _)| plan_no.as_str() == "MP20250607007") {
        batch_history.push((
            plan_id.clone(),
            "batch_approve_failed",
            Some("audit_rejected".to_string()),
            Some("audit_rejected".to_string()),
            "当前状态 '审核驳回' 不允许审核通过，请先由登记员补正",
            auditor_id.as_str(),
        ));
        batch_history.push((
            plan_id.clone(),
            "batch_reject_failed",
            Some("audit_rejected".to_string()),
            Some("audit_rejected".to_string()),
            "当前状态 '审核驳回' 不允许审核驳回",
            auditor_id.as_str(),
        ));
    }

    // 登记员批量提交失败样例：第10条 archived（错状态）
    if let Some((plan_id, _, _)) = plans.iter().find(|(_, plan_no, _)| plan_no.as_str() == "MP20250610010") {
        batch_history.push((
            plan_id.clone(),
            "batch_submit_failed",
            Some("archived".to_string()),
            Some("archived".to_string()),
            "当前状态 '已归档' 不允许提交",
            registrar_id.as_str(),
        ));
    }

    // 复核员批量复核失败样例：第2条 pending_audit（错状态）
    if let Some((plan_id, _, _)) = plans.iter().find(|(_, plan_no, _)| plan_no.as_str() == "MP20250602002") {
        batch_history.push((
            plan_id.clone(),
            "batch_review_failed",
            Some("pending_audit".to_string()),
            Some("pending_audit".to_string()),
            "当前状态 '待审核' 不允许复核，请先由审核主管完成审核",
            reviewer_id.as_str(),
        ));
    }

    // 登记员批量提交需重试样例：第3条 pending_audit（旧版本冲突场景）
    if let Some((plan_id, _, _)) = plans.iter().find(|(_, plan_no, _)| plan_no.as_str() == "MP20250603003") {
        batch_history.push((
            plan_id.clone(),
            "batch_submit_retry",
            Some("pending_audit".to_string()),
            Some("pending_audit".to_string()),
            "版本冲突：当前版本为 v2，你基于 v1 操作，请刷新后重试",
            registrar_id.as_str(),
        ));
    }

    // 审核员批量审核需重试样例：第6条 review_rejected（版本冲突）
    if let Some((plan_id, _, _)) = plans.iter().find(|(_, plan_no, _)| plan_no.as_str() == "MP20250606006") {
        batch_history.push((
            plan_id.clone(),
            "batch_approve_retry",
            Some("review_rejected".to_string()),
            Some("review_rejected".to_string()),
            "版本冲突：当前版本为 v4，你基于 v3 操作，请刷新后重试",
            auditor_id.as_str(),
        ));
    }

    // 复核员批量复核需重试样例：第5条 pending_review（版本冲突）
    if let Some((plan_id, _, _)) = plans.iter().find(|(_, plan_no, _)| plan_no.as_str() == "MP20250605005") {
        batch_history.push((
            plan_id.clone(),
            "batch_review_retry",
            Some("pending_review".to_string()),
            Some("pending_review".to_string()),
            "版本冲突：当前版本为 v6，你基于 v5 操作，请刷新后重试",
            reviewer_id.as_str(),
        ));
    }

    // 登记员批量提交缺证据需重试：第1条 draft（已有一条种子，但再补一条登记员视角的历史）
    if let Some((plan_id, _, _)) = plans.iter().find(|(_, plan_no, _)| plan_no.as_str() == "MP20250601001") {
        batch_history.push((
            plan_id.clone(),
            "batch_submit_retry",
            Some("draft".to_string()),
            Some("draft".to_string()),
            "提交前请至少上传客户合同、媒体报价单或创意稿其中之一",
            registrar_id.as_str(),
        ));
    }

    // 审核员批量驳回成功样例：第9条 review_rejected（之前是审核驳回）
    if let Some((plan_id, _, _)) = plans.iter().find(|(_, plan_no, _)| plan_no.as_str() == "MP20250609009") {
        batch_history.push((
            plan_id.clone(),
            "batch_reject",
            Some("pending_audit".to_string()),
            Some("audit_rejected".to_string()),
            "批量审核驳回：创意稿不符合品牌规范",
            auditor_id.as_str(),
        ));
    }

    let base_time = Utc::now() - Duration::days(2);
    for (idx, (plan_id, operation, old_status, new_status, remark, operator_id)) in batch_history.iter().enumerate() {
        let id = Uuid::new_v4().to_string();
        let created_at = base_time + Duration::minutes(idx as i64 * 3);

        sqlx::query(
            r#"
            INSERT INTO operation_logs (id, plan_id, operator_id, operation, old_status, new_status, remark, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(plan_id)
        .bind(operator_id)
        .bind(operation)
        .bind(old_status.as_deref())
        .bind(new_status.as_deref())
        .bind(Some(*remark))
        .bind(Some(created_at))
        .execute(pool)
        .await?;
    }

    Ok(())
}
