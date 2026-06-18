#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
DB_PATH="${DB_PATH:-$BACKEND_DIR/data/scf.db}"

echo "=============================================="
echo "供应链金融平台 - 一键初始化脚本"
echo "=============================================="
echo ""

# 1. 后端初始化
echo "🔧 正在初始化后端 (Rust Rocket)..."
cd "$BACKEND_DIR"
mkdir -p data
if [ -f "$DB_PATH" ]; then
  echo "⚠️  数据库已存在: $DB_PATH"
  read -p "是否删除并重建？(y/N): " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f "$DB_PATH"
    rm -f "$DB_PATH"-*
    echo "✅ 旧数据库已删除"
  fi
fi

echo "📦 检查 Rust 环境..."
if ! command -v cargo &> /dev/null; then
  echo "❌ 请先安装 Rust: https://rustup.rs/"
  exit 1
fi
echo "✅ Rust 版本: $(cargo --version)"

echo "📥 下载并编译后端依赖（首次会比较慢）..."
cargo build --release
echo "✅ 后端编译完成"

# 2. 前端初始化
echo ""
echo "🎨 正在初始化前端 (SvelteKit)..."
cd "$FRONTEND_DIR"
if ! command -v node &> /dev/null; then
  echo "❌ 请先安装 Node.js 18+: https://nodejs.org/"
  exit 1
fi
echo "✅ Node 版本: $(node --version)"

if [ ! -d node_modules ]; then
  echo "📥 安装前端依赖..."
  if command -v pnpm &> /dev/null; then
    pnpm install
  elif command -v npm &> /dev/null; then
    npm install
  else
    echo "❌ 请先安装 npm / pnpm"
    exit 1
  fi
else
  echo "✅ node_modules 已存在，跳过安装"
fi
echo "✅ 前端初始化完成"

echo ""
echo "=============================================="
echo "初始化完成！启动方式："
echo "=============================================="
echo ""
echo "  方式一：分别启动（推荐开发时使用）"
echo "    终端1 (后端端口8004):  cd backend && cargo run"
echo "    终端2 (前端端口3004):  cd frontend && npm run dev"
echo ""
echo "  方式二：生产模式"
echo "    终端1:  cd backend && cargo run --release"
echo "    终端2:  cd frontend && npm run build && npm run preview"
echo ""
echo "🌐 启动后访问: http://localhost:3004"
echo ""
echo "演示账户（登录界面右上角切换）："
echo "  📝 张登记 (REGISTRAR)   - 创建/补正/提交"
echo "  🔍 李审核 (AUDITOR)     - 核验/风险调整"
echo "  📦 王复核 (REVIEWER)    - 复核/归档/驳回"
echo ""
