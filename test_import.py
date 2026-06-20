#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8005/api"

def login(username, password):
    req = urllib.request.Request(
        f"{BASE}/auth/login",
        data=json.dumps({"username": username, "password": password}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        return data["data"]["token"]

def import_test(token):
    items = [
        {"ticket_no": "TS202606001", "title": "家政服务人员迟到问题", "content": "和线上内容一致", "complainant": "陈先生", "priority": "normal"},
        {"ticket_no": "TS-NEW-001", "title": "新导入工单1", "content": "这是一个新导入的工单", "complainant": "测试用户", "priority": "high"},
        {"ticket_no": "TS202606002", "title": "保洁服务质量不满意", "content": "和线上内容不一样，冲突了", "complainant": "不同的人", "priority": "urgent"},
        {"ticket_no": "TS-BAD-001", "title": "", "content": "", "complainant": "", "priority": "invalid"}
    ]
    req_data = json.dumps({"source": "offline_excel", "items": items}).encode()
    req = urllib.request.Request(
        f"{BASE}/import",
        data=req_data,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        return data

if __name__ == "__main__":
    token = login("registrar1", "123456")
    print(f"登录成功，token: {token[:20]}...")
    print()
    
    result = import_test(token)
    print("=== 导入结果 ===")
    print(f"状态: {result['message']}")
    if result["code"] == 0:
        b = result["data"]
        print(f"批次号: {b.get('batch_no')}")
        print(f"总数: {b.get('total')}, 成功: {b.get('success')}, 失败: {b.get('failed')}")
        print()
        print("逐条详情:")
        for i, r in enumerate(b.get("records", [])):
            status = r["status"]
            err = r.get("error_message") or ""
            diff = r.get("diff_detail") or ""
            no = r.get("original_ticket_no") or ""
            print(f"  {i+1}. {no} - {status}")
            if err:
                print(f"     错误: {err}")
            if diff:
                print(f"     差异: {diff}")
    else:
        print(f"错误: {result}")
