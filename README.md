# 仓储配送中心 - 移动补录校验库存调整单系统

基于 **Solid.js + Vite + Go + Gin + SQLite 实现的库存调整单管理系统，支持移动补录校验、角色权限分离、完整的审批流程。

## 功能特性

- 🔐 **角色权限分离**
  - 库管员：创建、提交、重新提交、补录、批量提交
  - 仓储主管：核验、退回、补录（异常/复核类型）
  - 运营经理：复核、归档、补录

- 📋 **完整的状态流转**
  - 待提交 → 待核验 → 核验通过 → 待复核 → 复核通过 → 已归档
  - 待提交/重新提交 → 已退回 → 重新提交 → 待核验
  - 核验/复核阶段可退回

- ✏️ **移动补录功能**
  - 异常记录（Exception）：记录发现的异常情况
  - 补正记录（Correct）：修正错误信息
  - 复核记录（Review）：复核阶段的补充说明
  - 补录记录独立存储，不修改原记录，可追溯

- 📊 **全状态统计与筛选**
  - 8种状态统计卡片：待提交、已退回、重新提交、待核验、核验通过、待复核、复核通过、已归档
  - 多维度筛选：状态、仓库、关键词搜索
  - 操作后自动刷新统计+列表+详情

- 📎 **证据补充管理**
  - 按角色限制证据类型：登记/补录（库管员）、核验（主管）、复核（经理）
  - 按订单状态限制可补充的证据类型
  - 同名证据重复检测
  - 每次补充写入操作审计日志

- 🛡️ **后端严格校验**
  - 角色越权拦截
  - 状态流转校验
  - 版本号乐观锁
  - 证据完整性校验
  - 版本冲突检测

## 技术栈

### 前端
- Solid.js 1.x
- Vite 5.x
- TypeScript
- 端口：3003

### 后端
- Go 1.21+
- Gin 1.9.x
- GORM 1.25.x
- SQLite
- 端口：8003

## 目录结构

```
.
├── frontend/                          # 前端项目
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginPage.tsx    # 登录页
│   │   │   └── MainLayout.tsx # 主布局
│   │   ├── api/
│   │   │   └── index.ts     # API请求封装
│   │   ├── types/
│   │   │   └── index.ts     # 类型定义
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env
│   └── vite.config.ts
│   └── package.json
├── backend/                       # 后端项目
│   ├── main.go                 # 入口文件
│   ├── models/
│   │   └── models.go         # 数据模型
│   ├── middleware/
│   │   ├── cors.go           # CORS中间件
│   │   └── auth.go           # 认证鉴权中间件
│   ├── services/
│   │   ├── order_service.go  # 订单业务逻辑
│   │   └── user_service.go   # 用户业务逻辑
│   ├── handlers/
│   │   └── handlers.go       # API处理器
│   ├── db/
│   │   └── database.go       # 数据库初始化
│   ├── data/
│   │   └── seed.go         # 演示数据
│   ├── .env
│   └── go.mod
└── README.md
```

## 快速开始

### 1. 环境要求

- Node.js >= 18+
- Go >= 1.21
- SQLite（已内置驱动）

### 2. 初始化后端

```bash
cd backend

# 安装依赖
go mod tidy

# 启动服务（默认端口 8003）
go run main.go
```

首次启动会自动：
- 创建 SQLite 数据库文件 `./data/inventory.db
- 自动建表
- 自动插入演示数据

### 3. 初始化前端

```bash
cd ../frontend

# 安装依赖（如未安装）
npm install

# 启动开发服务器（端口 3003）
npm run dev
```

### 4. 访问系统

打开浏览器访问：http://localhost:3003

## 演示账号

| 用户名 | 密码 | 角色 | 说明
---|---|---|---
keeper01 | 123456 | 库管员 | 张库管，可创建、提交、补录
keeper02 | 123456 | 库管员 | 李库管，可创建、提交、补录
super01 | 123456 | 仓储主管 | 王主管，可核验、退回
manager01 | 123456 | 运营经理 | 赵经理，可复核、归档

## 核心业务流程

### 标准流程：

```
库管员创建调整单
    ↓
待提交（补充证据）
    ↓
提交核验
    ↓
待核验（仓储主管核验）
    ↓ （通过/退回）
核验通过 / 已退回
    ↓ （库管员补录修正后重新提交）
待复核（运营经理复核）
    ↓ （通过/退回）
复核通过
    ↓
