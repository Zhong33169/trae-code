# 冷链物流仓 - 风险分级处置冷链入库单系统

冷链入库单的全生命周期管理，按风险等级动态调整队列优先级和处理动作。

## 技术栈

- 后端：Go / Gin + SQLite（本地文件，无需外部服务）
- 前端：SvelteKit（Svelte 5）
- 默认端口：前端 3002，后端 8002（均可自定义）

## 快速启动

### 1. 前置条件

- Go 1.21+
- Node.js 18+
- SQLite3（Go 驱动内置，无需单独安装）

### 2. 启动后端

```bash
cd backend

# 首次：下载 Go 依赖
go mod tidy

# 编译
go build -o coldchain-server .

# 启动（默认端口 8002，首次启动自动建库+插入样例数据）
./coldchain-server -port 8002 -db ./data/coldchain.db

# 自定义端口
./coldchain-server -port 9000 -db ./data/coldchain.db
```

启动成功后输出：
```
样例数据已初始化完成
冷链入库单系统后端服务启动在 http://localhost:8002
```

### 3. 启动前端

```bash
cd frontend

# 首次：安装依赖
npm install

# 启动（默认前端 3002，代理后端 8002）
npm run dev

# 自定义端口（后端端口也要对应修改）
BACKEND_PORT=9000 FRONTEND_PORT=4000 npm run dev
```

启动成功后访问 http://localhost:3002

### 4. 一键重启（清除数据重新初始化）

```bash
# 后端
cd backend && rm -f data/coldchain.db && ./coldchain-server -port 8002 -db ./data/coldchain.db

# 前端（另一个终端）
cd frontend && npm run dev
```

## 办理边界与角色

| 角色 | 代码 | 可操作环节 |
|------|------|-----------|
| 仓管员 | warehouse_keeper | 创建入库单（登记）、补正提交 |
| 温控主管 | temp_supervisor | 过程核验（推进/退回） |
| 仓储经理 | warehouse_manager | 复核归档（推进/退回/强制修复冲突） |

## 流程状态

```
登记(registered) → 核验(verifying) → 归档(archived)
     ↓                  ↓
  退回补正(returned) ←──┘
     ↓
  补正提交 → 回到登记

逾期(overdue)：超时自动标记，可推进回核验
冲突(conflict)：版本/角色冲突，仓储经理可强制修复
```

## 风险分级处置规则

| 风险等级 | 队列优先级 | 推进条件 |
|---------|-----------|---------|
| 高风险(high) | 最高（排第一） | 必须提供全部3项证据（温度、质量、数量） |
| 中风险(medium) | 居中 | 必须提供温度记录证据 |
| 低风险(low) | 最低 | 标准流程即可 |

## 样例数据

系统首次启动自动插入 8 条样例入库单：

| 单号 | 产品 | 风险 | 状态 | 说明 |
|------|------|------|------|------|
| CC20260601001 | 冻虾仁 | 高 | 核验 | 证据齐全，正常核验中 |
| CC20260601002 | 鲜牛奶 | 中 | 归档 | 全流程已走完 |
| CC20260602001 | 冰鲜三文鱼 | 高 | 登记 | 缺少温度和质量证据 |
| CC20260602002 | 速冻水饺 | 低 | 登记 | 仅有温度记录 |
| CC20260603001 | 冷鲜牛肉 | 高 | 逾期 | 核验阶段逾期 |
| CC20260603002 | 冷藏酸奶 | 中 | 退回补正 | 被温控主管退回 |
| CC20260604001 | 冷冻羊肉卷 | 高 | 冲突 | 版本冲突异常状态 |
| CC20260605001 | 冷鲜猪肉 | 中 | 核验 | 缺质量证据 |

样例用户：

| 用户名 | 姓名 | 角色 |
|--------|------|------|
| zhangsan | 张三 | 仓管员（ID=1）|
| lisi | 李四 | 仓管员（ID=2）|
| wangwu | 王五 | 温控主管（ID=3）|
| zhaoliu | 赵六 | 仓储经理（ID=4）|

> 注意：用户 ID 首次初始化时自动递增，如数据库被删除重建，ID 可能变化。

## 后端校验逻辑

提交处理时后端依次校验：

1. **处理人校验**：当前操作者必须是入库单的 current_handler
2. **角色校验**：操作者角色必须匹配当前状态所需角色
3. **版本校验**：提交版本必须与数据库当前版本一致（乐观锁）
4. **证据校验**：
   - 高/中风险 → 推进必须提供温度记录
   - 高风险 → 推进必须提供全部3项证据
5. 校验不通过：保留原状态，写入操作记录（result=conflict/returned）

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/users | 获取用户列表 |
| GET | /api/stats | 统计数据 |
| GET | /api/orders | 入库单列表（支持 ?status=&risk_level=&handler_id= 筛选） |
| POST | /api/orders | 创建入库单 |
| GET | /api/orders/:id | 入库单详情（含操作记录） |
| PUT | /api/orders/:id/process | 处理推进 |
| POST | /api/orders/mark-overdue | 标记逾期 |

## 端口配置

两端端口均通过参数/环境变量可改：

```bash
# 后端
./coldchain-server -port 8002 -db ./data/coldchain.db

# 前端
BACKEND_PORT=8002 FRONTEND_PORT=3002 npm run dev
```

## 项目结构

```
backend/
├── main.go              # 入口，路由定义
├── database/db.go       # SQLite 初始化和建表
├── models/models.go     # 数据模型和常量映射
├── handlers/order.go    # 核心 API 处理逻辑
├── seed/seed.go         # 样例数据初始化
├── go.mod / go.sum
└── data/coldchain.db    # SQLite 数据库（自动生成）

frontend/
├── package.json
├── svelte.config.js
├── vite.config.js       # 代理配置+端口
├── src/
│   ├── app.html
│   ├── lib/api.js       # API 调用+常量映射
│   └── routes/
│       ├── +layout.svelte      # 导航布局
│       ├── +page.svelte        # 仪表盘
│       ├── orders/+page.svelte # 队列列表
│       ├── orders/[id]/+page.svelte  # 详情+处理
│       └── create/+page.svelte # 新建入库单
└── static/
```
