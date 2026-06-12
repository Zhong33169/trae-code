# 园区招商中心 · 移动补录校验招商线索单系统

## 技术栈
- **前端**: Vue 3 + Vite + Vue Router + Pinia + Axios
- **后端**: Node.js + Hono + sql.js (SQLite, WASM 纯 JS 版，无需编译)
- **前端端口**: 30010
- **后端端口**: 8010（注：原需求 80010 超过 TCP 端口上限 65535，调整为 8010）

## 初始化

### 1. 启动后端
```bash
cd backend
npm install
npm run dev
# 后端运行在 http://localhost:8010
# 首次启动会自动初始化 SQLite 数据库并导入演示数据
```

### 2. 启动前端
```bash
cd frontend
npm install
npm run dev
# 前端运行在 http://localhost:30010
```

### 3. 访问系统
打开浏览器访问 http://localhost:30010

## 演示账号

系统预置 5 个用户，涵盖 3 个岗位角色。可在页面顶部切换角色：

| 用户名 | 姓名 | 角色 | 角色名 | 职责 |
|--------|------|------|--------|------|
| zs001 | 张招商 | INITIATOR | 招商专员(发起) | 发起招商线索单 |
| zs002 | 李招商 | INITIATOR | 招商专员(发起) | 发起招商线索单 |
| bl001 | 王办理 | HANDLER | 招商经理(办理) | 跟进拜访 + 签约确认 |
| bl002 | 赵办理 | HANDLER | 招商经理(办理) | 跟进拜访 + 签约确认 |
| fh001 | 刘复核 | REVIEWER | 复核专员(复核归档) | 复核归档 / 驳回 |

## 业务流程（三段式，后岗不能替前岗）

```
[发起] INITIATOR → [办理] HANDLER → [复核归档] REVIEWER
   ↓                   ↓                    ↓
创建线索单         跟进拜访记录          证据齐全校验
                   签约确认              通过→归档/不通过→驳回
```

### 流转规则
1. **岗位隔离**：后一个岗位不能替前一个岗位补流程
   - INITIATOR 不能办理、不能复核
   - HANDLER 不能发起、不能复核
   - REVIEWER 不能发起、不能办理
2. **重复补录拦截**：同一企业线索存在进行中的线索单时，不得重复发起
3. **覆盖结果拦截**：已被某办理人接手的线索单，其他办理人不能覆盖
4. **证据校验**：
   - 办理阶段：至少 1 条跟进拜访记录
   - 复核归档阶段：企业信息 + 跟进拜访 + 签约确认，三类证据必须齐全
5. **版本冲突拦截**：提交时若客户端版本号落后于服务端，必须刷新后再操作
6. **状态校验**：各阶段只接受特定状态的线索单

## 预置演示数据（可直接暴露问题）

| 单号 | 企业 | 阶段 | 状态 | 证据情况 | 用途 |
|------|------|------|------|----------|------|
| XS202506001 | 上海星瀚科技 | 办理 | 已发起 | 企业✓ 跟进✗ 签约✗ | 测试缺跟进证据时能否办理 |
| XS202506002 | 深圳云帆新能源 | 复核归档 | 已办理 | 企业✓ 跟进✓ 签约✗ | 测试缺签约证据时能否归档 |
| XS202506003 | 北京智联软件 | 办理 | 已发起 | 企业✗ 跟进✗ 签约✗ | 测试企业信息缺失场景 |
| XS202506004 | 杭州蓝鲸生物 | 复核归档 | 已办理 | 企业✓ 跟进✓ 签约✓ | 测试证据齐全可正常归档 |
| XS202506005 | 苏州锐驰精密 | 复核归档 | 已复核 | 企业✓ 跟进✓ 签约✓ | 已复核完成的样例 |

## 后端 API 拦截用例（可绕过前端直接调用测试）

所有接口通过请求头 `X-User-Id` 和 `X-User-Role` 识别当前用户。

### 示例 1：错角色 - 用 REVIEWER 去办理
```bash
curl -X POST http://localhost:8010/api/clue-orders/XS202506001/handle \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: 5' \
  -H 'X-User-Role: REVIEWER' \
  -d '{}'
# 返回: ROLE_PERMISSION_DENIED - 当前角色【复核专员(复核归档)】无此操作权限
```

### 示例 2：旧版本 - 提交过期的 version
```bash
curl -X POST http://localhost:8010/api/clue-orders/XS202506001/handle \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: 3' \
  -H 'X-User-Role: HANDLER' \
  -d '{"clientVersion": 999, "followup": {"visit_date":"2025-06-10","content":"拜访"}}'
# 返回: VERSION_CONFLICT - 线索单已被更新，请刷新后再操作
```

### 示例 3：缺证据 - 证据不全直接归档
```bash
curl -X POST http://localhost:8010/api/clue-orders/XS202506002/review \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: 5' \
  -H 'X-User-Role: REVIEWER' \
  -d '{"action":"approve"}'
# 返回: INSUFFICIENT_EVIDENCE - 复核归档前证据不齐全，缺少：签约确认材料
```

### 示例 4：错状态 - 对 HANDLED 状态执行 handle
```bash
curl -X POST http://localhost:8010/api/clue-orders/XS202506002/handle \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: 3' \
  -H 'X-User-Role: HANDLER' \
  -d '{}'
# 返回: WRONG_STATUS - 线索单当前状态为【已办理】，仅【已发起】状态可办理
```

### 示例 5：重复补录 - 同一企业再发起
```bash
curl -X POST http://localhost:8010/api/clue-orders \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: 1' \
  -H 'X-User-Role: INITIATOR' \
  -d '{"clue_no":"QY20250001","title":"重复发起测试"}'
# 返回: DUPLICATE_ORDER - 企业线索已存在进行中的线索单，不得重复发起
```

### 示例 6：覆盖结果 - 用 bl002 覆盖 bl001 已办理的单子
```bash
# 找一个 handler_id=3 (bl001) 的单子，用 id=4 (bl002) 去覆盖
curl -X POST http://localhost:8010/api/clue-orders/XS202506002/handle \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: 4' \
  -H 'X-User-Role: HANDLER' \
  -d '{"followup": {"visit_date":"2025-06-10","content":"抢办理"}}'
# 返回: ORDER_ALREADY_ASSIGNED - 线索单已由【王办理】办理，您无法覆盖他人办理结果
```

## 主要接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/health | 健康检查 | 无 |
| GET | /api/users | 获取所有用户 | 登录 |
| GET | /api/clue-orders | 线索单列表（支持 status/currentStage/keyword/mine） | 登录 |
| GET | /api/clue-orders/:orderNo | 线索单详情（含证据、日志） | 登录 |
| POST | /api/clue-orders | 发起线索单 | INITIATOR |
| POST | /api/clue-orders/:orderNo/handle | 办理（提交跟进/签约） | HANDLER |
| POST | /api/clue-orders/:orderNo/review | 复核通过/驳回 | REVIEWER |
| POST | /api/clue-orders/batch-review | 批量复核归档 | REVIEWER |
| GET | /api/enterprise-leads | 企业线索列表 | 登录 |
| POST | /api/enterprise-leads | 录入企业线索 | INITIATOR/HANDLER |
| POST | /api/follow-up-records | 添加跟进拜访 | HANDLER |
| POST | /api/signing-confirmations | 添加签约确认 | HANDLER |
| GET | /api/stats | 统计概览 | 登录 |

## 数据文件
SQLite 数据库文件位置：`backend/data/zhaoshang.db`
如需重置：删除该文件后重启后端即可自动重新初始化。
