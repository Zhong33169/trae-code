# 中医馆 - 批量变更复核处方流转单系统

基于 Go + Chi + SQLite 后端、Fresh (Deno) 前端的处方流转单批量变更复核管理系统。

## 技术栈

- **后端**: Go 1.26 + Chi v5 + SQLite (modernc.org/sqlite 纯 Go 驱动)
- **前端**: Fresh 1.7 (Deno) + Preact + Twind (Tailwind CSS)
- **数据库**: SQLite (本地文件)

## 项目结构

```
├── backend/                    # Go 后端
│   ├── cmd/
│   │   └── main.go            # 程序入口
│   ├── internal/
│   │   ├── db/                 # 数据库初始化与种子数据
│   │   ├── model/              # 数据模型
│   │   ├── service/            # 业务逻辑
│   │   ├── handler/            # HTTP 处理器
│   │   ├── middleware/         # 中间件 (CORS, 认证)
│   │   └── util/               # 工具函数
│   ├── data/                   # SQLite 数据库文件目录
│   └── go.mod
│
├── frontend/                   # Fresh 前端
│   ├── routes/                 # 页面路由
│   ├── islands/                # 交互组件 (客户端 JS)
│   ├── components/             # 静态组件
│   ├── utils/                  # 工具函数 (API, 认证, 类型)
│   ├── deno.json
│   └── fresh.config.ts
│
└── README.md
```

## 快速开始

### 前置要求

- Go 1.26+
- Deno 2.8+
- SQLite 3 (系统自带)

### 后端启动

```bash
cd backend

# 构建
go build -o server ./cmd/

# 运行 (首次启动自动建表并注入演示数据)
./server

# 或直接运行
go run ./cmd/
```

后端服务地址: `http://localhost:8004`

数据库文件: `backend/data/app.db`

### 前端启动

```bash
cd frontend

# 开发模式 (热更新)
deno task start

# 生产构建
deno task build

# 预览生产构建
deno task preview
```

前端服务地址: `http://localhost:3004`

## 演示账号

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| reception | 123456 | 接诊助理 | 登记处方流转单 |
| physician | 123456 | 坐诊医师 | 核验处方流转单 |
| pharmacy | 123456 | 药房管理员 | 复核归档处方流转单 |

## 核心功能

### 1. 处方流转单队列 (首页)

- 以流转单列表为主视图，支持状态筛选、关键词搜索、分页
- 右侧关键证据面板，实时显示选中流转单的登记、核验、复核归档证据
- 多选批量操作，支持同一阶段混合状态批量处理
- 顶部显示当前登录用户及角色

### 2. 流转单详情

- 完整展示处方流转单基本信息
- 证据时间线，记录每一步操作的操作员、操作时间、证据内容
- 办理操作区：根据当前用户角色和流转单状态显示对应操作按钮
- 操作需填写证据内容 (evidence_content)

### 3. 批量操作

- 批量登记 / 批量核验 / 批量复核归档
- 自动生成批次号格式: `BATCH-YYYYMMDDHHMMSS-XXX`
- 部分成功部分失败，失败项保留错误原因
- 失败重试：仅重试失败的项目
- 批量操作列表与详情查看

### 4. 审计日志

- 记录所有操作行为
- 包含操作人、角色、动作、目标、新旧值、IP 地址

### 5. 角色权限控制

| 操作 | 接诊助理 | 坐诊医师 | 药房管理员 |
|------|---------|---------|-----------|
| 登记 | ✅ | ❌ | ❌ |
| 核验 | ❌ | ✅ | ❌ |
| 复核归档 | ❌ | ❌ | ✅ |
| 查看列表 | ✅ | ✅ | ✅ |
| 查看详情 | ✅ | ✅ | ✅ |
| 查看证据 | ✅ | ✅ | ✅ |
| 批量操作 | 仅批量登记 | 仅批量核验 | 仅批量复核 |

## 状态流转

```
草稿 (draft)
  ↓
待登记 (pending_registration)
  ↓  [接诊助理 · 登记]
待核验 (pending_verification)
  ↓  [坐诊医师 · 核验]
待复核 (pending_review)
  ↓  [药房管理员 · 复核归档]
已归档 (archived)
```

