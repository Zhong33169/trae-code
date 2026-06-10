#!/bin/bash
cd "$(dirname "$0")"

PORT=${PORT:-3005}
API_URL=${API_URL:-http://localhost:8005}

echo "=========================================="
echo "  新能源汽车充电站设备巡检系统 - 前端"
echo "=========================================="
echo "端口: $PORT"
echo "地址: http://localhost:$PORT"
echo "API地址: $API_URL"
echo "=========================================="

if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
fi

echo "启动开发服务器..."
npm run dev
