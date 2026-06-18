#!/usr/bin/env python3
"""
数据库初始化脚本
运行方式: python init_db.py
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.database import SessionLocal, engine, Base
from app.services import init_database


def main():
    print("开始初始化数据库...")

    Base.metadata.drop_all(bind=engine)
    print("已清理旧表")

    Base.metadata.create_all(bind=engine)
    print("已创建新表")

    db = SessionLocal()
    try:
        init_database(db)
        print("数据库初始化完成！")
        print("\n已创建测试用户：")
        print("  科室秘书: secretary / 123456 (内科)")
        print("  科室秘书: secretary2 / 123456 (外科)")
        print("  质控医生: quality / 123456")
        print("  医务部主任: director / 123456")
        print("\n已创建样例整改单: 5条")
    except Exception as e:
        print(f"初始化失败: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
