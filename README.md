# 器材借用管理系统

基于 Angular + Vite + Node + Koa + SQLite 构建的器材借用流程管理系统，实现**登记 → 审核 → 复核归档**三岗分离的全流程闭环。

---

## 功能概览

### 流程岗位
| 岗位 | 角色标识 | 权限 |
|---|---|---|
| 器材借用登记员 | `registrar` | 新建借用单、补正信息、上传/删除证据、提交审核 |
| 器材借用审核主管 | `auditor` | 对"待审核"单据进行审核通过 / 驳回 |
| 体育场馆复核负责人 | `reviewer` | 对"待复核"单据复核归档 / 驳回；支持批量复核 |

### 状态流转
```
草稿(draft) → 待审核(pending_audit) → 审核主管办理
                      ↓通过                      ↓驳回
                 待复核(pending_review)     审核驳回(audit_rejected)→登记员补正
                      ↓通过                      ↓驳回
                 已归档(archived)          复核驳回(review_rejected)→登记员补正
```

### 关键特性
- **三岗分离**：后一个岗位无法替代前一岗位办理流程（后端强校验）
- **乐观锁版本控制**：`version` 字段防止并发覆盖
- **证据校验**：复核归档强制检查借用、归还、损耗证据齐全且与说明一致
- **批量复核**：一次勾选多条，逐条显示 `success / failed / retry` 及失败原因
- **详情失败原因**：每次复核失败原因写入 `last_failure_reason`，在详情显著展示
- **绕过页面保护**：错角色、旧版本、缺证据、错状态均被后端拦截并返回具体原因
- **内置样例**：8 条覆盖正常/异常场景的借用单，便于暴露问题

---

## 演示账号

| 用户名 | 密码 | 角色 |
|---|---|---|
| `registrar01` | `123456` | 器材借用登记员（李登记员） |
| `auditor01` | `123456` | 器材借用审核主管（王审核主管） |
| `reviewer01` | `123456` | 体育场馆复核负责人（张复核负责人） |

> 登录页可点击快速登录按钮，或在顶部"角色切换"下拉快速切换账号。

---

## 初始化与启动

### 1. 后端 (端口 8004)
```bash
cd backend
npm install
# 首次启动会自动初始化 SQLite 数据库并插入演示数据
npm start
```
- 数据库文件：`backend/data/equipment.db`
- 健康检查：`GET http://localhost:8004/health`

如需重置数据：
```bash
# 删除 DB 后重启后端即可重新初始化
rm -rf backend/data && cd backend && npm start
```

### 2. 前端 (端口 3004)
```bash
cd frontend
npm install
npm run dev
```
打开浏览器访问：**http://localhost:3004**

前端所有 `/api/*` 请求会通过 Vite 代理转发至 `http://localhost:8004`。
后端 CORS 已放行 `http://localhost:3004`。

---

## 内置演示样例（8条）

| 单号 | 场景 | 状态 | 关键特征 |
|---|---|---|---|
| EB-2024-0001 | ✅ 正常可归档 | 待复核 | 三类证据齐全 |
| EB-2024-0002 | ❌ 缺归还验收证据 | 待复核 | 批量复核会失败 |
| EB-2024-0003 | ✅ 带损耗（正常） | 待复核 | 有损耗说明+损耗证据 |
| EB-2024-0004 | 📋 待审核 | 待审核 | 只有审核主管可办理 |
| EB-2024-0005 | 🚫 审核驳回待补正 | 审核驳回 | 登记员需补正重提 |
| EB-2024-0006 | ⚠️ 复核驳回待补正 | 复核驳回 | 已写入失败原因 |
| EB-2024-0007 | ✅ 已归档 | 已归档 | 完整流程走完 |
| EB-2024-0008 | ❌ 损耗证据不完整 | 待复核 | 复核会失败 |

### 批量复核验收步骤
1. 登录 `reviewer01` → 进入"待我复核"队列
2. 勾选 **EB-2024-0001、0002、0003、0008**（混合正常与异常）
3. 点击 **批量复核归档**
4. 预期逐条结果：
   - ✅ 0001 → 成功归档
   - ❌ 0002 → 失败（缺少"归还验收"证据）
   - ✅ 0003 → 成功归档
   - ❌ 0008 → 失败（损耗确认相关问题）
5. 失败条目可点击"进入办理"查看详情与失败原因

---

## 后端拦截规则（绕过页面时触发）

| 拦截场景 | HTTP | 返回示例 |
|---|---|---|
| 错角色（如审核岗调用复核接口）| 403 | `无权操作，需要角色: reviewer` |
| 错状态（已归档再复核）| 400 | `当前状态为【已归档】，复核仅可在待复核/复核驳回状态进行` |
| 错岗位越权（审核主管替登记员提交）| 400 | `仅创建人（登记员）可以提交审核` |
| 旧版本（乐观锁冲突）| 400 | `版本冲突：当前版本v3，提交版本v2，请刷新后重试` |
| 复核缺证据 | 400 | `复核校验失败：缺少"归还验收"证据；注明了损耗但缺少"损耗确认"证据` |
| 令牌缺失/过期 | 401 | `未登录或令牌缺失` |

可使用 `curl` 验证拦截：
```bash
# 使用审核令牌调用复核接口（错角色）
TOKEN=$(curl -s -X POST http://localhost:8004/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"auditor01","password":"123456"}' | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.token')

curl -s -X POST http://localhost:8004/api/orders/1/review \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"decision":"approve"}'
# 预期返回 403，无权操作
```

---

## 目录结构
```
.
├── backend/
│   ├── src/
│   │   ├── app.js              # Koa 入口，端口 8004
│   │   ├── config.js           # 端口、角色、状态枚举
│   │   ├── db.js               # SQLite 连接
│   │   ├── init-db.js          # Schema + 演示数据
│   │   ├── middleware/auth.js  # JWT 认证+角色中间件
│   │   ├── business/rules.js   # 状态流转+证据校验规则
│   │   ├── services/           # auth / order 业务层
│   │   └── routes/             # auth.routes / order.routes
│   └── data/equipment.db       # SQLite 数据文件（自动生成）
├── frontend/
│   ├── vite.config.ts          # Vite + 端口 3004 + /api 代理
│   └── src/app/
│       ├── pages/              # login / queue（队列第一屏）/ order-detail（详情）
│       ├── components/         # header（角色切换）
│       ├── services/           # auth / order
│       ├── interceptors/       # JWT 注入
│       └── guards/             # 登录守卫
└── README.md
```
