#!/bin/bash
set -e

BACKEND_PORT=${BACKEND_PORT:-8005}
FRONTEND_PORT=${FRONTEND_PORT:-3005}

echo "=== 二手车过户登记管理系统 ==="
echo "后端端口: $BACKEND_PORT"
echo "前端端口: $FRONTEND_PORT"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[1/3] 安装后端依赖..."
cd "$SCRIPT_DIR/backend"
pip install -q -r requirements.txt 2>/dev/null || pip3 install -q -r requirements.txt

echo "[2/3] 安装前端依赖..."
cd "$SCRIPT_DIR/frontend"
npm install --silent 2>/dev/null

echo "[3/3] 启动服务..."
echo ""

trap 'kill 0' INT TERM

cd "$SCRIPT_DIR/backend"
BACKEND_PORT=$BACKEND_PORT FRONTEND_PORT=$FRONTEND_PORT python -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
BACKEND_PID=$!

cd "$SCRIPT_DIR/frontend"
BACKEND_PORT=$BACKEND_PORT FRONTEND_PORT=$FRONTEND_PORT npx vite --port $FRONTEND_PORT --host &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动:"
echo "   后端 API: http://localhost:$BACKEND_PORT/docs"
echo "   前端页面: http://localhost:$FRONTEND_PORT"
echo ""

wait
