# 社区健身房器械巡检管理系统

基于 Qwik City + Python Litestar 的社区健身房器械巡检管理系统，实现从巡检登记、故障报修、恢复确认到复核归档的完整业务流程。

## 功能特性

### 核心业务流程
- **器械巡检**：巡检员发起巡检，填写检查项目和结果
- **故障报修**：发现故障时可提交故障报修，高风险故障自动升级风险等级
- **恢复确认**：故障修复后进行恢复确认
- **复核归档**：复核员审核巡检单，可通过归档或退回补正

### 风险分级管理
- 风险等级（低/中/高）作为独立业务动作管理，而非备注字段
- 高风险巡检单单独识别，优先处理
- 风险等级升级/降级全程留痕，记录变更前后等级、原因和操作人

### 后端强制校验
提交时自动校验：
- 当前处理人身份和角色权限
- 巡检单当前状态（状态机约束）
- 版本号（乐观锁，防止并发修改冲突）
- 必填证据（非通过结果必须上传证据材料）
- 校验不通过时保留原状态，并记录操作日志

### 操作记录与审计
- 所有状态变更全程留痕
- 详情页可见上一处理人意见和结果
- 完整的时间线式操作记录

### 队列与统计同步
- 角色专属待办队列
- 实时统计数字（按状态、风险、结果、区域）
- 处理后队列、详情状态、统计数字同步更新

### 丰富的样例数据
包含多种业务场景：
- ✅ **正常**：巡检正常通过并归档
- ❌ **异常**：发现故障，待复核
- ⚠️ **高风险**：高风险器械，缺证据，紧急
- ↩️ **退回补正**：复核不通过，退回整改
- ⏰ **逾期**：超过办理期限，已归档
- 🔄 **状态冲突**：并发修改导致的状态冲突

## 技术栈

### 后端
- **框架**：Python 3.11+ + Litestar 2.x
- **ORM**：SQLAlchemy 2.x
- **数据验证**：Pydantic 2.x
- **数据库**：SQLite（本地文件）
- **服务器**：Uvicorn ASGI

### 前端
- **框架**：Qwik City 1.x
- **语言**：TypeScript 5.x
- **构建工具**：Vite 5.x

## 项目结构

```
trae-code-2/
├── backend/                    # 后端项目
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # 应用入口
│   │   ├── config.py          # 配置管理
│   │   ├── database.py        # 数据库连接
│   │   ├── models.py          # SQLAlchemy 模型
│   │   ├── schemas.py         # Pydantic 模式
│   │   ├── dependencies.py    # 依赖注入
│   │   ├── seed.py            # 样例数据生成
│   │   ├── routes/
│   │   │   └── inspection_routes.py  # API 路由
│   │   └── services/
│   │       └── inspection_service.py # 业务逻辑
│   ├── data/                  # 数据库文件目录
│   ├── .env                   # 环境变量
│   ├── .env.example
│   └── requirements.txt
├── frontend/                  # 前端项目
│   ├── src/
│   │   ├── routes/            # Qwik City 路由
│   │   │   ├── layout.tsx     # 根布局
│   │   │   ├── index.tsx      # 首页（工作台）
│   │   │   └── inspections/   # 巡检单相关页面
│   │   ├── components/        # 组件
│   │   ├── services/          # API 服务
│   │   ├── types/             # 类型定义
│   │   └── utils/             # 工具函数
│   ├── .env                   # 环境变量
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

## 快速开始

### 1. 环境准备

确保已安装：
- Python 3.11+
- Node.js 18+
- npm 或 yarn

### 2. 端口配置（可修改）

**后端端口**：`8002`
**前端端口**：`3002`

如需修改端口，分别编辑：
- 后端：`backend/.env` 中的 `BACKEND_PORT`
- 前端：`frontend/.env` 中的 `FRONTEND_PORT` 和 `VITE_BACKEND_URL`

**注意**：修改后端端口后，前端的 `VITE_BACKEND_URL` 也需要同步修改。

### 3. 后端启动

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 初始化数据库并生成样例数据
# 首次启动会自动建表并插入样例数据
python -m app.main
```

启动成功后访问：
- API 文档：http://localhost:8002/docs
- 健康检查：http://localhost:8002/health

### 4. 前端启动

