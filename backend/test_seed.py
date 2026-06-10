import asyncio
import aiosqlite
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.config import DB_PATH
from app.database import init_db
from app.seed_data import seed_all

async def test_seed():
    print("重新初始化数据库...")
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    await init_db()
    await seed_all()
    
    print("\n验证数据...")
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM service_orders")
    order_count = (await cursor.fetchone())["cnt"]
    print(f"服务单数量: {order_count}")
    
    cursor = await db.execute("SELECT id, order_no, status, version, register_opinion FROM service_orders ORDER BY id")
    orders = await cursor.fetchall()
    print(f"\n服务单列表:")
    for o in orders:
        print(f"  #{o['id']} {o['order_no']} - {o['status']} (v{o['version']})")
    
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM audit_logs")
    audit_count = (await cursor.fetchone())["cnt"]
    print(f"\n审计日志总数: {audit_count}")
    
    cursor = await db.execute("SELECT COUNT(*) as cnt FROM service_materials")
    mat_count = (await cursor.fetchone())["cnt"]
    print(f"材料总数: {mat_count}")
    
    print("\n第 6 号单（并发冲突演示单）详情:")
    cursor = await db.execute("SELECT * FROM service_orders WHERE id = 6")
    order6 = await cursor.fetchone()
    if order6:
        print(f"  单号: {order6['order_no']}")
        print(f"  状态: {order6['status']}")
        print(f"  版本: v{order6['version']}")
        print(f"  时限: {order6['time_limit_hours']}小时")
        print(f"  登记意见: {order6['register_opinion']}")
        
        cursor = await db.execute("SELECT * FROM audit_logs WHERE order_id = 6 ORDER BY id")
        audits = await cursor.fetchall()
        print(f"  审计日志 ({len(audits)} 条):")
        for a in audits:
            print(f"    - [{a['action']}] {a['operator']}({a['operator_role']}): {a['remark'][:60]}")
    
    await db.close()
    print("\n✅ Seed 数据验证完成")

if __name__ == "__main__":
    asyncio.run(test_seed())
