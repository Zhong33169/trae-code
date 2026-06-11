# SaaS 客户成功团队 - 批量变更复核上线计划单系统

> 业务验收会专用演示系统：**客户成功经理发起 → 交付顾问处理 → 客户成功负责人确认** 三段式流程，严格角色隔离、版本锁、证据链、批量操作全审计。

## ✨ 核心特性

| 模块 | 说明 |
|---|---|
| 🔒 角色强隔离 | CSM/交付顾问/负责人 各司其职，后一角色**不能**替前一角色补流程 |
| 📋 队列优先 | 登录首屏即看队列（按角色过滤），非静态表格 |
| 📎 证据链 | 登记证据(CSM)、过程核验证据(交付)、复核归档证据(负责人) 三阶段分类 |
| 🔢 乐观锁 | 所有状态变更/编辑/证据上传均校验 version，防并发覆盖 |
| 📦 批次系统 | 批量操作自动生成批次号 (`BATCH-YYYYMMDD-XXXXXX`)，支持部分成功、失败重试、全量审计 |
| 🧪 样例丰富 | 预置 10 条样例，覆盖「缺证据/被驳回/多状态/不同风险」各种边界 |
| 🛡️ 严格拦截 | 绕页直调 API 时，`错角色/旧版本/缺证据/错状态` 均被拦截，返回具体原因与错误码 |

---

## 🏗️ 技术栈

| 层 | 选型 | 端口 |
|---|---|---|
| 前端 | Angular 18 + Vite + TailwindCDN | **3009** |
| 后端 | Node.js + Fastify + sql.js (WASM SQLite) | **8009** |
| 存储 | 本地 SQLite 文件：`backend/data/launch_plan.db` | - |

> sql.js 为纯 WASM 版 SQLite，无需原生编译，跨平台开箱即用。

---

## 🚀 快速启动

```bash
# ===== 1. 克隆后进入项目 =====
cd trae-code-9

# ===== 2. 启动后端 =====
cd backend
npm install          # 首次安装
npm start            # 启动：http://localhost:8009
# 注：启动时自动建库、自动注入样例数据

# ===== 3. 启动前端（新终端） =====
cd frontend
npm install          # 首次安装
npm run dev          # 启动：http://localhost:3009
```

### 自动生成的 SQLite 文件

首次启动后端后，数据库文件自动生成在：
```
backend/data/launch_plan.db
```
如需重置数据，**直接删除该文件，重启后端即可**。

---

## 👤 演示账号

所有账号密码统一 `123456`：

| 角色 | 用户名 | 姓名 | 说明 |
|---|---|---|---|
| 🔵 **客户成功经理 (CSM)** | `csm_wang` | 王晓敏 | 发起登记、重新提交被驳回的单据 |
| 🔵 **客户成功经理 (CSM)** | `csm_li` | 李伟强 | 同上 |
| 🟣 **交付顾问 (DELIVERY)** | `delivery_zhang` | 张明远 | 过程核验、核验通过/驳回 |
| 🟣 **交付顾问 (DELIVERY)** | `delivery_chen` | 陈思雨 | 同上 |
| 🟠 **客户成功负责人 (DIRECTOR)** | `director_zhao` | 赵国栋 | 复核归档、最终确认/驳回 |

> 顶部导航栏内置 **「切换角色」** 下拉框，一键切换不同角色体验流程。

---

## 🗺️ 工作流（严格单向，后一角色不能补前一角色流程）

```
[CSM]        草稿 ──submit──▶ 待交付核验
                ▲                  │
                │ resubmit         │ verify_pass [DELIVERY]
                │                  ▼
          已驳回 ◀──reject─── 待负责人确认
           (任意环节可驳)          │
                                  │ confirm_pass [DIRECTOR]
                                  ▼
                               已完成
```

| 操作 | 允许角色 | 必须证据 |
|---|---|---|
| `submit` (提交核验) | CSM | 登记证据 |
| `verify_pass` (核验通过) | DELIVERY | 核验证据 |
| `confirm_pass` (确认归档) | DIRECTOR | 归档证据 |
| `reject` (驳回) | DELIVERY / DIRECTOR | 可选备注 |
| `resubmit` (重新提交) | CSM | 登记证据 |