归档
```

## 演示数据说明

系统预置了10条库存调整单样例，覆盖各种状态和场景：

| 单号 | 状态 | 创建人 | 说明 | 测试场景
---|---|---|---|---
IA20260601001 | 待提交 | 张库管 | 无登记证据 | **缺证据拦截**：提交时会被拦
IA20260601002 | 待核验 | 张库管 | 有登记证据 | **可核验**：王主管可核验
IA20260601003 | 已退回 | 李库管 | 核验退回，有补录记录 | **错状态**：不能提交核验
IA20260601004 | 重新提交 | 李库管 | 补正后重提，有补录证据 | **旧版本**：版本号为3
IA20260601005 | 待复核 | 张库管 | 核验通过，有登记+核验证据 | **可继续办理**：赵经理可复核
IA20260601006 | 待复核 | 李库管 | 核验通过，有登记+核验证据，缺复核证据 | **缺证据拦截**：复核时会被拦
IA20260601007 | 复核通过 | 张库管 | 复核通过，三类证据齐全 | **可归档**：赵经理可归档
IA20260601008 | 已归档 | 李库管 | 完整流程，有补录+证据 | **错状态**：不能做任何操作
IA20260601009 | 待提交 | 张库管 | 无登记证据 | **缺证据** + **越权测试**：李库管不能上传登记证据
IA20260601010 | 待核验 | 李库管 | 有登记证据 | **可核验**：王主管可核验

### 可演示的问题场景：

1. **证据不足**：单号 IA20260601001、IA20260601009 无登记证据，提交时会提示证据不足
2. **补录记录**：单号 IA20260601003、IA20260601004、IA20260601008 已有补录记录
3. **版本冲突**：使用错误版本号操作会被拦截
4. **角色越权**：
   - 库管员不能核验/复核/归档
   - 主管不能提交/复核/归档
   - 经理不能提交/核验
   - 库管员不能给别人创建的订单上传登记/补录证据
5. **状态错误**：已归档的订单不能操作
6. **重复证据**：同类型同文件名的证据不能重复上传
7. **证据类型越权**：
   - 库管员不能上传核验/复核证据
   - 主管不能上传登记/补录/复核证据
   - 经理不能上传登记/补录/核验证据

## API 接口说明

### 公共接口

- `POST /api/login - 登录
- `GET /api/users` - 获取用户列表
- `GET /api/role-info` - 获取当前角色信息
- `GET /api/statistics` - 获取统计数据

### 订单接口

- `GET /api/orders` - 获取订单列表
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders/submit` - 提交订单（库管员）
- `POST /api/orders/resubmit` - 重新提交（库管员）
- `POST /api/orders/verify` - 核验（仓储主管）
- `POST /api/orders/review` - 复核（运营经理）
- `POST /api/orders/archive` - 归档（运营经理）
- `POST /api/orders/supplement` - 补录（所有角色，按角色限制）
- `POST /api/orders/evidence` - 补充证据（所有角色，按角色+状态限制类型）
- `POST /api/orders/batch-submit` - 批量提交（库管员）

### 请求头

所有需要认证的接口必须携带：

```
X-User-ID: 用户ID
X-User-Role: 角色（warehouse_keeper/warehouse_supervisor/operation_manager）
X-User-Name: 真实姓名
X-Username: 用户名
```

### 绕过页面直接调用 API 测试场景

#### 1. 错角色测试：

```bash
# 用库管员角色调用核验接口（应该被拦截）
curl -X POST http://localhost:8003/api/orders/verify \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 1" \
  -H "X-User-Role: warehouse_keeper" \
  -H "X-User-Name: 张库管" \
  -H "X-Username: keeper01" \
  -d '{"order_id": 2, "version": 1, "pass": true}'
```

返回：
```json
{
  "code": 403,
  "message": "权限不足，无法执行此操作",
  "details": "当前角色: warehouse_keeper，需要角色: warehouse_supervisor"
}
```

#### 2. 旧版本测试：

```bash
curl -X POST http://localhost:8003/api/orders/submit \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 1" \
  -H "X-User-Role: warehouse_keeper" \
  -H "X-User-Name: 张库管" \
  -H "X-Username: keeper01" \
  -d '{"order_id": 1, "version": 999}'
```

返回：
```json
{
  "code": 400,
  "message": "提交失败",
  "details": "版本冲突，当前版本: 1，您的版本: 999，请刷新后重试"
}
```

#### 3. 缺证据测试（提交无证据的订单：

```bash
# 先创建一个没有证据的订单，然后提交
```

返回：
```json
{
  "code": 400,
  "message": "提交失败",
  "details": "缺少登记阶段的证据材料，请上传至少1份证据后再提交"
}
```

#### 4. 错状态测试（对已归档订单提交）：

```bash
curl -X POST http://localhost:8003/api/orders/submit \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 1" \
  -H "X-User-Role: warehouse_keeper" \
  -H "X-User-Name: 张库管" \
  -H "X-Username: keeper01" \
  -d '{"order_id": 8, "version": 3}'
