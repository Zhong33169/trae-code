# 客服呼叫中心 - 跨班组交接确认工单系统

一个基于 Vue 3 + Rust Poem + SQLite 的客服工单管理系统，支持跨班组交接确认流程。

## 功能特性

- 🔐 **三级岗位权限**：客服坐席 → 质检主管 → 客服经理
- 📋 **工单全生命周期**：来电登记 → 问题派单 → 回访中 → 已关闭
- 🔄 **跨班组交接**：待签收、异常回传、签收完成三种状态
- 📊 **实时统计**：列表、详情、统计数据统一从后端获取
- 📝 **操作留痕**：完整的操作日志和处理轨迹
- ✅ **交接校验**：班次、交出人、接收人、确认时间缺一不可

## 技术栈

| 层级 | 技术 | 端口 |
|------|------|------|
| 前端 | Vue 3 + Vite + Element Plus + Pinia | 3009 |
| 后端 | Rust + Poem + SQLx + OpenAPI | 8009 |
| 数据库 | SQLite | - |

## 目录结构

```
.
├── frontend/          # 前端项目
│   ├── src/
│   │   ├── api/       # API 接口封装
│   │   ├── components/ # 通用组件
│   │   ├── stores/    # Pinia 状态管理
│   │   ├── views/     # 页面组件
│   │   ├── router/    # 路由配置
│   │   └── utils/     # 工具函数
│   └── package.json
├── backend/           # 后端项目
│   ├── src/
│   │   ├── db/        # 数据库连接
│   │   ├── models/    # 数据模型
│   │   ├── handlers/  # 业务逻辑
│   │   ├── routes/    # API 路由
│   │   └── main.rs
│   ├── data/          # SQLite 数据文件（自动创建）
│   └── Cargo.toml
└── README.md
```

## 快速开始

### 前置要求

- Node.js >= 16
- Rust >= 1.70
- Cargo（随 Rust 安装）

### 1. 启动后端

```bash
cd backend

# 首次运行会自动创建数据库和初始化样例数据
cargo run
```

后端服务启动后：
- 服务地址：http://localhost:8009
- Swagger UI：http://localhost:8009/swagger
- 数据库文件：`backend/data/ticket.db`

### 2. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务启动后：
- 访问地址：http://localhost:3009

### 3. 登录系统

使用以下测试账号登录：

| 用户名 | 密码 | 角色 | 班次 |
|--------|------|------|------|
| agent1 | 123456 | 客服坐席 | 早班 |
| agent2 | 123456 | 客服坐席 | 中班 |
| agent3 | 123456 | 客服坐席 | 晚班 |
| qa1 | 123456 | 质检主管 | 早班 |
| qa2 | 123456 | 质检主管 | 中班 |
| cs1 | 123456 | 客服经理 | 早班 |

## 核心流程

### 工单状态流转

```
来电登记(incoming) → 问题派单(dispatched) → 回访中(return_visit) → 已关闭(closed)
                        ↓                         ↑
                    异常回传(exception) ←──────────┘
```

### 交接流程

```
客服坐席 提交交接 → 质检主管 签收/回传 → 客服经理 签收/回传
     ↓                   ↓                    ↓
  待签收(pending)   签收完成(accepted)   签收完成(accepted)
                      异常回传(rejected)   异常回传(rejected)
```

### 角色权限

| 操作 | 客服坐席 | 质检主管 | 客服经理 |
|------|---------|---------|---------|
| 来电登记（创建工单） | ✅ | ❌ | ❌ |
| 问题派单 | ❌ | ✅ | ✅ |
| 开始回访 | ❌ | ✅ | ✅ |
| 回访关闭 | ❌ | ✅ | ✅ |
| 异常回传 | ❌ | ✅ | ✅ |
| 提交交接（给下一级） | ✅（给质检） | ✅（给经理） | ❌ |
| 签收交接 | ❌ | ✅（坐席交来的） | ✅（质检交来的） |
| 查看所有工单 | ❌（仅自己的） | ✅ | ✅ |
| 统计数据 | 仅自己的 | 全部 | 全部 |

### 交接信息校验

提交交接前必须填写以下信息，缺一不可：
- **班次**：早班 / 中班 / 晚班
- **交出人**：当前登录用户（自动填充）
- **接收人**：选择对应岗位的人员
- **确认时间**：提交时间（自动记录）

## 数据一致性保证

1. **状态以后端为准**：所有状态变更都通过后端 API 完成，前端不做本地状态修改
2. **操作后刷新**：每次操作成功后自动重新拉取列表、详情、统计数据
3. **统一数据源**：列表、详情、统计卡片都从同一个后端接口获取数据
4. **操作日志**：所有状态变更和交接操作都会记录操作日志

## API 接口

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |

### 工单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tickets` | 工单列表（分页、筛选） |
| GET | `/api/tickets/:id` | 工单详情 |
| POST | `/api/tickets` | 创建工单（来电登记） |
| PUT | `/api/tickets/:id/status` | 更新工单状态 |

### 交接

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/handover` | 提交交接 |
| POST | `/api/handover/:id/accept` | 签收交接 |
| POST | `/api/handover/:id/reject` | 异常回传 |
| GET | `/api/handover/my` | 我的待签收列表 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/statistics` | 统计数据 |
| GET | `/api/logs` | 操作日志 |
| GET | `/api/users/qa-managers` | 质检主管列表 |
| GET | `/api/users/cs-managers` | 客服经理列表 |

> 💡 完整 API 文档请访问 Swagger UI: http://localhost:8009/swagger

## 数据库表结构

### users - 用户表
- id: 用户ID
- username: 用户名
- password: 密码
- role: 角色（agent/qa_manager/cs_manager）
- name: 姓名
- shift: 班次（morning/afternoon/night）
- created_at: 创建时间

### tickets - 工单表
- id: 工单ID
- title: 标题
- customer_name: 客户姓名
- customer_phone: 客户电话
- description: 问题描述
- status: 状态（incoming/dispatched/return_visit/closed/exception）
- created_by: 创建人ID
- created_at: 创建时间
- updated_at: 更新时间

### handover_records - 交接记录表
- id: 记录ID
- ticket_id: 工单ID
- shift: 班次
- from_user: 交出人ID
- to_user: 接收人ID
- handover_time: 交接时间
- status: 状态（pending/accepted/rejected）
- remark: 备注
- created_at: 创建时间

### operation_logs - 操作日志表
- id: 日志ID
- ticket_id: 工单ID
- user_id: 操作人ID
- action: 操作类型
- detail: 操作详情
- created_at: 操作时间

## 常见问题

### Q: 如何重置数据库？
A: 删除 `backend/data/ticket.db` 文件，重启后端服务即可自动重建。

### Q: 如何添加新用户？
A: 目前需要直接操作数据库，或在 `backend/src/handlers/mod.rs` 的 `init_sample_data` 函数中添加。

### Q: 前端代理不生效？
A: 检查 `frontend/vite.config.js` 中的代理配置，确保后端服务运行在 8009 端口。

## 开发说明

### 后端开发

```bash
cd backend

# 编译检查
cargo check

# 运行
cargo run

# 查看 Swagger 文档
# 浏览器打开 http://localhost:8009/swagger
```

### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

## License

MIT
