# 公关传播计划管理系统

> 面向公关传播团队的 **传播计划单闭环管理** 系统，支持跨班组交接、岗位级权限控制、状态流转统一由后端驱动，保证列表/详情/批量/统计/操作记录五处数据一致。

- 前端：**SolidStart**（端口 `3004`）
- 后端：**NestJS（Node.js）**（端口 `8004`）
- 数据库：**本地 SQLite**（文件：`backend/propaganda.db`）

---

## 一、目录结构

```
.
├── backend/            # NestJS 后端
│   ├── src/
│   │   ├── main.ts            # 入口
│   │   ├── app.module.ts      # 根模块 + SQLite 连接 + 全局拦截/过滤
│   │   ├── auth/              # JWT 登录 + 角色守卫
│   │   ├── plan/              # 传播计划 Service / Controller
│   │   ├── entities/          # TypeORM 实体（User/PropagandaPlan/HandoverRecord/OperationLog）
│   │   ├── common/            # 状态枚举/响应格式/通用工具
│   │   └── seed.ts            # 启动自动建表 + 测试账号 + 样例数据
│   ├── package.json
│   ├── tsconfig.json
│   └── propaganda.db          # ← 首次启动后自动生成
│
└── frontend/           # SolidStart 前端
    ├── src/
    │   ├── entry-client.tsx / entry-server.tsx
    │   ├── app.tsx             # 根组件 + 用户上下文 + Toast
    │   ├── style.css
    │   ├── api/                # client / auth / plans
    │   └── routes/             # 基于文件路由
    │       ├── login.tsx       # 登录页（含演示账号一键填入）
    │       ├── index.tsx       # 首页 → /plans
    │       └── plans/
    │           ├── index.tsx   # 传播计划列表（含批量审核）
    │           ├── [id].tsx    # 详情（流转/交接/素材/投放/归档/时间线）
    │           └── stat.tsx    # 统计看板
    ├── app.config.ts
    └── package.json
```

---

## 二、岗位与职责

| 岗位 | 账号 | 密码 | 职责 |
|---|---|---|---|
| 传播计划登记员 | `register1` / `register2` | `123456` | 发起 / 补正计划，提交审核，提交素材，本岗位内跨班组交接 |
| 传播计划审核主管 | `audit1` / `audit2` | `123456` | 审核、素材审核、确认投放，本岗位内跨班组交接，批量审核 |
| 公关传播团队复核负责人 | `review1` | `123456` | 复核归档（**流程闭环终点**） |

> 可见字段 / 按钮 / 可提交动作全部由后端 `permissions` 返回 + 前端 `RolesGuard` 双重校验。

---

## 三、状态流转（传播计划 / 素材 / 投放互相影响）

```
 草稿 ──→ 待审核 ──┬──→ 审核通过 ──→ 待素材审核 ──┬──→ 素材通过 ──→ 投放确认 ──→ 投放完成 ──→ 已归档（闭环）
   │           │    └──→ 需补正 ──┘            └──→ 素材不通过─┘
   ↑           │                                    ↑
   └── (登记员补正后重提)                            └── (登记员补正素材后重提)
```

**关键规则**：

- 传播计划、素材审核、投放确认任意一步都会改变 `propaganda_plans.status`；
- **后端为唯一真值**：前端所有操作均调用 REST 接口，成功后重新拉取详情，保证刷新后：
  - 列表数量、详情状态、统计数据、操作记录、交接记录**五处一致**；
  - 交接确认后，详情「最近一次交接」卡片**立即显示接收人和确认时间**。

---

## 四、启动方式（本地演示）

### 1️⃣ 启动后端（端口 8004）

```bash
cd backend
npm install          # 首次
npm run start:dev    # 开发模式（或 npm run start）
```

启动后自动：
- 创建 SQLite 文件 `backend/propaganda.db`；
- 自动建表（`synchronize: true`）；
- 注入 **5 个测试账号** 与 **6 条样例传播计划单**（覆盖各状态）、1 条交接样例；
- 监听 `http://localhost:8004`，接口前缀 `/api`。

> 想重置数据？停止后端，删除 `backend/propaganda.db` 再重启即可。

### 2️⃣ 启动前端（端口 3004）

```bash
cd frontend
npm install          # 首次
npm run dev
```

打开浏览器访问：**http://localhost:3004**

### 3️⃣ 快速演示路径（本地演示闭环）

