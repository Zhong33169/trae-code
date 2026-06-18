# 外贸订单管理系统

围绕外贸公司外贸订单全流程的管理系统：**外贸业务员发起 → 单证主管处理 → 业务经理确认**，三岗分离、流程不可跳过。

## 技术栈

| 层 | 技术 | 端口 |
|----|------|------|
| 前端 | Nuxt 3 + Vue 3 + Pinia + @nuxt/ui | **3005** |
| 后端 | Python 3.11+ / Django 5 / Django Ninja / SQLite | **8005** |
| 数据 | 本地 SQLite (`backend/db.sqlite3`) | - |

## 目录结构

```
.
├── backend/                  # Django + Ninja 后端
│   ├── manage.py
│   ├── trade_system/         # Django 项目配置
│   ├── trade_order/          # 订单业务 App
│   │   ├── models.py         # 数据模型
│   │   ├── api.py            # Ninja API 路由（含所有权限/乐观锁/证据校验）
│   │   ├── schemas.py
│   │   └── management/commands/seed_demo_data.py   # 初始化样例数据
│   └── requirements.txt
└── frontend/                 # Nuxt 3 前端
    ├── pages/
    │   ├── index.vue         # 第一屏：订单队列 + 侧边证据栏 + 批量操作
    │   └── orders/[id].vue   # 订单详情办理页
    ├── stores/app.ts         # Pinia Store + API 调用封装
    ├── components/
    ├── types/
    └── nuxt.config.ts        # 配置端口 3005
```

## 快速开始

### 0. 环境要求

- Python 3.11+
- Node.js 18+
- npm / pnpm

### 1. 启动后端（端口 8005）

```bash
cd backend

# 1. 安装依赖
python3 -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. 初始化数据库（自动建表 + 样例数据）
python manage.py migrate
python manage.py seed_demo_data

# 3. 启动服务
python manage.py runserver 0.0.0.0:8005
```

后端 API 文档：http://localhost:8005/api/docs

### 2. 启动前端（端口 3005）

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
```

访问：http://localhost:3005

### 3. CORS

后端已通过 `django-cors-headers` 放行 `http://localhost:3005`（设置 `CORS_ALLOW_ALL_ORIGINS = True`），
前端请求地址在 `nuxt.config.ts` 的 `runtimeConfig.public.apiBase` 中配置为 `http://localhost:8005/api`。

## 演示账号

所有账号密码统一为 `123456`：

| 用户名 | 角色 | 显示名 | 说明 |
|--------|------|--------|------|
| `sales01` | 外贸业务员 | 张伟 | 创建订单、上传证据、提交单证 |
| `sales02` | 外贸业务员 | 李娜 | 同上，用于测试"只能操作自己订单" |
| `doc01` | 单证主管 | 王芳 | 复核单证、通过/退回补正/标记异常 |
| `manager01` | 业务经理 | 刘强 | 最终确认、通过/退回补正/标记异常 |

在页面右上角可随时切换角色，**所有操作的权限校验都在后端完成**，前端切换仅模拟不同角色登录。

## 核心流程

```
┌─────────────────────────────────────────────────────────────────┐
│  [草稿 draft]                    ← 业务员创建                    │
│         │                                                        │
│         ▼  (业务员: 上传3类证据 → 提交)                           │
│  [待单证处理 pending_doc]                                          │
│         │                                                        │
│   ┌─────┼──────┬──────────┐                                      │
│   ▼     ▼      ▼          ▼                                      │
│ 通过   退回   标记异常    (单证主管)                               │
│   │     │      │                                                 │
│   ▼     ▼      ▼                                                 │
│ [待经理  [待业  [单证                                              │
│  确认]   务员  异常]                                              │
│   │     补正]                                                     │
│   │      ▲                                                       │
│   │      │  (业务员补正后重新提交)                                 │
│   │      │                                                       │
│   └──────┘                                                       │
│         │                                                        │
│         ▼  (经理确认)                                             │
│   ┌─────┼──────┬──────────┐                                      │
│   ▼     ▼      ▼          ▼                                      │
│ 完成   退回   标记异常    (业务经理)                               │
│   │     │      │                                                 │
│   ▼     ▼      ▼                                                 │
│ [完成]  [待单  [确认                                              │
│         证补  异常]                                               │
│          正] ▲                                                   │
│              │  (单证补正后重新提交)                               │
│              └───────────── 回到待经理确认                        │
└─────────────────────────────────────────────────────────────────┘
```

**严格规则（后端拦截）：**

1. **三岗分离**：业务员只能在草稿/待补正状态操作自己创建的订单；单证主管只能在单证阶段操作；经理只能在确认阶段操作。后一个岗位不能替前一个岗位补流程。
2. **证据齐全**：提交单证和经理最终确认时，必须具备 **客户询盘 / 报价确认 / 订单签订** 三类证据。
3. **乐观锁**：每次更新必须携带正确的 `version`，版本冲突时后端返回 `409 VERSION_CONFLICT`。
4. **退回/异常必须说明**：标记异常或退回时，`remark` 字段必填。

## 批量变更复核

在订单列表勾选多条订单（可混选正常/异常/缺证据/错状态的混合样本），点击"批量操作"：

