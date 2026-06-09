import aiosqlite
from app.config import DB_PATH
import os

async def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row

    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")

    await db.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        gender TEXT,
        grade TEXT,
        school TEXT,
        phone TEXT,
        guardian_name TEXT,
        guardian_phone TEXT,
        status TEXT DEFAULT 'active',
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        grade TEXT,
        total_hours INTEGER DEFAULT 0,
        teacher TEXT,
        classroom TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS course_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        schedule_date DATE NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        teacher TEXT,
        classroom TEXT,
        capacity INTEGER DEFAULT 30,
        status TEXT DEFAULT 'scheduled',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id)
    );

    CREATE TABLE IF NOT EXISTS service_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        qr_code TEXT UNIQUE NOT NULL,
        student_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        schedule_id INTEGER,
        service_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        current_handler TEXT,
        register_by TEXT,
        reviewer_by TEXT,
        finalizer_by TEXT,
        register_time DATETIME,
        review_time DATETIME,
        finalize_time DATETIME,
        register_opinion TEXT,
        review_opinion TEXT,
        finalize_opinion TEXT,
        material_complete INTEGER DEFAULT 0,
        time_limit_hours INTEGER DEFAULT 24,
        version INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (course_id) REFERENCES courses(id),
        FOREIGN KEY (schedule_id) REFERENCES course_schedules(id)
    );

    CREATE TABLE IF NOT EXISTS service_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        material_type TEXT NOT NULL,
        material_name TEXT NOT NULL,
        file_url TEXT,
        uploaded_by TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES service_orders(id)
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        attendance TEXT,
        performance TEXT,
        homework TEXT,
        teacher_comment TEXT,
        feedback_time DATETIME,
        feedback_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES service_orders(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        operator TEXT NOT NULL,
        operator_role TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        remark TEXT,
        ip TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
    CREATE INDEX IF NOT EXISTS idx_service_orders_student ON service_orders(student_id);
    CREATE INDEX IF NOT EXISTS idx_service_orders_handler ON service_orders(current_handler);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_order ON audit_logs(order_id);
    """)

    await db.commit()
    await db.close()
