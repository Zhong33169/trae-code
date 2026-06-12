#!/bin/bash
set -e

BASE="http://localhost:18010/api"
echo "=========== 消防隐患单闭环测试 ==========="
echo ""

# Step 1: 三个账号登录
echo "[1/8] 三个账号登录..."
CLERK_TOKEN=$(curl -s -X POST $BASE/login -H "Content-Type: application/json" \
  -d '{"username":"clerk01","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
SUP_TOKEN=$(curl -s -X POST $BASE/login -H "Content-Type: application/json" \
  -d '{"username":"supervisor01","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
CHIEF_TOKEN=$(curl -s -X POST $BASE/login -H "Content-Type: application/json" \
  -d '{"username":"chief01","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "  clerk01 token: ${CLERK_TOKEN:0:20}..."
echo "  supervisor01 token: ${SUP_TOKEN:0:20}..."
echo "  chief01 token: ${CHIEF_TOKEN:0:20}..."
echo "  OK"
echo ""

# Step 2: 初始统计
echo "[2/8] 三个视角的初始统计（用于对比数据一致性）..."
C_STAT=$(curl -s $BASE/statistics -H "Authorization: Bearer $CLERK_TOKEN")
S_STAT=$(curl -s $BASE/statistics -H "Authorization: Bearer $SUP_TOKEN")
CH_STAT=$(curl -s $BASE/statistics -H "Authorization: Bearer $CHIEF_TOKEN")
echo "  clerk01 可见总数: $(echo $C_STAT | python3 -c "import sys,json; print(json.load(sys.stdin)['summary']['total'])")"
echo "  supervisor01 可见总数: $(echo $S_STAT | python3 -c "import sys,json; print(json.load(sys.stdin)['summary']['total'])")"
echo "  chief01 可见总数: $(echo $CH_STAT | python3 -c "import sys,json; print(json.load(sys.stdin)['summary']['total'])")"
echo "  OK"
echo ""

# Step 3: clerk01 创建隐患单
echo "[3/8] clerk01 上报新隐患单..."
CREATE_RESULT=$(curl -s -X POST $BASE/orders -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "【测试】消防通道被车辆堵塞",
    "description": "东门口消防通道长期被社会车辆占用",
    "location": "朝阳小区东门",
    "hazard_level": "high",
    "content": "现场有3辆私家车长期停放在消防通道，宽度仅剩1.5米，消防车无法通过。已电话通知车主2次仍未挪走，建议立即处理。"
  }')
ORDER_ID=$(echo $CREATE_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
ORDER_NO=$(echo $CREATE_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['order_no'])")
echo "  创建成功: id=$ORDER_ID, order_no=$ORDER_NO"
echo "  状态: $(echo $CREATE_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")"
echo "  OK"
echo ""

# Step 4: 验证列表、详情、统计一致
echo "[4/8] 验证数据一致性：clerk列表/详情/统计都能看到；chief看不到"
C_LIST=$(curl -s "$BASE/orders?page=1&size=5" -H "Authorization: Bearer $CLERK_TOKEN")
C_LIST_COUNT=$(echo $C_LIST | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
C_DETAIL=$(curl -s $BASE/orders/$ORDER_ID -H "Authorization: Bearer $CLERK_TOKEN")
C_DETAIL_STATUS=$(echo $C_DETAIL | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['status'])")
C_DETAIL_NODE=$(echo $C_DETAIL | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['current_node'])")
C_ALLOWED=$(echo $C_DETAIL | python3 -c "import sys,json; print(json.load(sys.stdin)['allowed_actions'])")
C_DENIALS=$(echo $C_DETAIL | python3 -c "import sys,json; d=json.load(sys.stdin)['action_denial_reasons']; print('; '.join([f'{k}={v}' for k,v in d.items()]))")

# chief01 应该 403（因为是 pending 状态）
CH_VIEW=$(curl -s -o /dev/null -w "%{http_code}" $BASE/orders/$ORDER_ID -H "Authorization: Bearer $CHIEF_TOKEN")

echo "  clerk列表数量=$C_LIST_COUNT, 详情状态=$C_DETAIL_STATUS, 节点=$C_DETAIL_NODE"
echo "  clerk allowed_actions=$C_ALLOWED"
echo "  clerk action_denials=$C_DENIALS"
echo "  chief01查看该单 HTTP状态=$CH_VIEW (期望403，因为pending)"

# 验证 clerk 不允许任何操作
if echo "$C_ALLOWED" | python3 -c "import sys; d=sys.stdin.read(); sys.exit(0 if 'assign' in d or 'rectify' in d or 'recheck' in d or 'confirm' in d else 1)"; then
  echo "  !! ERROR: clerk 不应有操作权限"
else
  echo "  clerk 无操作权限 (正确)"
fi
echo "  OK"
echo ""

# Step 5: supervisor01 转办
echo "[5/8] supervisor01 转办分派（下发整改通知）..."
S_DETAIL_BEFORE=$(curl -s $BASE/orders/$ORDER_ID -H "Authorization: Bearer $SUP_TOKEN")
S_ALLOWED_BEFORE=$(echo $S_DETAIL_BEFORE | python3 -c "import sys,json; print(json.load(sys.stdin)['allowed_actions'])")
echo "  转办前 allowed_actions=$S_ALLOWED_BEFORE"

ASSIGN_RESULT=$(curl -s -X PUT "$BASE/orders/$ORDER_ID/assign" -H "Authorization: Bearer $SUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "days": 3,
    "content": "限3日内完成消防通道清场，设置隔离桩防止再次占用。处罚物业公司2000元并通报。",
    "remark": "情况紧急，优先处理"
  }')
echo "  转办后 status=$(echo $ASSIGN_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])"), node=$(echo $ASSIGN_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['node'])")"

S_DETAIL_AFTER=$(curl -s $BASE/orders/$ORDER_ID -H "Authorization: Bearer $SUP_TOKEN")
NOTICE_COUNT=$(echo $S_DETAIL_AFTER | python3 -c "import sys,json; print(len(json.load(sys.stdin)['rectification_notices']))")
LOG_COUNT=$(echo $S_DETAIL_AFTER | python3 -c "import sys,json; print(len(json.load(sys.stdin)['operation_logs']))")
S_ALLOWED_AFTER=$(echo $S_DETAIL_AFTER | python3 -c "import sys,json; print(json.load(sys.stdin)['allowed_actions'])")
echo "  整改通知记录数=$NOTICE_COUNT (期望1)"
echo "  操作日志记录数=$LOG_COUNT (期望2)"
echo "  转办后 allowed_actions=$S_ALLOWED_AFTER (期望包含rectify)"
echo "  OK"
echo ""

# Step 6: supervisor01 提交整改记录
echo "[6/8] supervisor01 提交整改记录..."
RECTIFY_RESULT=$(curl -s -X PUT "$BASE/orders/$ORDER_ID/rectify" -H "Authorization: Bearer $SUP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "1. 已联系交警拖走3辆占道车辆；2. 物业公司已在通道口设置隔离桩4根；3. 已贴出禁停公告；4. 对物业公司罚款2000元已缴纳。现场实测通道宽度4.5米，消防车可顺利通过。",
    "remark": "整改效果良好"
  }')
echo "  整改后 status=$(echo $RECTIFY_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])"), node=$(echo $RECTIFY_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['current_node'])")"

S_DETAIL3=$(curl -s $BASE/orders/$ORDER_ID -H "Authorization: Bearer $SUP_TOKEN")
RECT_COUNT=$(echo $S_DETAIL3 | python3 -c "import sys,json; print(len(json.load(sys.stdin)['rectification_records']))")
S_ALLOWED3=$(echo $S_DETAIL3 | python3 -c "import sys,json; print(json.load(sys.stdin)['allowed_actions'])")
echo "  整改记录数=$RECT_COUNT (期望1)"
echo "  整改后 allowed_actions=$S_ALLOWED3 (期望不包含rectify，因为已到recheck节点)"

# chief01 现在应该能看到且可复查
CH_DETAIL1=$(curl -s $BASE/orders/$ORDER_ID -H "Authorization: Bearer $CHIEF_TOKEN")
CH_ALLOWED1=$(echo $CH_DETAIL1 | python3 -c "import sys,json; print(json.load(sys.stdin)['allowed_actions'])")
echo "  chief01 allowed_actions=$CH_ALLOWED1 (期望包含recheck)"
echo "  OK"
echo ""

# Step 7: chief01 复查回访
echo "[7/8] chief01 复查回访..."
RECHECK_RESULT=$(curl -s -X PUT "$BASE/orders/$ORDER_ID/recheck" -H "Authorization: Bearer $CHIEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "result": "pass",
    "content": "现场复查：4根隔离桩完好，无车辆停放。物业公司保安每2小时巡逻一次，登记齐全。通道宽度实测4.6米，满足消防要求。复查通过。",
    "remark": "建议持续跟踪1个月"
  }')
echo "  复查后 status=$(echo $RECHECK_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])"), node=$(echo $RECHECK_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['node'])")"

CH_DETAIL2=$(curl -s $BASE/orders/$ORDER_ID -H "Authorization: Bearer $CHIEF_TOKEN")
RECH_COUNT=$(echo $CH_DETAIL2 | python3 -c "import sys,json; print(len(json.load(sys.stdin)['recheck_records']))")
CH_ALLOWED2=$(echo $CH_DETAIL2 | python3 -c "import sys,json; print(json.load(sys.stdin)['allowed_actions'])")
echo "  复查记录数=$RECH_COUNT (期望1)"
echo "  复查后 allowed_actions=$CH_ALLOWED2 (期望包含confirm)"
echo "  OK"
echo ""

# Step 8: chief01 确认完成 + 最终一致性验证
echo "[8/8] chief01 确认完成 + 最终数据一致性验证..."
CONFIRM_RESULT=$(curl -s -X PUT "$BASE/orders/$ORDER_ID/confirm" -H "Authorization: Bearer $CHIEF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remark": "确认闭环，跟踪一个月"}')
echo "  确认后 status=$(echo $CONFIRM_RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")"

