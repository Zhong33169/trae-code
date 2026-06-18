# 备件更换单异常申诉系统

基于 React + Vite + Rust Poem + SQLite 的备件更换单流程管理系统，支持正常登记、核验、复核归档，以及异常申诉的完整闭环。

## 一、目录结构

```
trae-code-3/
├── backend/            # Rust 后端 (Poem + SQLx + SQLite)
│   ├── Cargo.toml
│   ├── .env.example
│   └── src/
│       ├── main.rs     # API 路由与服务入口
│       ├── models.rs   # 数据模型与类型
│       ├── db.rs       # 数据库连接、建表、演示数据
│       └── service.rs  # 业务逻辑：状态机、角色校验、版本控制、证据校验
└── frontend/           # React 前端 (Vite + TypeScript)
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── styles.css
        ├── utils.tsx
        ├── api/        # axios 封装
        ├── types/      # TypeScript 类型
        └── pages/
            ├── Home.tsx         # 列表页（统计、筛选、队列）
            └── OrderDetail.tsx  # 详情页（信息、证据、处理记录、操作面板）
```

## 二、角色与办理边界

| 角色 | 人员 | 可办理的操作 |
|---|---|---|
| **备件更换登记员** (registrar) | 张登记员、李登记员 | 创建草稿、提交登记、被退回后申诉提交、被驳回后补正重提 |
| **备件更换审核主管** (auditor) | 王审核主管 | 核验通过、核验退回补正 |
| **复核负责人** (reviewer) | 赵复核负责人 | 受理申诉、复核确认通过、驳回补正、复核退回、归档 |

## 三、流程说明

### 3.1 正常流程

```
草稿(draft)
  ↓ 登记员 提交登记
已登记待核验(registered)
  ↓ 审核主管 核验
核验办理中(verifying) → 核验通过
  ↓
复核办理中(reviewing)
  ↓ 复核负责人 确认/归档
复核确认待归档(review_confirmed) → 已归档(archived)
```

### 3.2 异常申诉流程（重点）

```
核验退回补正(verify_returned)
  ↓ 登记员 提交申诉（可补证据+申诉理由）
申诉已提交(appeal_submitted)
  ├─→ 复核负责人 受理申诉 → 申诉已受理复核中(appeal_accepted)
  │                                     ├─→ 复核确认通过 → 归档
  │                                     ├─→ 复核退回补正(review_returned) → 登记员申诉
  │                                     └─→ 驳回补正(appeal_rejected_correction)
  │                                                          ↓ 登记员补正重提
  │                                                     申诉补正后重提(appeal_resubmitted)
  │                                                          ↓ 复核
  │                                                     归档 / 再次退回
  └─→ 复核负责人 驳回补正 → appeal_rejected_correction（同上闭环）
```

## 四、后端校验点

每次提交操作，后端都会校验并在失败时**保留原状态 + 写处理记录**：

1. **当前处理人**：操作者 `handler_id` 必须等于单据 `current_handler_id`
2. **角色**：操作者角色必须等于单据 `current_handler_role`
3. **状态**：状态必须匹配当前操作允许的前置状态（状态机）
4. **版本**：请求 `version` 必须等于单据 `version`（乐观锁，防并发冲突）
5. **证据**：关键节点（提交、核验通过、复核确认、归档）至少 2 份证据
6. **意见**：退回/驳回操作必须填写处理意见

## 五、启动步骤

### 5.1 启动后端（默认端口 8003）

```bash
cd backend

# 首次编译（会下载依赖，首次约 3-8 分钟）
cargo build

# 直接运行（自动建库 + 写入演示数据）
# 方式一：环境变量指定端口
PORT=8003 RUST_LOG=info ./target/debug/spare-part-backend

# 方式二：复制环境变量文件
cp .env.example .env   # 按需修改
cargo run
```

启动成功后：
- API 根路径：`http://localhost:8003/api`
- Swagger UI：`http://localhost:8003/swagger`
- SQLite 数据文件：`backend/data.db`（与 README 约定的项目本地文件一致）

### 5.2 启动前端（默认端口 3003）

```bash
cd frontend
npm install
npm run dev
```

打开浏览器访问：`http://localhost:3003`

Vite 已配置代理 `/api` → `http://localhost:8003`，无需跨域处理。

### 5.3 修改端口

**后端端口**：启动时加环境变量 `PORT=8003`（或改 `.env`）

**前端端口**：修改 `frontend/vite.config.ts` 的 `server.port`，同时同步修改代理目标。

```ts
// vite.config.ts
server: {
  port: 3003,  // 改这里
  proxy: {
    '/api': {
      target: 'http://localhost:8003',  // 后端端口同步
      changeOrigin: true,
    },
  },
},
```

## 六、演示数据说明

首次启动后端自动建表并写入 5 张样例单（覆盖用户要求的多种异常状态）：

| 编号 | 标题 | 当前状态 | 异常标记 | 说明 |
|---|---|---|---|---|
| BJ-2026-0001 | 阳光电站A区逆变器风扇更换 | **已归档** | 正常 | 全流程顺利通过的正常样例 |
| BJ-2026-0002 | 星河电站B组光伏组件接线盒更换 | **申诉驳回补正** | 缺证据 | 证据不足被驳回，待登记员补正重提 |
| BJ-2026-0003 | 海风电站C区汇流箱熔断器更换 | **核验办理中** | 逾期 | 办理超时（逾期标记），正常核验中 |
| BJ-2026-0004 | 绿洲电站D组跟踪电机减速箱更换 | **申诉已受理复核中** | 退回补正后申诉 | 核验退回 → 申诉 → 已受理，待复核确认 |
| BJ-2026-0005 | 南山电站E区SVG模块更换 | **复核办理中** | 正常 | 已核验通过，待复核归档 |

演示用户（通过页面右上角切换）：

| 账号 | 角色 | 公司 |
|---|---|---|
| 张登记员 | 备件更换登记员 | 光伏运维公司 |
| 李登记员 | 备件更换登记员 | 光伏运维公司 |
| 王审核主管 | 备件更换审核主管 | 备件更换审核部门 |
| 赵复核负责人 | 复核负责人 | 光伏运维公司 |

## 七、操作演示建议（异常路径优先）

1. 打开 `http://localhost:3003`
2. **异常路径演示**：切到 `赵复核负责人` → 点 **BJ-2026-0002 星河电站** → 可见"申诉驳回补正"状态、驳回原因、原状态、证据缺失标记 → 切回 `张登记员` → 补证据+填写补正说明 → **补正后重新提交** → 状态变成"申诉补正后重提" → 切到赵复核负责人 → 复核确认通过 → 归档
3. **退回路径演示**：切 `张登记员` → 新建一张登记单 → 提交 → 切 `王审核主管` → 核验退回（填原因）→ 切张登记员 → 提交申诉 → 切赵复核负责人 → 受理/驳回/确认，观察每步处理记录和状态跳转
4. 所有操作后：**列表队列、详情状态、顶部统计数字、处理记录时间线** 均会同步变化

## 八、重置数据

需要清空并重新生成演示数据：

```bash
cd backend
rm -f data.db data.db-shm data.db-wal
PORT=8003 RUST_LOG=info ./target/debug/spare-part-backend
```
