#!/bin/bash
# 一键启动脚本 - 同时启动前后端
set -e

cd "$(dirname "$0")"

echo "========================================="
echo "  售电公司 - 到期预警处理售电合同单系统"
echo "  本地演示一键启动"
echo "========================================="

export BACKEND_PORT=${BACKEND_PORT:-8003}
export FRONTEND_PORT=${FRONTEND_PORT:-3003}
export CORS_ORIGINS=${CORS_ORIGINS:-"http://localhost:3003,http://127.0.0.1:3003"}
export VITE_API_BASE=${VITE_API_BASE:-"http://localhost:8003"}

# 启动后端
echo ""
echo "[1/2] 启动后端 (端口 $BACKEND_PORT)..."
cd backend && bash start.sh &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 3

# 启动前端
echo ""
echo "[2/2] 启动前端 (端口 $FRONTEND_PORT)..."
cd frontend && bash start.sh &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================="
echo "  启动完成！"
echo "  前端: http://localhost:$FRONTEND_PORT"
echo "  后端: http://localhost:$BACKEND_PORT/api/health"
echo "  后端PID: $BACKEND_PID"
echo "  前端PID: $FRONTEND_PID"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "========================================="

# 等待中断
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
