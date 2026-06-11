#!/bin/bash
cd /Users/echo/Desktop/zqzl/zhong33169/trae-code-1/backend

echo "====== [0] 清理并重启服务 ======"
pkill -9 -f subcontract-server 2>/dev/null
sleep 1
lsof -ti:8001 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1
rm -f subcontract.db subcontract.db-wal subcontract.db-shm
echo "数据库已删除"

./subcontract-server > /tmp/subcontract-server.log 2>&1 &
sleep 3
echo "服务已启动"

echo ""
echo "====== [A] foreman01登录获取token ======"
LOGIN_RESP=$(curl -s -X POST http://localhost:8001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"foreman01","password":"foreman123"}')
echo "$LOGIN_RESP"
FOREMAN_TOKEN=$(echo "$LOGIN_RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
FOREMAN_ID=$(echo "$LOGIN_RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo ""
echo "foreman token: $FOREMAN_TOKEN"
echo "foreman id: $FOREMAN_ID"

echo ""
echo "====== [B] 获取status=pending_foreman的FB-0001 ======"
FORMS_RESP=$(curl -s "http://localhost:8001/api/forms?status=pending_foreman" \
  -H "Authorization: Bearer $FOREMAN_TOKEN")
echo "$FORMS_RESP"

FB0001_ID=$(echo "$FORMS_RESP" | sed 's/.*"code":"FB-0001"[^}]*"id":"\([^"]*\)".*/\1/')
FB0001_VERSION=$(echo "$FORMS_RESP" | sed 's/.*"code":"FB-0001"[^}]*"version":\([0-9]*\).*/\1/')

if [ -z "$FB0001_ID" ] || [ "$FB0001_ID" = "$FORMS_RESP" ]; then
  ALL_FORMS=$(curl -s "http://localhost:8001/api/forms" -H "Authorization: Bearer $FOREMAN_TOKEN")
  echo "所有表单(foreman): $ALL_FORMS"
  CLERK_LOGIN=$(curl -s -X POST http://localhost:8001/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"clerk01","password":"clerk123"}')
  CLERK_TOKEN=$(echo "$CLERK_LOGIN" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  ALL_FORMS2=$(curl -s "http://localhost:8001/api/forms" -H "Authorization: Bearer $CLERK_TOKEN")
  echo "所有表单(clerk): $ALL_FORMS2"
  FB0001_ID=$(echo "$ALL_FORMS2" | sed 's/.*"code":"FB-0001"[^}]*"id":"\([^"]*\)".*/\1/')
  FB0001_VERSION=$(echo "$ALL_FORMS2" | sed 's/.*"code":"FB-0001"[^}]*"version":\([0-9]*\).*/\1/')
fi

echo ""
echo "FB-0001 ID: $FB0001_ID"
echo "FB-0001 Version: $FB0001_VERSION"
ORIGINAL_VERSION=$FB0001_VERSION

echo ""
echo "====== [C] 上传inspection证据到FB-0001 ======"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/evidences \
  -H "Authorization: Bearer $FOREMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_id\":\"$FB0001_ID\",\"type\":\"inspection\",\"name\":\"现场核验记录-20260611.pdf\",\"is_supplemental\":false}"

echo ""
echo ""
echo "====== [D] 错误version(99)批量核验FB-0001（预期失败）======"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/forms/batch \
  -H "Authorization: Bearer $FOREMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_ids\":[\"$FB0001_ID\"],\"form_versions\":{\"$FB0001_ID\":99},\"action\":\"verify_foreman\"}"

echo ""
echo ""
echo "====== [E] 验证失败未持久化 - 查看FB-0001详情 ======"
DETAIL_E=$(curl -s "http://localhost:8001/api/forms/$FB0001_ID" \
  -H "Authorization: Bearer $FOREMAN_TOKEN")
echo "$DETAIL_E"
E_VERSION=$(echo "$DETAIL_E" | sed 's/.*"version":\([0-9]*\).*/\1/')
E_STATUS=$(echo "$DETAIL_E" | sed 's/.*"status":"\([^"]*\)".*/\1/')
E_HANDLER=$(echo "$DETAIL_E" | sed 's/.*"current_handler":"\([^"]*\)".*/\1/')
E_AUDIT_COUNT=$(echo "$DETAIL_E" | grep -o '"action":"verify_foreman"' | wc -l)
echo ""
echo ">>> 验证结果: version=$E_VERSION (期望$ORIGINAL_VERSION), status=$E_STATUS (期望pending_foreman), current_handler=$E_HANDLER (期望$FOREMAN_ID), verify_foreman audit_logs数量=$E_AUDIT_COUNT (期望0)"

echo ""
echo "====== [F] 正确version($ORIGINAL_VERSION)批量核验FB-0001（成功）======"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/forms/batch \
  -H "Authorization: Bearer $FOREMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_ids\":[\"$FB0001_ID\"],\"form_versions\":{\"$FB0001_ID\":$ORIGINAL_VERSION},\"action\":\"verify_foreman\"}"

echo ""
echo ""
echo "====== [G] 验证成功持久化 - 查看FB-0001详情 ======"
DETAIL_G=$(curl -s "http://localhost:8001/api/forms/$FB0001_ID" \
  -H "Authorization: Bearer $FOREMAN_TOKEN")
echo "$DETAIL_G"
G_VERSION=$(echo "$DETAIL_G" | sed 's/.*"version":\([0-9]*\).*/\1/')
G_STATUS=$(echo "$DETAIL_G" | sed 's/.*"status":"\([^"]*\)".*/\1/')
G_AUDIT_COUNT=$(echo "$DETAIL_G" | grep -o '"action":"verify_foreman"' | wc -l)
echo ""
echo ">>> 验证结果: version=$G_VERSION (期望$((ORIGINAL_VERSION+1))), status=$G_STATUS (期望pending_manager), verify_foreman audit_logs数量=$G_AUDIT_COUNT (期望1)"

echo ""
echo "====== 所有测试完成 ======"