- 业务员：批量提交单证处理
- 单证主管：批量复核通过 / 退回补正 / 标记异常 / 提交经理确认
- 业务经理：批量确认通过 / 退回补正 / 标记异常

**执行结果逐条展示**：每条订单显示 `成功 / 失败 / 需重试`，以及 `错误码` + `具体原因`。
常见的错误码：

| 错误码 | 含义 |
|--------|------|
| `ROLE_MISMATCH` | 请求头 x-role 与用户实际角色不符 |
| `PERMISSION_DENIED` | 当前角色无权限执行该操作 |
| `NOT_OWNER` | 不是该订单的创建业务员 |
| `INVALID_STATUS` | 订单当前状态不允许该操作 |
| `INVALID_STATUS_FOR_EDIT` | 当前状态不允许编辑 |
| `VERSION_CONFLICT` | 乐观锁版本冲突 |
| `MISSING_EVIDENCE` | 缺少必要证据（返回具体缺哪几类） |
| `REMARK_REQUIRED` | 退回/异常必须填写备注 |
| `ORDER_NOT_FOUND` | 订单不存在 |
| `ORDER_NO_EXISTS` | 订单号重复 |
| `MISSING_USER` / `INVALID_USER` | 请求未带用户或用户不存在 |

## 样例订单说明

初始化脚本会创建 10 条覆盖典型问题的样例订单：

| 订单号 | 状态 | 证据 | 说明 / 可测试点 |
|--------|------|------|----------------|
| PO202506180001 | 草稿 | 无 | 正常刚创建草稿 |
| PO202506180002 | 草稿 | 仅询盘 | **缺证据**：提交时会被拦截 MISSING_EVIDENCE |
| PO202506180003 | 待单证处理 | 齐全 | **正常**：单证可正常复核通过 |
| PO202506180004 | 待单证处理 | 缺合同 | **错状态 + 缺证据**：单证阶段但证据不完整，批量提交经理时会触发 RETRY |
| PO202506180005 | 待业务员补正 | 齐全 | **补正场景**：业务员补正后可重新提交 |
| PO202506180006 | 单证异常 | 齐全 | **异常场景**：已被标记，不可直接通过 |
| PO202506180007 | 待经理确认 | 齐全 | **正常**：经理可直接确认完成 |
| PO202506180008 | 待单证补正 | 齐全 | **补正场景**：单证主管重新补正提交 |
| PO202506180009 | 确认异常 | 齐全 | **异常场景**：利润率异常，经理需复核 |
| PO202506180010 | 已完成 | 齐全 | 流程已完成的订单 |

**测试技巧**：在批量操作中把正常订单、缺证据订单、错状态订单、已异常订单混选，观察每条独立的结果。

## 绕过页面直接调 API 时的后端拦截示例

所有接口通过 HTTP Header `x-user-id` + `x-role` 识别用户和角色。尝试以下场景：

```bash
# 例1：错角色 —— 用 sales 身份尝试确认经理订单
curl -X POST http://localhost:8005/api/orders/7/confirm-approve \
  -H "x-user-id: 1" -H "x-role: sales" \
  -H "Content-Type: application/json" -d '{"version":1}'
# => 403 {"code":"PERMISSION_DENIED","message":"当前角色(外贸业务员)无权限..."}

# 例2：旧版本（乐观锁）
curl -X POST http://localhost:8005/api/orders/3/submit-to-doc \
  -H "x-user-id: 1" -H "x-role: sales" \
  -H "Content-Type: application/json" -d '{"version":999}'
# => 409 {"code":"VERSION_CONFLICT","message":"版本冲突：当前版本为N，你提供的版本为999..."}

# 例3：缺证据
curl -X POST http://localhost:8005/api/orders/2/submit-to-doc \
  -H "x-user-id: 1" -H "x-role: sales" \
  -H "Content-Type: application/json" -d '{"version":1}'
# => 400 {"code":"MISSING_EVIDENCE","message":"缺少必要证据：报价确认、订单签订..."}

# 例4：错状态
curl -X POST http://localhost:8005/api/orders/10/confirm-approve \
  -H "x-user-id: 4" -H "x-role: biz_manager" \
  -H "Content-Type: application/json" -d '{"version":1}'
# => 400 {"code":"INVALID_STATUS","message":"当前状态(已完成)不允许经理确认"}
```

## 页面功能

- **第一屏 (首页 `/`)**
  - 左侧：订单队列（表格、筛选、搜索、分页、多选）
  - 右侧：当前选中订单的三类证据列表（询盘/报价/合同）、缺失标识、上传与删除、异常说明展示
  - 批量操作弹窗：选择动作 → 展示所选订单状态 → 执行 → **逐条结果（成功/失败/需重试 + 错误码 + 原因）**
  - 最近批处理记录展示

- **订单详情页 (`/orders/:id`)**
  - 订单基本信息 + 编辑（仅业务员在允许状态下）
  - 三类证据卡片 + 上传/删除
  - 办理操作区：根据当前角色和订单状态展示对应按钮，自动校验前置条件
  - 流程进度条（四步）
  - 完整操作历史（谁、何时、做了什么、状态变化、备注）

- **全局**
  - 顶部角色切换：实时刷新订单和权限
  - 所有列表/详情/批量之间操作后自动互相刷新
