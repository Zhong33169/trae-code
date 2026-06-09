#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate

if [ ! -f "venv/.installed" ]; then
    echo "安装依赖..."
    pip install -r requirements.txt
    touch venv/.installed
fi

export PYTHONPATH="$(pwd)"
export BACKEND_PORT="${BACKEND_PORT:-8002}"
export BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:3002}"

echo "启动后端服务于 $BACKEND_HOST:$BACKEND_PORT"
uvicorn app.main:app --host $BACKEND_HOST --port $BACKEND_PORT --reload
