use anyhow::{anyhow, Result};
use chrono::{Duration, Utc};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

use crate::models::*;

pub type DbPool = SqlitePool;

pub async fn init_pool(database_url: &str) -> Result<DbPool> {
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;
    Ok(pool)
}

pub async fn run_migrations(pool: &DbPool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            company TEXT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS spare_part_orders (
            id TEXT PRIMARY KEY,
            order_no TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            part_name TEXT NOT NULL,
            part_model TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            reason TEXT NOT NULL,
            station_name TEXT NOT NULL,
            status TEXT NOT NULL,
            current_handler_id TEXT NOT NULL,
            current_handler_name TEXT NOT NULL,
            current_handler_role TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            evidence TEXT NOT NULL DEFAULT '[]',
            registrar_id TEXT NOT NULL,
            registrar_name TEXT NOT NULL,
            appeal_reason TEXT,
            review_opinion TEXT,
            reject_reason TEXT,
            original_status TEXT,
            deadline TEXT,
            is_overdue INTEGER NOT NULL DEFAULT 0,
            is_evidence_missing INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS process_records (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            handler_id TEXT NOT NULL,
            handler_name TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            action TEXT NOT NULL,
            opinion TEXT NOT NULL DEFAULT '',
            from_status TEXT NOT NULL,
            to_status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES spare_part_orders(id)
        );
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn seed_data(pool: &DbPool) -> Result<()> {
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;
    if user_count > 0 {
        return Ok(());
    }

    let users = vec![
        (
            "user_registrar_1",
            "张登记员",
            UserRole::Registrar.as_str(),
            "光伏运维公司",
        ),
        (
            "user_registrar_2",
            "李登记员",
            UserRole::Registrar.as_str(),
            "光伏运维公司",
        ),
        (
            "user_auditor_1",
            "王审核主管",
            UserRole::Auditor.as_str(),
            "备件更换审核部门",
        ),
        (
            "user_reviewer_1",
            "赵复核负责人",
            UserRole::Reviewer.as_str(),
            "光伏运维公司",
        ),
    ];

    for (id, name, role, company) in &users {
        sqlx::query(
            "INSERT INTO users (id, name, role, company) VALUES (?, ?, ?, ?)",
        )
        .bind(id)
        .bind(name)
        .bind(role)
        .bind(company)
        .execute(pool)
        .await?;
    }

    let now = Utc::now();

    let demo_orders = vec![
        DemoOrderSeed {
            order_no: "BJ-2026-0001".to_string(),
            title: "阳光电站A区逆变器风扇更换".to_string(),
            part_name: "散热风扇".to_string(),
            part_model: "FAN-12038-24V".to_string(),
            quantity: 4,
            reason: "逆变器散热风扇异响，转速不足，需更换".to_string(),
            station_name: "阳光电站A区".to_string(),
            status: OrderStatus::Archived.as_str().to_string(),
            current_handler_id: "user_reviewer_1".to_string(),
            current_handler_name: "赵复核负责人".to_string(),
            current_handler_role: UserRole::Reviewer.as_str().to_string(),
            registrar_id: "user_registrar_1".to_string(),
            registrar_name: "张登记员".to_string(),
            is_overdue: false,
            is_evidence_missing: false,
            deadline_days: None,
            appeal_reason: None,
            review_opinion: Some("复核通过，流程合规，证据齐全，同意归档。".to_string()),
            reject_reason: None,
            original_status: None,
            evidence: demo_evidence_normal(),
        },
        DemoOrderSeed {
            order_no: "BJ-2026-0002".to_string(),
            title: "星河电站B组光伏组件接线盒更换".to_string(),
            part_name: "光伏组件接线盒".to_string(),
            part_model: "BOX-PV-1500V-DC".to_string(),
            quantity: 6,
            reason: "接线盒烧毁，疑似雷击导致".to_string(),
            station_name: "星河电站B组".to_string(),
            status: OrderStatus::AppealRejectedCorrection.as_str().to_string(),
            current_handler_id: "user_registrar_1".to_string(),
            current_handler_name: "张登记员".to_string(),
            current_handler_role: UserRole::Registrar.as_str().to_string(),
            registrar_id: "user_registrar_1".to_string(),
            registrar_name: "张登记员".to_string(),
            is_overdue: false,
            is_evidence_missing: true,
            deadline_days: Some(3),
            appeal_reason: Some("首次审核退回后，已补充现场照片，但缺少第三方检测报告".to_string()),
            review_opinion: None,
            reject_reason: Some("缺少第三方电气检测报告，无法确认故障原因，需补充证据后重新提交。".to_string()),
            original_status: Some(OrderStatus::AppealSubmitted.as_str().to_string()),
            evidence: demo_evidence_partial(),
        },
        DemoOrderSeed {
            order_no: "BJ-2026-0003".to_string(),
            title: "海风电站C区汇流箱熔断器更换".to_string(),
            part_name: "直流熔断器".to_string(),
            part_model: "FUSE-DC-1500V-20A".to_string(),
            quantity: 12,
            reason: "汇流箱多支路熔断器熔断，排查后为组件短路引起".to_string(),
            station_name: "海风电站C区".to_string(),
            status: OrderStatus::Verifying.as_str().to_string(),
            current_handler_id: "user_auditor_1".to_string(),
            current_handler_name: "王审核主管".to_string(),
            current_handler_role: UserRole::Auditor.as_str().to_string(),
            registrar_id: "user_registrar_2".to_string(),
            registrar_name: "李登记员".to_string(),
            is_overdue: true,
            is_evidence_missing: false,
            deadline_days: Some(-1),
            appeal_reason: None,
            review_opinion: None,
            reject_reason: None,
            original_status: None,
            evidence: demo_evidence_normal(),
        },
        DemoOrderSeed {
            order_no: "BJ-2026-0004".to_string(),
            title: "绿洲电站D组跟踪电机减速箱更换".to_string(),
            part_name: "减速箱".to_string(),
            part_model: "GEAR-WORM-50:1".to_string(),
            quantity: 2,
            reason: "跟踪支架减速箱漏油，运行异响".to_string(),
            station_name: "绿洲电站D组".to_string(),
            status: OrderStatus::AppealAccepted.as_str().to_string(),
            current_handler_id: "user_reviewer_1".to_string(),
            current_handler_name: "赵复核负责人".to_string(),
            current_handler_role: UserRole::Reviewer.as_str().to_string(),
            registrar_id: "user_registrar_2".to_string(),
            registrar_name: "李登记员".to_string(),
            is_overdue: false,
            is_evidence_missing: false,
            deadline_days: Some(5),
            appeal_reason: Some("审核退回认为理由不充分，但现场实际已发生故障影响发电，附新补充的发电量损失报告和更清晰的视频证据".to_string()),
            review_opinion: None,
            reject_reason: None,
            original_status: Some(OrderStatus::VerifyReturned.as_str().to_string()),
            evidence: demo_evidence_full(),
        },
        DemoOrderSeed {
            order_no: "BJ-2026-0005".to_string(),
            title: "南山电站E区SVG模块更换".to_string(),
            part_name: "SVG功率模块".to_string(),
            part_model: "SVG-MOD-50kVA".to_string(),
            quantity: 1,
            reason: "SVG模块IGBT损坏".to_string(),
            station_name: "南山电站E区".to_string(),
            status: OrderStatus::Reviewing.as_str().to_string(),
            current_handler_id: "user_reviewer_1".to_string(),
            current_handler_name: "赵复核负责人".to_string(),
            current_handler_role: UserRole::Reviewer.as_str().to_string(),
            registrar_id: "user_registrar_1".to_string(),
            registrar_name: "张登记员".to_string(),
            is_overdue: false,
            is_evidence_missing: false,
            deadline_days: Some(7),
            appeal_reason: None,
            review_opinion: None,
            reject_reason: None,
            original_status: None,
            evidence: demo_evidence_normal(),
        },
        DemoOrderSeed {
            order_no: "BJ-2026-0006".to_string(),
            title: "东风电站F区直流电缆更换".to_string(),
            part_name: "光伏直流电缆".to_string(),
            part_model: "PV1-F-1x6".to_string(),
            quantity: 200,
            reason: "直流电缆绝缘老化，多处破损需整体更换".to_string(),
            station_name: "东风电站F区".to_string(),
            status: OrderStatus::Reviewing.as_str().to_string(),
            current_handler_id: "user_reviewer_1".to_string(),
            current_handler_name: "赵复核负责人".to_string(),
            current_handler_role: UserRole::Reviewer.as_str().to_string(),
            registrar_id: "user_registrar_1".to_string(),
            registrar_name: "张登记员".to_string(),
            is_overdue: false,
            is_evidence_missing: false,
            deadline_days: Some(6),
            appeal_reason: None,
            review_opinion: None,
            reject_reason: None,
            original_status: None,
            evidence: demo_evidence_normal(),
        },
        DemoOrderSeed {
            order_no: "BJ-2026-0007".to_string(),
            title: "金沙电站G组汇流箱防雷器更换".to_string(),
            part_name: "直流防雷器".to_string(),
            part_model: "SPD-DC-1000V-40kA".to_string(),
            quantity: 8,
            reason: "防雷器老化失效，雷雨季前需批量更换".to_string(),
            station_name: "金沙电站G组".to_string(),
            status: OrderStatus::ReviewReturned.as_str().to_string(),
            current_handler_id: "user_registrar_1".to_string(),
            current_handler_name: "张登记员".to_string(),
            current_handler_role: UserRole::Registrar.as_str().to_string(),
            registrar_id: "user_registrar_1".to_string(),
            registrar_name: "张登记员".to_string(),
            is_overdue: false,
            is_evidence_missing: true,
            deadline_days: Some(4),
            appeal_reason: Some("复核退回后已补充防雷器检测报告，申请重新复核".to_string()),
            review_opinion: None,
            reject_reason: Some("缺少防雷器老化检测报告，无法判断是否确需批量更换，退回补正。".to_string()),
            original_status: Some(OrderStatus::Reviewing.as_str().to_string()),
            evidence: demo_evidence_partial(),
        },
    ];

    for (idx, seed) in demo_orders.iter().enumerate() {
        let id = format!("order_{:05}", idx + 1);
        let deadline = seed.deadline_days.map(|d| {
            let dt = now + Duration::days(d);
            dt.to_rfc3339()
        });
        let created_at = (now - Duration::days((idx as i64) + 1)).to_rfc3339();
        let updated_at = (now - Duration::hours(idx as i64)).to_rfc3339();
        let evidence_json = serde_json::to_string(&seed.evidence)?;

        sqlx::query(
            r#"
            INSERT INTO spare_part_orders (
                id, order_no, title, part_name, part_model, quantity, reason,
                station_name, status, current_handler_id, current_handler_name,
                current_handler_role, version, evidence, registrar_id, registrar_name,
                appeal_reason, review_opinion, reject_reason, original_status,
                deadline, is_overdue, is_evidence_missing, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(&seed.order_no)
        .bind(&seed.title)
        .bind(&seed.part_name)
        .bind(&seed.part_model)
        .bind(seed.quantity)
        .bind(&seed.reason)
        .bind(&seed.station_name)
        .bind(&seed.status)
        .bind(&seed.current_handler_id)
        .bind(&seed.current_handler_name)
        .bind(&seed.current_handler_role)
        .bind(1i64)
        .bind(&evidence_json)
        .bind(&seed.registrar_id)
        .bind(&seed.registrar_name)
        .bind(&seed.appeal_reason)
        .bind(&seed.review_opinion)
        .bind(&seed.reject_reason)
        .bind(&seed.original_status)
        .bind(&deadline)
        .bind(seed.is_overdue)
        .bind(seed.is_evidence_missing)
        .bind(&created_at)
        .bind(&updated_at)
        .execute(pool)
        .await?;

        seed_demo_records(pool, &id, seed, &created_at).await?;
    }

    Ok(())
}

struct DemoOrderSeed {
    order_no: String,
    title: String,
    part_name: String,
    part_model: String,
    quantity: i64,
    reason: String,
    station_name: String,
    status: String,
    current_handler_id: String,
    current_handler_name: String,
    current_handler_role: String,
    registrar_id: String,
    registrar_name: String,
    is_overdue: bool,
    is_evidence_missing: bool,
    deadline_days: Option<i64>,
    appeal_reason: Option<String>,
    review_opinion: Option<String>,
    reject_reason: Option<String>,
    original_status: Option<String>,
    evidence: Vec<EvidenceItem>,
}

fn demo_evidence_normal() -> Vec<EvidenceItem> {
    let t = Utc::now();
    vec![
        EvidenceItem {
            name: "现场故障照片.jpg".to_string(),
            url: "/demo/evidence/photo1.jpg".to_string(),
            uploaded_at: t,
        },
        EvidenceItem {
            name: "备件申请单扫描件.pdf".to_string(),
            url: "/demo/evidence/apply1.pdf".to_string(),
            uploaded_at: t,
        },
    ]
}

fn demo_evidence_partial() -> Vec<EvidenceItem> {
    let t = Utc::now();
    vec![EvidenceItem {
        name: "现场照片补拍.jpg".to_string(),
        url: "/demo/evidence/photo2.jpg".to_string(),
        uploaded_at: t,
    }]
}

fn demo_evidence_full() -> Vec<EvidenceItem> {
    let t = Utc::now();
    vec![
        EvidenceItem {
            name: "故障现场照片.jpg".to_string(),
            url: "/demo/evidence/photo3.jpg".to_string(),
            uploaded_at: t,
        },
        EvidenceItem {
            name: "发电量损失报告.pdf".to_string(),
            url: "/demo/evidence/loss.pdf".to_string(),
            uploaded_at: t,
        },
        EvidenceItem {
            name: "故障视频.mp4".to_string(),
            url: "/demo/evidence/video.mp4".to_string(),
            uploaded_at: t,
        },
    ]
}

async fn seed_demo_records(
    pool: &DbPool,
    order_id: &str,
    seed: &DemoOrderSeed,
    base_created_at: &str,
) -> Result<()> {
    let base = chrono::DateTime::parse_from_rfc3339(base_created_at)
        .map_err(|e| anyhow!(e))?
        .with_timezone(&Utc);

    match seed.status.as_str() {
        "archived" => {
            add_record(
                pool,
                order_id,
                "user_registrar_1",
                "张登记员",
                UserRole::Registrar.as_str(),
                "提交登记",
                "提交备件更换登记，含现场照片和申请单。",
                OrderStatus::Draft.as_str(),
                OrderStatus::Registered.as_str(),
                base,
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_auditor_1",
                "王审核主管",
                UserRole::Auditor.as_str(),
                "核验通过",
                "材料齐全，流程合规，核验通过。",
                OrderStatus::Registered.as_str(),
                OrderStatus::Verifying.as_str(),
                base + Duration::hours(2),
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_auditor_1",
                "王审核主管",
                UserRole::Auditor.as_str(),
                "核验通过",
                "已核验，提交复核。",
                OrderStatus::Verifying.as_str(),
                OrderStatus::VerifyPassed.as_str(),
                base + Duration::hours(4),
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_reviewer_1",
                "赵复核负责人",
                UserRole::Reviewer.as_str(),
                "复核归档",
                "复核通过，流程合规，证据齐全，同意归档。",
                OrderStatus::VerifyPassed.as_str(),
                OrderStatus::Archived.as_str(),
                base + Duration::hours(8),
            )
            .await?;
        }
        "appeal_rejected_correction" => {
            add_record(
                pool,
                order_id,
                "user_registrar_1",
                "张登记员",
                UserRole::Registrar.as_str(),
                "提交登记",
                "接线盒烧毁更换申请。",
                OrderStatus::Draft.as_str(),
                OrderStatus::Registered.as_str(),
                base,
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_auditor_1",
                "王审核主管",
                UserRole::Auditor.as_str(),
                "核验退回",
                "证据不足，缺少故障检测报告，退回补正。",
                OrderStatus::Registered.as_str(),
                OrderStatus::VerifyReturned.as_str(),
                base + Duration::hours(3),
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_registrar_1",
                "张登记员",
                UserRole::Registrar.as_str(),
                "申诉提交",
                "已补充现场照片，申请复核。",
                OrderStatus::VerifyReturned.as_str(),
                OrderStatus::AppealSubmitted.as_str(),
                base + Duration::hours(20),
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_reviewer_1",
                "赵复核负责人",
                UserRole::Reviewer.as_str(),
                "复核驳回补正",
                "仍缺少第三方电气检测报告，驳回补正。",
                OrderStatus::AppealSubmitted.as_str(),
                OrderStatus::AppealRejectedCorrection.as_str(),
                base + Duration::hours(26),
            )
            .await?;
        }
        "verifying" => {
            add_record(
                pool,
                order_id,
                "user_registrar_2",
                "李登记员",
                UserRole::Registrar.as_str(),
                "提交登记",
                "汇流箱熔断器批量更换申请。",
                OrderStatus::Draft.as_str(),
                OrderStatus::Registered.as_str(),
                base,
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_auditor_1",
                "王审核主管",
                UserRole::Auditor.as_str(),
                "核验受理",
                "材料基本齐全，进入核验。",
                OrderStatus::Registered.as_str(),
                OrderStatus::Verifying.as_str(),
                base + Duration::hours(2),
            )
            .await?;
        }
        "appeal_accepted" => {
            add_record(
                pool,
                order_id,
                "user_registrar_2",
                "李登记员",
                UserRole::Registrar.as_str(),
                "提交登记",
                "跟踪支架减速箱漏油更换。",
                OrderStatus::Draft.as_str(),
                OrderStatus::Registered.as_str(),
                base,
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_auditor_1",
                "王审核主管",
                UserRole::Auditor.as_str(),
                "核验退回",
                "故障理由描述不够充分，证据视频模糊。",
                OrderStatus::Registered.as_str(),
                OrderStatus::VerifyReturned.as_str(),
                base + Duration::hours(5),
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_registrar_2",
                "李登记员",
                UserRole::Registrar.as_str(),
                "申诉提交",
                "补充发电量损失报告和高清视频，申诉。",
                OrderStatus::VerifyReturned.as_str(),
                OrderStatus::AppealSubmitted.as_str(),
                base + Duration::hours(30),
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_reviewer_1",
                "赵复核负责人",
                UserRole::Reviewer.as_str(),
                "申诉受理",
                "证据充分，申诉受理，进入复核。",
                OrderStatus::AppealSubmitted.as_str(),
                OrderStatus::AppealAccepted.as_str(),
                base + Duration::hours(36),
            )
            .await?;
        }
        "reviewing" => {
            add_record(
                pool,
                order_id,
                &seed.registrar_id,
                &seed.registrar_name,
                UserRole::Registrar.as_str(),
                "提交登记",
                &seed.reason,
                OrderStatus::Draft.as_str(),
                OrderStatus::Registered.as_str(),
                base,
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_auditor_1",
                "王审核主管",
                UserRole::Auditor.as_str(),
                "核验通过",
                "核验通过，提交复核归档。",
                OrderStatus::Registered.as_str(),
                OrderStatus::Verifying.as_str(),
                base + Duration::hours(2),
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_auditor_1",
                "王审核主管",
                UserRole::Auditor.as_str(),
                "核验通过提交复核",
                "核验完成，提交复核负责人。",
                OrderStatus::Verifying.as_str(),
                OrderStatus::Reviewing.as_str(),
                base + Duration::hours(4),
            )
            .await?;
        }
        "review_returned" => {
            add_record(
                pool,
                order_id,
                "user_registrar_1",
                "张登记员",
                UserRole::Registrar.as_str(),
                "提交登记",
                "防雷器批量更换申请。",
                OrderStatus::Draft.as_str(),
                OrderStatus::Registered.as_str(),
                base,
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_auditor_1",
                "王审核主管",
                UserRole::Auditor.as_str(),
                "核验通过",
                "材料齐全，核验通过，提交复核。",
                OrderStatus::Registered.as_str(),
                OrderStatus::Verifying.as_str(),
                base + Duration::hours(3),
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_auditor_1",
                "王审核主管",
                UserRole::Auditor.as_str(),
                "核验通过提交复核",
                "核验完成，提交复核负责人。",
                OrderStatus::Verifying.as_str(),
                OrderStatus::Reviewing.as_str(),
                base + Duration::hours(6),
            )
            .await?;
            add_record(
                pool,
                order_id,
                "user_reviewer_1",
                "赵复核负责人",
                UserRole::Reviewer.as_str(),
                "复核退回补正",
                "缺少防雷器老化检测报告，无法判断是否确需批量更换，退回补正。",
                OrderStatus::Reviewing.as_str(),
                OrderStatus::ReviewReturned.as_str(),
                base + Duration::hours(12),
            )
            .await?;
        }
        _ => {}
    }

    if order_id == "order_00006" {
        add_record(
            pool,
            order_id,
            "user_reviewer_1",
            "赵复核负责人",
            UserRole::Reviewer.as_str(),
            "复核失败-版本冲突",
            "版本冲突：当前版本为 3，您提交的版本为 2，请刷新后重试",
            OrderStatus::Reviewing.as_str(),
            OrderStatus::Reviewing.as_str(),
            base + Duration::hours(10),
        )
        .await?;
    }

    Ok(())
}

async fn add_record(
    pool: &DbPool,
    order_id: &str,
    handler_id: &str,
    handler_name: &str,
    handler_role: &str,
    action: &str,
    opinion: &str,
    from_status: &str,
    to_status: &str,
    time: chrono::DateTime<Utc>,
) -> Result<()> {
    let id = new_uuid();
    sqlx::query(
        r#"
        INSERT INTO process_records (
            id, order_id, handler_id, handler_name, handler_role,
            action, opinion, from_status, to_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(order_id)
    .bind(handler_id)
    .bind(handler_name)
    .bind(handler_role)
    .bind(action)
    .bind(opinion)
    .bind(from_status)
    .bind(to_status)
    .bind(&time.to_rfc3339())
    .execute(pool)
    .await?;
    Ok(())
}
