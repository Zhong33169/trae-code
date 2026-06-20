#!/bin/bash
set -e
cd "$(dirname "$0")"

LOGIN_RESP=$(curl -s -X POST http://localhost:8003/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"registrar01","password":"123456"}')

CODE=$(echo "$LOGIN_RESP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('code',''))")
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('token',''))")
echo "[1] Login: code=$CODE, token_len=${#TOKEN}"

echo ""
echo "[2] Stats:"
curl -s http://localhost:8003/api/stats -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
print('  AR total:', d.get('ar_total'), 'amount=', d.get('ar_total_amount'))
print('  Order total:', d.get('order_total'))
print('  Order status: draft=',d.get('order_draft'),' pending_audit=',d.get('order_pending_audit'),' pending_review=',d.get('order_pending_review'),' archived=',d.get('order_archived'),' returned=',d.get('order_returned'))
print('  Verify:', d.get('verification_total'), d.get('verification_total_amount'), '元')
"

echo ""
echo "[3] Handover Validation (missing fields):"
curl -s -X POST http://localhost:8003/api/orders/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"order_id":4,"shift":"","handover_from":0,"handover_to":0,"advance_reason":""}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('  code=', d.get('code'))
print('  msg=', d.get('message'))
"

echo ""
echo "[4] Submit order 4 (补正后重新提交):"
curl -s -X POST http://localhost:8003/api/orders/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"order_id":4,"shift":"早班","handover_from":1,"handover_to":2,"advance_reason":"发票已补正，重新提交审核"}' | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('  code=', d.get('code'), 'msg=', d.get('message'))
if d.get('code')==0:
    o=d.get('data',{})
    print('  ->', o.get('order_no'), 'status=', o.get('status_name'))
    print('  交接: shift=', o.get('shift'), 'from=', o.get('handover_from_name'), 'to=', o.get('handover_to_name'))
    print('  reason=', o.get('advance_reason'))
"

echo ""
echo "[5] Stats after submit:"
curl -s http://localhost:8003/api/stats -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',{})
print('  Order: draft=',d.get('order_draft'),' pending_audit=',d.get('order_pending_audit'),' pending_review=',d.get('order_pending_review'),' archived=',d.get('order_archived'),' returned=',d.get('order_returned'))
"
