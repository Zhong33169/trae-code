# 异动申请审批系统

基于 **Go (Echo) + SQLite** 后端 + **Lit + Vite** 前端的完整异动申请审批系统。

## 功能特性

- 🔐 **三角色审批**：人事专员发起 → 薪酬主管处理（预算校验+调薪） → HRBP负责人确认
- ⏱️ **节点超时追踪**：每个处理节点 24 小时时限，自动检测超时，支持记录超时原因与补正动作
- 📊 **一致的状态管理**：列表 / 详情 / 统计 / 批量操作共用同一后端数据源，刷新后一致
- 🔗 **模块联动**：调岗调薪、预算校验、异动登记三模块共同推进申请最终状态（待审核→预算校验中→待确认→审核通过→已同步）
- 📝 **完整处理轨迹**：详情页展示每个节点的处理人、动作、备注、是否超时
- 🎛️ **细粒度权限**：当前角色决定可见字段、按钮与可提交动作，非权限节点只能查看

## 技术栈

| 层级 | 技术 | 端口 |
|------|------|------|
| 前端 | Lit 3 + Vite 5 | 3001 |
| 后端 | Go 1.21 + Echo v4 | 8001 |
| 数据库 | SQLite（本地文件） | - |

## 目录结构

```
trae-code-1/
├── backend/                  # Go 后端
│   ├── db/
│   │   ├── database.go       # 数据库初始化 + 种子数据
│   │   └── schema.sql        # 建表 DDL
│   ├── handlers/             # HTTP 处理器
│   │   ├── auth.go
│   │   ├── application.go
│   │   └── employee.go
│   ├── middleware/           # JWT 认证 + 角色中间件
│   ├── models/               # 数据模型
│   ├── utils/                # JWT、响应封装
│   ├── main.go               # 服务入口
│   └── go.mod
├── frontend/                 # Lit 前端
│   ├── src/
│   │   ├── components/       # 页面组件
│   │   │   ├── login-page.js
│   │   │   ├── application-list.js
│   │   │   ├── application-form.js
│   │   │   ├── application-detail.js
│   │   │   ├── statistics-page.js
│   │   │   └── logs-page.js
│   │   ├── api.js            # 接口封装 + 常量
│   │   ├── app-shell.js      # 布局 + 路由
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 快速启动

### 1. 启动后端（端口 8001）

```bash
cd backend

# 下载依赖
go mod tidy
go mod download

# 运行服务（首次启动会自动建库 + 写入初始数据）
go run .
```

- 数据库文件会自动创建在 `backend/data/transfer.db`
- 服务启动后会打印示例账号

### 2. 启动前端（端口 3001）

另开一个终端：

```bash
cd frontend

# 安装依赖（首次）
npm install

# 启动开发服务器
npm run dev
```

### 3. 访问系统

浏览器打开：**http://localhost:3001**

## 测试账号

| 账号 | 密码 | 角色 | 权限 |
|------|------|------|------|
| `hr01` | `123456` | 人事专员 | 发起申请、异动登记、查看自己发起的申请 |
| `salary01` | `123456` | 薪酬主管 | 预算校验、调薪处理、提交到下一节点 |
| `hrbp01` | `123456` | HRBP负责人 | 最终审核通过/驳回 |

## 业务流程

```
人事专员发起申请
    │
    ▼
┌────────────────────┐   24h超时   ┌──────────────────┐
│ 节点：人事专员     │────────────▶│ 记录超时原因     │
│ 状态：待审核       │             │ 可继续推进       │
└────────────────────┘             └──────────────────┘
    │ 提交
    ▼
┌─────────────────────────────┐
│ 节点：薪酬主管               │
│ 状态：预算校验中             │
│ 可执行：                     │
│   ├─ 预算校验               │
│   ├─ 调薪处理               │
│   └─ 提交到下一节点 / 驳回   │
└─────────────────────────────┘
    │ 提交
    ▼
┌────────────────────┐
│ 节点：HRBP负责人   │
│ 状态：待确认       │
│ 动作：通过 / 驳回  │
└────────────────────┘
    │ 通过
    ▼
┌────────────────────┐
│ 状态：审核通过     │
│ 人事专员执行：     │
│   └─ 异动登记     │
└────────────────────┘
    │ 登记 + 调薪 + 预算 均完成
    ▼
┌────────────────────┐
│ 状态：已同步       │  ◀── 最终状态
└────────────────────┘
```

## 状态定义

| 状态值 | 展示名 | 说明 |
|--------|--------|------|
| `pending_review` | 待审核 | 人事专员刚发起 |
| `budget_checking` | 预算校验中 | 薪酬主管处理中 |
| `pending_confirm` | 待确认 | HRBP负责人确认中 |
| `approved` | 审核通过 | HRBP确认通过，待执行登记 |
| `synced` | 已同步 | 预算、调薪、登记均完成，流程闭环 |
| `rejected` | 已驳回 | 流程终止 |

## 数据一致性说明

所有状态变更均通过后端事务处理：
- 列表、详情、统计页均实时查询同一张 `transfer_applications` 表
- 处理操作会同时写入：申请主表状态、`processing_trails` 处理轨迹、`operation_logs` 操作日志
- 前端每次操作完成后自动刷新数据，刷新页面数量/状态/轨迹/日志完全一致

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录获取 Token |
| GET | `/api/me` | 当前用户信息 |
| GET | `/api/employees` | 员工列表 |
| GET | `/api/applications` | 申请列表（按角色过滤） |
| GET | `/api/applications/:id` | 申请详情（含处理轨迹） |
| POST | `/api/applications` | 人事专员发起申请 |
| POST | `/api/applications/:id/process` | 节点处理（submit/reject/verify_budget/process_salary/register） |
| POST | `/api/applications/batch` | 批量操作 |
| GET | `/api/statistics` | 统计数据 |
| GET | `/api/operation-logs` | 操作日志 |

## 常见问题

**Q: 首次启动数据库如何初始化？**
A: 后端 `go run .` 会自动读取 `db/schema.sql` 建表并写入 3 个测试账号 + 4 个示例员工，无需手动执行 SQL。

**Q: 如何重置数据？**
A: 停止后端，删除 `backend/data/transfer.db`，重新启动后端即可重建。

**Q: 修改超时时间？**
A: 在 `backend/handlers/application.go` 顶部修改 `nodeTimeoutHours` 常量即可。
