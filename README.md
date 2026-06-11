# 服装加工厂-节点超时追踪打样任务系统

## 系统概述

本系统实现了服装加工厂打样任务的全流程节点超时追踪管理。系统按照岗位分工进行权限控制，打样任务在「订单打样 → 样衣确认 → 大货排产 → 归档」四个节点间流转，每个节点24小时超时自动追踪，实现从列表到详情到操作记录的完整超时追踪链路。

---

## 技术栈

| 层级 | 技术 | 端口 |
|------|------|------|
| 前端 | Next.js 14 App Router + TypeScript + Ant Design 5 + TailwindCSS | 3002 |
| 后端 | Rust Actix Web 4 + SQLx + SQLite | 8002 |
| 数据库 | SQLite 本地存储 | - |

---

## 项目结构

```
trae-code-2/
├── backend/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs            # 应用入口
│   │   ├── db.rs              # 数据库连接、初始化
│   │   ├── models.rs          # 数据模型、DTO、超时计算
│   │   ├── middleware/
│   │   │   └── auth.rs        # JWT认证中间件
│   │   ├── handlers/
│   │   │   ├── auth.rs        # 登录接口
│   │   │   ├── tasks.rs       # 任务CRUD、节点推进
│   │   │   └── statistics.rs  # 统计接口
│   │   └── migrations/
│   │       └── 001_initial_schema.sql  # 建表脚本
│   ├── .env                   # 环境变量
│   └── Cargo.toml
├── frontend/                   # Next.js 前端
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── tasks/[id]/page.tsx
│   │   └── statistics/page.tsx
│   ├── components/            # 公共组件
│   ├── lib/                   # axios、auth工具
│   ├── types/                 # TypeScript类型
│   └── package.json
└── README.md
```

---

## 快速启动

### 前置要求
- Rust >= 1.75
- Node.js >= 18.17
- npm >= 9.0

### 1. 启动后端（端口 8002）

```bash
cd backend

# 首次启动会自动：
# - 创建 ./data/sampling.db 数据库文件
# - 执行 SQL 建表
# - 初始化 3 个默认账号
cargo run
```

后端启动成功后会显示：
```
Server starting on 127.0.0.1:8002
Default users: registrar1/123456, auditor1/123456, reviewer1/123456
```

### 2. 启动前端（端口 3002）

```bash
cd frontend
npm install    # 首次需要
npm run dev
```

前端启动后访问：http://localhost:3002

---

## 默认账号

所有账号密码均为：**`123456`**

| 用户名 | 姓名 | 岗位 | 权限 |
|--------|------|------|------|
| `registrar1` | 李登记 | 打样登记员 | 发起打样任务、补正修改、提交审核 |
| `auditor1` | 王审核 | 打样审核主管 | 样衣确认办理、大货排产核准、打回补正 |
| `reviewer1` | 张复核 | 服装加工厂复核负责人 | 复核归档 |

---

## 样例入口与操作流程

### 完整业务流程演示

1. **【登记员】登录 → 发起打样任务**
   - 访问 http://localhost:3002/login
   - 用 `registrar1` / `123456` 登录
   - 进入「打样任务」→ 点击「新建打样任务」
   - 填写款号、款名、客户、面料等信息 → 提交
   - 任务进入「订单打样」节点，状态为「处理中」

2. **【登记员】提交审核**
   - 在任务列表找到刚创建的任务
   - 点击「提交审核」→ 填写备注（可选）→ 确认
   - 任务流转到「样衣确认」节点

3. **【审核主管】登录 → 办理样衣确认**
   - 注销当前用户，用 `auditor1` / `123456` 登录
   - 在「打样任务」列表看到待处理任务
   - 点击任务编号进入详情页，可查看：
     - 节点流程图（当前节点高亮）
     - 节点处理记录
     - 操作日志时间线
   - 点击「确认通过」→ 填写异常原因（可选）→ 确认
   - 任务流转到「大货排产」节点

4. **【审核主管】核准大货排产**
   - 在任务详情页点击「排产核准」
   - 任务流转到待「归档」状态

5. **【复核负责人】登录 → 复核归档**
   - 注销，用 `reviewer1` / `123456` 登录
   - 进入任务详情 → 点击「复核归档」
   - 任务完成，状态变为「已完成」

### 超时追踪演示

