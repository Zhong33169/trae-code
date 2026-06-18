# 病历整改单管理系统

基于 Next.js App Router + Python Starlette + SQLite 的病历质控整改全流程管理系统。

## 功能特性

### 核心业务
- **岗位角色**：科室秘书 → 质控医生 → 医务部主任，三级审批流程
- **状态流转**：待提交 → 已提交 → (已退回 → 重新提交) → 质控已审核 → 整改通知已发送 → 复核通过 → 已归档 → 医务部确认
- **节点时限**：每个节点有明确的处理时限，超时自动标记
- **超时追踪**：超时记录需登记原因和后续处理措施
- **业务联动**：病历质控、整改通知、复核归档数据互相影响整改单状态
- **数据一致性**：列表、详情、统计、批量操作结果统一数据源，刷新后保持一致
- **操作留痕**：所有状态变更完整记录，含操作人、时间、原因、附加数据

### 技术特性
- **后端**：Starlette (ASGI) + SQLAlchemy + Pydantic
- **前端**：Next.js 14 App Router + React 18 + TypeScript + Ant Design
- **数据库**：SQLite 本地存储
- **认证**：JWT Bearer Token，基于角色的权限控制
- **端口**：前端 3001，后端 8001

## 快速开始

### 环境要求
- Python 3.9+
- Node.js 18+

### 1. 启动后端服务

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 初始化数据库（创建表结构、测试用户、样例数据）
python init_db.py

# 启动后端服务
python -m app.main
# 或
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

后端服务地址: http://localhost:8001

健康检查: http://localhost:8001/health

### 2. 启动前端服务

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

前端服务地址: http://localhost:3001

### 3. 访问系统

打开浏览器访问 http://localhost:3001

## 测试账号

| 用户名 | 密码 | 角色 | 科室 |
|--------|------|------|------|
| secretary | 123456 | 科室秘书 | 内科 |
| secretary2 | 123456 | 科室秘书 | 外科 |
| quality | 123456 | 质控医生 | 质控科 |
| director | 123456 | 医务部主任 | 医务部 |

## 系统页面入口

### 1. 整改单列表 (`/`)
- 按角色可见字段控制
- 状态、科室、超时筛选
- 顶部统计卡片：总数、待我处理、已超时、已完成
- 批量操作（同状态整改单）
- 列表、统计数据同源

### 2. 整改单详情 (`/orders/[id]`)
- 基本信息展示
- 节点时间线（含超时标记、原因、处理措施）
- 病历质控、整改通知、复核归档关联数据
- 可操作按钮（根据当前状态和角色动态显示）
- 完整操作日志

### 3. 新建整改单 (`/create`)
- 科室秘书可创建
- 录入患者信息、病历问题、整改要求

### 4. 数据统计 (`/statistics`)
- 总览统计
- 状态分布进度条
- 各科室统计对比
- 超时整改单列表

### 5. 节点超时追踪 (`/overdue`)
- 所有超时节点列表
- 超时时长计算
- 登记超时原因和后续处理
- 一键跳转详情

### 6. 操作日志 (`/logs`)
- 全系统操作记录
- 按操作类型、角色筛选
- 状态变更轨迹
- 附加信息详情查看

## 状态流转规则

| 当前状态 | 允许角色 | 可执行操作 | 目标状态 |
|----------|----------|------------|----------|
| 待提交 | 科室秘书 | 提交整改单 | 已提交 |
| 已提交 | 质控医生 | 质控审核通过<br>退回整改单 | 质控已审核<br>已退回 |
| 已退回 | 科室秘书 | 重新提交 | 重新提交 |
| 重新提交 | 质控医生 | 质控审核通过<br>再次退回 | 质控已审核<br>已退回 |
| 质控已审核 | 质控医生 | 发送整改通知 | 整改通知已发送 |
| 整改通知已发送 | 科室秘书 | 完成整改并申请复核 | 复核通过 |
| 复核通过 | 质控医生 | 复核通过并归档<br>退回重新整改 | 已归档<br>整改通知已发送 |
| 已归档 | 医务部主任 | 医务部确认完成 | 医务部确认 |

## 节点时限配置

| 节点 | 时限 |
|------|------|
| 科室提交 | 24小时 |
| 质控审核 | 48小时 |
| 发送整改通知 | 12小时 |
| 整改处理 | 7天 |
| 复核归档 | 48小时 |
| 医务部确认 | 24小时 |

## API 接口

