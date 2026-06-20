use rusqlite::Connection;
use crate::auth::hash_password;

pub fn init_db() -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open("appointments.db")?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    create_tables(&conn)?;
    seed_data(&conn)?;
    Ok(conn)
}

fn create_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('registrar', 'reviewer', 'archivist')),
            display_name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            visitor_name TEXT NOT NULL,
            visitor_phone TEXT NOT NULL,
            visitor_id_number TEXT NOT NULL,
            exhibition_name TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('pending_review', 'pending_archive', 'rejected_for_correction', 'rejected_for_review', 'archived')),
            version INTEGER NOT NULL DEFAULT 1,
            created_by TEXT NOT NULL,
            updated_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            appointment_id TEXT NOT NULL REFERENCES appointments(id),
            type TEXT NOT NULL CHECK(type IN ('reservation', 'check_in', 'data_recovery')),
            content TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS operation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            appointment_id TEXT NOT NULL REFERENCES appointments(id),
            action TEXT NOT NULL,
            operator TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            detail TEXT NOT NULL DEFAULT '',
            timestamp TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
        CREATE INDEX IF NOT EXISTS idx_evidence_appointment_id ON evidence(appointment_id);
        CREATE INDEX IF NOT EXISTS idx_operation_logs_appointment_id ON operation_logs(appointment_id);
        CREATE INDEX IF NOT EXISTS idx_appointments_visitor_id ON appointments(visitor_id_number, exhibition_name);"
    )?;
    Ok(())
}

fn seed_data(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let password_hash = hash_password("123456");

    conn.execute(
        "INSERT INTO users (username, password_hash, role, display_name) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params!["registrar1", &password_hash, "registrar", "登记员-张三"],
    )?;
    conn.execute(
        "INSERT INTO users (username, password_hash, role, display_name) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params!["reviewer1", &password_hash, "reviewer", "审核主管-李四"],
    )?;
    conn.execute(
        "INSERT INTO users (username, password_hash, role, display_name) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params!["archivist1", &password_hash, "archivist", "复核负责人-王五"],
    )?;

    let now = "2026-06-21T10:00:00+08:00";

    let seed_appointments = [
        ("APT-0001", "张明", "13800001001", "310101199001011234", "2026上海科技展", "pending_review", 1, "registrar1"),
        ("APT-0002", "李华", "13800002002", "310101199002022345", "2026上海科技展", "pending_review", 1, "registrar1"),
        ("APT-0003", "王芳", "13800003003", "310101199003033456", "2026上海科技展", "pending_review", 1, "registrar1"),
        ("APT-0004", "赵强", "13800004004", "310101199004044567", "2026上海科技展", "archived", 3, "registrar1"),
        ("APT-0005", "钱丽", "13800005005", "310101199005055678", "2026上海科技展", "pending_review", 1, "registrar1"),
        ("APT-0006", "孙伟", "13800006006", "310101199006066789", "2026上海科技展", "rejected_for_correction", 2, "registrar1"),
        ("APT-0007", "周敏", "13800007007", "310101199007077890", "2026上海科技展", "pending_archive", 2, "registrar1"),
        ("APT-0008", "吴静", "13800008008", "310101199008088901", "2026上海科技展", "pending_archive", 2, "registrar1"),
    ];

    for (id, name, phone, id_num, exhibition, status, version, created_by) in &seed_appointments {
        conn.execute(
            "INSERT INTO appointments (id, visitor_name, visitor_phone, visitor_id_number, exhibition_name, status, version, created_by, updated_by, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![id, name, phone, id_num, exhibition, status, version, created_by, created_by, now, now],
        )?;
    }

    let full_evidence_apt_ids = ["APT-0001", "APT-0003", "APT-0004", "APT-0005", "APT-0006", "APT-0007", "APT-0008"];
    for apt_id in &full_evidence_apt_ids {
        conn.execute(
            "INSERT INTO evidence (appointment_id, type, content, created_by, created_at) VALUES (?1, 'reservation', ?2, 'registrar1', ?3)",
            rusqlite::params![apt_id, format!("预约凭证-{}", apt_id), now],
        )?;
        conn.execute(
            "INSERT INTO evidence (appointment_id, type, content, created_by, created_at) VALUES (?1, 'check_in', ?2, 'registrar1', ?3)",
            rusqlite::params![apt_id, format!("入场核销凭证-{}", apt_id), now],
        )?;
        conn.execute(
            "INSERT INTO evidence (appointment_id, type, content, created_by, created_at) VALUES (?1, 'data_recovery', ?2, 'registrar1', ?3)",
            rusqlite::params![apt_id, format!("数据补录凭证-{}", apt_id), now],
        )?;
    }

    conn.execute(
        "INSERT INTO evidence (appointment_id, type, content, created_by, created_at) VALUES ('APT-0002', 'reservation', '预约凭证-APT-0002', 'registrar1', ?1)",
        rusqlite::params![now],
    )?;

    let log_timestamp = |offset_sec: i64| -> String {
        chrono::DateTime::parse_from_rfc3339(now)
            .unwrap()
            .checked_add_signed(chrono::Duration::seconds(offset_sec))
            .unwrap()
            .to_rfc3339()
    };

    for (apt_id, action, operator, operator_role, detail, offset) in [
        ("APT-0001", "create", "registrar1", "registrar", "创建预约单", 0),
        ("APT-0002", "create", "registrar1", "registrar", "创建预约单", 10),
        ("APT-0003", "create", "registrar1", "registrar", "创建预约单", 20),
        ("APT-0004", "create", "registrar1", "registrar", "创建预约单", 30),
        ("APT-0004", "review_approve", "reviewer1", "reviewer", "审核通过", 40),
        ("APT-0004", "archive_approve", "archivist1", "archivist", "归档完成", 50),
        ("APT-0005", "create", "registrar1", "registrar", "创建预约单", 60),
        ("APT-0006", "create", "registrar1", "registrar", "创建预约单", 70),
        ("APT-0006", "review_reject", "reviewer1", "reviewer", "信息有误，请补正", 80),
        ("APT-0007", "create", "registrar1", "registrar", "创建预约单", 90),
        ("APT-0007", "review_approve", "reviewer1", "reviewer", "审核通过", 100),
        ("APT-0008", "create", "registrar1", "registrar", "创建预约单", 110),
        ("APT-0008", "review_approve", "reviewer1", "reviewer", "审核通过", 120),
    ] {
        conn.execute(
            "INSERT INTO operation_logs (appointment_id, action, operator, operator_role, detail, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![apt_id, action, operator, operator_role, detail, log_timestamp(offset)],
        )?;
    }

    Ok(())
}