1. 登录 **register1**（王登记）→ 看到"Q3新品发布会"草稿 → 点击详情 → **提交审核**；
2. 退出登录 → 登录 **audit1**（张审核）→ 列表点进该单 → **审核通过** → **提交素材审核**；
3. 保持 audit1 登录 → **素材审核通过** → **确认投放完成**；
4. 退出登录 → 登录 **review1**（陈复核）→ 进入该单 → **复核归档** → **流程闭环**；
5. 此时再进入 **统计看板**，可见「闭环率」「已归档」计数同步增长；
6. 列表"618大促复盘稿件"已预置 **早班张审核 → 中班赵主管** 的交接记录，进入详情可直接看到「接收人 / 班次 / 确认时间」。

**演示跨班组交接**：登录 `audit1` → 打开任一当前处理人为"张审核"的单据 → 点击 **🔁 跨班组交接** → 选择接收人 `audit2`、班次 → 确认后详情顶部交接卡片立即更新，操作记录时间线同步新增一条。

---

## 五、后端主要接口

统一响应格式：`{ code, data, message }`，`code=0` 为成功。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | 登录（返回 token + 用户信息） |
| GET | `/api/auth/profile` | 当前登录用户 |
| GET | `/api/plans` | 分页列表（支持 keyword/status/onlyMine/page/pageSize） |
| GET | `/api/plans/statistics` | 统计看板（总数 / 闭环率 / 状态 / 岗位分布） |
| GET | `/api/plans/receivers?role=REGISTER` | 可交接人员（按岗位过滤） |
| GET | `/api/plans/:id` | 详情（含 handovers / logs / permissions） |
| POST | `/api/plans` | 新建传播计划单（草稿） |
| PUT | `/api/plans/:id` | 编辑（仅登记员在草稿/需补正时） |
| POST | `/api/plans/:id/submit-audit` | 提交审核 |
| POST | `/api/plans/:id/audit` | 审核（{ pass, remark }） |
| POST | `/api/plans/:id/submit-material` | 提交素材审核 |
| POST | `/api/plans/:id/audit-material` | 素材审核（{ pass, remark }） |
| POST | `/api/plans/:id/confirm-delivery` | 投放确认（{ remark }） |
| POST | `/api/plans/:id/archive` | 复核归档（{ remark }） |
| POST | `/api/plans/:id/handover` | 跨班组交接（{ toUserId, fromShift, toShift, remark }） |
| POST | `/api/plans/batch/audit` | 批量审核（{ ids, pass, remark }） |

> 所有非登录接口需在 Header 中携带：`Authorization: Bearer <token>`。

---

## 六、设计亮点（对应业务诉求）

✅ **闭环**：`ARCHIVED` 为终态，到达后禁止交接、禁止编辑；  
✅ **跨班组交接**：非简单备注，而是 `handover_records` 表（谁交出/谁接收/班次/确认时间）；  
✅ **岗位驱动**：后端 `getPermissions` + `RolesGuard` 双重控制，接口不会绕过前端越权；  
✅ **三块互相影响**：计划/素材/投放统一修改 `status`，所有读取接口只读这一张表，故列表/详情/统计自然一致；  
✅ **刷新一致**：状态变更必走事务 + 操作日志 + 重新拉取，前端无本地"假变化"；  
✅ **错误提示非通用**：每个状态不匹配、越权都有明确中文文案（如「当前状态 [素材审核不通过] 不允许确认投放」）。

---

## 七、常见问题

| 问题 | 解决 |
|---|---|
| 前端提示「网络错误」 | 检查后端是否启动，浏览器能否访问 `http://localhost:8004/api/auth/profile` |
| 登录返回「账号不存在」 | 确认 SQLite 文件已经自动生成；删除 `backend/propaganda.db` 重启后端重跑种子 |
| 某按钮不显示 | 登录角色不对或单据未进入对应状态，请切换岗位 / 推进状态 |
| 端口被占用 | 修改 `backend/src/main.ts` 的 `listen(...)` 与 `frontend/src/api/client.ts` 的 `API_BASE` |

---

**演示入口总览**：

- 前端：http://localhost:3004
- 后端健康检查：http://localhost:8004/api/auth/login （POST，可用 register1/123456 验证）
- 演示推荐流程：`register1 → audit1 → audit1 交接给 audit2 → review1 归档`（全程覆盖状态流转 + 跨班组 + 闭环）
