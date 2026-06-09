# 三甲医院医务部 - 异常申诉复核会诊申请单系统

一个完整的医院会诊申请单流转管理系统，覆盖从申请登记、审核办理到医务部复核归档的全流程，支持异常申诉处理。

## 技术栈

- **前端**: Astro 4 + React Islands (React 18)
- **后端**: Go + Fiber 框架
- **数据库**: SQLite (本地文件)
- **端口**: 前端 3002，后端 8002

## 项目结构

```
.
├── backend/                 # 后端服务 (Go Fiber)
│   ├── cmd/
│   │   └── main.go         # 入口文件
│   ├── internal/
│   │   ├── config/         # 配置
│   │   ├── models/         # 数据模型 & 数据库
│   │   ├── handlers/       # API 处理器
│   │   ├── middleware/     # 中间件
│   │   └── utils/          # 工具函数
│   ├── data/               # SQLite 数据库文件目录
│   └── go.mod
│
└── frontend/               # 前端应用 (Astro + React)
    ├── src/
    │   ├── pages/          # 页面
    │   ├── components/     # 静态组件 (Astro)
    │   ├── islands/        # 交互组件 (React Islands)
    │   ├── layouts/        # 布局
    │   ├── lib/            # 工具 & API
    │   └── styles/         # 样式
    └── package.json
```

## 快速开始

### 环境要求

- Go 1.22+
- Node.js 18+

### 1. 启动后端服务

```bash
cd backend

# 安装依赖（首次运行）
go mod tidy

# 构建
go build -o consultation-server ./cmd

# 启动（默认端口 8002）
./consultation-server
```

或直接运行：

```bash
cd backend
go run ./cmd
```

**配置端口**:

```bash
# macOS/Linux
PORT=8002 ./consultation-server

# 或修改配置
BACKEND_PORT=8002 ./consultation-server
```

首次启动会自动：
- 创建 SQLite 数据库文件 (`data/consultation.db`)
- 初始化数据库表结构
- 自动写入演示样例数据

### 2. 启动前端服务

```bash
cd frontend

# 安装依赖（首次运行）
npm install

# 启动开发服务器（默认端口 3002）
npm run dev
```

**配置端口**:

```bash
# 使用环境变量
PORT=3002 npm run dev
```

**配置后端 API 地址**:

```bash
PUBLIC_API_BASE=http://localhost:8002/api npm run dev
```

或修改 `astro.config.mjs` 中的 `vite.define` 配置。

### 3. 访问系统

打开浏览器访问：http://localhost:3002

## 角色与用户

系统内置 3 种角色，可在页面右上角切换：

| 角色 | 用户名 | 用户ID | 说明 |
|------|--------|--------|------|
| 会诊申请登记员 | 张登记员 | u001 | 发起、补正申请，提交申诉 |
| 会诊申请登记员 | 李登记员 | u002 | 同上 |
| 会诊申请审核主管 | 王主管 | u003 | 审核申请，退回补正，标记缺证据 |
| 会诊申请审核主管 | 赵主管 | u004 | 同上 |
| 医务部复核负责人 | 陈主任 | u005 | 复核归档，状态冲突判定，处理申诉 |
| 医务部复核负责人 | 刘主任 | u006 | 同上 |

## 业务流程

### 正常流程

```
登记员创建草稿
    ↓
登记员提交申请  (校验：必填证据、版本号、当前处理人)
    ↓
审核主管审核
    ├─ 审核通过 → 医务部复核
    ├─ 退回补正 → 登记员补正重提
    └─ 证据不足 → 登记员补正资料
    ↓
医务部复核
    ├─ 开始复核
    ├─ 复核归档 (完成)
    ├─ 状态冲突
    └─ 复核驳回
```

### 异常申诉流程

```
异常状态 (缺证据/退回补正/状态冲突/驳回)
    ↓
登记员提交申诉
    ↓
医务部复核负责人处理
    ├─ 受理申诉 → 重新核实处理
    └─ 驳回申诉 → 维持原决定
```

## 申请单状态

