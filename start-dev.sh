#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3001,http://127.0.0.1:3001}"

echo "=========================================="
echo "  小贷公司展期申请系统 - 开发环境启动"
echo "=========================================="
echo ""
echo "后端端口: $BACKEND_PORT"
echo "前端端口: $FRONTEND_PORT"
echo "CORS 源: $CORS_ORIGINS"
echo ""

cleanup() {
    echo ""
    echo "正在停止服务..."
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo "服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "--- 启动后端服务 (Django) ---"
cd "$BACKEND_DIR"

if [ ! -f "db.sqlite3" ]; then
    echo "初始化数据库..."
    python3 manage.py migrate --noinput
    python3 manage.py init_demo_data
fi

export CORS_ALLOWED_ORIGINS="$CORS_ORIGINS"
python3 manage.py runserver 0.0.0.0:$BACKEND_PORT &
BACKEND_PID=$!

sleep 3

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "错误: 后端服务启动失败"
    exit 1
fi

echo "后端服务已启动 (PID: $BACKEND_PID)"
echo "API 地址: http://localhost:$BACKEND_PORT/api/"
echo ""

echo "--- 启动前端服务 (Nuxt) ---"
cd "$FRONTEND_DIR"

export NUXT_PUBLIC_API_BASE_URL="http://localhost:$BACKEND_PORT/api"

npx nuxt dev --port $FRONTEND_PORT --host 0.0.0.0 &
FRONTEND_PID=$!

sleep 8

if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "错误: 前端服务启动失败"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "前端服务已启动 (PID: $FRONTEND_PID)"
echo "前端地址: http://localhost:$FRONTEND_PORT"
echo ""

echo "=========================================="
echo "  系统启动完成！"
echo "=========================================="
echo ""
echo "前端访问: http://localhost:$FRONTEND_PORT"
echo "后端 API: http://localhost:$BACKEND_PORT/api/"
echo ""
echo "测试账号:"
echo "  展期登记员: zhangsan"
echo "  展期审核主管: lisi"
echo "  小贷公司复核负责人: wangwu"
echo "  系统管理员: admin"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

wait