```

返回：
```json
{
  "code": 400,
  "message": "提交失败",
  "details": "当前状态[archived]不允许提交操作，仅待提交、已退回、重新提交状态可以提交"
}
```

#### 5. 证据越权测试（库管员上传核验证据）：

```bash
curl -X POST http://localhost:8003/api/orders/evidence \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 1" \
  -H "X-User-Role: warehouse_keeper" \
  -H "X-User-Name: 张库管" \
  -H "X-Username: keeper01" \
  -d '{"order_id": 2, "type": "verify", "file_name": "越权证据.pdf", "remark": "测试越权"}'
```

返回：
```json
{
  "code": 400,
  "message": "补充证据失败",
  "details": "核验证据只能由仓储主管上传，当前角色: 库管员"
}
```

#### 6. 证据创建人越权测试（李库管给张库管的订单传登记证据）：

```bash
curl -X POST http://localhost:8003/api/orders/evidence \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 2" \
  -H "X-User-Role: warehouse_keeper" \
  -H "X-User-Name: 李库管" \
  -H "X-Username: keeper02" \
  -d '{"order_id": 1, "type": "register", "file_name": "越权证据.pdf"}'
```

返回：
```json
{
  "code": 400,
  "message": "补充证据失败",
  "details": "登记证据只能由订单创建人上传"
}
```

#### 7. 证据状态不匹配测试（待核验状态上传登记证据）：

```bash
curl -X POST http://localhost:8003/api/orders/evidence \
  -H "Content-Type: application/json" \
  -H "X-User-ID: 1" \
  -H "X-User-Role: warehouse_keeper" \
  -H "X-User-Name: 张库管" \
  -H "X-Username: keeper01" \
  -d '{"order_id": 2, "type": "register", "file_name": "状态不匹配.pdf"}'
```

返回：
```json
{
  "code": 400,
  "message": "补充证据失败",
  "details": "当前状态为待核验，不能上传登记证据（仅待提交状态可上传）"
}
```

## 后端拦截逻辑

### 角色权限拦截：
- 提交/重提/批量提交：仅库管员
- 核验：仅仓储主管
- 复核/归档：仅运营经理
- 库管员只能操作自己创建的订单

### 状态流转拦截：
- 提交：待提交/已退回/重新提交 → 待核验
- 核验通过：待核验 → 待复核
- 核验退回：待核验 → 已退回
- 复核通过：待复核 → 复核通过
- 复核退回：待复核 → 已退回
- 重新提交：已退回 → 重新提交 → 待核验
- 归档：复核通过 → 已归档

### 版本校验：
- 每次操作版本号+1
- 提交时校验版本号匹配
- 防止并发修改冲突

### 证据校验：
- 提交前必须有至少1份登记证据
- 核验通过前必须有核验证据
- 复核通过前必须有复核证据

### 证据补充校验：
- **角色限制**：
  - 登记/补录证据：仅库管员（且是订单创建人）
  - 核验证据：仅仓储主管
  - 复核证据：仅运营经理
- **状态限制**：
  - 登记证据：仅待提交状态
  - 补录证据：仅已退回状态
  - 核验证据：待核验 / 补正重提状态
  - 复核证据：仅待复核状态
- **重复检测**：同订单同类型同文件名的证据不能重复上传
- **归档限制**：已归档订单不能补充证据
- 每次补充证据写入操作审计日志

### 补录校验：
- 已归档订单不能补录
- 库管员只能补录自己创建的订单
- 仓储主管只能补录异常/复核类型
- 补正类型只能在已退回状态

## 开发说明

### 数据库表结构

- `users` - 用户表
- `inventory_adjust_orders` - 库存调整单
- `order_evidences` - 证据表
- `supplement_records` - 补录记录表
- `operation_logs` - 操作日志表

### 补录记录特点

- 补录记录与原记录分离存储
- 记录补录人、时间、类型、内容、原因
- 记录字段修改前后对比
- 完整可追溯，不覆盖原数据

## 常见问题

### 1. 如何重置演示数据？

删除 `backend/data/inventory.db` 文件，重启后端服务即可。

### 2. 前端请求后端跨域问题？

后端已配置 CORS，允许 `http://localhost:3003`，如需修改请编辑 `backend/.env`。

### 3. 如何修改端口？

- 前端：修改 `frontend/vite.config.ts` 和 `frontend/.env`
- 后端：修改 `backend/.env`

## License

MIT
