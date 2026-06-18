# 进度报告管理系统

工程项目进度验收管理平台，实现三级审批流程和完整的进度追踪管理。

## 技术栈

### 前端
- **框架**: SvelteKit
- **语言**: TypeScript
- **样式**: CSS3
- **端口**: 3001

### 后端
- **框架**: NestJS
- **语言**: TypeScript
- **数据库**: SQLite (本地)
- **ORM**: TypeORM
- **认证**: JWT + Cookie
- **端口**: 8001

## 业务流程

### 岗位分工
1. **进度登记员** (registrar)：发起/补正进度报告
2. **进度审核主管** (supervisor)：审核进度报告
3. **工程监理公司复核负责人** (supervisor_engineer)：复核并归档

### 状态流转
```
草稿 → 待审核 → 审核中 → 审核通过/驳回 → 待复核 → 复核中 → 已归档/驳回
         ↓                ↓
    审核驳回         复核驳回
         ↑                ↑
      可补正           可补正
```

### 超时机制
- **正常**: 截止时间 > 2天
- **预警**: 截止时间 ≤ 2天
- **超时**: 已过截止时间

超时记录推进时需要留下原因和后续处理记录。

## 功能特性

- ✅ 角色权限控制：不同岗位可见不同字段、按钮和操作
- ✅ 状态流转控制：严格的状态机管理
- ✅ 超时自动计算：实时计算超时状态和超时时长
- ✅ 操作日志审计：所有状态变更都记录操作人、时间、前后状态
- ✅ 数据一致性：列表、详情、统计使用统一计算逻辑
- ✅ 模块关联：周报、偏差分析、业主汇报互相影响进度报告状态
- ✅ 统一响应格式：后端统一响应结构和异常处理
- ✅ 页面提示一致性：页面提示与接口返回信息保持一致

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
# 安装所有依赖（推荐）
npm run install:all

# 或分别安装
cd backend && npm install
cd ../frontend && npm install
```

### 初始化数据库

```bash
# 执行数据库种子脚本（创建测试用户和样例数据）
npm run seed:db

# 或手动执行
cd backend && npm run seed
```

### 启动服务

```bash
# 同时启动前后端（推荐）
npm run dev

# 或分别启动
# 后端（端口 8001）
cd backend && npm run start:dev

