# 汽车4S店 - 风险分级处置维修工单系统

一套完整的汽车4S店维修工单风险分级处置系统，覆盖**预约进厂 → 工单派修 → 交车回访**三阶段流程，支持维修登记员、维修审核主管、复核负责人三种角色办理。

## 功能特性

### 办理边界（角色分工）
| 角色 | 英文标识 | 负责办理阶段 |
|------|----------|------------|
| 维修登记员 | `registrar` | 发起工单 / 补正退回工单 / 重新提交 |
| 维修审核主管 | `supervisor` | 审核通过 / 退回补正 / 风险升级或降级 |
| 复核负责人 | `reviewer` | 复核通过归档 / 复核退回返工 |

### 三阶段流程
```
┌───────────────┐    提交审核    ┌───────────────┐   主管审核通过  ┌───────────────┐
│  预约进厂阶段  │ ─────────────▶│  工单派修阶段  │ ──────────────▶ │  交车回访阶段  │
│ (appointment) │◀── 退回补正 ── │  (dispatch)   │◀── 复核退回 ──  │  (delivery)   │
└───────────────┘                └───────────────┘                 └───────┬───────┘
                                                                             │
                                                                             ▼
                                                                         归档完成 (archived)
```

### 风险分级留痕
- 三档风险：**低风险 (low) / 中风险 (medium) / 高风险 (high)**
- 风险**升级**或**降级**均必须填写原因，独立写入操作记录
- 高风险工单在列表中使用 `左边框4px红色 + 渐变背景` 突出显示（不止改文字颜色）
- 风险变更独立接口，不与状态流转耦合

### 后端核心校验（任何操作失败自动保留原状态并写记录）
1. **当前处理人校验**：操作人的角色必须匹配该工单当前阶段的办理权限
2. **状态流转校验**：当前状态必须在合法的前置状态集合中
3. **版本号校验**：请求携带版本号必须与数据库当前版本一致（乐观锁，防并发冲突）
4. **必填证据校验**：提交审核时 `evidence_submitted=true`，证据清单非空
5. **操作留痕**：每次合法/非法操作均写入 `order_operations` 表（含IP、版本、风险变更、证据校验结果）

### 前端核心能力
- 顶部可**实时切换角色**，切换后队列、统计数字同步刷新
- 工单详情**三阶段流程图**高亮当前阶段
- 详情**上一步处理意见和结果**明显展示（退回红底/通过绿底/风险升级黄底）
- 详情底部**操作记录时间轴**，每步显示：操作人、角色、动作、前→后状态、意见、结果、风险变更标记、证据校验、版本、IP
- 按Tab筛选：**全部 / 我的待办 / 我创建的 / 草稿 / 审批中 / 已退回 / 高风险 / 逾期 / 已归档**

### 覆盖的样例场景（初始化自动生成）
| 工单号索引 | 客户 | 车辆 | 状态 | 风险 | 场景 |
|-----------|------|------|------|------|------|
| #1 | 张三 | 丰田凯美瑞 | 草稿 | 低 | **正常**：新建保养工单 |
| #2 | 李四 | 大众帕萨特 | 已提交待主管审核 | 中 | **正常**：故障维修待审核 |
| #3 | 王五 | 奔驰E300L | 高风险升级 | 高 | **高风险**：事故车+高端车型+大额维修 |
| #4 | 赵六 | 本田雅阁 | 主管通过待复核 | 低 | **正常**：厂家召回工单待复核 |
| #5 | 钱七 | 比亚迪汉EV | 退回登记员补正 | 中 | **缺证据+退回补正**：电池故障证据不全 |
| #6 | 孙八 | 奥迪A6L | 已归档 | 低 | **正常完成**：大保养完整走完三阶段 |
| #7 | 周九 | 宝马X5 | **已逾期** | 高 | **逾期**：配件海关延误超办理时限 |
| #8 | 吴十 | 特斯拉Model Y | **复核退回返工** | 中 | **状态冲突**：Autopilot校准不合格退回 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | **Angular 18 + Vite 5 + TypeScript** |
| 后端 | **Go 1.22 + Chi 路由 + GORM ORM** |
| 数据库 | **SQLite 3**（项目本地文件，首次启动自动建库） |
| 认证方式 | 简化：HTTP Header `X-User-Id: {用户ID}`（前端切换时自动设置） |

---

## 目录结构

