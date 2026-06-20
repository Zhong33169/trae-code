#!/usr/bin/env bash
# 后端启动脚本：端口 8005
# 先安装依赖 -> 迁移 -> 初始化数据 -> 启动
set -e

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "[INFO] 创建 Python 虚拟环境..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "[INFO] 安装 Python 依赖..."
pip install -q -r requirements.txt

if [ ! -f "db.sqlite3" ]; then
  echo "[INFO] 初始化数据库..."
  python manage.py makemigrations booking
  python manage.py migrate
  echo "[INFO] 载入演示数据..."
  python init_data.py
else
  echo "[INFO] 数据库已存在，跳过迁移与初始化。若需重置请删除 db.sqlite3 后重试。"
  python manage.py migrate 2>/dev/null || true
fi

echo "[INFO] 启动后端服务于 http://localhost:8005"
exec python manage.py runserver 0.0.0.0:8005
