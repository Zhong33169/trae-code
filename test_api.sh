#!/bin/bash
set -e

BASE_URL="http://localhost:8008"

echo "============================================="
echo "  创意需求单系统 API 测试"
echo "============================================="
echo ""

# 1. 登录获取 token
echo "1. 登录 (registrar/registrar123)..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"registrar","password":"registrar123"}')
echo "   响应: $LOGIN_RESPONSE"
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "   Token: ${TOKEN:0:50}..."
echo ""

# 2. 测试无效码扫码
echo "2. 测试无效码扫码 (code: INVALID123)..."
curl -s -X POST "$BASE_URL/api/creative-demands/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"INVALID123"}' | python3 -m json.tool
echo ""

# 3. 测试非当前处理人扫码
echo "3. 测试非当前处理人扫码 (code: CD202406002, 当前处理人: supervisor)..."
curl -s -X POST "$BASE_URL/api/creative-demands/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"CD202406002"}' | python3 -m json.tool
echo ""

# 4. 测试正确扫码
echo "4. 测试正确扫码 (code: CD202406001, 当前处理人: registrar)..."
curl -s -X POST "$BASE_URL/api/creative-demands/scan" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"CD202406001"}' | python3 -m json.tool
echo ""

# 5. 获取统计数据
echo "5. 获取统计数据..."
curl -s "$BASE_URL/api/creative-demands/statistics" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""

# 6. 获取创意需求单列表
echo "6. 获取创意需求单列表..."
curl -s "$BASE_URL/api/creative-demands" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  总数: {d[\"total\"]}')
for item in d['items']:
    print(f'  - {item[\"code\"]}: {item[\"title\"]} | 状态: {item[\"status\"]} | 处理人: {item[\"current_handler_role\"]}')
"
echo ""

# 7. 获取 cd001 详情
echo "7. 获取 cd001 详情..."
curl -s "$BASE_URL/api/creative-demands/cd001" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  编号: {d[\"code\"]}')
print(f'  标题: {d[\"title\"]}')
print(f'  状态: {d[\"status\"]}')
print(f'  版本: {d[\"version\"]}')
print(f'  Brief材料: {d[\"brief_materials\"]}')
print(f'  Brief意见: {d[\"brief_opinion\"]}')
"
echo ""

# 8. 测试状态流转 - 登记员提交 cd001
echo "8. 测试状态流转: cd001 pending_registrar -> pending_supervisor..."
curl -s -X POST "$BASE_URL/api/creative-demands/cd001/transition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"target_status":"pending_supervisor","comments":"登记完成，提交审核","version":1}' | python3 -m json.tool
echo ""

# 9. 再次获取 cd001 详情确认状态变化
echo "9. 再次获取 cd001 详情确认状态变化..."
curl -s "$BASE_URL/api/creative-demands/cd001" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  编号: {d[\"code\"]}')
print(f'  标题: {d[\"title\"]}')
print(f'  状态: {d[\"status\"]}')
print(f'  版本: {d[\"version\"]}')
print(f'  当前处理人: {d[\"current_handler_role\"]}')
"
echo ""

# 10. 测试审计日志
echo "10. 获取审计日志..."
curl -s "$BASE_URL/api/audit-logs?limit=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for log in d['items']:
    print(f'  [{log[\"created_at\"]}] {log[\"user_name\"]}({log[\"user_role\"]}): {log[\"action\"]}')
"
echo ""

# 11. 测试乐观锁 - 用旧版本号提交
echo "11. 测试乐观锁冲突 - 用旧版本号(1)提交 cd001..."
curl -s -X POST "$BASE_URL/api/creative-demands/cd001/transition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"target_status":"pending_supervisor","comments":"重复提交测试","version":1}' | python3 -m json.tool
echo ""

# 12. 测试越权操作 - 登记员尝试审核主管的单
echo "12. 测试越权操作 - 登记员尝试审核 cd002 (当前处理人: supervisor)..."
curl -s -X POST "$BASE_URL/api/creative-demands/cd002/transition" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"target_status":"pending_reviewer","comments":"越权测试","version":1}' | python3 -m json.tool
echo ""

echo "============================================="
echo "  测试完成!"
echo "============================================="
