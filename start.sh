#!/usr/bin/env bash
set -euo pipefail

# macOS / Linux
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8004}"
FRONTEND_PORT="${FRONTEND_PORT:-3004}"

export ROCKET_PORT="$BACKEND_PORT"
export VITE_API_BASE="http://localhost:$BACKEND_PORT"

cleanup() {
  echo ""
  echo "🛑 正在停止服务..."
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM EXIT

echo "🚀 启动后端 (Rocket, 端口 $BACKEND_PORT)..."
cd "$ROOT/backend"
cargo run &
BACKEND_PID=$!

sleep 2
echo ""
echo "🚀 启动前端 (SvelteKit, 端口 $FRONTEND_PORT)..."
cd "$ROOT/frontend"
VITE_PORT="$FRONTEND_PORT" npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务启动中..."
echo "   前端: http://localhost:$FRONTEND_PORT"
echo "   后端: http://localhost:$BACKEND_PORT"
echo ""
echo "按 Ctrl+C 停止"

wait