### 认证接口
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/init` - 初始化数据库

### 整改单接口
- `GET /api/rectification` - 获取列表（含统计）
- `POST /api/rectification` - 创建整改单
- `GET /api/rectification/{id}` - 获取详情
- `PATCH /api/rectification/{id}/status` - 更新状态
- `POST /api/rectification/batch` - 批量操作
- `GET /api/rectification/{id}/overdue` - 检查超时状态

### 关联业务接口
- `POST /api/quality/{id}/quality/submit` - 提交质控
- `POST /api/quality/{id}/notice` - 发送整改通知
- `POST /api/quality/{id}/review` - 复核归档
- `GET /api/quality/{id}/linked` - 获取关联数据

### 统计接口
- `GET /api/statistics/overview` - 总览统计
- `GET /api/statistics/by-department` - 科室统计
- `GET /api/statistics/overdue-report` - 超时报告

### 日志接口
- `GET /api/logs` - 获取操作日志
- `GET /api/logs/order/{id}` - 获取单条整改单日志

## 数据一致性保障

1. **单数据源**：所有页面（列表、详情、统计、批量操作）均调用同一后端接口
2. **事务处理**：状态变更、节点推进、业务关联、日志记录在同一事务中完成
3. **后端为准**：状态流转校验完全在后端进行，前端仅展示后端返回的结果
4. **实时刷新**：操作完成后自动重新拉取数据，确保与后端一致
5. **错误提示**：接口返回具体错误信息，不使用通用失败提示

## 项目结构

```
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # Starlette 应用入口
│   │   ├── config.py            # 配置（角色、状态、时限）
│   │   ├── database.py          # 数据库连接
│   │   ├── models.py            # SQLAlchemy 模型
│   │   ├── schemas.py           # Pydantic 模式
│   │   ├── auth.py              # 认证与权限
│   │   ├── services.py          # 核心业务逻辑（状态流转、超时、联动）
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── auth.py          # 认证接口
│   │       ├── rectification.py # 整改单接口
│   │       ├── quality.py       # 关联业务接口
│   │       ├── statistics.py    # 统计接口
│   │       └── logs.py          # 日志接口
│   ├── init_db.py               # 数据库初始化脚本
│   ├── requirements.txt
│   └── medical_records.db       # SQLite 数据库（自动生成）
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx       # 根布局
    │   │   ├── globals.css
    │   │   ├── login/           # 登录页
    │   │   └── (dashboard)/     # 主应用（受保护路由）
    │   │       ├── layout.tsx   # 主布局（含侧边栏、权限控制）
    │   │       ├── page.tsx     # 整改单列表
    │   │       ├── create/      # 新建整改单
    │   │       ├── orders/[id]/ # 整改单详情
    │   │       ├── statistics/  # 数据统计
    │   │       ├── overdue/     # 超时追踪
    │   │       └── logs/        # 操作日志
    │   ├── types/               # TypeScript 类型定义
    │   ├── services/            # API 封装
    │   └── store/               # 状态管理（Zustand）
    ├── package.json
    ├── tsconfig.json
    └── next.config.js
```

## 数据库表结构

- **users** - 用户表
- **rectification_orders** - 病历整改单主表
- **node_records** - 节点处理记录表
- **operation_logs** - 操作日志表
- **quality_controls** - 病历质控表
- **rectification_notices** - 整改通知表
- **review_archives** - 复核归档表

## 验收检查清单

### 节点超时追踪场景
1. ✅ 列表页显示超时标记
2. ✅ 详情页节点时间线显示超时状态
3. ✅ 超时时操作需填写原因和后续处理
4. ✅ 超时原因和处理措施在节点和日志中留存
5. ✅ 刷新后超时状态、原因保持一致

### 岗位权限控制
1. ✅ 科室秘书仅可见本科室数据
2. ✅ 各角色可见字段不同
3. ✅ 可操作按钮根据角色和状态动态显示
4. ✅ 后端权限校验，前端越权操作返回 403

### 业务联动
1. ✅ 提交质控后更新整改单状态
2. ✅ 发送通知后更新整改单状态
3. ✅ 复核归档后更新整改单状态
4. ✅ 关联数据在详情页集中展示

### 数据一致性
1. ✅ 列表顶部统计与列表数量一致
2. ✅ 批量操作后列表自动刷新
3. ✅ 详情页操作后返回列表数据已更新
4. ✅ 统计页面与列表数据同源
5. ✅ 刷新浏览器后所有数据保持一致

### 状态变更
1. ✅ 状态变更以后端校验为准
2. ✅ 接口返回具体错误信息，非通用失败
3. ✅ 页面提示与接口返回一致
4. ✅ 操作日志完整记录每次状态变更