# 前端（端口 3001，新终端）
cd frontend && npm run dev
```

### 访问应用

打开浏览器访问: http://localhost:3001

## 测试账号

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| registrar | 123456 | 进度登记员 | 发起、补正进度报告 |
| supervisor | 123456 | 进度审核主管 | 审核进度报告 |
| engineer | 123456 | 工程监理复核负责人 | 复核、归档、删除 |
| registrar2 | 123456 | 进度登记员 | 发起、补正进度报告 |

## 项目结构

```
.
├── backend/                 # 后端 NestJS 项目
│   ├── src/
│   │   ├── common/         # 公共模块（枚举、守卫、拦截器、过滤器）
│   │   ├── modules/        # 业务模块
│   │   │   ├── auth/       # 认证模块
│   │   │   ├── users/      # 用户模块
│   │   │   ├── progress-reports/  # 进度报告核心模块
│   │   │   ├── weekly-reports/    # 周报模块
│   │   │   ├── deviation-analysis/ # 偏差分析模块
│   │   │   ├── owner-reports/     # 业主汇报模块
│   │   │   ├── operation-logs/    # 操作日志模块
│   │   │   └── statistics/        # 统计模块
│   │   ├── database/       # 数据库配置和种子
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env               # 环境配置
│   └── package.json
├── frontend/               # 前端 SvelteKit 项目
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/        # API 客户端封装
│   │   │   ├── components/ # 通用组件
│   │   │   ├── stores/     # 状态管理
│   │   │   ├── types/      # TypeScript 类型定义
│   │   │   ├── utils/      # 工具函数
│   │   │   └── styles/     # 全局样式
│   │   ├── routes/         # 页面路由
│   │   │   ├── login/      # 登录页
│   │   │   ├── progress-reports/  # 进度报告（列表、详情、新建、编辑）
│   │   │   ├── operation-logs/    # 操作记录
│   │   │   ├── +layout.server.ts
│   │   │   ├── +layout.svelte
│   │   │   └── +page.svelte       # 仪表盘
│   │   └── app.d.ts
│   └── package.json
└── package.json            # monorepo 配置
```

## 主要 API 接口

### 认证
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 获取当前用户

### 进度报告
- `GET /api/progress-reports` - 获取列表（支持筛选、分页）
- `GET /api/progress-reports/:id` - 获取详情
- `POST /api/progress-reports` - 创建
- `PATCH /api/progress-reports/:id` - 更新
- `DELETE /api/progress-reports/:id` - 删除
- `POST /api/progress-reports/:id/submit-review` - 提交审核
- `POST /api/progress-reports/:id/start-review` - 开始审核
- `POST /api/progress-reports/:id/review` - 审核（通过/驳回）
- `POST /api/progress-reports/:id/start-verification` - 开始复核
- `POST /api/progress-reports/:id/verify` - 复核（通过/驳回）
- `POST /api/progress-reports/:id/correct` - 补正
- `POST /api/progress-reports/:id/handle-timeout` - 处理超时
- `GET /api/progress-reports/statistics` - 获取统计数据

### 操作记录
- `GET /api/operation-logs` - 获取操作记录列表

### 统计
- `GET /api/statistics/overview` - 获取概览统计

## 页面说明

### 登录页
- 输入用户名密码登录
- 展示测试账号信息

### 仪表盘
- 统计卡片：总数、本月新增、超时、待处理
- 状态分布饼图数据
- 超时情况进度条
- 快捷操作入口

### 进度报告列表
- 筛选条件：关键词、状态、超时状态、责任人、日期范围
- 列表展示：标题、项目名、责任人、状态、超时状态、截止时间、异常原因、最近处理结果
- 快捷操作：提交、审核、复核、处理超时、删除
- 分页功能

### 进度报告详情
- 基本信息展示
- 超时告警提示
- Tab 切换：基本信息、关联模块、操作记录
- 操作按钮：根据角色和状态显示不同操作
- 弹窗交互：提交审核、审核、复核、补正、处理超时

### 新建/编辑报告
- 表单：标题、项目名、报告日期、截止时间、责任人、内容、异常原因
- 操作：保存草稿、保存并提交审核

### 操作记录
- 筛选条件：操作类型、操作人、日期范围
- 列表展示：操作时间、类型、操作人、关联报告、状态变更、详情、备注

## 数据一致性保证

1. **后端统一计算**：超时状态、超时时长每次查询时由后端统一计算
2. **状态以后端为准**：所有状态变更都通过后端接口，前端仅展示
3. **操作后刷新**：每次操作完成后调用 `invalidateAll()` 刷新所有数据
4. **统计数据来源统一**：列表、详情、统计页面使用相同的查询逻辑
5. **操作日志自动记录**：所有状态变更都自动生成操作日志

## 样例数据

数据库种子脚本会创建以下样例数据：

### 用户 (4个)
- 张三 (registrar) - 进度登记员
- 李四 (supervisor) - 进度审核主管
- 王五 (supervisor_engineer) - 工程监理复核负责人
- 赵六 (registrar2) - 进度登记员

### 进度报告 (6条)
包含各种状态的样例报告，涵盖正常、预警、超时三种超时状态。

## 开发说明

### 前端路径别名
- `$types` -> `src/lib/types`
- `$api` -> `src/lib/api`
- `$components` -> `src/lib/components`
- `$stores` -> `src/lib/stores`
- `$utils` -> `src/lib/utils`
- `$styles` -> `src/lib/styles`

### 后端环境变量 (.env)
```
PORT=8001
DB_PATH=./data/progress.db
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

## 注意事项

1. 首次启动前必须先执行数据库种子脚本
2. 前后端需要同时启动才能正常使用
3. 登录状态通过 Cookie 维持，关闭浏览器后需要重新登录
4. 操作记录不可删除，用于审计追踪
5. 已归档的报告不可编辑，仅可查看

## License

MIT
