# 供应链金融平台 - 应收确权管理系统

面向供应链金融业务的应收确权流程管理平台，实现登记员 → 审核主管 → 复核负责人三岗流转，
确保跨班组交接有据可查、状态变更后端为准、三单数据联动一致。

---

## 🎯 核心特性

| 能力 | 说明 |
|------|------|
| **三岗权限隔离** | 登记员 `registrar`、审核主管 `auditor`、复核负责人 `reviewer`，岗位决定可见字段、可用按钮、可提交动作 |
| **交接信息校验** | 状态推进前强制校验：班次 + 交出人 + 接收人 + 确认时间，缺一项即拦；必须说明推进原因或退回原因 |
| **三单联动** | 应收账款、确权登记、回款核销互相影响；确权归档后自动更新应收账款为「已确权」；核销累计金额不能超过确权金额 |
| **数据一致性** | 列表/详情/批量结果/统计/操作日志均以 DB 为准，刷新后数量、状态、金额 100% 对齐 |
| **状态以服务端为准** | 所有状态变更落库后回显，前端仅展示；接口返回明确错误原因，拒绝通用「失败」提示 |

### 岗位 & 功能矩阵

| 能力 | 登记员 | 审核主管 | 复核负责人 |
|------|:---:|:---:|:---:|
| 登录 / 看板 / 日志 | ✅ | ✅ | ✅ |
| 应收账款创建/修改 | ✅ | ❌ | 只读 |
| 确权单创建 / 补正 / 提交 / 批量提交 | ✅ | ❌ | 只读 |
| 确权单审核通过 / 退回 | ❌ | ✅ | ❌ |
| 确权单复核 / 归档 / 退回 | ❌ | ❌ | ✅ |
| 回款核销登记 | ❌ | ❌ | ✅ |

### 确权单状态机

```
  草稿 draft ──提交(交接校验)──▶ 待审核 pending_audit
                                      │
                      退回原因◀───────┴───────▶ 审核通过(交接校验)
                      │                                    │
                      ▼                                    ▼
                  已退回 returned               待复核 pending_review
                      │                                    │
              补正后重新提交                    退回原因◀─┴──────▶ 归档(说明原因)
                      │                                    │
                      └──────────────────────────────────┐│
                                                         ▼▼
                                                    已归档 archived
                                                          │
                                               回款核销(累计金额 ≤ 确权金额)
```

---

## ⚙️ 技术栈

| 层 | 技术 | 端口 |
|----|------|------|
| 前端 | **TanStack Start**（React 18 + TS + Vite 7 + TanStack Router 文件路由 + Nitro SSR + React Query + Tailwind） | **3003** |
| 后端 | Rust Rocket 0.5 + r2d2 连接池 | **8003** |
| 数据库 | SQLite 本地文件 `backend/scf_platform.db` | — |
| 认证 | JWT (jsonwebtoken) + bcrypt 密码哈希 | — |

> 💡 **关于 Start 架构 & SSR 配置**：前端使用真实的 TanStack Start 全栈元框架，完整支持 SSR + 文件路由 + 客户端水合。`@tanstack/router-plugin`（SPA-only 插件）、`index.html` 直挂、`entry-client.tsx` 等 SPA 残留已经全部清理，统一使用 Start 的 `client.tsx` + SSR 启动链路。
>
> **SSR 模式切换（`vite.config.ts` 中 `nitro.ssr` 配置）**：
> - `ssr: false`（**当前默认**）：SPA 模式 + Nitro 构建，纯客户端水合，保留 Start 完整工程化能力
> - `ssr: true`：开启服务端渲染，HTML 在 Nitro Node 服务器首屏直出，后续路由走客户端导航
> - 无论哪种模式，前端开发服务器均运行在 **3003 端口**，`/api` 自动代理到 8003 后端

---

## 🚀 快速启动

### 前置要求
- Rust 1.75+（建议 1.78+）
- **Node.js >= 22.12**（TanStack Start 要求；当前验证：v22.22.3 ✅）
- Python 3（可选，仅用于跑 `test_api.sh`）

