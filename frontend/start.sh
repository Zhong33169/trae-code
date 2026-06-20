#!/bin/bash

# 订舱管理系统 - 前端启动脚本
# 端口: 3005
# API: http://localhost:8005/api

set -e

echo "============================================="
echo "  订舱管理系统 前端启动"
echo "  端口: 3005"
echo "  API Base: http://localhost:8005/api"
echo "============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[1/2] 安装依赖..."
if [ ! -d "node_modules" ]; then
  echo "首次启动，正在安装依赖..."
  npm install
else
  echo "node_modules 已存在，跳过安装（如需更新请手动执行 npm install）"
fi

echo ""
echo "[2/2] 启动开发服务器..."
echo ""
echo "前端访问地址:  http://localhost:3005"
echo ""

npm run dev -- --port 3005