| 状态 | 说明 |
|------|------|
| 草稿 | 申请单已创建，未提交 |
| 已提交 | 已提交，等待审核 |
| 退回补正 | 资料不全，退回登记员补正 |
| 再次提交 | 补正后重新提交 |
| 缺证据 | 证据材料不充分 |
| 审核通过 | 主管审核通过 |
| 复核中 | 医务部正在复核 |
| 状态冲突 | 患者状态与申请信息不符 |
| 已归档 | 复核完成，归档保存 |
| 已驳回 | 复核不通过 |
| 申诉已提交 | 异常申诉已提交 |
| 申诉已受理 | 申诉已被受理 |
| 申诉已驳回 | 申诉被驳回 |

## 演示样例

系统内置 8 条会诊申请单样例，覆盖各种状态：

| 编号 | 标题 | 状态 | 特点 |
|------|------|------|------|
| c001 | 心内科疑难病例会诊 | 已归档 | 正常通过的完整流程 |
| c002 | 神经内科重症患者多学科会诊 | 退回补正 | 被退回，等待补正 |
| c003 | 呼吸科发热待查患者会诊 | 申诉已提交 | 缺证据 + 异常申诉中 |
| c004 | 骨科术后并发症会诊 | 审核通过 | 经历过补正重提后通过 |
| c005 | 消化科消化道出血急诊会诊 | 复核中 | 急诊病例，正在复核 |
| c006 | 内分泌科糖尿病足会诊 | 草稿 (逾期) | 超期未提交的草稿 |
| c007 | 肾内科尿毒症患者肾移植前评估 | 申诉已受理 | 状态冲突 + 申诉已受理 |
| c008 | 儿科重症肺炎会诊 | 草稿 | 新建草稿 |

## API 接口

基础路径：`http://localhost:8002/api`

**请求头**:
- `X-User-ID`: 用户 ID（如 u001）
- `X-User-Role`: 用户角色（registrar / reviewer / director）

### 统计
- `GET /stats` - 获取统计数据

### 申请单
- `GET /consultations` - 申请单列表
- `GET /consultations/:id` - 申请单详情
- `POST /consultations` - 创建申请单
- `PUT /consultations/:id` - 更新申请单
- `GET /consultations/:id/history` - 处理历史

### 流程处理
- `POST /consultations/:id/submit` - 提交申请
- `POST /consultations/:id/review` - 审核处理
- `POST /consultations/:id/correct` - 补正资料
- `POST /consultations/:id/final-review` - 复核处理
- `POST /consultations/:id/archive` - 归档

### 申诉
- `POST /consultations/:id/appeal` - 提交申诉
- `POST /consultations/:id/appeal/accept` - 受理申诉
- `POST /consultations/:id/appeal/reject` - 驳回申诉

### 字典
- `GET /dict/statuses` - 状态字典
- `GET /dict/roles` - 角色字典
- `GET /users` - 用户列表

## 核心校验规则

每次状态变更时后端都会校验：

1. **处理人校验** - 确认当前用户是否有权限执行该操作
2. **角色校验** - 确认用户角色是否匹配操作要求
3. **状态校验** - 确认当前状态是否允许目标操作
4. **版本校验** - 防止并发修改冲突（乐观锁）
5. **必填证据校验** - 提交和归档时校验必填证据材料

校验不通过时：
- 保留原状态不变
- 返回详细错误信息
- 不写入操作记录（仅错误日志）

## 端口配置

### 后端端口

默认 8002，可通过环境变量修改：

```bash
PORT=8002 go run ./cmd
# 或
BACKEND_PORT=8002 go run ./cmd
```

### 前端端口

默认 3002，可通过环境变量修改：

```bash
PORT=3002 npm run dev
```

### 前端调用后端地址

默认 `http://localhost:8002/api`，可修改：

```bash
PUBLIC_API_BASE=http://localhost:8002/api npm run dev
```

或修改 `frontend/astro.config.mjs` 中的配置。

## 数据重置

如需重置数据，删除数据库文件后重启后端即可：

```bash
cd backend
rm data/consultation.db
./consultation-server
```

重启后会自动重新创建数据库并填充样例数据。
