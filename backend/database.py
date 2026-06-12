import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.db")

_db = None


async def get_db():
    global _db
    if _db is None:
        _db = await aiosqlite.connect(DB_PATH)
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("PRAGMA foreign_keys=ON")
    return _db


async def init_db():
    db = await get_db()
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('clerk', 'supervisor', 'rechecker', 'system')),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS repair_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_no TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            enterprise_name TEXT NOT NULL,
            contact_person TEXT NOT NULL,
            contact_phone TEXT NOT NULL,
            repair_type TEXT NOT NULL,
            urgency TEXT NOT NULL CHECK(urgency IN ('low', 'medium', 'high', 'urgent')),
            location TEXT NOT NULL,
            evidence_descriptions TEXT DEFAULT '[]',
            status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'under_review', 'returned', 'review_approved', 'under_recheck', 'archived', 'rejected')),
            current_handler_id INTEGER,
            current_handler_role TEXT,
            version INTEGER DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (current_handler_id) REFERENCES users(id)
        );
    """)

    cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='operation_records'")
    old_table = await cursor.fetchone()
    cursor_new = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='operation_records_new'")
    new_table = await cursor_new.fetchone()

    if not old_table and not new_table:
        await db.execute("""
            CREATE TABLE operation_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                operator_id INTEGER,
                operator_name TEXT,
                operator_role TEXT,
                opinion TEXT,
                result TEXT,
                reason TEXT,
                from_status TEXT,
                to_status TEXT,
                from_version INTEGER,
                to_version INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
    elif old_table:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS operation_records_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                operator_id INTEGER,
                operator_name TEXT,
                operator_role TEXT,
                opinion TEXT,
                result TEXT,
                reason TEXT,
                from_status TEXT,
                to_status TEXT,
                from_version INTEGER,
                to_version INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        try:
            await db.execute("""
                INSERT INTO operation_records_new
                    (id, order_id, action, operator_id, operator_name, operator_role,
                     opinion, result, reason, from_status, to_status, from_version, to_version, created_at)
                SELECT id, order_id, action, operator_id, operator_name, operator_role,
                       opinion, result, reason, from_status, to_status, from_version, to_version, created_at
                FROM operation_records
            """)
            await db.execute("DROP TABLE operation_records")
            await db.execute("ALTER TABLE operation_records_new RENAME TO operation_records")
        except Exception:
            pass
    elif new_table:
        try:
            await db.execute("ALTER TABLE operation_records_new RENAME TO operation_records")
        except Exception:
            pass

    try:
        await db.execute("ALTER TABLE operation_records ADD COLUMN from_version INTEGER")
    except Exception:
        pass
    try:
        await db.execute("ALTER TABLE operation_records ADD COLUMN to_version INTEGER")
    except Exception:
        pass

    try:
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM users WHERE id = 0")
        row = await cursor.fetchone()
        if row["cnt"] == 0:
            await db.execute(
                "INSERT INTO users (id, name, role) VALUES (0, '系统', 'system')"
            )
    except Exception:
        pass

    await db.commit()


async def close_db():
    global _db
    if _db is not None:
        await _db.close()
        _db = None