```bash
# 进入前端目录（新终端）
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

启动成功后访问：http://localhost:3002

### 5. 查看样例数据

系统预置了 7 张巡检单，覆盖各种业务场景：

| 单号 | 器械 | 状态 | 风险 | 场景 |
|------|------|------|------|------|
| XJ-2026-001 | 跑步机-01 | 已归档 | 低 | ✅ 正常通过 |
| XJ-2026-002 | 椭圆机-01 | 待复核 | 中 | ❌ 异常，已报修 |
| XJ-2026-003 | 动感单车-01 | 待办理 | 高 | ⚠️ 高风险，缺证据 |
| XJ-2026-004 | 哑铃架-01 | 已退回 | 中 | ↩️ 退回补正 |
| XJ-2026-005 | 史密斯架-01 | 已归档 | 高 | ⏰ 逾期，有故障和恢复记录 |
| XJ-2026-006 | 划船机-01 | 办理中 | 中 | 🔄 状态冲突 |
| XJ-2026-007 | 跑步机-01 | 待办理 | 低 | 新发起巡检 |

预置测试用户：
| ID | 用户名 | 姓名 | 角色 |
|----|--------|------|------|
| 1 | inspector1 | 张巡检 | 巡检员 |
| 2 | handler1 | 李办理 | 办理员 |
| 3 | reviewer1 | 王复核 | 复核员 |

## 业务流程说明

### 标准流程
```
发起巡检 → 办理巡检 → 复核归档
    ↓           ↓
  故障报修 → 恢复确认
    ↓
高风险自动升级
```

### 状态流转

| 状态 | 说明 | 可执行操作 |
|------|------|------------|
| DRAFT（草稿） | 未提交 | 发起 |
| PENDING_HANDLING（待办理） | 已发起，待办理 | 办理，报修，变更风险 |
| IN_PROGRESS（办理中） | 办理中 | 完成办理，报修，变更风险 |
| PENDING_REVIEW（待复核） | 办理完成，待复核 | 复核通过，退回补正 |
| RETURNED（已退回） | 复核不通过 | 重新办理 |
| ARCHIVED（已归档） | 流程结束 | 查看 |

### 风险等级变更
- 低 → 中 → 高：手动升级，需填写原因
- 高 → 中 → 低：手动降级，需填写原因
- 高风险故障报修：自动升级为高风险
- 所有变更永久留痕

## API 接口

### 巡检单管理
- `GET /api/inspections` - 获取巡检单列表
- `GET /api/inspections/{id}` - 获取巡检单详情
- `POST /api/inspections/{id}/handle` - 办理巡检单
- `POST /api/inspections/{id}/review` - 复核归档
- `POST /api/inspections/{id}/return` - 退回补正
- `POST /api/inspections/{id}/risk` - 变更风险等级
- `POST /api/inspections/{id}/validate` - 提交前校验
- `GET /api/inspections/high-risk` - 获取高风险列表

### 故障与恢复
- `POST /api/fault-reports` - 提交故障报修
- `POST /api/recovery-confirms` - 确认恢复

### 查询与统计
- `GET /api/queue` - 获取角色专属队列
- `GET /api/statistics` - 获取统计数据
- `GET /api/users` - 获取用户列表
- `GET /api/equipments` - 获取器械列表

## 核心校验规则

### 办理校验
- 处理人角色必须为 **办理员**
- 状态必须为 **待办理** 或 **办理中**
- 版本号必须匹配（防止并发冲突）
- 非 **正常** 结果必须提供证据材料

### 复核校验
- 复核人角色必须为 **复核员**
- 状态必须为 **待复核**
- 版本号必须匹配

### 退回校验
- 复核人角色必须为 **复核员**
- 状态必须为 **待复核**
- 必须填写退回原因

### 风险变更校验
- 必须填写变更原因
- 版本号必须匹配
- 自动记录变更历史

## 演示说明

1. **首页工作台**：查看统计概览和待办队列
2. **巡检单列表**：筛选、搜索所有巡检单，高风险和逾期单高亮显示
3. **巡检单详情**：
   - 查看基本信息、检查项目、意见
   - 查看上一处理人意见（蓝色高亮）
   - 查看证据材料、风险变更记录、故障/恢复记录
   - 查看完整操作记录时间线
   - 根据状态进行办理、复核、退回、风险变更、故障报修、恢复确认等操作
4. **高风险单**：专门页面汇总所有高风险巡检单，优先处理

## 开发说明

### 后端重置数据库
```bash
cd backend
rm -f data/app.db
python -m app.main  # 会自动重建并重新生成样例数据
```

### 前端环境变量
```env
FRONTEND_PORT=3002
BACKEND_PORT=8002
VITE_BACKEND_URL=http://localhost:8002
```

### 后端环境变量
```env
BACKEND_PORT=8002
FRONTEND_PORT=3002
DATABASE_URL=sqlite:///./data/app.db
DEBUG=true
LOG_LEVEL=debug
```

## 常见问题

### Q: 端口被占用？
A: 修改 `.env` 文件中的端口号，前后端都需要对应修改。

### Q: 数据库需要重置？
A: 删除 `backend/data/app.db`，重启后端服务会自动重建。

### Q: 后端 API 文档在哪里？
A: 启动后端后访问 http://localhost:8002/docs 查看 Swagger UI。

### Q: 如何测试校验失败场景？
A: 使用错误的版本号、错误的角色、或者非通过结果不提供证据，后端会返回错误并保留原状态，操作记录中会有 "验证失败" 记录。
