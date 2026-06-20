# 授信申请审批系统（B2B 批发平台）

基于 **SolidStart + Node Express + SQLite** 构建的三级授信审批演示系统，覆盖授信申请登记、过程核验、复核归档全流程，支持补正退回、申诉复核、逾期/状态冲突等异常路径演练。

---

## 一、办理边界与流程

| 环节 | 办理角色 | 可执行操作 |
| :--- | :--- | :--- |
| 授信申请登记 | **授信登记员** | 新建申请、编辑证据标记、首次提交审核、补正后再次提交、复核驳回后**申诉提交** |
| 过程核验办理 | **授信审核主管** | 审核通过 → 转复核；审核退回补正（登记员重提）；审核驳回 |
| 复核归档 | **B2B 复核负责人** | 复核通过、复核驳回（可申诉）、**复核归档**完成闭环 |

流程顺序：`登记（提交） → 核验（通过/退回/驳回） → 复核（通过/驳回/归档）`
异常路径：复核驳回 → 登记员申诉提交 → 再次进入复核（可循环多次，版本号递增，完整记录所有驳回原因和复核意见）

---

## 二、目录结构

```
trae-code-4/
├── backend/                        Node Express 后端（端口 8004）
│   ├── server.js                   入口
│   ├── .env                        端口/DB 路径/CORS 配置
│   ├── package.json
│   ├── data/credit.db              SQLite 本地数据库（init-db 后生成）
│   ├── scripts/
│   │   ├── init-db.js              建表脚本
│   │   └── seed-data.js            演示样例数据
│   └── src/
│       ├── db.js                   SQLite 连接
│       ├── validators.js           处理人/角色/状态/版本/证据校验
│       └── routes.js               RESTful API 路由
│
└── frontend/                       SolidStart 前端（端口 3004）
    ├── vite.config.ts              端口 + /api 反向代理到 8004
    ├── .env                        VITE_API_BASE 等
    ├── package.json
    └── src/
        ├── entry.tsx / entry-server.tsx
        ├── lib/api.ts              fetch 封装 + 身份头注入
        └── routes/
            ├── root.tsx            主布局（侧边栏+FileRoutes）
            ├── app.css             全部样式
            ├── login.tsx           登录页（含角色切换+演示账号快速填充）
            ├── index.tsx           工作台（统计卡片+待办队列+流程说明）
            ├── stats.tsx           统计分析（状态/角色分布+全量表）
            └── applications/
                ├── index.tsx       申请列表（多条件筛选）
                ├── new.tsx         新建申请（仅登记员）
                └── [id].tsx        详情页（上一处理人意见+证据+流程节点+操作记录+处理对话框）
```

---

## 三、快速开始

### 1. 环境要求
- Node.js ≥ 18（推荐 v20+）
- npm / pnpm / yarn
- 本地可用端口 **3004（前端）**、**8004（后端）**（端口均可变，见下方 "自定义端口"）

### 2. 一键初始化与启动

#### 步骤 A：初始化后端 + 建库 + 样例数据
```bash
cd backend
npm install
npm run init-db     # 建 users / credit_applications / evidence_items / process_nodes / operation_logs 等表
npm run seed        # 插入 6 个演示账号 + 8 条多场景申请 + 节点/日志
npm start           # 启动后端（默认 http://localhost:8004）
```

#### 步骤 B：启动前端（新终端）
```bash
cd frontend
npm install
npm run dev         # 启动 SolidStart（默认 http://localhost:3004）
```

启动完成后打开浏览器访问：**http://localhost:3004**

### 3. 演示账号（密码统一：`123456`）

| 账号 | 姓名 | 角色 | 部门 |
| :--- | :--- | :--- | :--- |
| registrar01 | 张伟 | 授信登记员 | 授信登记部 |
| registrar02 | 李娜 | 授信登记员 | 授信登记部 |
| auditor01 | 王强 | 授信审核主管 | 授信审核部 |
| auditor02 | 刘芳 | 授信审核主管 | 授信审核部 |
| reviewer01 | 陈明 | B2B 复核负责人 | B2B复核部 |
| reviewer02 | 赵雪 | B2B 复核负责人 | B2B复核部 |

> 登录页左上角可切换角色后快速点击对应姓名按钮即可自动填充账号密码。

---

## 四、预置演示样例（至少覆盖 5 种场景）

| # | 企业名称 | 状态 | 类型说明 |
| :-- | :--- | :--- | :--- |
| 001 | 北京华信电子科技有限公司 | `pending_audit` 待审核 | ✅ **正常**（登记员提交，等审核主管办理） |
| 002 | 上海盛达贸易有限公司 | `reject_correction` 退回补正 | ⚠️ **缺证据**（缺财务报表+银行流水，等登记员补正） |
| 003 | 广州鸿源食品有限公司 | `pending_review` 待复核 | ✅ **正常**（已审核通过，等复核负责人复核） |
| 004 | 深圳创新科技有限公司 | `overdue` 逾期 | ❌ **逾期**（部分证据 + 超办理期限，审核主管仍可处理） |
| 005 | 成都锦绣服装有限公司 | `archived` 已归档 | ✅ **正常完成**（流程全通过已归档） |
| 006 | 杭州远见网络科技有限公司 | `conflict` 状态冲突 | ❌ **状态冲突**（关联企业历史授信冲突，需复核负责人裁定） |
| 007 | 南京中泰化工有限公司 | `appeal_reviewing` 申诉复核中 | ⚠️ **申诉路径**（复核驳回→登记员申诉→再次复核，版本号=3） |
| 008 | 武汉鑫达物流有限公司 | `archived` 已归档 | ✅ 已完成（参考对照） |

