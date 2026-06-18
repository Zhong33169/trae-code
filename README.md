# 交易核查单管理系统

证券营业部交易核查单全流程演示系统：登记 → 过程核验 → 复核归档。

- 前端：SvelteKit（端口 3002）
- 后端：NestJS + SQLite（端口 8002）
- 数据库：本地 SQLite 文件 `backend/data/deviation.db`

---

## 一、角色与流转

| 角色 | 权限 |
| --- | --- |
| 理财顾问 (FINANCIAL_ADVISOR) | 登记核查单、补正材料 |
| 合规专员 (COMPLIANCE_OFFICER) | 核验材料、提交复核、退回补正 |
| 营业部经理 (BRANCH_MANAGER) | 复核确认办结 / 驳回 |

状态流转：
```
已登记(REGISTERED) → 待补正(PENDING_CORRECTION) → 已登记 → 复核中(REVIEWING) → 办结(COMPLETED)
                        ↑                                          ↓
                        └──────── 退回补正 ───────────────────────┘
                        └──────── 驳回复核 ───────────────────────┘
```

## 二、风险分级

| 风险 | 队列优先级 | 必填证据 |
| --- | --- | --- |
| 高 HIGH | 100 | 客户身份证明、交易授权书、风险揭示书、资金来源证明 |
| 中 MEDIUM | 50 | 客户身份证明、交易授权书、风险揭示书 |
| 低 LOW | 10 | 客户身份证明、交易授权书 |

## 三、启动说明

### 0. 端口和 API 配置（环境变量联动）

前后端端口均支持通过 `.env` 文件配置，默认值：前端 3002，后端 8002。

**后端**（backend/.env）：
```
PORT=8002
DB_PATH=./data/deviation.db
```

**前端**（frontend/.env）：
```
VITE_PORT=3002
VITE_BACKEND_PORT=8002
VITE_API_BASE_URL=/api
```

> 修改端口后需重启前后端服务。前端 Vite 代理会自动联动后端端口。

### 1. 初始化后端（建库 + 种子数据）

```bash
cd backend
npm install
cp .env.example .env     # 如无 .env 文件请复制模板
npm run seed             # 创建 SQLite 库并插入演示数据
npm start                # 启动 NestJS 服务，默认端口 8002
```

如需改端口：直接修改 `backend/.env` 中的 PORT。

### 2. 初始化前端

```bash
cd frontend
npm install
cp .env.example .env     # 如无 .env 文件请复制模板
npm run dev              # 启动 SvelteKit 开发服务，默认端口 3002
```

如需改端口：直接修改 `frontend/.env` 中的 VITE_PORT（前端）和 VITE_BACKEND_PORT（后端代理目标）。

### 3. 访问

打开浏览器访问：`http://localhost:3002`

右上角可切换当前登录身份（理财顾问/合规专员/营业部经理）。

---

## 四、演示样例说明（共 6 笔）

执行 `npm run seed` 后生成以下核查单，覆盖常见业务场景：

| 单号 | 客户 | 风险 | 状态 | 说明 |
| --- | --- | --- | --- | --- |
| TR-20250615-1001 | 陈建国 | 高 | **办结** | 正常流程样例：登记→核验通过→复核通过→办结 |
| TR-20250616-1002 | 刘美丽 | 中 | **复核中** | 退回补正后重新提交，正等待营业部经理确认 |
| TR-20250617-1003 | 周大海 | 高 | **待补正（逾期）** | 缺少资金来源证明、融资融券风险揭示书，已过截止日 |
| TR-20250618-1004 | 吴小芳 | 低 | **已登记（缺证据）** | 仅上传身份证明，缺少交易授权书 |
| TR-20250614-1005 | 孙国华 | 中 | **已登记（状态冲突+逾期）** | 柜台系统时间不一致，补正后待重新核验 |
| TR-20250618-1006 | 钱志强 | 高 | **已登记** | 高风险期权业务首次登记，材料齐全 |

演示用户（均在种子数据中）：
- 张伟（理财顾问）
- 李娜（理财顾问）
- 王强（合规专员）
- 赵敏（营业部经理）

---

## 五、后端校验（提交时严格执行）

每一次状态变更提交，后端都会校验并保留原状态（写记录但不变更单据）：

1. **当前处理人**：`operator_id` 必须等于单据 `current_handler_id` 或对应角色
2. **角色匹配**：动作必须与 `operator_role` 一致（例：只有合规专员能"提交复核"）
3. **状态合法**：仅允许合法的状态迁移路径
4. **版本冲突**：请求参数 `expected_version` 必须等于单据 `version`，防止并发覆盖
5. **必填证据**：根据风险等级校验证据材料完整性

**登记接口额外校验（失败不生成无效单）**：
- 必须由理财顾问角色发起（其他角色 403 拒绝）
- 按风险等级校验必填证据完整性（缺失返回 400，不写入任何数据）
- 使用事务保护：`trade_reviews` 和 `review_records` 要么同时成功，要么同时回滚

校验不通过时：
- 原单据状态不变（登记接口：完全不写入）
- 处理接口：写入一条操作记录（含失败原因），前端可在"操作记录"时间线查看

---

## 六、目录结构

```
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   ├── database.service.ts
│   │   │   └── seed.ts
│   │   └── review/
│   │       ├── review.module.ts
│   │       ├── review.controller.ts
│   │       ├── review.service.ts
│   │       ├── review.dto.ts
│   │       └── review.types.ts
│   ├── data/                     # SQLite 文件目录
│   ├── package.json
│   ├── tsconfig.json
│   └── nest-cli.json
├── frontend/
│   ├── src/
│   │   ├── app.html
│   │   ├── app.d.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── types.ts
│   │   └── routes/
│   │       ├── +layout.svelte
│   │       ├── +page.svelte           # 核查队列（统计+列表+筛选）
│   │       ├── register/+page.svelte  # 登记页
│   │       └── review/[id]/+page.svelte  # 详情页（操作+时间线）
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.js
│   └── tsconfig.json
└── README.md
```

---

## 七、API 速览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/reviews/users | 获取所有用户 |
| GET | /api/reviews/statistics | 统计数字 |
| GET | /api/reviews?status=&risk_level=&current_role=&handler_id=&keyword= | 列表（按优先级倒序，逾期置顶） |
| GET | /api/reviews/:id | 详情（含操作记录） |
| POST | /api/reviews/register | 理财顾问登记 |
| POST | /api/reviews/submit-review | 合规专员核验通过 |
| POST | /api/reviews/request-correction | 合规专员退回补正 |
| POST | /api/reviews/correct | 理财顾问补正提交 |
| POST | /api/reviews/confirm-complete | 营业部经理确认办结 |
| POST | /api/reviews/reject-review | 营业部经理驳回 |

所有处理接口请求体：
```json
{
  "review_id": "...",
  "operator_id": "...",
  "operator_role": "COMPLIANCE_OFFICER",
  "expected_version": 3,
  "opinion": "...",
  "result": "...",
  "evidence": ["客户身份证明", "交易授权书"]
}
```