```
trae-code-4/
├── backend/                         # Go 后端
│   ├── main.go                      # 入口
│   ├── go.mod
│   ├── config/config.go             # 配置（读 BACKEND_PORT 环境变量）
│   └── internal/
│       ├── database/database.go     # SQLite + GORM 自动迁移
│       ├── models/models.go         # User / RepairOrder / OrderOperation 模型
│       ├── middleware/auth.go       # X-User-Id 解析中间件
│       ├── handlers/                # API handlers（auth/orders/stats）
│       └── seed/seed.go             # 初始化样例数据（幂等）
│
├── frontend/                        # Angular 前端
│   ├── package.json
│   ├── vite.config.ts               # 读 FRONTEND_PORT / BACKEND_PORT
│   ├── angular.json / tsconfig*.json
│   └── src/
│       ├── main.ts / styles.css / index.html
│       ├── environments/
│       └── app/
│           ├── models/index.ts      # 类型定义 + 常量映射
│           ├── services/            # auth / order / stats + auth interceptor
│           ├── guards/              # 路由守卫
│           └── components/          # dashboard / order-list / order-detail / order-create / header / timeline
│
└── README.md
```

---

## 快速启动

### 前置条件
- **Go ≥ 1.22**
- **Node.js ≥ 18**（推荐 20+）
- **npm ≥ 9**
- 操作系统：macOS / Linux / Windows 均可

### 第一步：启动后端（建库 + 初始化样例 + 服务）

```bash
cd backend

# 1. 下载 Go 依赖（首次）
go mod download

# 2. 编译并启动
#    端口可自定义：演示时替换 {{BACKEND_PORT}}
BACKEND_PORT={{BACKEND_PORT}} go run main.go

# 或先编译二进制
go build -o repair-system .
BACKEND_PORT={{BACKEND_PORT}} ./repair-system
```

**启动后自动执行**：
1. 在 `backend/repair.db` 创建 SQLite 数据库（如不存在）
2. 自动迁移 `users / repair_orders / order_operations` 三张表
3. 用户表为空时，自动初始化 3 个角色 + 8 张样例工单 + 20+ 条操作记录（幂等）

**验证后端健康检查**：
```bash
curl http://localhost:{{BACKEND_PORT}}/api/health
# 返回: {"status": "ok", "message": "维修管理系统 API 服务运行正常"}
```

**获取所有用户（前端切换用）**：
```bash
curl http://localhost:{{BACKEND_PORT}}/api/auth/users
```

### 第二步：启动前端

```bash
cd frontend

# 1. 安装 npm 依赖（首次）
npm install

# 2. 启动开发服务器
#    前端端口：{{FRONTEND_PORT}}
#    后端端口：{{BACKEND_PORT}}（用于 /api 反向代理）
FRONTEND_PORT={{FRONTEND_PORT}} BACKEND_PORT={{BACKEND_PORT}} npm run dev
```

启动后浏览器打开：**http://localhost:{{FRONTEND_PORT}}**

---

## 演示指南

### 默认测试用户（顶部右上角切换）

| 下拉选择 | 角色 | 可办理事项 |
|---------|------|----------|
| 🟦 张登记 (X-User-Id: 1) | 维修登记员 | 创建工单、提交审核、补正退回工单后重新提交、删除草稿 |
| 🟧 李主管 (X-User-Id: 2) | 维修审核主管 | 审核通过 / 退回补正 / 风险升级 / 单独调整风险等级 |
| 🟩 王复核 (X-User-Id: 3) | 复核负责人 | 复核通过归档 / 复核退回返工 / 填写最终费用 |

### 推荐演示流程

#### 1️⃣ 正常流程（张登记 → 李主管 → 王复核）
- 切换**张登记**，点「新建工单」填写一张新工单（勾选必填证据），提交后自动进入李主管待办
- 切换**李主管**，在「我的待办」Tab 找到刚提交的工单，点击「通过」（填写意见）
- 切换**王复核**，在「我的待办」Tab 点击「复核通过」→ 填写最终费用 → 归档

#### 2️⃣ 退回补正流程（看 #5 钱七 比亚迪汉EV）
- 切换**张登记**，打开工单 #5（退回登记员补正），顶部可看到**红底退回意见**
- 点击「补正后重新提交」→ 勾选补充的证据 → 填写补正说明 → 提交
- 切换**李主管**待办可看到该工单变为重新提交状态

#### 3️⃣ 高风险识别与留痕（看 #3 王五 奔驰事故车）
- 任何角色打开工单 #3，左侧流程图+高风险徽章醒目标识
- 切换**李主管**，操作面板里可「调整风险」→ 选择降级为「中风险」→ 填原因
- 看时间轴最底部：自动记录 `downgrade:high->medium` 标记，同时工单列表左边框颜色变化

