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
- 注入 **5 个测试账号**、**8 条样例传播计划单**（覆盖各状态+完整闭环）、**4 条交接记录样例**、**30+ 条操作时间线记录**；
- 监听 `http://localhost:8004`，接口前缀 `/api`。

> 想重置数据？停止后端 → 删除 `backend/propaganda.db` → 重启后端即可重新生成。
>
> 后端 TypeScript 已验证编译通过（`tsc --noEmit` exit=0）。

### 2️⃣ 启动前端（端口 3004）

```bash
cd frontend
npm install          # 首次
npm run dev
```

打开浏览器访问：**http://localhost:3004**

### 3️⃣ 快速演示路径（本地演示闭环）

**首次启动后端控制台会打印样例说明，直接按以下路径演示即可。**

| 步骤 | 登录账号 | 动作 | 验证点 |
|---|---|---|---|
| ① 起草→审核 | `register1`（王登记） | 打开"Q3新品发布会"草稿 → 提交审核 | 状态变为【待审核】，详情立即显示，列表/统计同步 |
| ② 审核+素材 | `audit1`（张审核） | 该单 → 审核通过 → 提交素材 → 素材审核通过 | 状态推进，操作记录 +3 条 |
| ③ 投放确认 | `audit1`（张审核） | 确认投放完成 | 状态→【投放已确认】，处理人岗位变更为复核负责人 |
| ④ 复核归档（闭环终点） | `review1`（陈复核） | 复核归档，写备注 | 状态→【已归档】，**统计看板闭环率 +1%，全流程 10+ 条操作时间线** |
| ⑤ 跨班组交接 | `audit1`（张审核） | 打开"618大促复盘"（待审核） → 跨班组交接 → 选赵主管、班次 | 交接卡片立即显示「交出人/接收人/班次/确认时间」，时间线新增一条 |
| ⑥ 补正流程 | `register1`（王登记） | 打开"突发舆情应对"（需补正）→ 编辑 → 补正后重提 | 状态回到【待审核】，退回原因保留在审核痕迹 |
| ⑦ 完整闭环样例 | 任意账号 | 打开"高校招聘季雇主品牌传播（完整闭环样例）" | 2 次跨班组交接 + 10+ 条操作时间线 + 详细归档备注 |

**样例清单（8 条，首次启动自动生成）**：

| # | 单据状态 | 当前处理人 | 能做什么 |
|---|---|---|---|
| 1 | 草稿 | 王登记（REGISTER） | 编辑 / 提交审核 |
| 2 | 待审核 | 张审核（AUDIT） | 审核 / 交接（含一条历史交接记录：张早班→赵中班） |
| 3 | 审核通过 | 张审核（AUDIT） | 提交素材审核 |
| 4 | 素材审核通过 | 赵主管（AUDIT） | 确认投放（含历史交接：张中班→赵夜班） |
| 5 | **完整闭环（已归档）** | 陈复核（REVIEW） | 查看流程（含登记员+审核主管两次交接完整时间线） |
| 6 | 需补正 | 王登记（REGISTER） | 编辑 / 补正后重提（含完整退回原因 3 条） |
| 7 | 待素材审核 | 赵主管（AUDIT） | 素材审核通过 / 退回 |
| 8 | 投放已确认 | 待复核负责人接单 | review1 可归档，推进闭环 |

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

**参数校验示例（NestJS + class-validator 统一抛出）**：
- `id` 非整数 → `Validation failed (numeric string is expected)`（由 `ParseIntPipe` 统一处理）
- `toUserId` 不是整数 → `toUserId 必须为整数`
- `fromShift` 非合法枚举 → `fromShift 必须是 MORNING/AFTERNOON/NIGHT，收到：xxx`
- `status` 参数非法 → `status 必须是：DRAFT/PENDING_AUDIT/.../ARCHIVED`

---

## 六、明确错误提示示例（无通用失败）

所有操作失败均返回**岗位 + 当前状态 + 谁在处理 + 解决方案**四维信息，前端 Toast 直接展示后端 message：

| 场景 | 错误提示（后端返回） |
|---|---|
| 登记员越权去审核 | `当前岗位【传播计划登记员】无审核权限；审核仅支持【传播计划审核主管】` |
| 复核负责人越权去归档（状态不对） | `当前状态【素材审核通过】不允许归档；只有投放已确认的单据才能复核归档（闭环终点）` |
| 非当前处理人发起交接 | `仅当前处理人可发起交接；当前处理人为【赵主管】` |
| 接收人岗位不匹配 | `接收人岗位必须为【传播计划审核主管】；当前接收人【王登记】岗位为【传播计划登记员】，不匹配` |
| 已归档单据再操作 | `当前状态【已归档】已归档，流程闭环，不允许交接` |
| 状态不匹配（如素材审核时状态已是素材通过） | `当前状态【素材审核通过】不允许素材审核；仅待素材审核状态可执行` |
| 自交接给自己 | `交接双方不能为同一人，请选择其他同事` |

---

## 七、设计亮点（对应业务诉求）

✅ **闭环**：`ARCHIVED` 为终态，到达后禁止交接、禁止编辑；  
✅ **跨班组交接**：非简单备注，而是 `handover_records` 表（谁交出/谁接收/班次/确认时间）；  
✅ **岗位驱动**：后端 `getPermissions` + `RolesGuard` 双重控制，接口不会绕过前端越权；  
✅ **三块互相影响**：计划/素材/投放统一修改 `status`，所有读取接口只读这一张表，故列表/详情/统计自然一致；  
✅ **刷新一致**：状态变更必走事务 + 操作日志 + 重新拉取，前端无本地"假变化"；  
✅ **错误提示非通用**：每个状态不匹配、越权都有明确中文文案（如「当前状态 [素材审核不通过] 不允许确认投放」）。

---

## 八、常见问题

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
