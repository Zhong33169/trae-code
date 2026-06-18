#!/bin/bash

echo "🚀 展商申请管理系统 - 启动脚本"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📁 项目目录: $SCRIPT_DIR"
echo ""

echo "📦 后端 (Python + Starlette + SQLite)"
echo "   端口: 8002"
echo "   启动中..."
echo ""

cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
    echo "   首次运行，创建虚拟环境并安装依赖..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

if [ ! -f "data/exhibitor.db" ]; then
    echo "   初始化演示数据..."
    python -m app.seed
fi

uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload &
BACKEND_PID=$!

echo "   后端已启动 (PID: $BACKEND_PID)"
echo ""

echo "🌐 前端 (React + Vite)"
echo "   端口: 3002"
echo "   启动中..."
echo ""

cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "   首次运行，安装依赖..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!

echo "   前端已启动 (PID: $FRONTEND_PID)"
echo ""

echo "✅ 系统启动完成！"
echo ""
echo "📋 演示账号："
echo "   展商登记员: registrar1 / 123456"
echo "   展商登记员: registrar2 / 123456"
echo "   展商审核主管: auditor1 / 123456"
echo "   展商审核主管: auditor2 / 123456"
echo "   展会主办方复核负责人: reviewer1 / 123456"
echo ""
echo "🔗 访问地址: http://localhost:3002"
echo ""
echo "按 Ctrl+C 停止服务..."

trap "echo ''; echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; wait 2>/dev/null; echo '✅ 服务已停止'" INT

wait