---

## 🧪 暴露问题的预置样例

> 启动后自动注入 10 条样例，建议用于业务验收会演示：

| 编号 | 标题 | 状态 | 可演示问题 |
|---|---|---|---|
| `LP-2026-0001` | 客户A - 权限体系批量变更 | **待核验** | 正常流程，证据齐全 → 交付可核验通过 |
| `LP-2026-0002` | 客户B - 工作流引擎版本升级 | **待确认** | 证据齐全 → 负责人可归档 |
| `LP-2026-0003` | 客户C - 报表模板批量替换 | **草稿** | CSM 可编辑 → 提交前会因「缺登记证据」被拒 |
| `LP-2026-0004` | 客户D - SSO集成（缺证据） | **待核验** | ⚠️ **没有登记证据** → delivery_zhang 点「核验通过」会被拦 |
| `LP-2026-0005` | 客户E - 数据字典批量修改 | **已完成** | 三阶段证据齐全的完整案例 |
| `LP-2026-0006` | 客户F - API配额调整（被驳回） | **已驳回** | 有 `reject_reason`，CSM 需补充后重新提交 |
| `LP-2026-0007` | 客户G - 多租户配置批量下发 | **待核验** | 2 份登记证据 + 与 `0001`/`0008` 一起做**批量核验** |
| `LP-2026-0008` | 客户H - 消息网关切换（待核验） | **待核验** | ⚠️ **做批量核验时，会与 0004 一起形成「部分成功」** (0007/0008/0001 ✓，0004 ✗ 缺证据) |
| `LP-2026-0009` | 客户I - 自定义字段扩展 | **待确认** | 与 `0002`/`0010` 做**批量确认归档** (0002/0009 ✓，0010 若缺归档证据则 ✗) |
| `LP-2026-0010` | 客户J - 工作流审批节点调整 | **待确认** | 同上 |

---

## 🔌 后端 API 速查

> 所有 API 需 `Authorization: Bearer <token>`。  
> 前后端由 Vite 代理 `/api → http://localhost:8009/api`，前端直接写 `/api/...`。

### 🔐 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | body: `{username, password}` → `{token, user}` |
| GET | `/api/auth/me` | 当前用户信息 |
| GET | `/api/users` | 所有用户列表 |
| GET | `/api/constants` | 前端枚举（状态/风险/角色/工作流说明） |

### 📋 计划单

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/plans/queue?status=&risk_level=&change_type=&keyword=&page=&size=` | **角色感知的队列**（核心首屏接口） |
| GET | `/api/plans/stats` | 按状态计数（顶部统计卡） |
| GET | `/api/plans/:id` | 详情 + 证据 + 流转 + 可用操作提示 |
| POST | `/api/plans` | CSM 新建（仅 CSM） |
| PATCH | `/api/plans/:id` | CSM 编辑（仅草稿/驳回 + 创建人 + version 校验） |
| **POST** | **`/api/plans/:id/action`** | **核心状态流转**：body `{action, comment, version}` |
| POST | `/api/plans/:id/evidence` | 证据上传（按证据类型分角色 + version 校验） |
| GET | `/api/plans/:id/audit` | 单计划单的审计日志 |

### 📦 批次（批量操作）

| 方法 | 路径 | 说明 |
|---|---|---|
| **POST** | **`/api/batch/action`** | 批量操作：`{plan_ids[], action, comment, plan_versions{id:ver}}` → 返回 `batch_no + items[]（success/failed 均保留）` |
| POST | `/api/batch/:batchId/retry` | 仅重试该批次失败项 |
| GET | `/api/batches` | 批次列表 |
| GET | `/api/batches/:batchId` | 批次详情 + 明细（含错误码/错误信息） |

### 📝 审计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/audit-logs?user_id=&action=&size=100` | 全量审计 |

---

## 🛡️ 错误拦截清单（绕页直调 API 时返回的具体原因）

