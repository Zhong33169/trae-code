# 菜品上新流程管理系统

餐饮连锁企业菜品上新全流程管理系统，覆盖"登记员发起/补正 → 审核主管办理 → 总部复核负责人复核归档"三岗流水线。

核心特性：**补录校验影响后续动作，后岗不可替前岗补流程，缺证据/错角色/旧版本/错状态全部前后端拦截**。

## 技术栈

- 前端：Astro 5 + React 18 Islands + TailwindCSS 4 + Zustand
- 后端：Node.js + Express 4 + TypeScript (ESM) + better-sqlite3
- 数据库：SQLite（本地文件 `backend/data.db`）
- 前端端口：3002，后端端口：8002

## 初始化步骤

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 2. 启动服务

```bash
# 终端1：启动后端
cd backend
npm run dev

# 终端2：启动前端
cd frontend
npm run dev
```

后端启动后自动创建数据库表并插入演示数据（首次启动时）。

### 3. 访问

浏览器打开 http://localhost:3002/

## 演示账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 菜品上新登记员 | `registrar` | `123456` | 发起新单、补正被退回的单据 |
| 菜品上新审核主管 | `reviewer` | `123456` | 审核单据、退回补正 |
| 餐饮连锁总部复核负责人 | `archiver` | `123456` | 复核归档、退回审核 |

## 演示数据说明

系统预置 7 条样例单据，覆盖不同状态和测试场景：

| 单据编号 | 菜品 | 状态 | 设计目的 |
|----------|------|------|----------|
| CPXJ-001 | 秘制红烧肉 | 草稿 | 有登记证据，可正常提交 |
| CPXJ-002 | 清蒸鲈鱼 | 已提交 | 有登记证据，待审核 |
| CPXJ-003 | 宫保鸡丁 | 已提交 | **无证据**，审核时会提示缺核验证据 |
| CPXJ-004 | 蒜蓉西兰花 | 审核通过 | 有登记+核验证据，待归档（缺归档证据） |
| CPXJ-005 | 麻婆豆腐 | 退回补正 | 登记员可补正 |
| CPXJ-006 | 糖醋里脊 | 退回审核 | 审核主管可重新审核 |
| CPXJ-007 | 水煮牛肉 | 已归档 | 证据齐全，已完成全流程 |

## 校验规则

后端对所有操作执行强校验，绕过页面直接调 API 同样会被拦截：

| 错误码 | 含义 | 触发场景 |
|--------|------|----------|
| `WRONG_ROLE` | 当前角色无权执行此操作 | 登记员尝试审核、审核主管尝试发起单据 |
| `WRONG_STATUS` | 单据状态不允许此操作 | 对已归档单据执行审核 |
| `VERSION_CONFLICT` | 版本号冲突 | 使用旧版本号提交 |
| `MISSING_EVIDENCE` | 缺少必要证据 | 提交时无登记证据、审核时无核验证据、归档时无归档证据 |
| `DUPLICATE_SUBMISSION` | 重复提交 | 5秒内对同一单据同一操作重复提交 |
| `ALREADY_PROCESSED` | 单据已被处理 | 对已提交/已审核/已归档单据重复操作 |

## API 接口

### 认证

- `POST /api/auth/login` — 登录
- `GET /api/auth/me` — 获取当前用户
- `GET /api/auth/switch-role?role=registrar|reviewer|archiver` — 切换角色

### 单据

- `GET /api/orders` — 获取列表（支持 `status`/`role`/`keyword` 筛选）
- `GET /api/orders/:id` — 获取详情（含证据和操作日志）
- `POST /api/orders` — 创建新单
- `PUT /api/orders/:id/submit` — 提交
- `PUT /api/orders/:id/review` — 审核通过
- `PUT /api/orders/:id/review-return` — 退回补正
- `PUT /api/orders/:id/archive` — 复核归档
- `PUT /api/orders/:id/archive-return` — 退回审核
- `PUT /api/orders/:id/amend` — 补正重新提交
- `POST /api/orders/batch` — 批量操作

### 证据

- `GET /api/orders/:id/evidence` — 获取证据列表
- `POST /api/orders/:id/evidence` — 上传证据

## 重置数据

删除数据库文件后重启后端即可：

```bash
rm backend/data.db
cd backend && npm run dev
```
