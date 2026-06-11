#!/usr/bin/env python3
"""数据库初始化脚本 - 调用幂等迁移系统
兼容新旧数据库：
1. 新库：执行建表DDL + 所有迁移
2. 旧库：检查迁移表，执行缺失的迁移
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.migrations.runner import run_migrations


def init_database():
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(data_dir, exist_ok=True)
    run_migrations()


if __name__ == "__main__":
    init_database()
