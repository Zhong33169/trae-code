#!/bin/bash
cd "$(dirname "$0")"

PORT=${PORT:-8005}
HOST=${HOST:-0.0.0.0}

echo "=========================================="
echo "  新能源汽车充电站设备巡检系统 - 后端"
echo "=========================================="
echo "端口: $PORT"
echo "地址: http://localhost:$PORT"
echo "API文档: http://localhost:$PORT/docs"
echo "=========================================="

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "安装依赖..."
pip install -r requirements.txt -q

echo "启动服务..."
python main.py