### 1️⃣ 启动后端（Rust）

```bash
cd backend

# 首次运行自动执行：建库 → 建表 → 灌演示数据 → 重置密码
cargo run
```

启动成功输出：
```
🚀 Rocket has launched from http://127.0.0.1:8003
```

> 💡 数据库文件：`backend/scf_platform.db`。如需重置，停止服务后 `rm scf_platform.db` 再重新启动即可。

### 2️⃣ 启动前端（另一个终端）

```bash
cd frontend

# 安装依赖（首次）
npm install

# 启动开发服务器（Nitro + SSR + 热更新）
npm run dev
```

启动成功：
```
  VITE v7.x  ready in xxx ms

  ➜  Local:   http://localhost:3003/
```

### 3️⃣ 浏览器访问

打开 **http://localhost:3003** 即可进入登录页。
路由入口由 TanStack Start 自动生成，包括：登录、看板、确权列表/详情、核销表单、日志等。

---

## 🔑 演示账号（密码均为 `123456`）

| 用户名 | 角色 | 账号类型 | 建议测试路径 |
|--------|------|----------|--------------|
| `registrar01` | 应收确权登记员 | 张登记 | 创建确权单 → 提交 → 退回补正 → 重提交 |
| `auditor01` | 应收确权审核主管 | 李审核 | 审核通过 / 退回（需说明原因） |
| `reviewer01` | 平台复核负责人 | 王复核 | 复核 → 归档 / 退回；登记回款核销 |

> 💡 **SQLite 样例入口说明**：后端启动时 `backend/src/db.rs` 中的 `init_db()` → `seed_data()` 自动建表并灌入以下样例数据（仅在空表首次执行）：
>
> **角色 3 条**：`registrar`（应收确权登记员）、`auditor`（审核主管）、`reviewer`（复核负责人）
>
> **用户 3 条**（密码均为 bcrypt 哈希 `123456`）：
> | username | 姓名 | 角色 | 用途 |
> |----------|------|------|------|
> | `registrar01` | 张登记 | 登记员 | 发起 & 补正确权单 |
> | `auditor01` | 李审核 | 审核主管 | 审核通过 / 退回 |
> | `reviewer01` | 王复核 | 复核负责人 | 复核 / 归档 / 核销 |
>
> **应收账款 5 条**（AR2025060001 ~ 0005，覆盖待确权/已确权 2 种状态）：2 条 `confirmed`（AR0001 上海贸易 50 万、AR0004 南京物流 35 万） + 3 条 `pending`（AR0002 北京科技 120 万、AR0003 杭州电商 80 万、AR0005 成都食品 92 万）
>
> **应收确权单 4 条**（覆盖 4 种核心状态，验证权限矩阵 & 交接信息完整链路）：
> | 编号 | AR | 状态 | 当前处理人 | 交接信息 | 测试用途 |
> |------|----|------|----------|----------|----------|
> | CO2025060001 | AR0001 50 万 | `archived` 已归档 | reviewer | ✅ | 已核销、只读权限验证 |
> | CO2025060002 | AR0002 120 万 | `pending_audit` 待审核 | auditor | ✅ 中班交接 | 审核岗通过/退回 |
> | CO2025060003 | AR0004 35 万 | `pending_review` 待复核 | reviewer | ✅ 晚班交接 | 复核岗归档/退回；后续核销测试基准 |
> | CO2025060004 | AR0003 80 万 | `returned` 已退回 | registrar | 退回原因已写 | 补正后重新提交 |
>
> **回款核销 1 条**：PV2025060001（CO0001 已全额核销 50 万），验证金额联动 & 超额拦截基准
>
> **操作日志 4 条**：CO0001 完整链路（创建 → 审核 → 归档），供审计追踪
>
> 删除 `backend/scf_platform.db` 并重启后端即可重置所有样例数据。

---

