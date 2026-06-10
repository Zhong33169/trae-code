# 图书馆-异常申诉复核借阅记录系统

一个完整的图书馆借阅记录异常申诉复核流程管理系统。包含借阅记录登记、过程核验、复核归档三级流程，支持多种异常类型处理。

## 技术栈

- **前端**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **后端**: Rust + Actix Web + SQLx
- **数据库**: SQLite (本地文件)

## 目录结构

```
.
├── backend/          # Rust 后端
│   ├── src/
│   │   ├── main.rs      # 入口
│   │   ├── db.rs        # 数据库初始化和连接
│   │   ├── models.rs    # 数据模型
│   │   ├── handlers.rs  # API 处理器
│   │   ├── services.rs  # 业务逻辑
│   │   └── errors.rs    # 错误类型
│   ├── Cargo.toml
│   └── .env.example
├── frontend/         # Next.js 前端
│   ├── app/             # App Router 页面
│   ├── lib/             # 工具库
│   ├── package.json
│   └── .env.example
└── README.md
```

## 角色与流程

### 三种角色

| 角色 | 职责 |
|------|------|
| 借阅登记员 (registrar) | 借阅记录登记、补正、提交审核 |
| 借阅审核主管 (supervisor) | 借阅记录审核、通过或驳回 |
| 图书馆复核负责人 (director) | 复核归档、通过或退回补正 |

### 流程状态流转

```
草稿 (draft)
  ↓ [登记员提交]
待审核 (pending_audit)
  ├─→ [审核通过] 待复核 (pending_review)
  │     ├─→ [复核通过] 已归档 (archived)
  │     └─→ [复核驳回] 退回补正 (returned_correction)
  └─→ [审核驳回] 退回补正 (returned_correction)
        ↓ [登记员补正后重新提交]
      待审核 (pending_audit)
```

### 异常类型

- **正常**: 无异常
- **缺证据 (missing_evidence)**: 缺少必要的证据材料
- **逾期 (overdue)**: 借阅已逾期
- **状态冲突 (conflict)**: 系统状态与实际情况不一致

## 快速开始

### 前置要求

- Rust 工具链 (rustup, cargo)
- Node.js >= 18
- npm 或 yarn

### 1. 启动后端

```bash
cd backend

# 复制环境变量配置
cp .env.example .env

# 首次运行会自动建库并填充样例数据
cargo run
```

后端默认运行在 `http://localhost:8080`

### 2. 启动前端

```bash
cd frontend

# 复制环境变量配置
cp .env.example .env

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端默认运行在 `http://localhost:3000`

### 3. 查看样例数据

系统启动后会自动创建 7 条样例借阅记录，覆盖各种状态和异常类型：

| 记录编号 | 借阅人 | 状态 | 异常类型 |
|---------|--------|------|----------|
| BR20240001 | 陈明 | 已归档 | 正常 |
| BR20240002 | 刘洋 | 草稿 | 缺证据 |
| BR20240003 | 王芳 | 待复核 | 逾期 |
| BR20240004 | 赵强 | 退回补正 | - |
| BR20240005 | 孙丽 | 草稿 | 状态冲突 |
| BR20240006 | 周杰 | 待审核 | 正常 |
| BR20240007 | 吴敏 | 待复核 | 正常 |

### 4. 示例用户

系统预置 4 个演示用户：

| 用户名 | 密码 | 角色 | 姓名 |
|--------|------|------|------|
| registrar1 | 123456 | 借阅登记员 | 张登记 |
| registrar2 | 123456 | 借阅登记员 | 李登记 |
| supervisor1 | 123456 | 借阅审核主管 | 王审核 |
| director1 | 123456 | 图书馆复核负责人 | 赵复核 |

> 演示模式：在详情页右上角可以切换当前身份，模拟不同角色的操作。

## 端口配置

### 后端端口

通过环境变量 `BACKEND_PORT` 配置，默认 `8080`。

