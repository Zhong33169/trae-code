#!/bin/bash
# 前端启动脚本 - Solid.js + Vite (端口 3003)
set -e

cd "$(dirname "$0")"

# 环境变量（可覆盖，不写死）
export FRONTEND_PORT=${FRONTEND_PORT:-3003}
export VITE_API_BASE=${VITE_API_BASE:-"http://localhost:8003"}

echo "========================================="
echo "  售电合同到期预警系统 - 前端"
echo "  端口: $FRONTEND_PORT"
echo "  后端API: $VITE_API_BASE"
echo "========================================="

# 安装依赖（如未安装）
if [ ! -d "node_modules" ]; then
    echo "正在安装前端依赖..."
    npm install
fi

npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT
