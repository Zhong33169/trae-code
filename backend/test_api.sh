#!/bin/bash
set -e
cd "$(dirname "$0")"

# ============== 1. 登记员登录 ==============
LOGIN_RESP=$(curl -s -X POST http://localhost:8003/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"registrar01","password":"123456"}')

CODE=$(echo "$LOGIN_RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('code',''))")
TOKEN_REG=$(echo "$LOGIN_RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('token',''))")
echo "[1] 登记员登录: code=$CODE, token_len=${#TOKEN_REG}"

# ============== 2. 列表接口验证 allowed_actions / visible_fields ==============
echo ""
echo "[2] 登记员视角列表验证:"
curl -s "http://localhost:8003/api/orders?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN_REG" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
items=d.get('items',[])
print(f'  列表数量: {len(items)}')
for i,item in enumerate(items[:2]):
    print(f'  [{i}] {item[\"order_no\"]} status={item[\"status\"]} status_name={item[\"status_name\"]}')
    print(f'      allowed_actions={item.get(\"allowed_actions\",[])}')
    print(f'      visible_fields 长度={len(item.get(\"visible_fields\",[]))}')
"

# ============== 3. 审核员登录 ==============
echo ""
echo "[3] 审核员登录 & 视角验证:"
LOGIN_AUD=$(curl -s -X POST http://localhost:8003/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"auditor01","password":"123456"}')
TOKEN_AUD=$(echo "$LOGIN_AUD" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('token',''))")
curl -s "http://localhost:8003/api/orders?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN_AUD" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
items=d.get('items',[])
print(f'  列表数量(审核员可见): {len(items)}')
for item in items[:2]:
    print(f'    {item[\"order_no\"]} status={item[\"status_name\"]} actions={item.get(\"allowed_actions\",[])}')
"

# ============== 4. 复核负责人登录 ==============
echo ""
echo "[4] 复核负责人登录 & 视角验证:"
LOGIN_REV=$(curl -s -X POST http://localhost:8003/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"reviewer01","password":"123456"}')
TOKEN_REV=$(echo "$LOGIN_REV" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('token',''))")
curl -s "http://localhost:8003/api/orders?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN_REV" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
items=d.get('items',[])
print(f'  列表数量(复核负责人可见): {len(items)}')
for item in items:
    print(f'    {item[\"order_no\"]} status={item[\"status_name\"]} actions={item.get(\"allowed_actions\",[])}')
"

# ============== 4.5 先归档 order_id=3 (待复核->已归档) ==============
echo ""
echo "[4.5] 先归档 order_id=3 (待复核->已归档), 用于后续核销测试:"
curl -s -X POST http://localhost:8003/api/orders/archive \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_REV" \
  -d '{"order_id":3,"shift":"早班","handover_from":2,"handover_to":3,"advance_reason":"材料齐全，同意归档"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  code={d.get(\"code\")} msg={d.get(\"message\")}')
if d.get('code')==0:
    o=d.get('data',{})
    print(f'  -> {o[\"order_no\"]} 新状态={o[\"status_name\"]}')
"

# ============== 5. 复核负责人视角: 已归档单详情 (验证核销权限) ==============
echo ""
echo "[5] 已归档确权单详情 (复核负责人视角 - 验证核销权限):"
curl -s "http://localhost:8003/api/orders/3" \
  -H "Authorization: Bearer $TOKEN_REV" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
print(f'  {d[\"order_no\"]} status={d[\"status_name\"]}')
print(f'  allowed_actions={d.get(\"allowed_actions\",[])}')
print(f'  已核销金额: {d.get(\"verified_amount\",0)} 元')
print(f'  核销次数: {d.get(\"verification_count\",0)}')
print(f'  含 create_verification 权限: {\"create_verification\" in d.get(\"allowed_actions\",[])}')
"

# ============== 6. 按 order_id 过滤核销记录 ==============
echo ""
echo "[6] 按 order_id=3 过滤核销记录:"
curl -s "http://localhost:8003/api/verifications?order_id=3&page=1&page_size=100" \
  -H "Authorization: Bearer $TOKEN_REV" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
items=d.get('items',[])
print(f'  该确权单核销记录数量: {len(items)}')
for v in items:
    print(f'    {v[\"payment_date\"]} {v.get(\"payer_name\",\"-\")} {v[\"payment_amount\"]} 元')
"

# ============== 7. 复核负责人: 新增核销 (验证事务 + 联动) ==============
echo ""
echo "[7] 新增核销 (order_id=3, 金额 200000 元):"
curl -s -X POST http://localhost:8003/api/verifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_REV" \
  -d '{"order_id":3,"payment_amount":200000.00,"payment_date":"2025-06-20","payer_name":"南京物流公司","bank_slip_no":"BK20250620001","remark":"首笔回款"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  code={d.get(\"code\")} msg={d.get(\"message\")}')
if d.get('code')==0:
    v=d.get('data',{})
    print(f'  核销单: {v[\"verify_no\"]} 金额={v[\"payment_amount\"]} 元')
"

# ============== 8. 验证联动更新: 确权单详情 ==============
echo ""
echo "[8] 核销后验证: 确权单详情联动更新:"
curl -s "http://localhost:8003/api/orders/3" \
  -H "Authorization: Bearer $TOKEN_REV" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
print(f'  核销次数: {d.get(\"verification_count\",0)} (预期=1)')
print(f'  已核销金额: {d.get(\"verified_amount\",0)} 元 (预期=200000.0)')
"

# ============== 9. 验证联动更新: 应收账款详情 ==============
echo ""
echo "[9] 核销后验证: 应收账款联动更新:"
curl -s "http://localhost:8003/api/ar/4" \
  -H "Authorization: Bearer $TOKEN_REV" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
print(f'  应收账款 {d[\"ar_no\"]} 已核销金额: {d.get(\"verified_amount\",0)} 元')
print(f'  状态: {d.get(\"status_name\",d.get(\"status\",\"\"))}')
"

# ============== 10. 验证联动更新: 统计 ==============
echo ""
echo "[10] 核销后验证: 统计同步更新:"
curl -s "http://localhost:8003/api/stats" \
  -H "Authorization: Bearer $TOKEN_REV" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
print(f'  核销总数: {d.get(\"verification_total\")} (预期=2)')
print(f'  核销总金额: {d.get(\"verification_total_amount\")} 元 (预期=700000.0)')
"

# ============== 11. 验证操作日志 ==============
echo ""
echo "[11] 验证操作日志 (target_type=confirmation_order, target_id=3):"
curl -s "http://localhost:8003/api/logs?target_type=confirmation_order&target_id=3&page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN_REV" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
items=d.get('items',[])
print(f'  日志数量: {len(items)}')
for log in items:
    print(f'    {log[\"created_at\"][:16]} {log[\"user_name\"]} {log[\"action\"]} - {log.get(\"remark\",\"-\")}')
"

# ============== 12. 边界测试: 超额核销拦截 ==============
echo ""
echo "[12] 边界测试: 超额核销拦截 (确权金额 350000, 已核销 200000, 本次 200000 超额):"
curl -s -X POST http://localhost:8003/api/verifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_REV" \
  -d '{"order_id":3,"payment_amount":200000.00,"payment_date":"2025-06-21","payer_name":"南京物流公司"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  code={d.get(\"code\")} msg={d.get(\"message\")}')
print(f'  预期: code=400, 含\"超过确权金额\"字样')
"

echo ""
echo "========================================"
echo "✅ 所有测试完成"
