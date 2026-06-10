#!/usr/bin/env python3
"""
删除旧数据库，让后端重新生成包含6条申请的新种子数据
"""
import os
import time

DB_PATH = '/Users/echo/Desktop/zqzl/zhong33169/trae-code-3/backend/data/app.db'

if os.path.exists(DB_PATH):
    print(f"删除旧数据库: {DB_PATH}")
    os.remove(DB_PATH)
    print("✅ 旧数据库已删除，后端启动时会重新创建并生成新的种子数据（包含第6条可归档申请）")
else:
    print("✅ 数据库文件不存在，后端启动时会自动创建")

# 也删除空的 lease_system.db
old_db = '/Users/echo/Desktop/zqzl/zhong33169/trae-code-3/backend/data/lease_system.db'
if os.path.exists(old_db):
    os.remove(old_db)
    print("✅ 已删除旧的 lease_system.db")
