# 社区健身房 · 附件缺失补正会员入会单系统

一套可本地演示的会员入会单管理系统，覆盖「会员入会登记 → 附件缺失补正 → 审核主管办理 → 复核负责人归档」完整流程。

## 技术栈

| 层级 | 技术 | 端口 |
| --- | --- | --- |
| 前端 | Nuxt 3 (Vue 3, TypeScript) | **3107** |
| 后端 | Python 3 + Litestar | **8107** |
| 数据库 | SQLite (内置，seed 数据) | - |

前端 API 请求地址指向 `http://localhost:8107/api`，后端已放行 CORS `http://localhost:3107`。

## 启动步骤

### 一、后端 (端口 8107)

```bash
cd backend

# 1. 创建虚拟环境并安装依赖
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. 初始化数据库（每次执行会重置数据，自动生成 seed 样例）
python init_db.py

# 3. 启动服务
python main.py
# 或：uvicorn main:app --host 0.0.0.0 --port 8107 --reload
```

启动成功后访问 <http://localhost:8107/api/health> 应返回 `{"status": "ok", ...}`。

### 二、前端 (端口 3107)

```bash
cd frontend

# 1. 安装依赖
npm install
# 或：pnpm install / yarn install

# 2. 启动开发服务
npm run dev
```

启动成功后访问 <http://localhost:3107>。

## 角色与账号（登录页可选）

| 用户名 | 姓名 | 角色 | 权限 |
| --- | --- | --- | --- |
| `registrar` | 李登记 | **会员入会登记员** | 新建入会单、上传/补正附件、提交审核 |
| `supervisor` | 王审核 | **会员入会审核主管** | 办理审核通过、退回补正（带原因）、驳回申请 |
| `reviewer` | 张复核 | **社区健身房复核负责人** | 复核通过、启用卡权益、归档 |

> 顶部导航栏提供角色切换按钮，切换后权限和可执行操作会实时变化（不是前端隐藏按钮，后端 API 也会校验状态机）。

## Seed 样例入会单（可直接验收）

执行 `python init_db.py` 后自动生成以下入会单，可直接在列表页按状态/异常筛选查看：

| 单号 | 会员 | 状态 | 场景说明 | 验收建议 |
| --- | --- | --- | --- | --- |
| `HY20250601001` | 赵小明 | **已归档** | ✅ 正常单：走完完整流程（草稿→提交→审核通过→复核→归档），4 份附件齐全，合同已确认、卡权益已启用 | 查看详情 → 审计日志时间线 → 验证所有操作留痕 |
| `HY20250601002` | 钱小红 | **附件缺失待补正** | ⚠️ 缺材料单：已上传身份证和照片，健康证明、入会合同缺失被退回补正 | 切换「登记员」→ 补传 2 个附件 → 重新提交 → 切回「审核主管」办理 |
| `HY20250601003` | 孙小刚 | **附件缺失待补正 + 超时** | ⏰ 超时单：超过 7 天未补齐附件，已标记为超时 | 在列表异常筛选「超时未处理」查看；详情可看到超时提醒和审计记录 |
| `HY20250601004` | 李小华 | **已驳回** | ❌ 退回单：首次材料不合格被退回补正，补正后重提仍不合格（身份证模糊、健康证明过期、合同缺失），二次审核被驳回，每条退回原因都有记录 | 查看详情 → 附件区域查看各附件退回原因 → 审计日志查看失败原因 |
| `HY20250601005` | 周小龙 | **待审核** | 📋 新单：登记员已提交，4 份附件齐全，等待审核主管办理 | 切换「审核主管」→ 进入详情 → 可选择审核通过 / 退回补正 / 驳回 |
| `HY20250601006` | 吴小芳 | **审核通过待复核** | 📬 审核通过：审核主管已办理通过并确认合同，等待复核负责人复核归档 | 切换「复核负责人」→ 进入详情 → 复核通过 → 归档（自动启用卡权益） |

## 业务流程

```
[登记员] 创建草稿 → 上传附件(身份证/照片/健康证明/合同) → 提交审核
    ↓
[审核主管] ←─ 待审核 / 补正后重提 ─→
     │                         │
     ├─ 审核通过 ──────────────┼─→ 审核通过待复核（合同自动确认）
     ├─ 退回补正（记录原因） ──┘
     │     ↓ 登记员补齐后
     │   补正后重提（不齐附件不能提交）
     └─ 驳回（永久记录失败原因）
           ↓
[复核负责人]  审核通过待复核
     │
     ├─ 复核通过 ─→ 复核通过待归档
     │     ↓
     └─ 归档（自动启用卡权益）─→ 已归档（流程结束）
```

## 关键特性

