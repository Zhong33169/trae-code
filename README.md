# 讲师排课单管理系统

基于 Lit + Vite（前端）和 Python FastAPI + SQLite（后端）的讲师排课单全流程管理系统。

## 功能特点

- **三岗分权**：讲师排课登记员（发起/补正）、讲师排课审核主管（办理）、企业培训公司复核负责人（复核归档）
- **节点时限追踪**：每个流转节点设有时限（小时），超时自动记录，超时处理需填写原因和后续处理记录
- **联动机制**：讲师排期、课件审核、课后评价互相影响排课单状态
- **数据一致性**：列表、详情、批量结果和统计均以后端为准，页面提示与接口返回一致
- **操作审计**：所有状态变更均记录操作日志，含操作人、时间、前后状态和备注

## 快速启动

### 1. 环境要求

- Python 3.9+
- Node.js 18+

### 2. 后端启动

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8005 --reload
```

后端启动后自动初始化 SQLite 数据库（`backend/scheduling.db`）并插入演示数据。

### 3. 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:3005`，API 请求自动代理到后端 `http://localhost:8005`。

### 4. 访问系统

打开浏览器访问 http://localhost:3005

## 演示账号

| 用户名   | 密码       | 岗位                       | 姓名   |
|----------|-----------|----------------------------|--------|
| clerk1   | clerk1    | 讲师排课登记员              | 张登记 |
| supervisor1 | supervisor1 | 讲师排课审核主管         | 李审核 |
| manager1 | manager1  | 企业培训公司复核负责人       | 王复核 |

## 演示数据

系统预置 5 条排课单，覆盖不同状态：

| 排课单号     | 标题                   | 状态           |
|-------------|------------------------|---------------|
| PK-2026-001 | Python高级编程培训      | 待审核         |
| PK-2026-002 | 项目管理实战培训        | 审核中         |
| PK-2026-003 | 数据分析与可视化培训    | 待课件审核     |
| PK-2026-004 | 领导力发展培训          | 待归档         |
| PK-2026-005 | 新员工入职培训          | 已归档         |

## API 接口

后端 API 基础路径: `http://localhost:8005/api`

| 接口                          | 方法   | 说明                  |
|-------------------------------|--------|-----------------------|
| /api/auth/login               | POST   | 用户登录              |
| /api/auth/me                  | GET    | 获取当前用户信息      |
| /api/forms                    | GET    | 排课单列表            |
| /api/forms                    | POST   | 创建排课单            |
| /api/forms/{id}               | GET    | 排课单详情            |
| /api/forms/{id}               | PUT    | 更新排课单            |
| /api/forms/{id}/transition    | POST   | 状态流转              |
| /api/forms/{id}/courseware-review | POST | 课件审核           |
| /api/forms/{id}/evaluation    | POST   | 提交课后评价          |
| /api/forms/{id}/confirm-teaching | POST | 确认授课完成        |
| /api/forms/{id}/timeout-handle | POST  | 超时处理             |
| /api/forms/{id}/schedules     | GET/POST | 讲师排期管理        |
| /api/forms/{id}/logs          | GET    | 操作日志              |
| /api/forms/{id}/timeout-records | GET  | 超时记录              |
| /api/forms/{id}/available-actions | GET | 可用操作           |
| /api/statistics               | GET    | 统计概览              |
| /api/batch/action             | POST   | 批量操作              |
| /api/timeout-records          | GET    | 全部超时记录          |
| /api/node-time-limits         | GET    | 节点时限配置          |

## 状态流转

```
草稿 → 待审核 → 审核中 → 待课件审核 → 课件审核中 → 待授课 → 授课完成 → 待课后评价 → 评价中 → 待归档 → 已归档
         ↑                    ↑                        ↑                    ↑
         └── 驳回 ←───────────┘                        │                    │
                              └──────── 超时处理 ───────┘
```

## 节点时限

| 节点           | 时限（小时） |
|---------------|-------------|
| 待审核         | 48          |
| 审核中         | 24          |
| 待课件审核     | 48          |
| 课件审核中     | 24          |
| 待授课         | 72          |
| 待课后评价     | 48          |
| 评价中         | 24          |
| 待归档         | 48          |

## 项目结构

```
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI 入口
│   │   ├── database.py      # 数据库模型与初始化
│   │   ├── models.py        # Pydantic 模型
│   │   ├── routes.py        # API 路由
│   │   └── helpers.py       # 辅助函数
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.js          # 入口
│   │   ├── services/
│   │   │   └── api.js       # API 封装
│   │   └── components/
│   │       ├── app-login.js         # 登录页
│   │       ├── app-layout.js        # 布局框架
│   │       ├── app-form-list.js     # 排课单列表
│   │       ├── app-form-detail.js   # 排课单详情
│   │       ├── app-form-create.js   # 新建排课单
│   │       ├── app-statistics.js    # 统计概览
│   │       └── app-timeout-records.js # 超时记录
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```
