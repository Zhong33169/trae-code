# 供应链金融平台 - 风险分级处置融资申请单系统

一个基于 **SvelteKit + Rust Rocket + SQLite** 的完整业务演示系统。

覆盖供应链金融融资申请单的**三阶段处理流程**：融资申请登记 → 过程核验 → 复核归档，包含角色边界、状态流转、风险分级（低/中/高/极高 四级）、证据材料、版本锁、操作留痕等核心机制。

## ✨ 系统特性

### 🔄 三阶段办理边界

| 阶段 | 角色 | 主要职责 |
|-------|------|----------|
| 融资申请单登记 | **融资申请登记员 (REGISTRAR) | 创建草稿、补齐证据、提交审核、对退回/缺证据补正后重提 |
| 过程核验 | **融资申请审核主管 (AUDITOR) | 核验证据完整性，识别异常（缺证据/逾期/冲突），风险等级升降级，决定转复核或退回 |
| 复核归档 | **供应链金融平台复核负责人 (REVIEWER)** | 复核通过归档或驳回，最终认定风险等级 |

### 🚨 风险分级处置（独立识别+升降留痕）

- **四级风险**：低 (LOW) / 中 (MEDIUM) / 高 (HIGH) / 极高 (CRITICAL)
- **高/极高风险单独识别**：独立列表、红底高亮、CRITICAL 呼吸动画
- **风险升降级留痕**：每次调整单独写入操作记录时间线（非列表变色），记录调整原因与版本

### 📋 状态机（共 10 种）

`草稿 → 待核验 → 核验通过待转 → 待复核 → 归档
                     ↘ 缺证据、逾期、退回补正、状态冲突（可在主管处理后继续流转）→ 驳回`

### 🔒 后端核心校验（提交/处理时必过）

每个写操作（提交/处理/复核）都校验：
- ✅ **当前处理人**（必须是 `current_handler`）
- ✅ **角色**（REGISTRAR/AUDITOR/REVIEWER 对应状态）
- ✅ **状态**（当前状态允许此操作）
- ✅ **版本号**（乐观锁：`expected_version`）
- ✅ **必填证据**（提交时必填证据齐全）
- 不通过则**保留原状态**，并写入 `VERSION_CONFLICT` 等操作记录

### 📜 操作记录永久留痕（时间线）

所有操作永久记录：谁（姓名+角色）、什么操作、状态变化、风险变化、意见、结果、版本号、时间戳

## 🏗️ 技术栈

