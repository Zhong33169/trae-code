# 签约服务单管理系统

社区卫生服务中心家庭医生签约服务单管理演示系统。

## 技术栈

- **前端**: Fresh (Deno + Preact)
- **后端**: Node.js + Hono
- **数据库**: SQLite (本地文件)
- **样式**: Tailwind CSS

## 项目结构

```
trae-code-5/
├── backend/                # 后端服务
│   ├── src/
│   │   ├── db/            # 数据库相关
│   │   │   ├── connection.js   # 数据库连接
│   │   │   ├── init.js         # 建表脚本
│   │   │   └── seed.js         # 样例数据
│   │   ├── routes/        # 路由
│   │   │   └── api.js          # API 路由
│   │   ├── services/      # 业务逻辑
│   │   │   ├── contractService.js  # 签约服务单服务
│   │   │   └── userService.js      # 用户服务
│   │   ├── constants.js   # 常量定义
│   │   └── index.js       # 入口文件
│   ├── data/              # 数据库文件 (自动生成)
│   └── package.json
└── frontend/               # 前端应用
    ├── routes/            # 页面路由
    │   ├── index.tsx           # 首页（队列列表）
    │   ├── contract/
    │   │   └── [id].tsx        # 详情页
    │   └── _app.tsx            # 布局
    ├── lib/               # 工具库
    │   ├── api.ts              # API 客户端
    │   └── constants.ts        # 常量
    ├── static/            # 静态资源
    ├── dev.ts             # 开发入口
    ├── main.ts            # 生产入口
    ├── fresh.config.ts    # Fresh 配置
    ├── fresh.gen.ts       # 自动生成的路由清单
    └── deno.json
```

## 快速开始

### 前置要求

- Node.js >= 18
- Deno >= 1.40

### 1. 启动后端服务

```bash
cd backend
npm install
npm run seed    # 初始化数据库并载入样例数据
npm start       # 启动后端服务
```

后端默认运行在 **8005** 端口。

验证后端是否启动成功：

```bash
curl http://localhost:8005/api/health
```

### 2. 启动前端服务

```bash
cd frontend
deno task start
```

前端默认运行在 **3005** 端口。

打开浏览器访问: http://localhost:3005

### 3. 查看样例数据

系统预置了三个演示账号，点击右上角的用户切换按钮可以切换角色：

| 用户 | 角色 | 职责 |
|------|------|------|
| 张三 | 签约服务登记员 | 发起签约、补正材料、制定计划、履约确认 |
| 李四 | 签约服务审核主管 | 审核签约、审核服务计划 |
| 王五 | 社区卫生服务中心复核负责人 | 履约复核、归档 |

#### 样例签约服务单

系统预置了 12 条样例数据，覆盖各种状态和风险等级：

| 单据号 | 居民 | 风险 | 当前阶段 | 状态 | 说明 |
|--------|------|------|----------|------|------|
| QY202606200001 | 赵建国 | 高 | 家庭医生签约 | 待办理 | 正常待审核 |
| QY202606200002 | 钱小美 | 中 | 家庭医生签约 | 退回补正 | 缺身份证复印件 |
| QY202606200003 | 孙国华 | 高 | 服务计划 | 待办理 | 高风险优先处理 |
| QY202606180004 | 周大宝 | 高 | 家庭医生签约 | 逾期 | 审核超期未处理 |
| QY202606190005 | 吴秀兰 | 低 | 服务计划 | 草稿 | 签约已通过，待制定计划 |
| QY202606150006 | 郑建军 | 中 | 履约确认 | 待办理 | 待复核归档 |
| QY202606100007 | 冯小玲 | 低 | 家庭医生签约 | 待办理 | 低风险普通件 |
| QY202606050008 | 陈志强 | 高 | 履约确认 | 退回补正 | 履约材料不完整 |
| QY202606010009 | 林美玲 | 低 | 服务计划 | 待办理 | 孕产妇签约 |
| QY202605280010 | 黄富贵 | 中 | 履约确认 | 已归档 | 正常完成归档 |
| QY202606120011 | 杨振华 | 高 | 履约确认 | 逾期 | 复核超期 |
| QY202606210012 | 朱小红 | 低 | 家庭医生签约 | 草稿 | 新建空白单 |

## 核心功能

### 业务流程

```
家庭医生签约 → 服务计划 → 履约确认
```

每个阶段都需经过：**登记员提交 → 审核主管/复核负责人办理**

### 角色与权限

| 操作 | 登记员 | 审核主管 | 复核负责人 |
|------|:-----:|:-------:|:---------:|
| 创建签约单 | ✅ | - | - |
| 提交审核 | ✅ | - | - |
| 补正重提 | ✅ | - | - |
| 审核通过 | - | ✅ | - |
| 退回补正 | - | ✅ | ✅ |
| 不予通过 | - | ✅ | - |
| 复核归档 | - | - | ✅ |

### 风险分级

风险等级影响队列优先级和处理时限：

- **高风险 (红色)**: 优先级最高，时限更紧，需优先处理
- **中风险 (黄色)**: 正常优先级
- **低风险 (绿色)**: 优先级最低

优先级评分 = 风险基础分 + 时限紧迫度 + 状态权重
队列按优先级从高到低排序。

### 提交校验

提交时后端会校验以下内容，不通过则保留原状态并写操作记录：

1. **处理人校验**: 当前用户必须是单据的当前处理人
2. **角色校验**: 用户角色必须与单据当前角色匹配
3. **状态校验**: 当前状态必须允许该操作
4. **版本校验**: 提交版本必须与当前版本一致（乐观锁）
5. **证据校验**: 必填证据数量必须达标