## 📋 快速验证路径（建议操作手册）

登录 **张登记**（registrar01 / 123456）：
1. 看板：查看各状态确权单数量 → 确认与列表数一致
2. 应收账款 → 点 **AR2025060003** → 详情 → 查看确权历史
3. 应收确权单 → 勾选状态「已退回」**CO2025060004** → 查看详情 → 返回列表 → 勾选 → **批量提交**
   - 填写：班次=早班 / 交出人ID=1 / 接收人ID=2 / 推进原因=已补正
   - ✅ 成功：状态变为「待审核」
   - ❌ 若班次为空：应提示「交接信息不完整：班次不能为空」
4. 点 **新建确权单** → 选一笔应收账款 → 创建草稿 → 提交

登录 **李审核**（auditor01 / 123456）：
1. 进入确权单列表 → 自动过滤待审核 → 点 CO2025060004 详情
2. **审核通过**：交接校验通过 → 状态进入「待复核」
3. 选另一笔 → **退回**：必须说明退回原因（例如"合同附件缺失"）→ 状态回退「已退回」

登录 **王复核**（reviewer01 / 123456）：
1. 复核通过 → **归档** → 说明原因「确权无误，归档」
2. 回款核销 → **新增核销** → 选已归档的确权单 → 填写回款金额
   - 累计金额 > 确权金额 会被拦截
3. 看板 → 确认统计卡片已更新归档数+1、核销金额+回款
4. 操作日志 → 查看上述全流程轨迹（创建→提交→审核→复核→归档→核销）

> 🔍 **一致性核验**：每一步后刷新页面/重新进入列表 → 数量、状态、金额应与后端完全一致。
> 可随时跑 `backend/test_api.sh` 验证后端接口行为。

---

## 🛰️ API 一览（后端 8003/api/*）