- **前端**：[SvelteKit 2](https://kit.svelte.dev/) + TypeScript + Vite
- **后端**：[Rocket 0.5](https://rocket.rs/) (Rust) + JSON API
- **数据库**：SQLite（单文件 `backend/data/scf.db`，Rusqlite 驱动）
- **认证**：内置演示账户（右上角切换身份），可扩展为真实登录

## 🚀 快速开始

### 环境要求

| 组件 | 版本要求 | 安装指引 |
|-------|-----------|-----------|
| Rust | 1.82+ | https://rustup.rs |
| Node.js | 18+ | https://nodejs.org |
| （可选）pnpm | 8+ | `npm i -g pnpm` |

### 方式一：一键初始化（推荐）

```bash
cd trae-code-4
./init.sh
```

脚本会自动：
1. 编译 Rust 后端（首次需要几分钟）
2. 初始化 SQLite 数据库 + 样例数据
3. 安装前端依赖

### 方式二：手动初始化

```bash
# 1. 后端初始化 + 建库 + 编译
cd backend
cargo build          # 编译，会自动初始化 data/scf.db 并导入 schema.sql + seed_data.sql

# 2. 前端初始化
cd ../frontend
npm install           # 或 pnpm install
```

### 启动服务

#### 开发模式（推荐，热更新）

**终端 1（后端，端口 8004）**：

```bash
cd backend
ROCKET_PORT=8004 cargo run
```

首次启动时会自动执行 SQL 建表并导入样例数据（仅首次数据库文件不存在时执行）。

**终端 2（前端，端口 3004）**：

```bash
cd frontend
VITE_API_BASE=http://localhost:8004 npm run dev
```

#### 一键启动（脚本）

```bash
./start.sh
# 自定义端口：
BACKEND_PORT=8004 FRONTEND_PORT=3004 ./start.sh
```

### 访问地址：http://localhost:3004

---

## 📝 🎯 演示账户（右上角切换身份）

| 展示名 | 用户名 | 角色 | 说明 |
|--------|--------|------|------|
| 张登记 | registrar01 | REGISTRAR | 融资申请登记员 |
| 李审核 | auditor01 | AUDITOR | 融资申请审核主管 |
| 王复核 | reviewer01 | REVIEWER | 供应链金融平台复核负责人 |

---

## 🧪 样例数据说明（seed_data.sql）

系统预置 **8 张真实融资申请单**覆盖以下典型场景（**绝不只是顺利通过的样例**）：

| 编号 | 申请人 | 状态 | 风险 | 说明 |
|------|-------|------|------|------|
| RZZ-0601-001 | **刘正常** | ✅ 归档 | 中风险 | **正常流程：登记→核验→复核归档（完整四段流程） |
| RZZ-0602-002 | **陈缺证** | 📎 缺证据 | ⬆️ 中→高风险升级 | 审核主管升级风险后退回补充税务证明与贷款用途 |
| RZZ-0603-003 | **赵逾期** | ⚠️ 逾期 | 🔴🔴 极高风险 | 3 次逾期，由中→高→极高，两级升级留痕 |
| RZZ-0604-004 | **孙退回** | 🔄 退回补正 | 低风险 | 财务报表与税务数据不一致，退回补正 |
| RZZ-0605-005 | **周冲突** | ⚡ 状态冲突 | ⬆️ 中→高 | 海关报关与合同不符+工商经营异常，待核查 |
| RZZ-0606-006 | **吴待审** | ⏳ 待核验 | 中风险 | 刚提交，待审核主管核验 |
| RZZ-0607-007 | **郑复核** | 🧐 待复核 | 高风险 | 核验通过待复核负责人做最终归档/驳回 |
| RZZ-0608-008 | **冯草稿** | 📝 草稿 | 中风险 | 登记员未提交，仅完成部分录入 |

每张申请单都配带完整**操作记录时间线**（包括风险升级/降级单独记录），可在详情页查看。

---

## 🌐 API 接口列表 (REST + JSON)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 获取所有用户（用于身份切换） |
| GET | `/api/applications` | 查询申请单列表，支持 `role/status/risk/handler/keyword 查询 |
| GET | `/api/applications/<id>` | 申请单详情 + 操作记录 |
| GET | `/api/statistics` | 统计数据（按状态/风险/队列） |
| POST | `/api/applications` | 登记员创建申请单 |
| POST | `/api/applications/submit` | 登记员提交/补正提交（校验：处理人+角色+状态+版本+证据） |
| POST | `/api/applications/process` | 审核主管处理（核验/异常/调整风险） |
| POST | `/api/applications/audit` | 复核负责人复核归档或驳回（带最终风险认定） |

每个 POST 接口若校验失败会返回 `409 Conflict`（版本冲突）、`400 Bad Request`、`403 Forbidden` 等明确错误，并写入操作记录便于追踪。

---

## 🔧 端口自定义

系统演示频繁换端口**两边都能跟着变**：

- **后端端口**：
  ```bash
  ROCKET_PORT=9001 cargo run         # 临时
  # 或修改 backend/Rocket.toml
  ```
- **前端端口** + API 指向：
  ```bash
  VITE_API_BASE=http://localhost:9001 npm run dev -- --port 3100
  ```
- 或修改 `frontend/vite.config.ts` 的 `server.port` 和 `proxy.target`

## 📁 目录结构

```
trae-code-4/
├── backend/
│   ├── Cargo.toml              # Rust 依赖
│   ├── Rocket.toml             # Rocket 端口配置
│   ├── rust-toolchain.toml      # Rust 版本锁
│   ├── schema.sql              # 建表 DDL
│   ├── seed_data.sql         # 预置样例
│   ├── .env.example
│   ├── data/
│   │   └── scf.db          # SQLite 数据库（自动生成）
│   └── src/main.rs           # Rocket 主程序（API + 状态机 + 校验）
├── frontend/
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts        # 含 /api 代理配置
│   ├── tsconfig.json
│   └── src/
│       ├── app.html
│       ├── app.d.ts
│       ├── app.css           # 样式（无需 UI 框架，纯 CSS）
│       ├── lib/
│       │   ├── api.ts      # fetch 封装
│       │   ├── stores.ts  # 当前用户
│       │   └── types.ts   # 类型+枚举+标签
│       └── routes/
│           ├── +layout.svelte     # 布局（左侧菜单 + 顶栏身份切换
│           ├── +page.svelte      # 工作台首页（我的队列+高风险+三阶段概览）
│           ├── applications/
│           │   ├── +page.svelte    # 申请单总览+筛选
│           │   └── [id]/+page.svelte # 详情页+处理流程核心
│           └── statistics/+page.svelte # 统计看板
├── init.sh           # 一键初始化脚本
└── start.sh          # 一键启动脚本
```

## 🐛 常见问题

**Q: 首次启动前端白屏？**
A: 确认后端已经启动（http://localhost:8004），并检查浏览器控制台 API 请求是否跨域失败。Rocket 已配置 `rocket_cors` 的 `allowed_origins: all`。

**Q: 如何重置数据库？**
A: 删除 `backend/data/scf.db` 后重新启动后端，会自动重建。或运行：
```bash
rm backend/data/scf.db && cd backend && cargo run
```

**Q: 前端如何修改默认身份？**
A: 界面右上角下拉框切换，选择后会自动刷新以应用新角色队列视图。