> **验收演示建议**：
> 1. 用 `registrar01` 登录，从"我的待办队列"进 002（上海盛达）→ 在证据区把"近一年财务报表""近3个月银行流水"标记提交 → 点「补正后重提」。
> 2. 换 `auditor01` 登录，从队列进 001（北京华信）→ 审核通过；再进 004（深圳创新）→ 点「审核通过」可自动清除逾期标记。
> 3. 换 `reviewer01` 登录，进 006（杭州远见/冲突）→ 点「归档完成」冲突标记清除；进 007（南京中泰/申诉复核中）→ 复核通过或再驳回（查看操作记录完整保存的所有意见+驳回原因+版本号递增）。

---

## 五、核心特性对应关系

### 办理边界
- 登记员操作：`/applications/new` 新建、`[id].tsx` 证据切换、提交/重提/申诉
- 审核主管：`[id].tsx` 审核通过/退回补正/审核驳回
- 复核负责人：`[id].tsx` 复核通过/复核驳回/**归档完成**

### 详情显示"上一处理人意见和结果"
- 进入 `applications/:id` 顶部的**黄色卡片**专门显示：
  - 上一处理人姓名 + 角色
  - 上一步结果（提交/通过/退回/驳回/申诉/归档）
  - 完整意见原文 + 若有驳回/退回原因同时展示

### 队列 / 详情状态 / 统计数字 / 操作记录 同步变化
- 任一操作成功后：
  - 顶部状态 Tag、当前处理人、版本号立即刷新
  - 流程节点对应行高亮为「已完成」，自动新增下一步处理中节点
  - 操作记录区立即追加一条（包含 old→new 状态、版本变化、意见/原因、证据检查）
  - 工作台 `/` 的统计卡片和列表页 `/applications` 返回接口即时更新

### 申诉提交 → 再次提交 的完整轨迹
- 复核驳回 → 申请状态 `reject_revision`，登记员队列可见
- 登记员进入详情点击「申诉提交」→ 状态 → `appeal_reviewing`，版本号 +1，新生成一个「申诉」流程节点+完整操作日志，重新进入复核负责人队列
- 所有复核意见和驳回原因可在：详情流程节点逐条查看 + 操作记录 Tab 完整追溯（支持多轮申诉）

### 后端校验（`validators.js` + `routes.js ACTION_MAP`）
提交任何 action 时后端依次校验：
1. ✅ **当前处理人**：`app.current_handler_id === user.id`
2. ✅ **角色权限**：操作与 role 匹配（如 audit_pass 只能 auditor）
3. ✅ **当前状态**：操作对应 `ACTION_ALLOWED_STATUSES`
4. ✅ **版本号**：`client_version === app.version`（防并发冲突）
5. ✅ **必填证据**：提交/通过类操作需全部 required 证据标记已提交

→ **校验不通过：保留原状态，写一条 `*_fail` 操作日志**（extra 字段里保留具体失败原因）

---

## 六、自定义端口

### 后端端口（默认 8004）
```bash
# backend/.env
PORT=8004
CORS_ORIGIN=http://localhost:3004   # 改成前端对应地址
```

### 前端端口（默认 3004）
```bash
# frontend/.env
PORT=3004
VITE_API_BASE=http://localhost:8004/api   # 改成后端地址
```

```ts
// frontend/vite.config.ts （同步 dev 代理）
export default defineConfig({
  server: { port: 3004 },
  vite:   { server: { port: 3004, proxy: { "/api": { target: "http://localhost:8004" } } } }
});
```

改完后后端 `npm start`、前端 `npm run dev` 重启即可。

---

## 七、后端主要 API 一览

| 方法 | 路径 | 说明 | Header 身份 |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | 账号密码登录 | - |
| GET  | `/api/applications` | 列表（支持 ?status / role / handler_id / keyword / evidence_status / is_overdue / has_conflict） | `x-user-id` + `x-user-role` |
| GET  | `/api/applications/stats` | 按状态+角色聚合、逾期、冲突、归档率 | - |
| GET  | `/api/applications/:id` | 详情（含证据/流程节点/操作日志） | - |
| POST | `/api/applications` | 新建申请（仅 registrar） | ✅ |
| PUT  | `/api/applications/:id/evidence/:eid` | 切换证据提交状态（仅 registrar） | ✅ |
| POST | `/api/applications/:id/action` | 执行操作（body: {action, opinion, reject_reason?, client_version}） | ✅ |
| GET  | `/api/dict/statuses`、`/api/dict/roles` | 字典 | - |

> 所有失败请求（校验不通过）都写 `operation_logs` 一条失败日志，**保留原状态不改变**。

---

## 八、重置演示数据

```bash
cd backend
rm -f data/credit.db data/credit.db-*
npm run init-db
npm run seed
# 重启后端（npm start）即可恢复完整演示样例
```

祝验收顺利 🎉