> 所有错误 HTTP 状态码 + 业务 `code` + 中文 `message`，前端直接展示。

| 场景 | HTTP | code | message 示例 |
|---|---|---|---|
| **错角色** (e.g. DIRECTOR 调 submit) | 400/403 | `WRONG_ROLE` | 当前角色「DIRECTOR」不允许执行「submit」操作，仅允许: CSM |
| **旧版本** (e.g. 基于 v=1 提交，当前已 v=3) | 409 | `OLD_VERSION` | 版本冲突：传入版本1，当前版本3，请刷新后重试 |
| **缺证据** (e.g. 提交核验但无 REGISTRATION 证据) | 400 | `MISSING_EVIDENCE` | 缺少必要证据：登记证据。请先上传对应证据后再执行操作。 |
| **错状态** (e.g. 已完成状态再执行提交) | 400 | `WRONG_STATUS` | 状态 COMPLETED 不允许执行操作「submit」 |
| **证据错角色上传** (e.g. DIRECTOR 传 REGISTRATION) | 403 | `WRONG_ROLE` | 证据「REGISTRATION」仅对应角色可上传：REGISTRATION→CSM |
| **非创建人编辑** | 403 | `WRONG_ROLE` | 仅创建人可编辑此计划单 |
| **已完成不可编辑/传证据** | 400 | `WRONG_STATUS` | 已完成状态不可再上传证据 |

---

## 🎬 业务验收会建议演示剧本

### 场景 1：队列首屏 + 角色切换
1. 用 `csm_wang` 登录 → 首屏直接看到「我的队列」(草稿+被驳回+已提交待核验)
2. 切角色到 `delivery_zhang` → 队列瞬间变为「待核验/待确认/已完成」
3. 切角色到 `director_zhao` → 队列变为「待确认/已完成/已驳回」
4. **要点**：角色切换后，队列、统计卡、批量操作按钮 **均联动刷新**

### 场景 2：单条完整走流程（LP-2026-0001）
1. `csm_wang` → 点击 0001，右侧边栏立刻显示证据速览
2. 点「进入办理」→ 详情页：证据齐全、可用操作「提交核验」亮绿
3. `delivery_zhang` 登录 → 进入 0001 → 先 **上传核验证据** → 点「核验通过」
4. `director_zhao` 登录 → 进入 0001 → 上传 **归档证据** → 点「确认归档」
5. 查看「流程轨迹」「审计日志」三段清晰记录

### 场景 3：错角色尝试 (WRONG_ROLE 拦截)
1. 保持 `director_zhao` 登录
2. 打开浏览器 Console，直接执行：
```js
fetch('/api/plans/1/action', {
  method:'POST',
  headers: {
    'Content-Type':'application/json',
    'Authorization':'Bearer <当前token>'
  },
  body: JSON.stringify({action:'submit', version:1})
}).then(r=>r.json()).then(console.log)
```
3. 预期返回：`{code: "WRONG_ROLE", message: "当前角色「DIRECTOR」不允许执行「submit」操作，仅允许: CSM"}`

### 场景 4：缺证据拦截 (MISSING_EVIDENCE)
1. `delivery_zhang` 登录 → 进入 **LP-2026-0004** (标题带「缺证据」)
2. 点「核验通过」→ 按钮灰色禁止 hover 提示缺证据
3. 强行绕过 Console 调 `/api/plans/4/action` → 返回 `{code:"MISSING_EVIDENCE", ...}`

### 场景 5：版本冲突 (OLD_VERSION)
1. `csm_wang` 登录 → 进入 **LP-2026-0003**（草稿），不关闭页面
2. 开另一个浏览器或无痕窗口，同样用 csm_wang 登录，进入 0003，随便修改描述并保存
3. 回到第一个窗口，提交旧版本的编辑 → 返回 **409 / OLD_VERSION**

### 场景 6：批量核验 - 部分成功（重点！）
1. `delivery_zhang` 登录 → 队列
2. 勾选 `0001`✓ `0004`✗ `0007`✓ `0008`✓（共 4 条，其中 0004 缺登记证据）
3. 点「批量核验通过」→ 执行
4. 结果：`成功3 / 失败1` → **失败项 0004 清晰展示错误码+错误信息，不被吞**
5. 进入「批次中心」→ 点批次号 → 可看到明细 → 可对失败项单独办理后「🔁 重试失败项」

