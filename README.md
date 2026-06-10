# 社区团购平台 - 离线台账回填团购订单系统

## 项目概述

本系统是一个完整的社区团购订单管理平台，支持从商品上架到到货签收的全流程处理，并集成了离线台账回填功能。系统采用三级审批机制：团购登记员 → 团购审核主管 → 社区团购平台复核负责人。

## 技术栈

- **前端**: Nuxt 3 + Vue 3 + TypeScript + Pinia + Tailwind CSS
- **后端**: Node.js + NestJS + TypeORM
- **数据库**: SQLite
- **认证**: JWT
- **文件处理**: xlsx (Excel导入)

## 快速开始

### 环境要求

- Node.js >= 18.x
- npm >= 9.x

### 端口配置

系统支持通过环境变量配置端口：
- `FRONTEND_PORT`: 前端端口（默认: 3000）
- `BACKEND_PORT`: 后端端口（默认: 3001）

### 安装与启动

#### 1. 后端启动

```bash
cd backend
npm install
npm run seed          # 初始化数据库并导入种子数据
npm run dev           # 开发模式启动
```

后端服务启动后访问: `http://localhost:3001/api`

#### 2. 前端启动

```bash
cd frontend
npm install
npm run dev           # 开发模式启动
```

前端服务启动后访问: `http://localhost:3000`

### 测试账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 团购登记员 | `registrar` | `123456` | 发起订单、补正订单、提交审核、签收 |
| 团购审核主管 | `supervisor` | `123456` | 审核订单、发货、配送、标记异常 |
| 社区团购平台复核负责人 | `reviewer` | `123456` | 最终复核、归档、查看审计 |

## 核心功能

### 1. 角色与工作流

系统包含三级角色，每个角色有独立的操作权限：

#### 团购登记员 (registrar)
- 创建/编辑草稿订单
- 提交订单审核
- 对退回/异常订单进行补正
- 配送签收
- 上传附件
- 离线台账导入

#### 团购审核主管 (supervisor)
- 审核通过/退回订单
- 提交最终复核
- 发货、配送
- 标记异常（材料缺失、超时、退回）
- 商品上架/下架
- 批量处理订单
- 查看审计日志

#### 社区团购平台复核负责人 (reviewer)
- 最终复核通过/退回
- 订单归档
- 用户管理
- 查看所有审计日志

### 2. 订单状态流转

```
草稿 (draft)
  ↓ 提交审核
待审核 (pending_review)
  ├─→ 审核通过 (review_approved) ──→ 待复核 (pending_final_review)
  │                                    ├─→ 复核通过 (final_approved)
  │                                    │    ↓ 发货
  │                                    │  已发货 (shipped)
  │                                    │    ↓ 配送
  │                                    │  已配送 (delivered)
  │                                    │    ↓ 签收
  │                                    │  已签收 (signed)
  │                                    │    ↓ 归档
  │                                    │  已归档 (archived)
  │                                    └─→ 复核退回 (final_rejected) ─┐
  └─→ 审核退回 (review_rejected) ──────→ 补正后重新提交 ←─────────────┘

异常状态:
- 材料缺失 (materials_missing)
- 超时 (timeout)
- 异常 (exception)
- 已退回 (returned)
  ↓ 补正
重新进入草稿状态
```

### 3. 离线台账回填

#### 功能特点
- 支持 Excel/CSV 文件批量导入
- 导入批次管理，可追溯
- 自动检测重复导入和线上线下冲突
- **不静默覆盖**：冲突时标记并保留原有数据
- 支持单条重试
- 详细的差异记录

#### 导入模板格式

| 列名 | 说明 | 必填 |
|------|------|------|
| 订单编号 | 线下台账订单号 | 否（自动生成） |
| 社区名称 | 团购社区名称 | 是 |
| 联系人 | 联系人姓名 | 否 |
| 联系电话 | 联系电话 | 否 |
| 配送地址 | 配送地址 | 否 |
| 商品名称 | 商品名称 | 是 |
| 单价 | 商品单价 | 是 |
| 数量 | 商品数量 | 是 |
| 单位 | 计量单位 | 否（默认件） |
| 备注 | 订单备注 | 否 |
| 预计配送日期 | 预计配送日期 | 否 |

> 注意：同一订单的多个商品行会自动合并为一个订单

#### 冲突处理规则

1. **重复导入**：相同订单号的线下订单重复导入时，标记为"冲突"，不覆盖原有数据
2. **线上线下冲突**：订单号已存在且为线上订单时，标记为"冲突"，不静默覆盖
3. **数据不完整**：缺少必要字段的记录标记为"失败"
4. **支持重试**：失败和冲突的记录可单独重试

## 样例数据说明

### 正常流程样例

登录后可在订单列表中找到以下状态的订单用于测试：

1. **草稿订单** `TG202406100010` - 可提交审核
2. **待审核订单** `TG202406100002` - 主管可审核通过/退回
3. **审核通过订单** `TG202406100006` - 可提交最终复核
4. **待复核订单** `TG202406100007` - 复核人可通过/退回
5. **已签收订单** `TG202406100001` - 完整流程样例
6. **线下导入订单** `TG202406100011` - 来源为离线导入

### 异常流程样例

1. **材料缺失单** `TG202406100003`
   - 状态：材料缺失
   - 原因：缺少采购证明材料
   - 操作：可补正后重新提交流程