#### 4️⃣ 逾期工单（看 #7 周九 宝马X5）
- 首页统计卡片「逾期」数字显示 1
- 工单列表切换「逾期」Tab，可看到带逾期徽章的工单
- 打开详情：时间轴可清晰看到「配件延误→标记逾期→升级高风险」完整链路

#### 5️⃣ 复核退回返工（状态冲突，看 #8 吴十 特斯拉）
- 切换**王复核**打开工单 #8，顶部显示**红底 Autopilot 校准不合格退回意见**
- 切换**李主管**：该工单出现在主管待办中（`reviewer_rejected` 状态由主管重做后再提交）

### 后端 API 直连测试（绕过前端）

```bash
# 以李主管（X-User-Id: 2）身份审批 #2 工单（当前版本 2）
curl -X POST http://localhost:{{BACKEND_PORT}}/api/orders/2/supervisor-review \
  -H "X-User-Id: 2" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 2,
    "action": "approve",
    "opinion": "工单信息完整，安排张技师处理",
    "result": "主管审核通过"
  }'

# 模拟版本冲突（不传正确版本号）——后端保留原状态写失败记录
curl -X POST http://localhost:{{BACKEND_PORT}}/api/orders/2/submit \
  -H "X-User-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"version": 999}'
```

---

## 端口变量说明

本系统完全支持演示时自定义端口：

| 变量 | 作用 | 读取位置 |
|------|------|----------|
| `BACKEND_PORT` | 后端 HTTP 服务端口 | Go 后端 `config.Load()` 读，默认 8080 |
| `FRONTEND_PORT` | 前端 Vite dev server 端口 | `vite.config.ts` 读，默认 4200 |
| 同时 `vite.config.ts` 也读 `BACKEND_PORT` 做 `/api` 的反向代理，保证前端通过同源访问后端，无跨域问题。 |

---

## 核心状态机

| 状态值 (status) | 中文 | 下一合法状态 | 触发操作 |
|----------------|------|-------------|---------|
| `draft` | 草稿 | `submitted` | 登记员提交审核 |
| `submitted` | 已提交待审核 | `supervisor_approved` / `returned_to_registrar` / `high_risk_escalated` | 主管审核 |
| `returned_to_registrar` | 退回补正 | `resubmitted` | 登记员补正后重新提交 |
| `resubmitted` | 补正后重新提交 | `supervisor_approved` / `returned_to_registrar` / `high_risk_escalated` | 主管二审 |
| `high_risk_escalated` | 高风险升级 | `supervisor_approved` / `returned_to_registrar` | 主管特殊处理 |
| `supervisor_approved` | 主管审核通过 | `archived` / `reviewer_rejected` | 复核负责人归档或退回 |
| `reviewer_rejected` | 复核退回返工 | `supervisor_approved` | 主管处理后再提交 |
| `archived` | 已归档 | (终态) | 归档完成 |
| `overdue` | 已逾期 | 保持或人工调整 | 超 deadline 后标记 |

---

## 数据库表结构（SQLite）

### `users`（用户表）
| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 用户ID（X-User-Id 值） |
| username | TEXT UNIQUE | 登录名 |
| real_name | TEXT | 真实姓名 |
| role | TEXT | `registrar` / `supervisor` / `reviewer` |
| created_at / updated_at | DATETIME | |

### `repair_orders`（维修工单表）
核心列：`id, order_no(唯一工单号), customer_name, phone, vehicle_plate, vehicle_model, mileage, appointment_type, problem_description, status, risk_level, risk_reason, stage, repair_items, estimated_cost, final_cost, evidence_submitted, evidence_list(JSON字符串), deadline, current_handler, version(乐观锁), created_by_id, last_opinion, last_result, created_at, updated_at`

### `order_operations`（操作记录留痕表）
核心列：`id, order_id, operator_id, operator_name, operator_role, action, from_status, to_status, opinion, result, risk_change(如 upgrade:medium->high), evidence_check, version_checked, ip_address, created_at`

**每次操作（含非法操作）都会写入本表，可事后审计。**

---

## 常见问题

### Q: 如何清理样例数据重新初始化？
```bash
rm backend/repair.db && BACKEND_PORT={{BACKEND_PORT}} cd backend && go run main.go
```

### Q: 前端构建产物？
```bash
cd frontend && npm run build
# 产物在 frontend/dist/
```

### Q: 生产部署？
- 后端：`go build -o repair-system` 产生的二进制可直接部署，配 `BACKEND_PORT` + `DATABASE_PATH`
- 前端：`npm run build` 后 `dist/` 用 nginx 等托管，注意 `/api` 反代到后端端口
