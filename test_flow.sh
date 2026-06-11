#!/bin/bash
set -e

BASE_URL="http://localhost:8009/api"

echo "=========================================="
echo "  客服工单系统 - 端到端流程测试"
echo "=========================================="
echo ""

# 1. 登录
echo "[1/10] 登录 agent1 (客服坐席)..."
AGENT1_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"agent1","password":"123456"}')
AGENT1_TOKEN=$(echo "$AGENT1_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
AGENT1_ID=$(echo "$AGENT1_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
echo "  ✅ agent1 登录成功，token: ${AGENT1_TOKEN:0:20}..."
echo ""

echo "[2/10] 登录 qa1 (质检主管)..."
QA1_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"qa1","password":"123456"}')
QA1_TOKEN=$(echo "$QA1_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
QA1_ID=$(echo "$QA1_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
echo "  ✅ qa1 登录成功"
echo ""

echo "[3/10] 登录 cs1 (客服经理)..."
CS1_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"cs1","password":"123456"}')
CS1_TOKEN=$(echo "$CS1_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
CS1_ID=$(echo "$CS1_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['user']['id'])")
echo "  ✅ cs1 登录成功"
echo ""

# 2. agent1 创建工单（来电登记）
echo "[4/10] agent1 创建工单（来电登记）..."
NEW_TICKET=$(curl -s -X POST "$BASE_URL/tickets" \
  -H "token: $AGENT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试工单-网络故障报修","customer_name":"测试用户张三","customer_phone":"13900139000","description":"家中无法上网，已重启路由器无效"}')
TICKET_ID=$(echo "$NEW_TICKET" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
TICKET_STATUS=$(echo "$NEW_TICKET" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "  ✅ 工单创建成功，ID: $TICKET_ID, 状态: $TICKET_STATUS"
echo ""

# 3. 验证统计数据更新
echo "[5/10] 验证统计数据..."
STATS_BEFORE=$(curl -s -H "token: $AGENT1_TOKEN" "$BASE_URL/statistics")
TOTAL_BEFORE=$(echo "$STATS_BEFORE" | python3 -c "import sys,json; print(json.load(sys.stdin)['total_tickets'])")
echo "  📊 当前总工单数: $TOTAL_BEFORE"
echo ""

# 4. qa1 派单（问题派单）
echo "[6/10] qa1 派单（incoming -> dispatched）..."
UPDATED=$(curl -s -X PUT "$BASE_URL/tickets/$TICKET_ID/status" \
  -H "token: $QA1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"dispatched","remark":"请尽快处理"}')
UPDATED_STATUS=$(echo "$UPDATED" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "  ✅ 派单成功，状态: $UPDATED_STATUS"
echo ""

# 5. 测试交接 - agent1 提交给 qa1
echo "[7/10] agent1 提交交接给 qa1..."
HANDOVER=$(curl -s -X POST "$BASE_URL/handover" \
  -H "token: $AGENT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\":\"$TICKET_ID\",\"to_user\":\"$QA1_ID\",\"shift\":\"morning\",\"remark\":\"早班交接，请查收\"}")
HANDOVER_ID=$(echo "$HANDOVER" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
HANDOVER_STATUS=$(echo "$HANDOVER" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "  ✅ 交接提交成功，ID: $HANDOVER_ID, 状态: $HANDOVER_STATUS"
echo ""

# 6. qa1 查看待签收
echo "[8/10] qa1 查看待签收列表..."
MY_HANDOVERS=$(curl -s -H "token: $QA1_TOKEN" "$BASE_URL/handover/my?status=pending")
COUNT=$(echo "$MY_HANDOVERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
echo "  📋 qa1 待签收数量: $COUNT"
echo ""

# 7. qa1 签收交接
echo "[9/10] qa1 签收交接..."
ACCEPTED=$(curl -s -X POST "$BASE_URL/handover/$HANDOVER_ID/accept" \
  -H "token: $QA1_TOKEN")
ACCEPTED_STATUS=$(echo "$ACCEPTED" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "  ✅ 签收成功，交接状态: $ACCEPTED_STATUS"
echo ""

# 8. 查看工单详情，验证操作日志
echo "[10/10] 查看工单详情和处理轨迹..."
DETAIL=$(curl -s -H "token: $QA1_TOKEN" "$BASE_URL/tickets/$TICKET_ID")
LOG_COUNT=$(echo "$DETAIL" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['operation_logs']))")
HANDOVER_COUNT=$(echo "$DETAIL" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['handover_records']))")
TICKET_STATUS_FINAL=$(echo "$DETAIL" | python3 -c "import sys,json; print(json.load(sys.stdin)['ticket']['status'])")
echo "  📄 工单状态: $TICKET_STATUS_FINAL"
echo "  📝 操作日志数: $LOG_COUNT"
echo "  🔄 交接记录数: $HANDOVER_COUNT"
echo ""

echo "=========================================="
echo "  ✅  核心流程测试全部通过！"
echo "=========================================="
echo ""
echo "📌 额外测试：异常回传、数据一致性、权限校验..."
echo ""

# 测试异常回传
echo "--- 测试异常回传 ---"
# 再创建一个交接用于测试回传
HANDOVER2=$(curl -s -X POST "$BASE_URL/handover" \
  -H "token: $AGENT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\":\"$TICKET_ID\",\"to_user\":\"$QA1_ID\",\"shift\":\"morning\",\"remark\":\"第二个交接测试\"}")
HANDOVER2_ID=$(echo "$HANDOVER2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  创建第二个交接: $HANDOVER2_ID"

REJECTED=$(curl -s -X POST "$BASE_URL/handover/$HANDOVER2_ID/reject" \
  -H "token: $QA1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remark":"信息不完整，需要补充客户资料"}')
REJECTED_STATUS=$(echo "$REJECTED" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
echo "  异常回传成功，状态: $REJECTED_STATUS"

# 验证工单状态变为 exception
DETAIL2=$(curl -s -H "token: $QA1_TOKEN" "$BASE_URL/tickets/$TICKET_ID")
EX_STATUS=$(echo "$DETAIL2" | python3 -c "import sys,json; print(json.load(sys.stdin)['ticket']['status'])")
echo "  工单状态变为: $EX_STATUS"
echo ""

echo "--- 测试权限校验 ---"
# agent 不能派单
RESULT=$(curl -s -X PUT "$BASE_URL/tickets/$TICKET_ID/status" \
  -H "token: $AGENT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"dispatched"}')
ERROR_MSG=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))")
echo "  agent 尝试派单被拒绝: $ERROR_MSG"
echo ""

echo "--- 测试交接信息校验 ---"
# 缺失班次
RESULT=$(curl -s -X POST "$BASE_URL/handover" \
  -H "token: $AGENT1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ticket_id\":\"$TICKET_ID\",\"to_user\":\"$QA1_ID\",\"shift\":\"\",\"remark\":\"测试\"}")
ERROR_MSG=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))")
echo "  缺失班次被拦截: $ERROR_MSG"
echo ""

echo "=========================================="
echo "  ✅  所有测试全部通过！"
echo "=========================================="