### 操作记录

所有操作都会记录审计日志，包含：
- 操作人、角色
- 操作动作
- 状态/阶段变更前后
- 办理意见
- 版本变化
- 操作时间

## 端口配置

### 修改后端端口

```bash
# 方式一：环境变量
PORT=8080 npm start

# 方式二：修改 backend/src/index.js 默认值
```

### 修改前端端口

```bash
# 方式一：环境变量
PORT=3006 deno task start

# 方式二：修改 frontend/fresh.config.ts 默认值
```

### 修改 API 地址

前端默认调用 `http://localhost:8005/api`，如需修改：

```bash
# 方式一：环境变量
API_BASE_URL=http://api.example.com/api deno task start

# 方式二：修改 frontend/lib/constants.ts 默认值
```

## 常用命令

### 后端

```bash
cd backend

npm install          # 安装依赖
npm run init-db      # 仅建表（不导入样例数据）
npm run seed         # 建表并导入样例数据
npm start            # 启动服务
npm run dev          # 开发模式（自动重启）
```

重置数据库：

```bash
rm -f data/contract.db data/contract.db-*
npm run seed
```

### 前端

```bash
cd frontend

deno task start      # 开发模式（自动刷新）
deno task build      # 构建生产版本
deno task preview    # 预览生产版本
deno task check      # 代码检查
```

## API 接口

### 签约服务单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/contracts` | 查询列表（支持分页、筛选） |
| GET | `/api/contracts/stats` | 获取统计数据 |
| GET | `/api/contracts/:id` | 获取详情 |
| POST | `/api/contracts` | 创建签约单 |
| PUT | `/api/contracts/:id` | 修改基本信息 |
| POST | `/api/contracts/:id/submit` | 提交审核 |
| POST | `/api/contracts/:id/approve` | 审核通过 |
| POST | `/api/contracts/:id/return-correction` | 退回补正 |
| POST | `/api/contracts/:id/reject` | 不予通过 |
| POST | `/api/contracts/:id/archive` | 复核归档 |
| POST | `/api/contracts/:id/evidences` | 添加证据 |
| DELETE | `/api/evidences/:id` | 删除证据 |

### 请求头

所有接口通过请求头传递用户身份：

```
X-User-Id: 2
X-User-Role: AUDITOR
```

## 数据库表结构

### users 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | TEXT | 用户名 |
| name | TEXT | 姓名 |
| role | TEXT | 角色 (REGISTER/AUDITOR/REVIEWER) |

### contract_forms 签约服务单表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| form_no | TEXT | 单据编号（唯一） |
| resident_name | TEXT | 居民姓名 |
| id_card | TEXT | 身份证号 |
| phone | TEXT | 联系电话 |
| address | TEXT | 居住地址 |
| doctor_name | TEXT | 家庭医生 |
| team_name | TEXT | 服务团队 |
| risk_level | TEXT | 风险等级 (HIGH/MEDIUM/LOW) |
| stage | TEXT | 当前阶段 (SIGN/PLAN/PERFORM) |
| status | TEXT | 状态 |
| current_handler_id | INTEGER | 当前处理人 |
| current_role | TEXT | 当前处理角色 |
| version | INTEGER | 版本号（乐观锁） |
| deadline | DATETIME | 处理时限 |
| sign_content | TEXT | 签约内容 |
| plan_content | TEXT | 服务计划内容 |
| perform_content | TEXT | 履约内容 |
| evidence_required | INTEGER | 必填证据数 |
| evidence_submitted | INTEGER | 已提交证据数 |
| last_opinion | TEXT | 上一处理人意见 |
| last_result | TEXT | 上一处理结果 |
| last_handler_name | TEXT | 上一处理人姓名 |
| priority_score | INTEGER | 优先级评分 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### evidences 证据表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| contract_form_id | INTEGER | 关联签约单 |
| stage | TEXT | 所属阶段 |
| name | TEXT | 证据名称 |
| description | TEXT | 描述 |
| is_required | INTEGER | 是否必填 |
| uploaded_by | INTEGER | 上传人 |
| uploaded_at | DATETIME | 上传时间 |

### operation_logs 操作日志表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| contract_form_id | INTEGER | 关联签约单 |
| operator_id | INTEGER | 操作人 |
| operator_name | TEXT | 操作人姓名 |
| operator_role | TEXT | 操作人角色 |
| action | TEXT | 操作类型 |
| from_stage | TEXT | 变更前阶段 |
| to_stage | TEXT | 变更后阶段 |
| from_status | TEXT | 变更前状态 |
| to_status | TEXT | 变更后状态 |
| opinion | TEXT | 办理意见 |
| result | TEXT | 处理结果 |
| version_before | INTEGER | 变更前版本 |
| version_after | INTEGER | 变更后版本 |
| created_at | DATETIME | 操作时间 |

## 演示说明

本系统为纯演示版本，不接外部服务，所有数据存储在本地 SQLite 文件中。

演示时建议按以下路径查看：

1. **队列视角**: 打开首页，切换不同角色查看各自待办队列
2. **优先级排序**: 注意高风险、逾期、退回补正的单据排在前面
3. **流程流转**: 从登记员→审核主管→复核负责人，逐步查看每个阶段的详情
4. **证据查看**: 在详情页查看每个阶段的证据材料和必填项满足情况
5. **操作记录**: 在详情页右侧查看完整的审计日志
6. **办理操作**: 点击办理按钮（需当前处理人匹配）体验提交/审核/退回等操作
