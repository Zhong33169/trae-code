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
            role TEXT NOT NULL CHECK(role IN ('clerk', 'supervisor', 'rechecker')),
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

        CREATE TABLE IF NOT EXISTS operation_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            operator_id INTEGER NOT NULL,
            operator_name TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            opinion TEXT,
            result TEXT,
            reason TEXT,
            from_status TEXT,
            to_status TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (order_id) REFERENCES repair_orders(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        );
    """)
    await db.commit()


async def close_db():
    global _db
    if _db is not None:
        await _db.close()
        _db = None
