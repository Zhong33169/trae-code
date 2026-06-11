# 城市公交公司 - 跨班组交接确认发车计划系统

> 专门针对城市公交公司发车计划跨班组交接确认流程定制，非泛用待办系统。岗位按发车登记员 → 发车审核主管 → 城市公交公司复核负责人 三级流转。

---

## 一、技术栈

| 层 | 技术 | 端口 |
|---|---|---|
| 前端 | Astro 4 + React Islands (React 18) | **3002** |
| 后端 | Node.js + Koa 2 | **8002** |
| 数据库 | 本地 SQLite (better-sqlite3) | - |

---

## 二、目录结构

```
.
├── backend/                 # 后端 Koa 服务
│   ├── data/                # SQLite 数据库文件目录（运行后自动生成）
│   ├── src/
│   │   ├── app.js           # Koa 入口
│   │   ├── config/          # 端口、JWT、角色/状态常量
│   │   ├── db/              # SQLite 连接
│   │   ├── middleware/      # 认证 & 角色权限中间件
│   │   ├── routes/          # API 路由
│   │   │   ├── auth.js      # 登录/登出/当前用户
│   │   │   ├── schedules.js # 发车计划 CRUD + 状态流转
│   │   │   └── common.js    # 统计、操作日志、用户列表
│   │   ├── scripts/
│   │   │   └── initDB.js    # 建表 + 初始用户脚本
│   │   └── utils/           # 操作日志记录、状态/角色文字映射
│   └── package.json
│
└── frontend/                # 前端 Astro 项目
    ├── src/
    │   ├── layouts/         # Astro 布局
    │   ├── pages/           # 页面（Astro + client:load 激活 React Islands）
    │   │   ├── login.astro
    │   │   ├── index.astro           # 发车计划列表
    │   │   ├── detail/[id].astro     # 发车计划详情（操作页）
    │   │   ├── statistics.astro      # 统计概览
    │   │   └── logs.astro            # 操作记录
    │   ├── components/      # React Islands 组件
    │   ├── styles/global.css
    │   └── utils/           # API 封装、状态格式化
    ├── astro.config.mjs
    └── package.json
```

---

## 三、启动步骤

### 1. 启动后端（端口 8002）

```bash
cd backend
npm install            # 首次安装依赖
npm run init-db        # 初始化数据库 & 建表 & 创建初始账号（可重复执行，幂等）
npm start              # 启动服务 http://localhost:8002
```

> `npm run init-db` 只需首次执行或想重置数据库时执行。数据库文件位于 `backend/data/bus_schedule.db`。

### 2. 启动前端（端口 3002）

```bash
cd frontend
npm install            # 首次安装依赖
npm run dev            # 启动服务 http://localhost:3002
```

### 3. 访问入口

打开浏览器访问 **http://localhost:3002** 自动跳转登录页。

---

## 四、测试账号（密码均为 `123456`）

| 用户名 | 岗位角色 | 真实姓名 | 权限说明 |
|---|---|---|---|
| `registrar1` | **发车登记员** | 张登记 | 新建/编辑/补正/删除草稿、提交审核 |
| `registrar2` | **发车登记员** | 李登记 | 同上 |
| `auditor1`   | **发车审核主管** | 王审核 | 审核发车计划（通过→待复核 / 退回→审核退回） |
| `reviewer1`  | **城市公交公司复核负责人** | 赵复核 | 最终复核（通过→归档 / 退回→复核退回） |

---

## 五、核心业务流程

```
草稿 (draft)
  │  发车登记员 提交审核 + 交接信息校验
  ▼
待审核 (pending_audit)
  │  发车审核主管 办理
  ├─ 通过 → 待复核 (pending_review)
  └─ 退回 → 审核退回 (audit_rejected)  → 登记员补正后可再提交
                    │
                    ▼
              待复核 (pending_review)
                │  城市公交公司复核负责人 办理
                ├─ 通过 → 已归档 (archived)  ✅ 流程结束
                └─ 退回 → 复核退回 (review_rejected) → 登记员补正后可再提交
```

### 交接信息强校验（**进入下一步前必拦**）

发车计划在 **提交审核**、**审核通过**、**复核通过** 三个节点都会校验：
- 班次编号（shift_no）
- 交出人（handover_person）
- 接收人（receiver_person）
- 确认时间（confirm_time）

四项缺任意一项都会返回明确错误提示，**状态不会变更**。后端校验为准，前端仅做友好提示。

---

## 六、岗位可见性与按钮权限

| 操作 | 发车登记员 | 发车审核主管 | 复核负责人 |
|---|:---:|:---:|:---:|
| 查看所有人的计划 | 仅自己 | ✅ | ✅ |
| 新建发车计划 | ✅ | ❌ | ❌ |
| 编辑草稿 | ✅(自己的) | ❌ | ❌ |
| 补正（审核/复核退回后） | ✅(自己的) | ❌ | ❌ |
| 删除草稿 | ✅(自己的) | ❌ | ❌ |
| 提交审核 | ✅(自己的) | ❌ | ❌ |
| 办理审核 | ❌ | ✅ | ❌ |
| 复核归档 | ❌ | ❌ | ✅ |

> 所有状态变更均以后端返回为准，前端收到成功响应后才刷新列表/详情/统计，保证刷新后一致。

---

## 七、数据一致性保证

- **单源状态**：所有页面（列表、详情、统计、操作记录）均从后端同一 `bus_schedules.status` 字段读取，刷新后数据完全一致。
- **操作日志**：每次创建、编辑、补正、提交、审核、复核、删除均写入 `operation_logs` 表，记录操作人、时间、动作、前后状态。
- **审核记录**：审核/复核意见单独存 `audit_records`，可追溯。
- **后端状态机**：状态流转合法性由后端判断，非法状态跳转返回具体错误信息（非通用失败）。

---

## 八、API 快速参考

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录，返回 token + 用户信息 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 当前用户信息 |
| GET | `/api/schedules` | 列表（分页+状态筛选+关键词） |
| GET | `/api/schedules/:id` | 详情（含交接信息、审核记录、操作日志） |
| POST | `/api/schedules` | 新建（草稿） |
| PUT | `/api/schedules/:id` | 编辑 / 补正 |
| POST | `/api/schedules/:id/submit` | 提交审核（校验交接信息） |
| POST | `/api/schedules/:id/audit` | 审核（pass/reject + 意见） |
| POST | `/api/schedules/:id/review` | 复核（pass/reject + 意见） |
| DELETE | `/api/schedules/:id` | 删除（仅草稿状态） |
| GET | `/api/statistics` | 统计概览 |
| GET | `/api/operation-logs` | 操作记录（分页） |

所有需要登录的接口需在 Header 携带 `Authorization: Bearer <token>`。