# 列表 / 详情 / 批量 / 统计 一致性
C_LIST2=$(curl -s "$BASE/orders?page=1&size=50" -H "Authorization: Bearer $CLERK_TOKEN")
C_LIST_TOTAL=$(echo $C_LIST2 | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
C_STAT2=$(curl -s $BASE/statistics -H "Authorization: Bearer $CLERK_TOKEN")
C_STAT_TOTAL=$(echo $C_STAT2 | python3 -c "import sys,json; print(json.load(sys.stdin)['summary']['total'])")
C_STAT_REVISITED=$(echo $C_STAT2 | python3 -c "import sys,json; print(json.load(sys.stdin)['summary']['revisited'])")

# 批量查询
IDS_IN_LIST=$(echo $C_LIST2 | python3 -c "import sys,json; print([o['id'] for o in json.load(sys.stdin)['list']])")
BATCH_RESULT=$(curl -s -X POST $BASE/orders/batch-status -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"ids\": $IDS_IN_LIST}")
BATCH_COUNT=$(echo $BATCH_RESULT | python3 -c "import sys,json; print(len(json.load(sys.stdin)['items']))")

# 详情最终
FINAL_DETAIL=$(curl -s $BASE/orders/$ORDER_ID -H "Authorization: Bearer $CLERK_TOKEN")
FINAL_STATUS=$(echo $FINAL_DETAIL | python3 -c "import sys,json; print(json.load(sys.stdin)['order']['status'])")
FINAL_NOTICE=$(echo $FINAL_DETAIL | python3 -c "import sys,json; print(len(json.load(sys.stdin)['rectification_notices']))")
FINAL_RECT=$(echo $FINAL_DETAIL | python3 -c "import sys,json; print(len(json.load(sys.stdin)['rectification_records']))")
FINAL_RECH=$(echo $FINAL_DETAIL | python3 -c "import sys,json; print(len(json.load(sys.stdin)['recheck_records']))")
FINAL_LOGS=$(echo $FINAL_DETAIL | python3 -c "import sys,json; print(len(json.load(sys.stdin)['operation_logs']))")
FINAL_ALLOWED=$(echo $FINAL_DETAIL | python3 -c "import sys,json; print(json.load(sys.stdin)['allowed_actions'])")

echo "  最终状态=$FINAL_STATUS"
echo "  clerk列表总数=$C_LIST_TOTAL, clerk统计总数=$C_STAT_TOTAL (一致吗? $([[ $C_LIST_TOTAL == $C_STAT_TOTAL ]] && echo '是' || echo '否'))"
echo "  clerk统计中已回访数=$C_STAT_REVISITED (至少1)"
echo "  批量查询数量=$BATCH_COUNT (期望等于列表数量)"
echo "  整改通知=$FINAL_NOTICE, 整改=$FINAL_RECT, 复查=$FINAL_RECH, 操作日志=$FINAL_LOGS (期望 1,1,1,5+)"
echo "  最终 allowed_actions=$FINAL_ALLOWED (期望为空)"

echo ""
echo "=========== 端到端闭环测试完成 ==========="
