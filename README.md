# 水务营业厅 · 抢修工单到期预警处置平台

面向水务营业厅的抢修工单三段式流转与到期预警处置系统。覆盖窗口人员建单登记 → 抄表主管过程核验 → 营业经理复核归档的完整链路，以到期预警（临期/逾期分级）驱动处置优先级，四重校验（权限/顺序/证据/并发）确保工单不被静默推进。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Remix 2 + React 18 + TypeScript + Tailwind CSS + lucide-react |
| 后端 | Go 1.22 + Chi v5 路由 |
| 数据库 | SQLite（modernc.org/sqlite 纯 Go 驱动，免 CGO） |
| 端口 | 前端 3004 / 后端 8004 |

## 快速启动

### 1. 启动后端

```bash
cd backend
go run ./cmd/server
```

默认端口 `8004`，CORS 允许 `http://localhost:3004`，数据库 `data/water_work_order.db`。
首次启动自动写入 10 条演示数据（含正常与异常样例）。

**环境变量（均可选，不写死）：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8004` | 后端监听端口 |
| `CORS_ORIGIN` | `http://localhost:3004` | 允许的前端跨域来源 |
| `DB_PATH` | `data/water_work_order.db` | SQLite 数据库文件路径 |

示例：自定义端口与 CORS

```bash
PORT=9000 CORS_ORIGIN=http://localhost:3000 DB_PATH=/tmp/water.db go run ./cmd/server
```

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认端口 `3004`，API 地址 `http://localhost:8004`。

**环境变量（可选）：**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `API_BASE_URL` | `http://localhost:8004` | 后端 API 地址（在 vite.config.ts 中通过 define 注入） |

示例：自定义后端地址

```bash
API_BASE_URL=http://localhost:9000 npm run dev
```

## 核心设计

### 四重校验引擎

每一步工单推进须经四重校验，任一不满足则拒绝并返回明确原因：

1. **权限校验**（forbidden）：当前操作人角色必须匹配阶段处理角色
2. **顺序校验**（wrong_order）：工单当前阶段必须与操作阶段一致
3. **证据校验**（missing_evidence）：必填材料齐全 + 处理意见非空
4. **并发校验**（concurrency_conflict）：乐观锁 version 匹配，防止两个页面同时提交

### 到期预警分级

| 档位 | 条件 | 颜色 |
|------|------|------|
| 正常 | 剩余 > 48h | 深水青 |
| 提醒 | 24h ~ 48h | 蓝 |
| 临期 | ≤ 24h | 琥珀 |
| 逾期 | ≤ 0h | 朱红（呼吸闪烁） |

临期与逾期工单在列表和预警看板中独立成列，不混入普通待办。

### 三阶段三状态

| 阶段 | 处理角色 | 推进动作 |
|------|----------|----------|
| 抢修工单登记 | 窗口人员 | 提交登记材料 |
| 过程核验 | 抄表主管 | 核验通过 / 退回 |
| 复核归档 | 营业经理 | 归档同步 / 退回 |

| 状态 | 含义 |
|------|------|
| 待审核（pending_review） | 等待当前阶段处理 |
| 审核通过（approved） | 核验已通过，等待归档 |
| 已同步（synced） | 终态，归档完成 |

## 演示数据

10 条工单覆盖正常与异常样例：

| 工单号 | 场景 |
|--------|------|
| WX-DEMO-001 | 登记阶段待提交（正常） |
| WX-DEMO-002 | 核验阶段待处理（正常） |
| WX-DEMO-003 | 核验阶段材料齐全（批量成功候选） |
| WX-DEMO-004 | 核验阶段缺核验记录单（证据缺失） |
| WX-DEMO-005 | 归档阶段待处理（正常） |
| WX-DEMO-006 | 归档阶段材料齐全（批量成功候选） |
| WX-DEMO-007 | 归档阶段缺归档凭证 + 逾期 |
| WX-DEMO-008 | 已同步（正常） |
| WX-DEMO-009 | 已同步 + 逾期 |
| WX-DEMO-010 | 核验阶段超时限 + 临期 |

演示账号：陈窗口（window_staff）、李主管（meter_supervisor）、王经理（business_manager）

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 用户列表 |
| GET | `/api/orders?role=&status=&stage=&warning=` | 工单列表（支持按岗位/状态/阶段/预警过滤） |
| GET | `/api/orders/{id}` | 工单详情（含三阶段记录、审计日志、预警信息） |
| POST | `/api/orders` | 创建工单 |
| POST | `/api/orders/{id}/stages/{stage}` | 阶段动作（submit/approve/reject） |
| POST | `/api/orders/batch` | 批量处理（approve/reject） |
| GET | `/api/stats` | 统计概览 |
| GET | `/api/warnings` | 到期预警分组（临期/逾期） |