2. **超时单** `TG202406100004`
   - 状态：超时
   - 原因：配送超时超过48小时
   - 操作：可补正后重新提交流程

3. **退回单** `TG202406100005`
   - 状态：已退回
   - 原因：商品质量问题

4. **审核退回单** `TG202406100012`
   - 状态：审核退回
   - 原因：商品数量与库存不符，请核对后重新提交
   - 操作：登记员可编辑后重新提交

### 批量处理测试

1. 使用主管账号登录
2. 在订单列表勾选多个待审核订单
3. 点击"批量处理"，选择批量审核通过/退回
4. 查看批量处理结果，成功和失败会逐条说明

### 离线台账回填测试

1. 使用登记员或主管账号登录
2. 进入"离线台账回填"页面
3. 点击"导入台账"上传 Excel 文件
4. 查看导入结果：成功、失败、冲突数量
5. 点击批次查看详细记录和差异说明

## 审计日志

所有操作都会记录审计日志，包括：
- 操作人、操作时间
- 操作类型（创建、更新、审核、退回、导入等）
- 操作前后数据对比
- 失败原因（操作失败时）
- IP 地址

审计日志可在"审计日志"页面查看和筛选，支持按订单、操作类型、成功/失败筛选。

## 项目结构

```
.
├── backend/                    # 后端 NestJS 项目
│   ├── src/
│   │   ├── entities/          # 数据库实体
│   │   ├── auth/              # 认证模块
│   │   ├── user/              # 用户模块
│   │   ├── product/           # 商品模块
│   │   ├── order/             # 订单模块
│   │   ├── audit/             # 审计模块
│   │   ├── import/            # 离线导入模块
│   │   ├── common/            # 公共装饰器、守卫
│   │   ├── config/            # 配置
│   │   ├── database/          # 数据库种子数据
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── data/                  # SQLite 数据库文件
│   ├── uploads/               # 上传文件目录
│   └── package.json
│
└── frontend/                  # 前端 Nuxt 3 项目
    ├── pages/                 # 页面
    ├── components/            # 组件
    ├── stores/                # Pinia 状态管理
    ├── composables/           # 组合式函数
    ├── types/                 # TypeScript 类型
    ├── assets/                # 静态资源
    ├── nuxt.config.ts
    └── package.json
```

## API 接口

### 认证
- `POST /api/auth/login` - 登录
- `GET /api/auth/profile` - 获取当前用户信息

### 商品
- `GET /api/products` - 商品列表
- `GET /api/products/:id` - 商品详情
- `POST /api/products` - 创建商品
- `PUT /api/products/:id` - 更新商品
- `PUT /api/products/:id/on-shelf` - 上架
- `PUT /api/products/:id/off-shelf` - 下架

### 订单
- `GET /api/orders` - 订单列表
- `GET /api/orders/:id` - 订单详情
- `POST /api/orders` - 创建订单
- `PUT /api/orders/:id` - 更新订单
- `POST /api/orders/:id/submit` - 提交审核
- `POST /api/orders/:id/review-approve` - 审核通过
- `POST /api/orders/:id/review-reject` - 审核退回
- `POST /api/orders/:id/submit-final` - 提交复核
- `POST /api/orders/:id/final-approve` - 复核通过
- `POST /api/orders/:id/final-reject` - 复核退回
- `POST /api/orders/:id/ship` - 发货
- `POST /api/orders/:id/deliver` - 配送
- `POST /api/orders/:id/sign` - 签收
- `POST /api/orders/:id/archive` - 归档
- `POST /api/orders/:id/exception` - 标记异常
- `POST /api/orders/:id/materials-missing` - 标记材料缺失
- `POST /api/orders/:id/timeout` - 标记超时
- `POST /api/orders/:id/return` - 退回订单
- `POST /api/orders/:id/rectify` - 补正订单
- `POST /api/orders/batch` - 批量处理
- `GET /api/orders/:id/attachments` - 附件列表
- `POST /api/orders/:id/attachments` - 上传附件

### 离线台账导入
- `POST /api/imports/upload` - 上传并导入
- `GET /api/imports/batches` - 批次列表
- `GET /api/imports/batches/:id` - 批次详情
- `GET /api/imports/batches/:id/records` - 批次记录
- `POST /api/imports/records/:id/retry` - 重试单条记录
- `GET /api/imports/statistics/summary` - 导入统计

### 审计日志
- `GET /api/audit-logs` - 审计日志列表
- `GET /api/audit-logs/:id` - 审计日志详情
- `GET /api/audit-logs/order/:orderId` - 订单审计日志

## 开发说明

### 数据库
项目使用 SQLite 数据库，数据库文件位于 `backend/data/app.db`。

初始化种子数据：
```bash
cd backend
npm run seed
```

种子数据包含：
- 3 个测试用户（三种角色各 1 个）
- 5 个商品
- 12 个示例订单（覆盖各种状态）
- 对应的审计日志

### 角色权限验证

系统不仅在前端隐藏按钮，后端也通过 `RolesGuard` 进行权限校验。即使知道接口地址，无权限用户也无法调用。

### 数据安全

- 密码使用 bcryptjs 加密存储
- JWT Token 认证
- 操作审计全程可追溯
- 离线导入冲突不静默覆盖，保留原始数据

## License

MIT