### 场景 7：驳回 + 重新提交
1. `delivery_zhang` → 对 `0006`（当前已被驳回，但可重开一条演示）或另选一条驳回
2. 填写驳回原因 → `reject`
3. 切 CSM → 该单据出现在队列里（红色「已驳回」），展示驳回原因
4. CSM 补充证据 + 编辑 → 重新提交 → 再次进入待核验

---

## 📁 项目结构

```
trae-code-9/
├── backend/
│   ├── package.json
│   ├── data/                      # SQLite 文件（启动后自动生成）
│   └── src/
│       ├── server.js              # Fastify 入口 (端口 8009)
│       ├── db/
│       │   ├── schema.js          # sql.js + 建表
│       │   ├── seed.js            # 10 条样例数据
│       │   └── init.js            # 独立初始化脚本
│       ├── middleware/auth.js     # JWT + 角色中间件
│       ├── utils/workflow.js      # 状态机/证据/版本/审计
│       └── routes/
│           ├── auth.js            # 登录/用户
│           ├── plans.js           # 计划单 CRUD + 状态流转
│           └── batch.js           # 批次 + 重试 + 审计日志
├── frontend/
│   ├── package.json
│   ├── vite.config.js             # 端口 3009 /api 代理 8009
│   ├── index.html                 # Tailwind CDN 入口
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts                # Angular 启动 + HTTP 拦截器
│       └── app/
│           ├── app.component.ts   # 顶栏 + 角色切换 + Toast
│           ├── app.routes.ts
│           ├── auth.guard.ts
│           ├── api.service.ts
│           └── pages/
│               ├── login.page.ts          # 登录（一键填充演示账号）
│               ├── queue.page.ts          # ★ 主队列 + 侧栏证据 + 批量弹窗
│               ├── plan-detail.page.ts    # ★ 详情办理 + 版本编辑 + 证据上传
│               ├── batches.page.ts        # 批次列表（统计概览）
│               ├── batch-detail.page.ts   # 批次明细 + 失败重试
│               └── audit.page.ts          # 全量审计日志
└── README.md
```

---

## 🔧 常见问题

**Q: 后端报数据库问题？**  
A: 删除 `backend/data/launch_plan.db` → 重启后端即可自动重建 + 自动样例。

**Q: 前端启动失败？**  
A: 确认 Node ≥ 18，`frontend` 目录下重新 `npm install`，Angular 18 需要 TypeScript 5.4+。

**Q: 如何重置为初始状态？**  
A:
```bash
rm -f backend/data/launch_plan.db
# 重启后端即可
```

**Q: 如何自定义后端端口/前端地址？**  
A:
```bash
PORT=9000 CORS_ORIGIN=http://localhost:4000 npm start   # backend
# 前端改 vite.config.js 里的 server.port 和 proxy.target
```

---

## ✅ 验收 Checklist

- [x] 第一屏是**按角色过滤的队列**（非静态表）
- [x] CSM → 交付 → 负责人 **三段清晰分离**，后角色不能补前角色流程
- [x] 队列左侧 + **侧边证据速览**（登记/核验/归档三阶段图标），点击进入详情办理
- [x] 批量操作生成 **批次号 BATCH-YYYYMMDD-XXXXXX**
- [x] 批量支持 **部分成功**，失败项 **保留错误码+错误信息**不被吞
- [x] 失败项可在「批次详情」中 **单独办理后一键重试**
- [x] 角色切换 / 筛选 / 详情办理 / 批量操作 **之间互相联动刷新**
- [x] 绕页直调 API：`WRONG_ROLE / OLD_VERSION / MISSING_EVIDENCE / WRONG_STATUS` **全部拦截并返回具体中文原因**
- [x] 后端 CORS 放行 3009，前端代理指向 8009
- [x] 10 条预置样例，覆盖各种边界场景
