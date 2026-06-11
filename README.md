# 广告代理公司-现场扫码核验创意需求单系统

## 项目概述

基于 Remix (前端) + Rust + Axum (后端) 构建的创意需求单扫码核验系统。

### 技术栈

- **前端**: Remix 2.x + React 18 + TypeScript + Tailwind CSS
- **后端**: Rust + Axum + SQLx (SQLite) + JWT 认证
- **端口配置**:
  - 前端: 3008 (可通过环境变量 `PORT` 修改)
  - 后端: 8008 (可通过环境变量 `PORT` 修改)

### 岗位角色

1. **创意需求登记员** (registrar): 发起/补正创意需求单
2. **创意需求审核主管** (supervisor): 办理审核，可通过/退回/拒绝
3. **广告代理公司复核负责人** (reviewer): 复核归档，可通过/退回/拒绝

### 状态流转

```
待登记员处理 → 待主管审核 → 待复核归档 → 已完成
                    ↓            ↓
                  已退回       已退回
```

### 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| registrar | registrar123 | 创意需求登记员 |
| supervisor | supervisor123 | 创意需求审核主管 |
| reviewer | reviewer123 | 广告代理公司复核负责人 |

## 快速启动

### 方式一：脚本启动

```bash
# 启动后端 (新终端)
chmod +x start-backend.sh
./start-backend.sh

# 启动前端 (新终端)
chmod +x start-frontend.sh
./start-frontend.sh
```

### 方式二：手动启动

#### 后端

```bash
cd backend
cargo run
```

#### 前端

```bash
cd frontend
npm install
npm run dev
```

## 核心功能

### 1. 扫码核验

- 支持输入创意需求单编号进行核验
- **无效码**: 返回 `INVALID_CODE` 错误，说明编号不存在
- **重复码**: 返回 `DUPLICATE_SCAN` 错误，说明已扫码过
- **非当前处理人**: 返回 `WRONG_HANDLER` 错误，明确说明当前处理角色

### 2. 创意需求单管理

- **列表页**: 按状态筛选、按角色筛选（只看我的）、统计面板、批量处理
- **详情页**: 可编辑（仅当前处理人），包含：
  - 基本信息
  - brief接收（材料、时限、处理意见）
  - 创意排期（材料、时限、处理意见）
  - 客户确认（材料、时限、处理意见）
  - 附件、备注、处理结果、退回说明
  - 审计记录

### 3. 状态流转前置条件

- 提交审核: brief接收材料和处理意见必须完整
- 提交复核: 创意排期材料和处理意见必须完整
- 完成归档: 客户确认材料和处理意见必须完整

### 4. 安全机制

- **越权控制**: 只有当前处理角色可以操作
- **顺序控制**: 状态流转严格按照流程
- **证据控制**: 流转前验证材料和意见完整性
- **并发控制**: 乐观锁（version版本号）防止同时提交
- **幂等性**: 重复扫码有记录，不静默推进

### 5. 审计日志

所有操作都记录审计日志，包括：
- 操作人、角色、时间
- 状态变更（旧状态 → 新状态）
- 操作详情、处理意见

## API 接口

### 认证

- `POST /api/auth/login` - 登录

### 创意需求单

- `GET /api/creative-demands` - 列表（支持 status、mine 查询参数）
- `POST /api/creative-demands` - 创建
- `GET /api/creative-demands/:id` - 详情
- `PUT /api/creative-demands/:id` - 更新
- `POST /api/creative-demands/scan` - 扫码核验
- `POST /api/creative-demands/:id/transition` - 状态流转
- `POST /api/creative-demands/batch-transition` - 批量流转
- `GET /api/creative-demands/statistics` - 统计数据

### 审计日志

- `GET /api/audit-logs` - 审计日志列表（支持 creative_demand_id 查询参数）

## 配置说明

### 后端配置 (backend/.env)

```
PORT=8008
DATABASE_URL=sqlite://creative_demand.db
JWT_SECRET=your-secret-key
FRONTEND_ORIGIN=http://localhost:3008
```

### 前端配置 (frontend/.env)

```
API_BASE_URL=http://localhost:8008
PORT=3008
```

## 项目结构

```
trae-code-8/
├── backend/
│   ├── src/
│   │   ├── main.rs              # 程序入口
│   │   ├── config.rs            # 配置管理
│   │   ├── models.rs            # 数据模型
│   │   ├── db.rs                # 数据库初始化
│   │   ├── middleware/
│   │   │   └── auth.rs          # JWT 认证中间件
│   │   ├── handlers/
│   │   │   ├── auth.rs          # 认证接口
│   │   │   ├── creative_demand.rs  # 创意需求单接口
│   │   │   └── audit_log.rs     # 审计日志接口
│   │   └── services/
│   │       ├── scan.rs          # 扫码核验逻辑
│   │       ├── transition.rs    # 状态流转逻辑
│   │       └── audit.rs         # 审计日志逻辑
│   ├── Cargo.toml
│   └── .env
├── frontend/
│   ├── app/
│   │   ├── root.tsx             # 根组件
│   │   ├── tailwind.css         # 样式
│   │   ├── api/
│   │   │   └── client.ts        # API 客户端和类型定义
│   │   └── routes/
│   │       ├── login.tsx        # 登录页
│   │       ├── _index.tsx       # 列表页
│   │       ├── create.tsx       # 新建页
│   │       └── demand.$id.tsx   # 详情页
│   ├── package.json
│   ├── remix.config.js
│   └── .env
├── start-backend.sh
├── start-frontend.sh
└── README.md
```

## 验证场景

1. **无效码测试**: 使用不存在的编号扫码
2. **重复码测试**: 同一用户重复扫码同一单
3. **非当前处理人测试**: 使用错误角色扫码
4. **角色切换测试**: 不同角色登录查看不同列表和操作
5. **批量处理测试**: 选择多条同状态记录批量流转
6. **并发提交测试**: 两个页面同时提交同一单（应触发版本冲突）
7. **证据缺失测试**: 材料/意见不完整时尝试流转
8. **越权操作测试**: 非当前处理人尝试修改/流转