```bash
# macOS / Linux
BACKEND_PORT=8090 cargo run

# 或修改 .env 文件
```

### 前端端口

通过环境变量 `FRONTEND_PORT` 配置，默认 `3000`。

同时需要配置 `BACKEND_PORT` 指向后端端口（用于 API 代理）。

```bash
# macOS / Linux
FRONTEND_PORT=3001 BACKEND_PORT=8090 npm run dev

# 或修改 .env 文件
```

使用模板变量占位符时：
- `{{FRONTEND_PORT}}` → 前端服务端口
- `{{BACKEND_PORT}}` → 后端服务端口

## 核心功能

### 1. 借阅记录列表
- 多维度筛选：按状态、按异常类型
- 实时统计数字显示
- 快速切换不同状态队列

### 2. 借阅记录详情
- 完整的借阅信息展示
- 证据材料清单（支持必填项标记）
- 处理记录时间线（完整的操作历史）
- 上一处理人的意见和结果展示
- 当前处理人信息

### 3. 流程操作
- **提交审核**: 登记员将草稿或退回补正的记录提交审核
- **审核办理**: 审核主管通过或驳回，填写意见和原因
- **复核归档**: 复核负责人通过归档或退回补正
- **补正提交**: 登记员补正后重新提交

### 4. 提交校验
- 校验当前处理人是否匹配
- 校验角色权限
- 校验当前状态是否允许操作
- 校验版本号（乐观锁，防止并发冲突）
- 校验必填证据项是否齐全
- 校验失败保留原状态并写入处理记录

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/users | 获取用户列表 |
| GET | /api/stats | 获取统计数据 |
| GET | /api/records | 获取借阅记录列表 |
| POST | /api/records | 创建借阅记录 |
| GET | /api/records/{id} | 获取借阅记录详情 |
| PUT | /api/records/{id} | 更新借阅记录 |
| POST | /api/records/{id}/submit | 提交审核 |
| POST | /api/records/{id}/audit | 审核办理 |
| POST | /api/records/{id}/review | 复核归档 |
| POST | /api/records/{id}/correct | 补正记录 |
| GET | /api/records/{id}/process-records | 获取处理记录 |
| GET | /api/records/{id}/evidence | 获取证据列表 |
| POST | /api/records/{id}/evidence | 添加证据 |

## 数据库表结构

### users - 用户表
- id, username, password, role, name, created_at

### borrow_records - 借阅记录表
- id, record_no, borrower_name, borrower_id, book_title, book_isbn
- borrow_date, due_date, return_date
- status, exception_type, version
- current_handler_id, current_handler_role
- description, created_at, updated_at

### evidence_items - 证据项表
- id, borrow_record_id, name, description, evidence_type
- is_required, file_path, uploaded_by, uploaded_at

### process_records - 处理记录表
- id, borrow_record_id, handler_id, handler_name, handler_role
- action, from_status, to_status
- opinion, reject_reason
- version_before, version_after
- created_at

## 演示流程推荐

1. 打开首页查看整体统计
2. 进入「借阅记录」查看所有记录
3. 打开 BR20240004（退回补正）：
   - 以「张登记」身份查看上一处理意见和驳回原因
   - 补正后重新提交
   - 切换到「王审核」身份进行审核
   - 切换到「赵复核」身份进行复核归档
4. 打开 BR20240002（缺证据）：
   - 尝试直接提交审核，观察缺少证据的提示
   - 添加必填证据后再提交
5. 打开 BR20240005（状态冲突）：
   - 查看异常类型和说明
   - 作为登记员提交处理

## 注意事项

- 本系统为演示用途，未实现真实登录认证，通过页面顶部切换身份
- 数据库文件位于 `backend/data/library.db`
- 首次启动自动建库和填充样例数据，删除 .db 文件可重置
- 所有操作均有处理记录，可在详情页查看完整历史
