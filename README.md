# 媒介计划单管理系统

一个基于 SvelteKit + Rust + Axum + SQLite 的媒介计划单全流程审批管理系统。

## 功能特性

- 三角色审批流程：登记员 → 审核主管 → 复核负责人
- 版本号控制，防止并发操作冲突
- 批量操作支持，逐条返回结果
- 完整的权限校验和状态流转控制
- 媒介排期、预算、证据材料全链路管理
- 演示数据内置多种异常场景

## 技术栈

- **前端**: SvelteKit (Vite)
- **后端**: Rust + Axum
- **数据库**: SQLite
- **认证**: JWT

## 端口

- 前端: 3001
- 后端: 8001

## 快速开始

### 环境要求

- Node.js >= 18
- Rust >= 1.70
- SQLite (由 sqlx 自动管理)

### 启动后端

```bash
cd backend
cargo run
```

后端启动后会自动：
1. 创建 SQLite 数据库文件 (`./data/media_plan.db`)
2. 初始化数据库表结构
3. 加载演示数据

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

### 访问系统

打开浏览器访问: http://localhost:3001

## 演示账号

| 角色 | 用户名 | 密码 | 角色名称 |
|------|--------|------|----------|
| 登记员 | registrar | 123456 | 张登记 (媒介计划登记员) |
| 审核主管 | auditor | 123456 | 李审核 (媒介计划审核主管) |
| 复核负责人 | reviewer | 123456 | 王复核 (广告代理公司复核负责人) |

## 业务流程

### 角色职责

1. **媒介计划登记员**
   - 创建、编辑媒介计划单
   - 提交审核
   - 修改被驳回的计划单

2. **媒介计划审核主管**
   - 审核登记员提交的计划单
   - 审核通过或驳回
   - 审核通过后自动送入复核环节

3. **广告代理公司复核负责人**
   - 复核通过的计划单
   - 复核通过或驳回
   - 复核通过后可归档

### 状态流转

```
草稿 (draft)
  ↓ 提交
待审核 (pending_audit)
  ├─→ 审核通过 (audit_approved)
  │     ↓ 自动送复核
  │   待复核 (pending_review)
  │     ├─→ 复核通过 (review_approved)
  │     │     ↓ 归档
  │     │   已归档 (archived)
  │     └─→ 复核驳回 (review_rejected)
  │           ↓ 重新审核
  │         待审核 (pending_audit)
  └─→ 审核驳回 (audit_rejected)
        ↓ 修改后重提
      草稿 (draft)
```

## 演示数据说明

系统内置 10 条演示计划单，覆盖各种状态，便于测试：

| 编号 | 标题 | 状态 | 说明 |
|------|------|------|------|
| MP20250601001 | 夏季促销活动媒体投放计划 | 草稿 | 无证据，测试提交时的证据校验 |
| MP20250602002 | 新品上市全媒体推广计划 | 待审核 | 正常待审核 |
| MP20250603003 | 年终大促广告投放计划 | 待审核 | 正常待审核 |
| MP20250604004 | 品牌形象宣传计划 | 审核通过 | 审核通过状态 |
| MP20250605005 | 双十一大促媒体计划 | 审核驳回 | 有驳回原因 |
| MP20250606006 | 春节联欢晚会冠名计划 | 待复核 | 正常待复核 |
| MP20250607007 | 618年中促销计划 | 待复核 | 正常待复核 |
| MP20250608008 | 世界杯赛事合作计划 | 复核通过 | 复核通过，可归档 |
| MP20250609009 | 开学季教育推广计划 | 复核驳回 | 有驳回原因 |
| MP20250610010 | 周年庆活动媒体计划 | 已归档 | 已完成归档 |

## API 接口

### 认证

- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户

### 计划单

- `GET /api/plans` - 获取计划单列表
- `GET /api/plans/:id` - 获取计划单详情
- `POST /api/plans` - 创建计划单
- `PUT /api/plans/:id` - 更新计划单
- `POST /api/plans/:id/submit` - 提交审核
- `POST /api/plans/:id/approve` - 审核通过
- `POST /api/plans/:id/reject` - 审核驳回
- `POST /api/plans/:id/review` - 复核通过
- `POST /api/plans/:id/archive` - 归档
- `POST /api/plans/batch-review` - 批量操作

### 相关数据

- `GET /api/plans/:id/schedules` - 获取排期
- `GET /api/plans/:id/budgets` - 获取预算
- `GET /api/plans/:id/evidences` - 获取证据
- `GET /api/todo` - 获取待办列表

## 错误校验

后端会对以下情况进行校验并返回具体错误原因：

- **错角色**: 当前角色无权限执行操作
- **旧版本**: 版本号不匹配，需要刷新后重试
- **缺证据**: 提交前必须上传证据材料
- **错状态**: 当前状态不允许执行该操作
- **越权**: 只能操作自己创建的计划单（登记员）

## 开发说明

### 项目结构

```
.
├── backend/              # Rust 后端
│   ├── src/
│   │   ├── main.rs       # 入口
│   │   ├── db.rs         # 数据库初始化
│   │   ├── models.rs     # 数据模型
│   │   ├── handlers/     # API 处理器
│   │   ├── middleware/   # 中间件
│   │   ├── seed.rs       # 演示数据
│   │   ├── errors.rs     # 错误处理
│   │   └── state.rs      # 应用状态
│   ├── data/             # SQLite 数据文件
│   └── Cargo.toml
├── frontend/             # SvelteKit 前端
│   ├── src/
│   │   ├── routes/       # 页面路由
│   │   └── lib/          # 工具库
│   └── package.json
└── README.md
```

## License

MIT
