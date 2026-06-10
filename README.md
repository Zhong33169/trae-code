# 长租公寓节点超时追踪租约申请系统

面向长租公寓真实业务办理场景，覆盖 **租客签约 → 租约审核 → 房态确认 → 入住交接 → 复核归档** 全流程的租约申请管理系统。

系统强调：**流程连续可处理、岗位权限决定可见内容、状态变更后端驱动、列表/详情/统计/操作记录完全联动一致、节点超时必须留痕**。

---

## 技术栈

| 层级 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 5 + React Router 6 |
| 后端 | Go 1.22 + Gin + GORM |
| 数据库 | SQLite（本地文件，零配置） |
| 认证 | JWT Token + 角色权限中间件 |
| 其他 | bcrypt 密码加密、uuid 申请号生成 |

---

## 目录结构

```
.
├── backend/                    # 后端 Go 项目
│   ├── cmd/server/main.go      # 入口
│   ├── internal/
│   │   ├── models/models.go    # 数据模型 & 常量定义
│   │   ├── database/database.go # 数据库初始化 & 种子数据 & 工具函数
│   │   ├── middleware/auth.go  # JWT 认证 & 角色中间件
│   │   └── handlers/           # API 处理器
│   │       ├── auth.go         # 登录/登出/用户信息
│   │       ├── application.go  # 租约申请 CRUD & 状态流转
│   │       ├── attachment.go   # 附件上传下载删除
│   │       └── stats.go        # 统计 & 操作日志
│   ├── data/                   # SQLite 数据文件 & 上传目录（运行时生成）
│   └── go.mod
├── frontend/                   # 前端 React 项目
│   ├── src/
│   │   ├── api/index.ts        # API 封装
│   │   ├── contexts/           # AuthContext / ToastContext
│   │   ├── components/         # Layout / Common 通用组件
│   │   ├── pages/              # 各业务页面
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx   # 工作台
│   │   │   ├── ApplicationList.tsx   # 列表
│   │   │   ├── ApplicationForm.tsx   # 新建/编辑
│   │   │   ├── ApplicationDetail.tsx # 详情（核心操作页）
│   │   │   └── Statistics.tsx        # 统计分析
│   │   ├── types/index.ts      # TypeScript 类型定义
│   │   └── styles/global.css   # 全局样式（含组件样式）
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

---

## 快速启动

### 0. 前置要求

- **Go** ≥ 1.22
- **Node.js** ≥ 18 + **npm** / **pnpm** / **yarn**
- macOS / Linux / Windows 均可（SQLite 跨平台）

### 1. 启动后端

```bash
cd backend

# 安装依赖
go mod tidy

# 设置端口（可选，默认 8000/4321）
export BACKEND_PORT=8000
export FRONTEND_PORT=4321

# 运行
BACKEND_PORT=8000 FRONTEND_PORT=4321 go run ./cmd/server
# 或编译：
# go build -o server ./cmd/server && BACKEND_PORT=8000 FRONTEND_PORT=4321 ./server
```

**首次启动自动完成：**
- ✅ 创建 `backend/data/app.db` SQLite 数据库文件
- ✅ 自动建表（User / LeaseApplication / Attachment / NodeTimeline / OperationLog）
- ✅ 自动种子 3 个测试账号
- ✅ 自动种子 5 条样例租约申请（覆盖各阶段状态）
- ✅ 自动生成 `backend/data/uploads/` 附件上传目录

健康检查：访问 `http://localhost:8000/health`

### 2. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动（Vite 会自动通过环境变量配置代理到后端）
BACKEND_PORT=8000 FRONTEND_PORT=4321 npm run dev
```

访问：`http://localhost:4321`

> 💡 **两服务端口均通过环境变量配置，修改一处即可联动**

### 3. 一键启动（推荐）

项目根目录下分别开两个终端：

```bash
# 终端 1（后端）
cd backend && BACKEND_PORT=8000 FRONTEND_PORT=4321 go run ./cmd/server

# 终端 2（前端）
cd frontend && BACKEND_PORT=8000 FRONTEND_PORT=4321 npm run dev
```

---

## 测试账号（默认密码统一 `123456`）

登录页提供 **"快速登录"** 按钮，一键切换角色体验。

| 账号 | 角色 | 角色名 | 权限与职责 |
|---|---|---|---|
| `registrar1` | registrar | **租约登记员** | 发起租约申请、编辑草稿、补正退回材料、提交至审核；管理本账号创建的申请 |
| `auditor1` | auditor | **租约审核主管** | 审核（通过/退回/拒绝）、房态确认、入住交接；查看所有申请 |
| `reviewer1` | reviewer | **长租公寓复核负责人** | 入住交接、复核归档；查看所有申请、超时记录；全局统计 |

