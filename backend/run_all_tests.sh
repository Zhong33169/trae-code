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
echo "====== [C] 测试版本缺失：不传form_versions ======"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/forms/batch \
  -H "Authorization: Bearer $FOREMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_ids\":[\"$FB0001_ID\"],\"action\":\"verify_foreman\"}"

echo ""
echo ""
echo "====== [D] 测试form_versions漏掉该id ======"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/forms/batch \
  -H "Authorization: Bearer $FOREMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_ids\":[\"$FB0001_ID\"],\"form_versions\":{\"other-id\":1},\"action\":\"verify_foreman\"}"

echo ""
echo ""
echo "====== [E] 测试错误角色：用clerk01登录 ======"
CLERK_LOGIN_RESP=$(curl -s -X POST http://localhost:8001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"clerk01","password":"clerk123"}')
echo "clerk登录响应: $CLERK_LOGIN_RESP"
CLERK_TOKEN=$(echo "$CLERK_LOGIN_RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
echo "clerk token: $CLERK_TOKEN"

echo ""
echo "--- clerk尝试批量核验（预期失败 wrong_role_foreman_verify）---"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/forms/batch \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_ids\":[\"$FB0001_ID\"],\"form_versions\":{\"$FB0001_ID\":$ORIGINAL_VERSION},\"action\":\"verify_foreman\"}"

echo ""
echo ""
echo "====== [F] 测试错误状态：clerk token 尝试 archive pending_foreman 的表单 ======"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/forms/batch \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_ids\":[\"$FB0001_ID\"],\"form_versions\":{\"$FB0001_ID\":$ORIGINAL_VERSION},\"action\":\"archive\"}"

echo ""
echo ""
echo "====== [G] 测试版本冲突：先上传inspection证据，再用version=99核验 ======"
echo "--- 上传inspection证据 ---"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/evidences \
  -H "Authorization: Bearer $FOREMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_id\":\"$FB0001_ID\",\"type\":\"inspection\",\"name\":\"现场核验记录-20260611.pdf\",\"is_supplemental\":false}"

echo ""
echo ""
echo "--- 用version=99批量核验（预期失败 version_conflict）---"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/forms/batch \
  -H "Authorization: Bearer $FOREMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_ids\":[\"$FB0001_ID\"],\"form_versions\":{\"$FB0001_ID\":99},\"action\":\"verify_foreman\"}"

echo ""
echo ""
echo "====== [H] 验证失败未持久化 - 查看FB-0001详情 ======"
DETAIL_H=$(curl -s "http://localhost:8001/api/forms/$FB0001_ID" \
  -H "Authorization: Bearer $FOREMAN_TOKEN")
echo "$DETAIL_H"
H_VERSION=$(echo "$DETAIL_H" | sed 's/.*"version":\([0-9]*\).*/\1/')
H_STATUS=$(echo "$DETAIL_H" | sed 's/.*"status":"\([^"]*\)".*/\1/')
H_HANDLER=$(echo "$DETAIL_H" | sed 's/.*"current_handler":"\([^"]*\)".*/\1/')
H_AUDIT_COUNT=$(echo "$DETAIL_H" | grep -o '"action":"verify_foreman"' | wc -l)
echo ""
echo ">>> 验证结果: version=$H_VERSION (期望$ORIGINAL_VERSION), status=$H_STATUS (期望pending_foreman), current_handler=$H_HANDLER (期望$FOREMAN_ID), verify_foreman audit_logs数量=$H_AUDIT_COUNT (期望0)"

echo ""
echo "====== [I] 正确批量核验：foreman token + version=$ORIGINAL_VERSION ======"
curl -s -w "\n---HTTP_STATUS:%{http_code}---" -X POST http://localhost:8001/api/forms/batch \
  -H "Authorization: Bearer $FOREMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"form_ids\":[\"$FB0001_ID\"],\"form_versions\":{\"$FB0001_ID\":$ORIGINAL_VERSION},\"action\":\"verify_foreman\"}"

echo ""
echo ""
echo "====== [J] 验证成功持久化 - 查看FB-0001详情 ======"
DETAIL_J=$(curl -s "http://localhost:8001/api/forms/$FB0001_ID" \
  -H "Authorization: Bearer $FOREMAN_TOKEN")
echo "$DETAIL_J"
J_VERSION=$(echo "$DETAIL_J" | sed 's/.*"version":\([0-9]*\).*/\1/')
J_STATUS=$(echo "$DETAIL_J" | sed 's/.*"status":"\([^"]*\)".*/\1/')
J_AUDIT_COUNT=$(echo "$DETAIL_J" | grep -o '"action":"verify_foreman"' | wc -l)
echo ""
echo ">>> 验证结果: version=$J_VERSION (期望$((ORIGINAL_VERSION+1))), status=$J_STATUS (期望pending_manager), verify_foreman audit_logs数量=$J_AUDIT_COUNT (期望1)"

echo ""
echo "====== 所有测试完成 ======"
