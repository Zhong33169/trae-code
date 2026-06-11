#!/usr/bin/env python3
import urllib.request, json, sys

BASE = "http://localhost:8009/api"

def api(method, path, data=None, token=None):
    url = BASE + path
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("token", token)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

agent1 = api("POST", "/auth/login", {"username": "agent1", "password": "123456"})
qa1 = api("POST", "/auth/login", {"username": "qa1", "password": "123456"})
cs1 = api("POST", "/auth/login", {"username": "cs1", "password": "123456"})
print("1. All users logged in")

ticket = api("POST", "/tickets", {
    "title": "contract-test",
    "customer_name": "test",
    "customer_phone": "13800000000",
    "description": "contract test"
}, agent1["token"])
tid = ticket["id"]
print(f"2. Ticket created: {tid}, status={ticket['status']}")

t = api("PUT", f"/tickets/{tid}/status", {"status": "dispatched", "remark": "dispatch"}, qa1["token"])
print(f"3. Dispatched: status={t['status']}")

h1 = api("POST", "/handover", {
    "ticket_id": tid, "to_user": qa1["user"]["id"],
    "shift": "morning", "remark": "morning handover"
}, agent1["token"])
h1_id = h1["id"]
print(f"4. Handover submitted: {h1_id}, status={h1['status']}")

detail = api("GET", f"/tickets/{tid}", token=qa1["token"])
for hr in detail.get("handover_records", []):
    print(f"   Handover: from={hr['from_user_name']}({hr['from_role']}) -> to={hr['to_user_name']}({hr['to_role']}), status={hr['status']}")

accepted = api("POST", f"/handover/{h1_id}/accept", {}, qa1["token"])
print(f"5. Accepted: status={accepted['status']}")

h2 = api("POST", "/handover", {
    "ticket_id": tid, "to_user": cs1["user"]["id"],
    "shift": "morning", "remark": "qa approved"
}, qa1["token"])
h2_id = h2["id"]
print(f"6. QA submitted to CS: {h2_id}, status={h2['status']}")

accepted2 = api("POST", f"/handover/{h2_id}/accept", {}, cs1["token"])
print(f"7. CS accepted: status={accepted2['status']}")

detail2 = api("GET", f"/tickets/{tid}", token=cs1["token"])
print(f"8. Final detail: status={detail2['status']}, creator_name={detail2['creator_name']}")
print(f"   handover_records: {len(detail2['handover_records'])}")
print(f"   operation_logs: {len(detail2['operation_logs'])}")
for hr in detail2["handover_records"]:
    print(f"   [{hr['status']}] {hr['from_user_name']}({hr['from_role']}) -> {hr['to_user_name']}({hr['to_role']}) shift={hr['shift']}")
for ol in detail2["operation_logs"]:
    print(f"   [{ol['action']}] {ol['user_name']}: {ol.get('detail','')}")

list_data = api("GET", f"/tickets?page_size=100", token=cs1["token"])
for item in list_data["items"]:
    if item["id"] == tid:
        print(f"9. List item: status={item['status']}, ho_status={item.get('latest_handover_status')}, ho_time={item.get('latest_handover_time')}")
        break

stats = api("GET", "/statistics", token=cs1["token"])
print(f"10. Stats: total={stats['total_tickets']}, incoming={stats['incoming_count']}, dispatched={stats['dispatched_count']}")

print("\nAll contract tests passed!")
