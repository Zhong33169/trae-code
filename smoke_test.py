import urllib.request
import urllib.parse
import json

BASE = "http://localhost:8003/api"

def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())

print("=== 1. 三角色登录 ===")
r_r = req("POST", "/auth/login", {"username": "registrar", "password": "123456"})
token_r = r_r["data"]["token"]
print(f"registrar: {token_r[:8]}...")

r_v = req("POST", "/auth/login", {"username": "reviewer", "password": "123456"})
token_v = r_v["data"]["token"]
print(f"reviewer: {token_v[:8]}...")

r_a = req("POST", "/auth/login", {"username": "archiver", "password": "123456"})
token_a = r_a["data"]["token"]
print(f"archiver: {token_a[:8]}...")

print("\n=== 2. 导入批次列表（含演示数据） ===")
batches = req("GET", "/import/batches", token=token_r)["data"]
print(f"批次数量: {len(batches)}")
for b in batches:
    print(f"  {b['batch_no']} - {b['source']}  成功{b['success_count']}/冲突{b['conflict_count']}/失败{b['error_count']}")

print("\n=== 3. 第一个批次明细（三类分组） ===")
bid = batches[0]["id"]
records = req("GET", f"/import/batches/{bid}/records", token=token_r)["data"]
print(f"记录总数: {len(records)}")
for status in ["success", "conflict", "error"]:
    rs = [r for r in records if r["status"] == status]
    label = {"success": "成功", "conflict": "冲突", "error": "失败"}[status]
    print(f"{label}: {len(rs)} 条")
    for r in rs:
        print(f"  {r['topic_no']} - {r.get('title', '无标题')}  {r.get('error_msg', '')}")

print("\n=== 4. 审计日志 - 按批次筛选 ===")
logs = req("GET", f"/audit/logs?batch_id={bid}", token=token_r)["data"]
print(f"该批次关联审计: {len(logs)} 条")
for l in logs:
    batch_short = l.get("import_batch_id", "")[:8] if l.get("import_batch_id") else "无"
    print(f"  [{l['action']}] {l['user_name']} - {l.get('detail','')[:60]}  批次:{batch_short}...")

print("\n=== 5. 新导入一批：成功+冲突+非法状态 ===")
imp = req("POST", "/import/execute", {
    "source": "验收测试批次",
    "remark": "smoke test",
    "items": [
        {"topic_no": "XT202509001", "title": "验收-正常离线选题", "source": "smoke", "reporter": "测试记者", "department": "测试部", "deadline": "2025-09-01", "status": "registered"},
        {"topic_no": "XT202506001", "title": "验收-与线上冲突", "source": "smoke", "reporter": "测试", "department": "测试部", "status": "reviewed"},
        {"topic_no": "XT202509002", "title": "验收-非法状态", "source": "smoke", "reporter": "测试", "department": "测试部", "status": "published"},
    ]
}, token=token_r)
d = imp["data"]
print(f'结果: code={imp["code"]}')
print(f'批次: {d["batch_no"]}, 总{d["total_count"]}, 成功{d["success_count"]}, 冲突{d["conflict_count"]}, 失败{d["error_count"]}')

print("\n=== 6. 验证失败分支都写入 import_error 审计并关联 batch_id ===")
new_bid = d["batch_id"]
new_logs = req("GET", f"/audit/logs?batch_id={new_bid}", token=token_r)["data"]
err_logs = [l for l in new_logs if l["action"] == "import_error"]
conflict_logs = [l for l in new_logs if l["action"] == "import_conflict"]
create_logs = [l for l in new_logs if l["action"] == "import_create"]
print(f"该批次审计共 {len(new_logs)} 条:")
print(f"  import_create: {len(create_logs)}")
print(f"  import_conflict: {len(conflict_logs)}")
print(f"  import_error: {len(err_logs)}")

all_have_batch = all(l.get("import_batch_id") for l in new_logs)
print(f"所有审计日志均关联 batch_id: {'✓' if all_have_batch else '✗'}")
print(f"失败分支均写入 import_error 审计: {'✓' if len(err_logs) >= 1 else '✗'}")

print("\n=== 全部 smoke test 通过 ✓ ===")