### 认证
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/login` | 公开 | 返回 `{token, user}` |
| GET  | `/me`    | 登录 | 当前用户 |

### 应收账款
| 方法 | 路径 | 权限 |
|------|------|------|
| GET | `/ar?page=&page_size=&status=&keyword=` | 登录 |
| GET | `/ar/<id>` | 登录 |
| POST | `/ar` | registrar | 创建 |
| PUT  | `/ar/<id>` | registrar | 修改 |

### 应收确权单
| 方法 | 路径 | 权限 | 校验 |
|------|------|------|------|
| GET | `/orders?page=&page_size=&status=&keyword=&ar_id=` | 登录（按岗位自动过滤） |
| GET | `/orders/<id>` | 登录 |
| POST | `/orders` | registrar | 关联AR未在流程中 |
| POST | `/orders/submit` | registrar | ✅ 交接四项 + 推进原因 |
| POST | `/orders/approve` | auditor | ✅ 交接四项 + 通过原因 + 确权金额 |
| POST | `/orders/reject` | auditor/reviewer | ✅ 退回原因必填 |
| POST | `/orders/review` | reviewer | ✅ 交接四项 + 复核原因 |
| POST | `/orders/archive` | reviewer | ✅ 归档原因必填 |
| POST | `/orders/batch-submit` | registrar | 逐条校验 + 返回每条成功/失败明细 |

### 回款核销
| 方法 | 路径 | 权限 | 校验 |
|------|------|------|------|
| GET | `/verifications?page=&page_size=&ar_id=&order_id=` | 登录 |
| POST | `/verifications` | reviewer | 确权单=已归档 且 累计≤确权金额 |

### 统计与日志
| 方法 | 路径 | 权限 |
|------|------|------|
| GET | `/stats` | 登录 | 看板聚合数据 |
| GET | `/users` | 登录 | 所有账号（供移交人选人） |
| GET | `/logs?page=&page_size=&target_type=&target_id=` | 登录 | 操作审计日志 |

### 统一响应格式

```json
{ "code": 0, "message": "success", "data": { /* ... */ } }
```

| code | 语义 |
|------|------|
| 0 | 成功 |
| 400 | 业务校验失败（含具体原因，不会只写"操作失败"） |
| 403 | 无权限 |
| 404 | 目标不存在 |
| 1001/1002 | 登录异常 |

---

## 📁 项目结构

```
trae-code-3/
├── backend/                          # Rust Rocket 后端
│   ├── Cargo.toml                    # 依赖
│   ├── Rocket.toml                   # 端口=8003 等配置
│   ├── schema.sql                    # 建表 DDL（首次启动执行）
│   ├── src/
│   │   ├── main.rs                   # 启动入口、挂载路由
│   │   ├── db.rs                     # 连接池、建库、初始化演示数据
│   │   ├── models.rs                 # 实体、DTO、状态/权限映射（含 status_name 字段）
│   │   ├── auth.rs                   # JWT 签发/校验 + 请求守卫
│   │   └── handlers.rs               # 业务处理（事务/校验/日志/联动更新）
│   └── test_api.sh                   # 后端接口自检脚本
│
├── frontend/                         # TanStack Start 前端（SSR + 文件路由）
│   ├── vite.config.ts                # Start 插件 + Nitro + 端口 3003 + /api 代理
│   ├── package.json                  # @tanstack/react-start + nitro + vite 7
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── app/
│       ├── client.tsx                # TanStack Start 客户端水合入口（hydrateStart）
│       ├── router.tsx                # createRouter 配置（路由树 + React Query Provider）
│       ├── index.css                 # Tailwind 样式
│       ├── env.d.ts                  # 类型声明
│       ├── routeTree.gen.ts          # 自动生成的路由树（Start 文件路由产物）
│       ├── api/client.ts             # fetch 封装（token/401跳转/统一错误）
│       ├── store/auth.ts             # Zustand 登录态
│       ├── lib/constants.ts          # 状态/动作/角色常量
│       ├── components/
│       │   ├── StatusBadge.tsx       # 状态标签
│       │   └── HandoverModal.tsx     # 交接信息弹窗（必填校验）
│       └── routes/                   # Start 文件路由（与 URL 一一对应）
│           ├── __root.tsx            # 根路由：HTML 文档结构 + createRootRouteWithContext
│           ├── index.tsx             # / → 重定向到 /dashboard
│           ├── login.tsx             # /login（公开路由，SSR 预渲染）
│           ├── _auth.tsx             # 受保护布局（路由守卫+侧边栏）
│           ├── _auth.dashboard.tsx           # 统计看板
│           ├── _auth.accounts-receivable.index.tsx  # AR 列表
│           ├── _auth.accounts-receivable.$id.tsx    # AR 详情
│           ├── _auth.confirmation-orders.index.tsx   # 确权单列表
│           ├── _auth.confirmation-orders.$id.tsx     # 确权单详情（含核销表单）
│           ├── _auth.payment-verifications.index.tsx # 核销列表
│           └── _auth.operation-logs.index.tsx        # 操作日志
│
└── README.md
```

---

## 🧪 后端接口自检

```bash
cd backend
bash test_api.sh
```

覆盖：登录 → 三岗权限验证 → 归档 → 核销 → 联动更新 → 超额拦截 → 操作日志。
所有 12 项测试通过表示后端核心逻辑正常。

---

## 🔐 生产部署注意事项

1. **JWT Secret**：`backend/src/auth.rs` 第7行 `SECRET` 改为长随机字符串
2. **CORS**：`backend/src/main.rs` 的 `AllowedOrigins` 改为真实域名
3. **SQLite**：高并发场景建议换 PostgreSQL，切换只需改 `Cargo.toml` 与连接串
4. **密码哈希轮次**：bcrypt cost 已用 12，生产可升至 14
5. **HTTPS**：生产环境务必启用
6. **TanStack Start 构建**：
   ```bash
   cd frontend
   npm run build        # 产出 .output/（Nitro SSR 部署产物）
   npm run start        # 启动 Node SSR 服务器
   ```

---

## 📝 License

内部演示项目。