### 附件缺失补正
- 每笔入会单默认要求 4 份必需附件：身份证复印件、一寸免冠照片、健康证明、入会合同
- 审核主管可勾选"需补正的附件项"并说明原因，退回后登记员只能看到对应缺失项
- **缺失附件未全部补正时，后端禁止重新提交**（前端按钮置灰 + 后端二次校验）
- 被驳回的附件保留驳回原因（不会在补正后清除历史原因）

### 审计留痕
- 所有操作都进入审计日志：创建、提交、补正重提、审核通过、退回补正、驳回、复核、归档、上传/删除附件、确认合同、启用卡权益、标记超时
- 每条审计记录包含：操作人、操作时间、状态流转（从 X 到 Y）、备注
- 失败/退回操作额外记录 `failure_reason`，详情页时间线以红色高亮展示
- 可随时追溯"是谁、什么时候、为什么没处理成功"

### 角色权限（状态机）

只有匹配角色 + 状态，才能执行对应操作（前端显示 + 后端校验）：

| 操作 | 角色 | 允许的起始状态 |
| --- | --- | --- |
| 新建入会单 / 上传附件 / 提交审核 | 登记员 | draft / materials_missing |
| 审核通过 | 审核主管 | pending_review / resubmitted |
| 退回补正 | 审核主管 | pending_review / resubmitted |
| 驳回申请 | 审核主管 | pending_review / resubmitted |
| 复核通过 | 复核负责人 | approved_review |
| 归档 + 启用卡权益 | 复核负责人 | reviewed |

### 批量结果逐条说明
- 详情页「审计日志」以时间线形式逐条展示每个操作的结果、备注、失败原因
- 退回和驳回记录显示红色高亮的失败原因区块
- 列表页每条入会单展示附件完成度（X/4）、合同状态、卡权益状态、当前状态标签

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/meta` | 获取状态、角色、附件类型枚举 |
| POST | `/api/auth/login` | 登录（body: `{ username }`） |
| GET | `/api/users` | 用户列表 |
| GET | `/api/orders` | 入会单列表，支持 `status` / `is_overdue` / `keyword` 查询 |
| POST | `/api/orders` | 新建入会单 |
| GET | `/api/orders/{id}` | 入会单详情（含附件、必需附件、审计日志） |
| POST | `/api/orders/{id}/submit` | 登记员提交审核 |
| POST | `/api/orders/{id}/approve` | 审核主管办理通过 |
| POST | `/api/orders/{id}/request-supplement` | 审核主管退回补正 |
| POST | `/api/orders/{id}/reject` | 审核主管驳回 |
| POST | `/api/orders/{id}/review` | 复核负责人复核通过 |
| POST | `/api/orders/{id}/archive` | 复核负责人归档（启用卡权益） |
| GET | `/api/orders/{id}/required-attachments` | 必需附件清单 |
| POST | `/api/orders/{id}/attachments` | 上传附件 |
| DELETE | `/api/orders/{id}/attachments/{aid}` | 删除附件 |

## 目录结构

```
backend/
├── main.py              # Litestar 入口，CORS 配置，端口 8107
├── init_db.py           # 数据库初始化 + seed 数据（正常/缺材料/超时/退回/待审核/待复核）
├── requirements.txt
└── app/
    ├── config.py        # 配置（端口、CORS、数据库地址）
    ├── database.py      # SQLAlchemy 引擎与 Session
    ├── models.py        # 数据模型：用户、入会单、附件、必需附件、审计日志
    ├── schemas.py       # Pydantic Schema
    └── routers/
        ├── auth.py       # 登录、用户列表
        ├── orders.py     # 入会单 CRUD + 状态流转
        └── attachments.py # 附件上传/删除/必需附件管理

frontend/
├── nuxt.config.ts       # 端口 3107，API base 指向 8107
├── package.json
├── assets/css/main.css  # 全局样式
├── types/index.ts       # TypeScript 类型定义
├── composables/
│   ├── useAuth.ts       # 登录/角色切换/权限判断
│   └── useOrders.ts     # 入会单 API 封装
├── layouts/
│   └── default.vue      # 顶部导航、角色切换
└── pages/
    ├── login.vue        # 登录页（角色选择）
    ├── index.vue        # 入会单列表 + 筛选 + 新建
    └── orders/[id].vue  # 详情页：附件管理 + 审核操作 + 审计日志
```

## 常见问题

**Q: 重置数据？**
```bash
cd backend && source venv/bin/activate && python init_db.py
```

**Q: 后端端口被占？**
修改 `backend/app/config.py` 的 `backend_port`，并同步修改前端 `frontend/nuxt.config.ts` 的 `runtimeConfig.public.apiBase`。

**Q: 前端端口被占？**
修改 `frontend/nuxt.config.ts` 的 `devServer.port`，并同步修改后端 `backend/app/config.py` 的 `frontend_url`。