---

## 样例数据入口

系统自动内置 5 条样例租约申请，覆盖各处理阶段，登录后在 **租约申请列表** 可直接看到：

| 编号前缀 | 状态 | 当前节点 | 体验什么 |
|---|---|---|---|
| ZYxxxxxx001 | 待审核 | 租约审核 | `auditor1` 去执行审核操作（通过/退回/拒绝） |
| ZYxxxxxx002 | 已退回 | 租约审核 | `registrar1` 点击 **编辑补正** → 重新提交 |
| ZYxxxxxx003 | 草稿 | 租客签约 | `registrar1` 去编辑信息、补充材料、提交 |
| ZYxxxxxx004 | 待房态确认 | 房态确认 | `auditor1` 去确认房态、流转下一节点 |
| ZYxxxxxx005 | 已完成 | 复核归档 | 查看完整的全流程时间线、操作记录、节点处理人 |

**全流程体验路径：**
1. `registrar1` 登录 → 新建申请 → 保存或提交
2. `auditor1` 登录 → 审核通过 → 房态确认 → 入住交接
3. `reviewer1` 登录 → 复核归档（流程完成）
4. 切换回 `registrar1`，列表数量、详情状态、统计数字、操作记录全部刷新一致

---

## 核心业务说明

### 🔁 状态流转（后端驱动，前端只读状态 + 按钮可见性）

```
draft(草稿) ──提交──► pending_review(待审核)
                        │
                ┌───────┼────────┐
                ▼       ▼        ▼
            returned reviewed(审核通过) rejected
              (退回)      │       (拒绝-终止)
                │         ▼
                └──► pending_confirm(待房态确认)
                            │
                            ▼
                    room_confirmed → pending_handover
                      (内部)        (待入住交接)
                            │
                            ▼
                    pending_handover → room_confirmed
                                          │
                                          ▼
                                   completed(完成归档)
```

每次状态变更：
1. **写入数据库**（LeaseApplication.status / currentNode）
2. **更新节点时间线**（NodeTimeline.status / handler / endTime）
3. **记录操作日志**（OperationLog，含旧/新状态、操作人、详情）
4. 三者在同一个请求内完成，**刷新后完全一致**

### ⏱️ 节点时限与超时追踪

系统内置 5 个节点时限（可通过 `/api/node-limits` 查询）：

| 节点 | 时限（小时） | 处理角色 |
|---|---|---|
| 租客签约 | 24 | 租约登记员 |
| 租约审核 | 48 | 租约审核主管 |
| 房态确认 | 24 | 租约审核主管 |
| 入住交接 | 48 | 审核主管 / 复核负责人 |
| 复核归档 | 72 | 复核负责人 |

- 每个申请创建时，所有节点的 **开始时间 / 截止时间 / 时限** 立即写入时间线
- **超时记录必须留痕**：推进任何已超时申请时，需填写 **"超时原因"** 与 **"后续处理措施"**，两者一并记入节点时间线 + 申请主表 + 操作日志
- 列表/详情/统计页均可见 **⚠️ 已超时** 红色徽标，详情页可见完整超时说明

### 👁️ 角色可见性（字段 / 按钮 / 动作）

| 功能 | 租约登记员 (registrar) | 审核主管 (auditor) | 复核负责人 (reviewer) |
|---|---|---|---|
| **可见申请** | 仅本人创建 | 全部 | 全部 |
| **发起申请** | ✅ | ❌ | ❌ |
| **编辑草稿/退回** | ✅ 本人的 | ❌ | ❌ |
| **提交审核** | ✅ | ❌ | ❌ |
| **审核（通过/退回/拒绝）** | ❌ | ✅ | ❌ |
| **房态确认** | ❌ | ✅ | ❌ |
| **入住交接** | ❌ | ✅ | ✅ |
| **复核归档** | ❌ | ❌ | ✅ |
| **记录超时** | ✅ | ✅ | ✅ |
| **上传附件** | ✅ 本人申请 | ✅ | ✅ |
| **全局统计/日志** | 仅本人维度 | 全局 | 全局 |

### 📄 详情页（不是只读展示，而是操作中枢）

详情页是系统的 **核心操作入口**，结构如下：