系统每个节点处理时限为 **24小时**：

- 列表页：超时任务**整行标红**，剩余时长红字显示，超时节点图标闪烁
- 详情页：超时节点显示**红色Warning图标**，标注超时时长和责任人
- 统计页：超时率、各节点超时分布一目了然

### 快速查看页面

| 页面 | 地址 | 说明 |
|------|------|------|
| 登录 | http://localhost:3002/login | 入口页 |
| 首页统计 | http://localhost:3002/dashboard | 总数、待处理、已超时、已完成卡片 |
| 打样任务列表 | http://localhost:3002/tasks | 超时高亮、多条件筛选、分页 |
| 任务详情示例 | http://localhost:3002/tasks/xxx | 节点流程、超时展示、推进操作 |
| 统计报表 | http://localhost:3002/statistics | 超时率、趋势图、分布图 |

---

## 核心功能特性

### 1. 岗位权限控制
- 不同岗位登录后看到不同的菜单、字段和操作按钮
- 登记员只能看到自己发起的任务
- 审核主管和复核负责人可看到所有任务

### 2. 节点超时追踪
- 每个节点自动计算处理时长，超过24小时标记为超时
- 列表页、详情页、统计页数据来源统一，不存在各算各的问题
- 超时节点记录责任人和处理时长

### 3. 状态联动
- 订单打样、样衣确认、大货排产三个节点互相影响
- 节点推进时自动更新任务状态、当前节点、各节点时间
- 打回补正时自动回退到上一节点

### 4. 数据一致性
- 所有状态变更以后端数据库为准
- 操作后自动刷新列表和详情，不依赖前端假数据
- 操作日志完整记录每次状态变更，可追溯

### 5. 异常记录
- 节点推进时可填写异常原因，永久记录
- 异常原因在详情页和节点记录中展示
- 操作日志记录每次操作的IP、时间、操作者

---

## API 接口列表

### 认证
- `POST /api/auth/login` - 登录

### 打样任务
- `GET /api/tasks` - 任务列表（支持筛选、分页）
- `GET /api/tasks/:id` - 任务详情（含节点记录、超时状态）
- `POST /api/tasks` - 创建任务（登记员）
- `PUT /api/tasks/:id` - 补正任务（登记员）
- `POST /api/tasks/:id/advance` - 节点推进（含异常原因）
- `POST /api/tasks/batch-advance` - 批量推进
- `GET /api/tasks/:id/logs` - 操作记录

### 统计
- `GET /api/statistics/summary` - 统计概览
- `GET /api/statistics/trend` - 近7天趋势数据

### 统一响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

错误响应示例：
```json
{
  "code": 400,
  "message": "该任务已归档，无法继续推进",
  "data": null
}
```

---

## 数据库表结构

### users（用户表）
- id, username, password_hash, real_name, role
- role: registrar / auditor / reviewer

### sampling_tasks（打样任务表）
- id, task_no, order_no, style_no, style_name, customer_name...
- current_node: order_sampling / sample_confirmation / production_scheduling / archived
- status: pending / processing / completed / rejected
- 各节点 started_at / completed_at 时间字段

### node_records（节点处理记录表）
- id, task_id, node_type, operator_id, action, remark, abnormal_reason
- started_at, completed_at, is_timeout, timeout_hours

### operation_logs（操作日志表）
- id, task_id, user_id, action, from_status, to_status, from_node, to_node
- detail, ip_address, created_at

---

## 常见问题

### Q: 首次启动后端报错找不到数据库？
A: 系统会自动创建 `./backend/data/sampling.db` 文件，请确保目录有写入权限。

### Q: 密码123456登录失败？
A: 检查后端启动日志是否显示 `Created default user`，如未初始化成功可删除 `data/sampling.db` 重启后端。

### Q: 前端请求后端跨域？
A: 后端已配置 `Cors::permissive()`，允许所有来源跨域访问。

### Q: 如何重置数据库？
A: 删除 `backend/data/sampling.db` 文件，重启后端即可重建数据库和默认账号。

---

## 开发说明

### 后端热重载（可选）
```bash
cargo install cargo-watch
cargo watch -x run
```

### 前端构建
```bash
cd frontend
npm run build
npm run start
```

### 后端目录下直接执行SQLite查询
```bash
sqlite3 data/sampling.db
.tables
SELECT * FROM users;
```
