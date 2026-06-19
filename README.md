# 中央厨房留样记录异常申诉系统

基于 **Lit + Vite**（前端）和 **Node.js + Hono**（后端），SQLite 本地文件存储。实现中央厨房食品留样 → 温度记录 → 异常处置 → 申诉复核的全链路闭环。

---

## ✨ 功能一览

| 模块 | 说明 |
|---|---|
| 食品留样 | 排产文员建单，记录批次、产品、温度、存放位置 |
| 温度记录 | 多次测温，异常自动标红 |
| 证据材料 | 照片 / 温度记录 / 文档 / 视频，提交时后端校验数量 |
| 品控推进 | 品控主管推进：通过 / 退回补正 / 驳回 |
| 生产经理复核 | 经理最终复核，通过或驳回 |
| 异常申诉 | 文员可对驳回/补正发起申诉；申诉被驳回后可再次提交 |
| 操作记录 | 全链路时间轴，可见上一处理人意见和原状态变化 |
| 统计看板 | 按队列展示待处理、处理中、申诉中、已完成、已驳回数量 |

### 办理边界

| 角色 | 权限 |
|---|---|
| 排产文员 (clerk) | 建单、补充证据提交、发起申诉 / 再次提交申诉 |
| 品控主管 (qc_supervisor) | 审核留样记录、受理或驳回申诉 |
| 生产经理 (production_manager) | 最终复核通过 / 驳回 |

### 状态链路

```
草稿 draft
  └─ 提交 → 待品控审核 pending_review
        ├─ 通过 → 品控通过待复核 qc_approved → 经理通过/驳回
        ├─ 退回补正 → 待补正证据 evidence_missing → 补正后再次提交
        └─ 驳回 → qc_rejected ─┐
                                ├─ 文员申诉 → appeal_submitted → 品控受理/驳回
                                └─ 申诉被驳回后可再次提交
```

---

## 📁 目录结构

```
trae-code-4/
├── backend/                 # Hono + SQLite 后端
│   ├── .env                 # 端口/数据库配置
│   ├── data/                # SQLite 数据库文件目录（自动生成）
│   └── src/
│       ├── index.ts         # 服务入口
│       ├── app.ts           # 路由定义
│       ├── db.ts            # SQLite 连接
│       ├── schema.ts        # 建表脚本
│       ├── seed.ts          # 样例数据
│       ├── services.ts      # 业务逻辑 + 校验
│       └── types.ts
├── frontend/                # Lit + Vite 前端
│   ├── .env
│   ├── index.html
│   └── src/
│       ├── app.ts           # 根组件
│       ├── styles.css
│       ├── api.ts           # API 封装
│       ├── types.ts
│       └── components/      # 详情 / 各种操作弹窗
└── README.md
```

---

## 🚀 快速启动

> 需要 Node.js ≥ 18

### 1. 安装依赖

```bash
# 在项目根目录执行
npm install
```

### 2. 初始化数据库 + 写入样例数据

```bash
cd backend
npm run seed
```

执行后会在 `backend/data/app.db` 生成 SQLite 数据库文件，并写入 10 条样例，包含以下场景：

| 样例 | 状态 | 说明 |
|---|---|---|
| YL20240601 红烧排骨套餐 | manager_approved | ✅ **正常通过**：完整的建单→品控→经理链路 |
| YL20240602 清炒时蔬 | evidence_missing | ⚠️ **缺证据**：品控要求补正温度记录 |
| YL20240603 黑椒牛柳 | overdue | ❌ **逾期**：品控审核超时自动标记 |
| YL20240604 番茄鸡蛋汤 | qc_rejected → appeal_submitted | 🔄 **申诉中**：品控驳回，文员已提交申诉 |
| YL20240605 鱼香肉丝 | appeal_rejected | ⚠️ **申诉驳回**：证据链不完整，可再次提交 |
| YL20240606 宫保鸡丁 | pending_review | 🔵 待品控审核 |
| YL20240607 蒜蓉西兰花 | qc_approved | 🟢 品控通过，待经理复核 |
| YL20240608 麻婆豆腐 | appeal_submitted | 🟣 申诉待受理 |
| YL20240609 白切鸡 | draft | ⚪ 草稿，未提交 |
| YL20240610 酸辣土豆丝 | manager_rejected | 🔴 经理最终驳回（含完整申诉链路） |

### 3. 启动后端（端口 8004）

```bash
cd backend
npm run dev
# 或在根目录：npm run dev:backend
```

启动后访问 <http://localhost:8004/health> 看到 `{"status":"ok"}` 即为正常。

### 4. 启动前端（端口 3004）

新开一个终端：

```bash
cd frontend
npm run dev
# 或在根目录：npm run dev:frontend
```

也可以在项目根目录使用一条命令同时启动前后端：

```bash
npm run dev
```

### 5. 访问系统

打开浏览器访问 <http://localhost:3004>

---

## 🔧 端口调整

后端端口 8004 和前端端口 3004 均可修改：

### 修改后端端口

编辑 `backend/.env`：

```
PORT=8004           # 改成任意可用端口
FRONTEND_ORIGIN=http://localhost:3004
```

### 修改前端端口

编辑 `frontend/.env` 和 `frontend/vite.config.ts`：

```
# frontend/.env
VITE_API_PORT=8004  # 必须和后端端口一致
```

```typescript
// frontend/vite.config.ts
server: {
  port: 3004,  // 改成任意可用端口
}
```

同时更新 `backend/.env` 的 `FRONTEND_ORIGIN` 以匹配前端新端口。

---

## 🧪 典型演示流程

以 **YL20240602 清炒时蔬（缺证据）** 为例，走一遍补正 → 品控 → 经理：

1. 顶部角色选择 `张三(登记员)` → 待处理队列
2. 点开该记录详情 → 点击 **提交审核**（补充温度记录证据后提交）
3. 切换角色为 `李主管` → 处理中队列，看到该记录
4. 点开详情 → 点击 **品控审核**，选择「通过」
5. 切换角色为 `王经理` → 处理中队列
6. 点开详情 → 点击 **生产经理复核**，选择通过
7. 记录进入 **已完成**，操作记录时间轴完整保留

再试试异常申诉：

1. 打开 **YL20240605 鱼香肉丝（申诉被驳回）**
2. 切换至文员身份 → 点击 **提交申诉**（这是"再次提交"）
3. 切换至李主管 → 申诉中队列 → 申诉受理/驳回

---

## 🛠 常用命令

| 命令 | 说明 |
|---|---|
| `npm run seed` | 初始化数据库并重置样例数据 |
| `npm run dev:backend` | 启动后端（HMR） |
| `npm run dev:frontend` | 启动前端（HMR） |
| `npm run dev` | 同时启动前后端 |
| `npm run build` | 生产构建 |

---

## 🔐 后端校验逻辑

提交时后端会校验：

- **处理人匹配**：`X-Handler` 必须等于 `current_handler`
- **角色匹配**：`X-Role` 必须等于 `current_role`
- **版本匹配**：`X-Version` 必须等于当前记录 `version`（防并发冲突）
- **证据数量**：首次提交 ≥ 2 项，补正提交必须比原有证据多

校验不通过时：

- 保留原状态不变
- 在操作记录中写入失败原因
- 前端展示具体错误字段和消息

请求头示例：

```
POST /api/samples/:id/submit
X-Handler: 张三(登记员)
X-Role: clerk
X-Version: 1
Content-Type: application/json

{ "evidences": [{ "type": "temperature", "name": "温度记录.pdf", "url": "/mock/ev/new.pdf" }] }
```
