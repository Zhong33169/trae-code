# 软件外包项目发布管理系统

软件外包项目组发布流程管理系统，支持发布申请、审核、复核、发布、回滚、复盘、归档全流程，以及换班交接和操作追踪。

## 技术栈

- **前端**: Angular 17 + Vite (application builder)
- **后端**: Python FastAPI
- **数据库**: SQLite
- **认证**: JWT

## 项目结构

```
trae-code-2/
├── backend/              # 后端 FastAPI 项目
│   ├── main.py           # 主入口
│   ├── database.py       # 数据库连接配置
│   ├── models.py         # SQLAlchemy 数据模型
│   ├── schemas.py        # Pydantic 数据结构
│   ├── auth.py           # 认证与权限
│   ├── crud.py           # 数据库操作
│   ├── init_db.py        # 初始化数据库脚本
│   ├── requirements.txt  # Python 依赖
│   └── routers/          # API 路由
│       ├── auth.py
│       ├── release_applications.py
│       ├── rollback_plans.py
│       ├── post_launch_reviews.py
│       ├── shift_handovers.py
│       └── common.py
└── frontend/             # 前端 Angular 项目
    ├── src/
    │   ├── app/
    │   │   ├── pages/    # 页面组件
    │   │   ├── services/ # 服务
    │   │   ├── guards/   # 路由守卫
    │   │   └── models/   # 类型定义
    │   └── main.ts
    ├── package.json
    ├── angular.json
    └── tsconfig.json
```

## 快速启动

### 1. 启动后端服务

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 初始化数据库（创建表、样例数据和账号）
python init_db.py

# 启动服务 (端口 8002)
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

后端 API 文档: http://localhost:8002/docs

### 2. 启动前端服务

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器 (端口 3002)
npm start
```

前端访问地址: http://localhost:3002

## 角色与权限

系统包含三种角色，不同角色可见字段、按钮和可执行操作不同：

| 角色 | 用户名 | 密码 | 主要职责 |
|------|--------|------|----------|
| 发布登记员 | registrar1 / registrar2 | 123456 | 发起发布申请、补正修改、提交审核 |
| 发布审核主管 | supervisor1 / supervisor2 | 123456 | 审核发布申请、提交复核、管理回滚预案 |
| 复核负责人 | reviewer1 / reviewer2 | 123456 | 复核发布申请、发布版本、回滚、复盘、归档 |

## 业务流程

### 发布申请状态流转

```
草稿 → 待审核 → 审核通过 → 待复核 → 复核通过 → 已发布 → 已复盘 → 已归档
         ↓         ↓         ↓         ↓         ↓
     审核驳回  审核驳回  复核驳回  复核驳回  已回滚 → 已归档
```

### 核心功能

1. **发布申请管理**
   - 发布登记员创建/编辑/补正申请
   - 支持批量提交审核
   - 按状态、项目、关键词筛选

2. **三级审批流程**
   - 登记员提交 → 主管审核 → 复核负责人复核

3. **回滚预案**
   - 与发布申请关联
   - 可审核，影响发布决策
   - 触发条件、回滚步骤、负责人、预计时长

4. **上线复盘**
   - 发布后创建复盘
   - 完成复盘后状态变为"已复盘"
   - 记录问题和改进措施

5. **换班交接**
   - 记录交出人、接收人、班次（白班/夜班）
   - 交接内容和确认状态
   - 发布申请详情页可查看交接历史

6. **操作记录**
   - 全链路操作追踪
   - 状态变更留痕
   - 操作人、时间、详情完整记录

7. **数据统计**
   - 各状态数量统计
   - 按项目分布
   - 按创建人分布
   - 列表、详情、统计数据一致（均来自后端）

## API 接口

### 认证
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户

### 发布申请
- `GET /api/release-applications` - 列表（支持分页、筛选）
- `GET /api/release-applications/{id}` - 详情
- `POST /api/release-applications` - 创建
- `PUT /api/release-applications/{id}` - 更新
- `POST /api/release-applications/{id}/submit-review` - 提交审核
- `POST /api/release-applications/{id}/review-approve` - 审核通过
- `POST /api/release-applications/{id}/review-reject` - 审核驳回
- `POST /api/release-applications/{id}/submit-recheck` - 提交复核
- `POST /api/release-applications/{id}/recheck-approve` - 复核通过
- `POST /api/release-applications/{id}/recheck-reject` - 复核驳回
- `POST /api/release-applications/{id}/publish` - 发布
- `POST /api/release-applications/{id}/rollback` - 回滚
- `POST /api/release-applications/{id}/archive` - 归档
- `POST /api/release-applications/batch` - 批量操作

### 回滚预案
- `GET /api/rollback-plans/{app_id}` - 获取回滚预案
- `POST /api/rollback-plans` - 创建
- `PUT /api/rollback-plans/{id}` - 更新
- `POST /api/rollback-plans/{id}/approve` - 审核通过

### 上线复盘
- `GET /api/post-launch-reviews/{app_id}` - 获取复盘
- `POST /api/post-launch-reviews` - 创建
- `PUT /api/post-launch-reviews/{id}` - 更新
- `POST /api/post-launch-reviews/{id}/complete` - 完成复盘

### 换班交接
- `GET /api/shift-handovers` - 列表
- `POST /api/shift-handovers` - 发起交接
- `POST /api/shift-handovers/{id}/confirm` - 确认交接

### 通用
- `GET /api/statistics` - 统计数据
- `GET /api/operation-logs` - 操作日志
- `GET /api/users` - 用户列表
- `GET /api/health` - 健康检查

## 数据一致性说明

- 所有状态变更以**后端**为准，前端仅展示
- 列表、详情、统计数据均从后端实时获取
- 操作完成后自动刷新，确保数据一致
- 刷新页面后列表数量、详情状态、统计和操作记录保持一致
- 操作失败时显示后端返回的具体错误信息，而非通用失败提示

## 端口说明

- 前端: 3002
- 后端: 8002
