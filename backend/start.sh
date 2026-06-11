#!/bin/bash
# 后端启动脚本 - Litestar (端口 8003)
set -e

cd "$(dirname "$0")"

# 环境变量（可覆盖，不写死）
export BACKEND_PORT=${BACKEND_PORT:-8003}
export BACKEND_HOST=${BACKEND_HOST:-0.0.0.0}
export CORS_ORIGINS=${CORS_ORIGINS:-"http://localhost:3003,http://127.0.0.1:3003"}

echo "========================================="
echo "  售电合同到期预警系统 - 后端"
echo "  端口: $BACKEND_PORT"
echo "  CORS: $CORS_ORIGINS"
echo "========================================="

# 检查虚拟环境
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 安装依赖（如未安装）
python -c "import litestar" 2>/dev/null || {
    echo "正在安装后端依赖..."
    pip install -r requirements.txt
}

python run.py
