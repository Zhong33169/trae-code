# 职业技能学校 - 附件缺失补正学员报名单系统

基于 **Astro + React Islands + Go + Gin + SQLite** 的学员报名单管理系统，支持招生顾问建单、教务主管核验、校务负责人复核的三级审批流程。

## 技术栈

- **前端**: Astro 4 + React 18 (Islands 架构)
- **后端**: Go 1.26 + Gin + GORM
- **数据库**: SQLite
- **认证**: JWT

## 快速开始

### 1. 启动后端

```bash
cd backend
go mod tidy
go run .
```

后端运行在 `http://localhost:8080`

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:4321`

### 3. 访问系统

打开浏览器访问 `http://localhost:4321`

## 角色说明

系统包含三种角色，各有不同的操作权限：

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 招生顾问 | admission1 / admission2 | 123456 | 新建报名单、上传附件、提交核验、补正后重新提交 |
| 教务主管 | academic1 | 123456 | 核验报名单、通过/退回、管理附件状态、批量操作 |
| 校务负责人 | admin1 | 123456 | 复核归档、退回补正、查看审计日志 |

> 登录页提供「快速登录」按钮，可直接切换角色演示。

## 业务流程

```
草稿 → 待核验 → 待复核 → 已归档
         ↓         ↓
      待补正 ←────┘
         ↓
      (重新提交)
```

1. **招生顾问**创建报名单（草稿状态），上传附件后提交核验
2. **教务主管**核验报名单和附件，通过则进入待复核，材料不全则退回补正
3. **校务负责人**复核报名单，通过则归档，有问题可退回补正
4. 被退回的报名单，招生顾问补齐附件后可重新提交

## 种子数据说明

系统首次启动时会自动初始化数据库并创建演示数据。

### 正常样例

| 编号 | 学员 | 状态 | 说明 |
|------|------|------|------|
| #1 | 陈小明 | 待核验 | 材料齐全，等待教务主管核验 |
| #3 | 王小强 | 待复核 | 已通过教务核验，等待校务复核 |
| #4 | 赵小美 | 已归档 | 完整流程走完的归档单 |
| #7 | 吴小军 | 草稿 | 新建未提交的草稿单 |

### 异常样例

| 编号 | 学员 | 状态 | 异常类型 | 说明 |
|------|------|------|----------|------|
| #2 | 刘小红 | 待补正 | 缺材料 | 缺少身份证复印件和学历证明 |
| #5 | 孙小伟 | 待补正 | 超时 | 照片不符合要求，且已超过补正截止日期 |
| #6 | 周小丽 | 已退回 | 退回 | 学历不符合报名要求，被最终驳回 |

## 功能特性

### 报名单列表
- 按状态筛选（全部/草稿/待核验/待补正/待复核/已归档/已退回）
- 超时筛选（仅显示超时单）
- 关键词搜索（姓名/电话/专业）
- 批量操作（教务主管可批量通过/退回待核验单）
- 超时单红色高亮显示

### 报名单详情
- 基本信息展示
- 附件材料管理（上传、通过、驳回、删除）
- 被驳回的附件保留驳回原因
- 退回原因展示
- 校务复核备注
- 审计日志时间线
- 状态流转可视化
- 根据角色显示对应操作按钮

### 审计日志
- 记录所有状态变更和操作
- 包含操作人、角色、时间、原因
- 可按操作人筛选
- 校务负责人可查看全局审计日志

## 端口配置

- **前端端口**: `4321` (可通过 `FRONTEND_PORT` 环境变量修改)
- **后端端口**: `8080` (可通过 `BACKEND_PORT` 环境变量修改)

前后端通过 Vite 代理通信，前端请求 `/api/*` 会自动转发到后端。

## 项目结构

```
.
├── backend/                    # Go 后端
│   ├── main.go                 # 入口文件
│   ├── models/                 # 数据模型
│   │   └── models.go
│   ├── database/               # 数据库初始化
│   │   └── database.go         # 含种子数据
│   ├── handlers/               # API 处理函数
│   │   ├── auth.go
│   │   ├── enrollment.go
│   │   ├── attachment.go
│   │   └── audit.go
│   ├── middleware/             # 中间件
│   │   ├── auth.go             # JWT 认证 + 角色权限
│   │   └── cors.go
│   ├── .env
│   └── go.mod
│
└── frontend/                   # Astro 前端
    ├── src/
    │   ├── pages/              # 页面 (Astro)
    │   │   ├── index.astro
    │   │   ├── login.astro
    │   │   ├── audit.astro
    │   │   └── enrollments/
    │   ├── components/         # React 组件 (Islands)
    │   │   ├── App.tsx
    │   │   ├── LoginForm.tsx
    │   │   ├── Header.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── EnrollmentList.tsx
    │   │   ├── EnrollmentDetail.tsx
    │   │   ├── CreateEnrollment.tsx
    │   │   └── AuditLogList.tsx
    │   ├── layouts/
    │   │   └── BaseLayout.astro
    │   └── lib/
    │       ├── api.ts          # API 封装
    │       └── types.ts        # 类型定义
    ├── astro.config.mjs
    ├── package.json
    └── tsconfig.json
```

## API 接口

### 认证
- `POST /api/login` - 登录

### 报名单
- `GET /api/enrollments` - 获取报名单列表
- `GET /api/enrollments/:id` - 获取报名单详情
- `POST /api/enrollments` - 创建报名单（招生顾问）
- `POST /api/enrollments/:id/submit` - 提交核验（招生顾问）
- `POST /api/enrollments/:id/verify` - 核验（教务主管）
- `POST /api/enrollments/:id/review` - 复核（校务负责人）
- `POST /api/enrollments/batch-verify` - 批量核验（教务主管）

### 附件
- `GET /api/attachments/enrollment/:id` - 获取附件列表
- `POST /api/attachments/enrollment/:id` - 上传附件
- `POST /api/attachments/:id/approve` - 通过附件
- `POST /api/attachments/:id/reject` - 驳回附件
- `DELETE /api/attachments/:id` - 删除附件

### 审计
- `GET /api/audit/enrollment/:id` - 获取单条报名单审计日志
- `GET /api/audit` - 获取全部审计日志（校务负责人）

## 验收测试用例

### 1. 正常单流程
- 用 `admission1` 登录，新建报名单并上传附件
- 提交核验 → 状态变为「待核验」
- 切换到 `academic1`，核验通过 → 状态变为「待复核」
- 切换到 `admin1`，复核归档 → 状态变为「已归档」

### 2. 缺材料单
- 查看 #2 刘小红（待补正状态）
- 附件列表只有 2 个，缺少身份证背面和学历证明
- 切换招生顾问，补充附件后重新提交
- 教务主管再次核验

### 3. 超时单
- 查看 #5 孙小伟（待补正 + 超时）
- 列表中红色高亮，状态标签显示「(超时)」
- 详情页截止日期标红

### 4. 退回单
- 查看 #6 周小丽（已退回状态）
- 有明确的退回原因
- 审计日志可追溯完整操作记录

### 5. 批量操作
- 教务主管登录，在「待核验」列表勾选多条
- 批量通过 / 批量退回
- 结果逐条显示成功/失败及原因