```
┌─ 顶部：申请号 + 状态徽标 + 节点徽标 + 超时徽标 + 编辑按钮
├─ 退回说明 / 拒绝说明 / 超时说明（高亮卡片）
├─ 5 节点进度流程图（带状态颜色/时限/日期）
├─ ⚡ 当前操作区（左右两栏）
│    ├─ 左：已完成节点的处理结果（审核人/时间/意见、房态确认、交接说明等）
│    └─ 右：根据角色 + 当前状态动态出现的动作按钮（提交/审核/确认/交接/归档/记录超时/刷新）
├─ 👤 租客信息 + 🏠 房屋租赁信息（完整字段）
├─ 📎 附件区：上传（按分类）+ 下载 + 删除（权限控制）
├─ 📅 节点进度时间线：每节点带时限/开始/截止/处理人/超时信息
└─ 📜 操作日志：完整的全流程追溯表（可滚动，含状态变更记录）
```

> ✅ 所有操作完成后 **页面立即自动刷新详情**，确保用户看到的状态、按钮、进度图、日志、附件完全同步后端。

### 🔗 列表 · 详情 · 统计 · 操作记录 四者一致性

所有数字均直接来自后端 SQL 聚合查询 **（非前端计算）**：

- **列表 count**：`SELECT COUNT(*) FROM lease_applications WHERE ...`
- **详情状态**：直接读主表 `status` 字段 + 关联节点
- **统计数字**：`GROUP BY status / current_node / apartment_name` + `SUM(monthly_rent)`
- **操作日志**：`operation_logs` 表，每次状态变更必然写入

→ 刷新任何页面，数字、状态、记录 **100% 一致**，不会出现前端改了后端没变的错觉。

### ⚠️ 错误提示（不是通用失败，而是业务上下文）

接口返回均为：
```json
{ "code": 400, "message": "当前状态为【已完成归档】，只有草稿或已退回状态可以提交审核" }
```

前端 Toast 直接显示该业务级错误文案，用户可立即理解为什么不能操作。

---

## API 概览（供二次开发）

所有接口除登录外均需 Header：`Authorization: Bearer <token>`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/login` | 登录（返回 JWT） |
| GET | `/api/me` | 当前用户信息 |
| GET | `/api/applications` | 租约申请列表（分页+过滤） |
| GET | `/api/applications/:id` | 详情（含附件/节点时间线/操作日志） |
| POST | `/api/applications` | 租约登记员：创建申请 |
| PUT | `/api/applications/:id` | 租约登记员：修改草稿/退回 |
| POST | `/api/applications/:id/submit` | 租约登记员：提交审核 |
| POST | `/api/applications/:id/review` | 审核主管：审核（approve/return/reject） |
| POST | `/api/applications/:id/room-confirm` | 审核主管：房态确认 |
| POST | `/api/applications/:id/handover` | 审核主管/复核负责人：入住交接 |
| POST | `/api/applications/:id/archive` | 复核负责人：归档 |
| POST | `/api/applications/:id/overdue-record` | 全部角色：记录超时原因+后续措施 |
| POST | `/api/applications/batch-status` | 批量查多条申请的状态 |
| POST | `/api/attachments/upload` | 上传附件（multipart，含 applicationId / category） |
| GET | `/api/attachments/download/:name` | 下载附件 |
| DELETE | `/api/attachments/:id` | 删除附件 |
| GET | `/api/stats/overview` | 统计总览（工作台/统计页共用） |
| GET | `/api/stats/logs` | 操作日志（分页+按申请过滤） |
| GET | `/api/node-limits` | 节点时限配置（公开） |
| GET | `/health` | 健康检查 |

---

## 数据重置

如需完全重置（清空所有业务数据，保留测试账号）：
```bash
# 停止后端后删除数据库文件
rm -rf backend/data/app.db backend/data/uploads/*
# 重启后端，自动重新建库 + 重新种子样例
```

仅重置样例申请、保留账号：可直接删除 `lease_application` 相关表记录后重启。

---

## 端口速查

| 服务 | 默认端口 | 环境变量 |
|---|---|---|
| 前端 Vite Dev Server | **4321** | `FRONTEND_PORT` |
| 后端 Gin HTTP Server | **8000** | `BACKEND_PORT` |

两环境变量前后端项目 **均需一致**。例如要改用 5173/3000：
```bash
# 后端
BACKEND_PORT=3000 FRONTEND_PORT=5173 go run ./cmd/server
# 前端
BACKEND_PORT=3000 FRONTEND_PORT=5173 npm run dev
```
