#!/bin/bash
cd "$(dirname "$0")"

echo "=========================================="
echo "  新能源汽车充电站设备巡检系统"
echo "=========================================="
echo ""
echo "启动后端服务 (端口: 8005)..."
echo "启动前端服务 (端口: 3005)..."
echo ""

trap "kill 0" EXIT

cd backend && bash start.sh &
BACKEND_PID=$!

sleep 3

cd ../frontend && bash start.sh &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "  服务启动完成！"
echo "=========================================="
echo "前端地址: http://localhost:3005"
echo "后端地址: http://localhost:8005"
echo "API文档:  http://localhost:8005/docs"
echo "=========================================="
echo ""
echo "测试账号："
echo "  登记员:    registrar / 123456"
echo "  审核主管:  supervisor / 123456"
echo "  复核负责人: reviewer / 123456"
echo "=========================================="

wait