兼容状态:
- 登记操作可处理: `draft`, `pending_registration`
- 核验操作可处理: `registered`, `pending_verification`
- 复核操作可处理: `verified`, `pending_review`

## 后端校验规则

所有接口都有严格的后端校验，绕过前端直接调用 API 也会被拦截：

| 校验类型 | HTTP 状态码 | 错误信息 |
|---------|------------|---------|
| 角色权限不足 | 403 | 无权限执行此操作 |
| 状态不匹配 | 400 | 当前状态不允许此操作 |
| 版本冲突 (乐观锁) | 409 | 数据已被修改，请刷新后重试 |
| 缺少操作证据 | 400 | 操作证据不能为空 |
| 记录不存在 | 404 | 记录不存在 |
| 未授权访问 | 401 | 未授权访问 / 无效的token |

### 乐观锁机制

每次更新操作需要携带当前 `version` 字段。如果版本不匹配，返回 409 冲突错误。每次成功更新后 `version` 自增 1。

### 测试校验场景

直接通过 curl 调用 API 测试校验：

```bash
# 1. 获取 token (接诊助理)
TOKEN=$(curl -s -X POST http://localhost:8004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"reception","password":"123456"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. 错角色测试 (接诊助理尝试核验)
curl -X PUT http://localhost:8004/api/transfers/1/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":1,"evidence_content":"test"}'
# 返回 403: 无权限执行此操作

# 3. 缺证据测试
curl -X PUT http://localhost:8004/api/transfers/1/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":1,"evidence_content":""}'
# 返回 400: 操作证据不能为空

# 4. 版本冲突测试 (用旧 version 提交)
curl -X PUT http://localhost:8004/api/transfers/1/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":0,"evidence_content":"test"}'
# 返回 409: 数据已被修改，请刷新后重试

# 5. 错状态测试 (已归档的单子再登记)
curl -X PUT http://localhost:8004/api/transfers/7/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version":3,"evidence_content":"test"}'
# 返回 400: 当前状态不允许此操作
```

## API 接口

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户信息 |

### 处方流转单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/transfers` | 列表 (支持 status, keyword, page, page_size) |
| GET | `/api/transfers/:id` | 详情 |
| POST | `/api/transfers` | 创建草稿 |
| PUT | `/api/transfers/:id/register` | 登记 |
| PUT | `/api/transfers/:id/verify` | 核验 |
| PUT | `/api/transfers/:id/review` | 复核归档 |
| GET | `/api/transfers/:id/evidences` | 证据列表 |

### 批量操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batch/register` | 批量登记 |
| POST | `/api/batch/verify` | 批量核验 |
| POST | `/api/batch/review` | 批量复核归档 |
| GET | `/api/batch/:batch_no` | 批次详情 (含成功/失败明细) |
| POST | `/api/batch/:batch_no/retry` | 失败重试 |
| GET | `/api/batch` | 批量操作列表 |

### 审计日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/audit` | 审计日志列表 |

## 演示数据说明

首次启动后端时自动注入 10 条处方流转单，覆盖各种状态：

| ID | 患者 | 状态 | 说明 |
|----|------|------|------|
| 1 | 张三 | draft | 草稿，缺少登记证据 |
| 2 | 李四 | pending_registration | 待登记，可登记测试 |
| 3 | 王五 | registered | 已登记，可核验测试 |
| 4 | 赵六 | pending_verification | 待核验，可核验测试 |
| 5 | 钱七 | verified | 已核验，可复核测试 |
| 6 | 孙八 | pending_review | 待复核，可复核测试 |
| 7 | 周九 | archived | 已归档，完整证据链 |
| 8 | 吴十 | draft | 草稿 |
| 9 | 郑十一 | registered | 已登记 |
| 10 | 冯十二 | pending_verification | 待核验 |

另有 1 条批量操作记录 (含成功/失败项) 和 10 条审计日志。

## 重置数据

删除数据库文件后重启后端即可重置：

```bash
rm backend/data/app.db
cd backend && go run ./cmd/
```
