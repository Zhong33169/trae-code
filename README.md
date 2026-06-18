# 培训项目单管理系统

企业培训公司培训项目单管理系统，支持现场办理、异常申诉复核，确保责任、证据和状态不分散。

## 技术栈

- **前端**: TanStack Start (React 18 + TypeScript + TanStack Router + TanStack Query)
- **后端**: Python FastAPI + SQLAlchemy
- **数据库**: SQLite (本地文件)

## 目录结构

```
trae-code-1/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py           # 配置（端口、数据库路径等）
│   │   ├── database.py         # 数据库连接
│   │   ├── models.py           # ORM 数据模型
│   │   ├── schemas.py          # Pydantic Schemas
│   │   ├── crud.py             # 数据库 CRUD 操作
│   │   ├── services.py         # 核心业务逻辑（状态流转、校验）
│   │   └── main.py             # FastAPI 路由入口
│   ├── data/                   # SQLite 数据库文件目录（自动生成）
│   ├── seed_data.py            # 样例数据初始化脚本
│   └── requirements.txt        # Python 依赖
├── frontend/                   # TanStack Start 前端
│   ├── app/
│   │   ├── components/         # 通用组件
│   │   ├── hooks/              # React Hooks
│   │   ├── lib/                # 工具、类型、API 客户端
│   │   ├── routes/             # 路由页面（文件系统路由）
│   │   ├── client.tsx          # 浏览器端入口
│   │   ├── ssr.tsx             # SSR 入口
│   │   ├── router.tsx          # 路由配置
│   │   └── styles.css          # 全局样式
│   ├── app.config.ts           # TanStack Start 配置
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                    # 环境变量
└── README.md
```

## 角色与流程

### 三种角色

| 角色 | 说明 | 职责 |
|------|------|------|
| 培训项目登记员 (registrar) | 项目发起方 | 创建项目、提交审核、补正、申诉 |
| 培训项目审核主管 (supervisor) | 审核方 | 接收办理、审核通过/驳回、退回补正 |
| 企业培训公司复核负责人 (reviewer) | 复核方 | 最终复核、申诉复核、归档、标记逾期 |

### 三个阶段

1. **培训需求 (need)** - 提交需求文档
2. **方案报价 (quotation)** - 提交需求+报价单
3. **合同确认 (contract)** - 提交需求+报价单+合同

### 状态流转

```
草稿(draft) → 已提交(submitted) → 审核中(under_review)
    ↑              ↓                    ↓
    └──── 退回补正(returned)     审核通过/驳回
                                      ↓
                                通过 → 进入下一阶段/归档
                                驳回(rejected) → 申诉提交 → 申诉复核中
                                                      ↓
                                              申诉通过/申诉驳回 → 归档
```

## 快速开始

### 1. 环境要求

- Python 3.10+
- Node.js 18+
- npm / pnpm / yarn

### 2. 后端启动

```bash
# 进入后端目录
cd backend

# 创建并激活虚拟环境（可选但推荐）
python3 -m venv venv
source venv/bin/activate   # macOS / Linux
# venv\Scripts\activate    # Windows

# 安装依赖
pip install -r requirements.txt

# 初始化数据库 + 导入样例数据
python seed_data.py

# 启动后端服务（端口由 backend/.env 的 BACKEND_PORT 统一驱动，默认 8001）
python run.py
# 或：python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

后端启动后访问：
- API 文档 (Swagger): http://localhost:8001/docs
- API 文档 (ReDoc): http://localhost:8001/redoc

#### 修改后端端口

端口由 `backend/.env` 统一驱动，修改 `BACKEND_PORT` 即可（CORS 允许来源会跟随 `FRONTEND_PORT`）：

```bash
# backend/.env
BACKEND_PORT=8002

# 启动时也会读取该变量
python run.py

# 或临时覆盖
BACKEND_PORT=8002 python run.py
```

### 3. 前端启动

```bash
# 打开新终端，进入前端目录
cd frontend

# 安装依赖
npm install
# 或 pnpm install / yarn

# 首次启动前生成路由树（TanStack Start 必需）
npx @tanstack/router-generate
# 或启动时会自动生成

# 启动开发服务（默认端口 3001）
npm run dev
```

访问前端：http://localhost:3001

#### 修改前端端口 / 后端地址

端口与后端地址由 `frontend/.env` 统一驱动（`app.config.ts` 通过 `loadEnv` 读取）：

```bash
# frontend/.env
VITE_API_URL=http://localhost:8001/api   # 前端访问的后端 API 地址
BACKEND_PORT=8001                          # 后端端口（若不设 VITE_API_URL，则据此推导）
FRONTEND_PORT=3001                         # 前端端口

# 改端口只需改 .env 后重启
npm run dev
```

## 样例数据说明

执行 `python seed_data.py` 后会生成以下示例用户和项目：

### 用户

| 姓名 | 角色 | 说明 |
|------|------|------|
| 张明 | 培训项目登记员 | ID: 1 |
| 李华 | 培训项目登记员 | ID: 2 |
| 王芳 | 培训项目审核主管 | ID: 3 |
| 赵强 | 培训项目审核主管 | ID: 4 |
| 刘总 | 企业培训公司复核负责人 | ID: 5 |

### 项目样例（覆盖多种场景）

| 项目 | 状态 | 场景 |
|------|------|------|
| 新员工入职技能培训项目 | 已归档 (archived) | ✅ **正常通过全流程**：需求→报价→合同→审核→复核→归档 |
| 中层管理能力提升培训 | 草稿 (draft) | ⚠️ **缺证据**：报价阶段仅需求文档，少报价单；含一条「缺证据提交」状态冲突记录 |
| 销售人员业绩冲刺培训 | 逾期 (overdue) | ❌ **逾期**：截止时间已过5天 |
| 客户服务礼仪标准培训 | 退回补正 (returned) | 📝 **退回补正**：审核主管要求补充需求细节 |
| 安全生产法规培训 | 申诉复核中 (appeal_under_review) | ⚖️ **状态冲突/申诉中**：合同被驳回，登记员已申诉，待复核 |
| 技术研发人员技能升级培训 | 草稿 (draft) | 📄 新建草稿；含一条「版本冲突」状态冲突记录 |
| 品牌营销策划培训 | 审核中 (under_review) | ⏳ 审核主管待审核 |
| 数字化转型管理培训 | 已提交 (submitted) | 🔁 **再次提交示例**：申诉通过→转回补正→登记员补正后再次提交 |

## 核心功能验证流程（推荐跑一遍）

### 场景一：正常提交 → 审核 → 复核 → 归档

1. 以 **张明（登记员）** 身份查看列表
2. 打开 **技术研发人员技能升级培训**（草稿状态）
3. 进入「证据材料」Tab，添加需求文档
4. 点击「提交审核」
5. 切换用户为 **王芳（审核主管）**
6. 点击「接收办理」→「审核通过」（进入报价阶段）
7. 切换回 **张明（登记员）**，添加报价单后提交
8. 切换到 **王芳（审核主管）** 审核通过（进入合同阶段）
9. 张明添加合同后提交
10. 王芳审核通过（提交复核）
11. 切换到 **刘总（复核负责人）**，接收后审核通过
12. 点击「归档」

### 场景二：申诉流程（推荐直接用样例项目「安全生产法规培训」）

1. 切换到 **刘总（复核负责人）**
2. 打开 **安全生产法规培训**（申诉复核中）
3. 在「申诉记录」Tab 查看登记员的申诉理由和意见
4. 在「操作记录」Tab 查看完整的驳回原因
5. 选择「申诉通过」，填写复核意见后提交
6. 项目状态变为「退回补正」，当前处理人交还登记员，可继续补正后「再次提交」

### 场景三：退回补正

1. 以 **李华（登记员）** 身份打开 **客户服务礼仪标准培训**
2. 在详情页顶部查看上一处理人（王芳）的退回原因
3. 补充项目描述或证据材料后点击「补正提交」

### 场景四：登记员发起项目

1. 在列表页点击右上角「+ 发起项目」
2. 选择登记员，填写项目名称、客户公司、阶段、预算、截止时间
3. 可在「初始证据材料」区按当前阶段必填项添加证据（带 ★ 标记）
4. 点击「创建项目」，自动跳转到项目详情页，可继续提交审核

### 场景五：状态冲突记录（校验失败保留原状态）

1. 打开 **中层管理能力提升培训**（草稿，缺报价单），在「操作记录」Tab 可见一条红色高亮的「状态冲突」记录，原草稿状态被保留
2. 打开 **技术研发人员技能升级培训**（草稿），「操作记录」Tab 可见一条「版本冲突」状态冲突记录
3. 也可在详情页对缺证据项目直接点「提交审核」，后端返回 400 并再写一条状态冲突记录，项目状态不变

### 场景六：再次提交闭环（样例项目「数字化转型管理培训」）

打开 **数字化转型管理培训**，在「操作记录」Tab 可见完整闭环：
申诉通过(→退回补正) → 补正提交(→已提交)，即「申诉通过转回补正再提交」规则。

## 后端校验规则

项目提交时后端会校验以下内容，不通过则保留原状态并写入操作记录：

| 校验项 | 说明 |
|--------|------|
| 当前处理人 | 必须是项目的 `current_handler_id` |
| 角色权限 | 每种操作限定特定角色（如提交必须是登记员） |
| 状态 | 当前状态必须在允许的状态集合内 |
| 版本号 | 可选乐观锁，传入 `?version=` 时校验一致性 |
| 必填证据 | 每个阶段要求的证据类型必须齐全 |

- 需求阶段：必须有 `need_document`（需求文档）
- 报价阶段：必须有 `need_document` + `quotation_sheet`（报价单）
- 合同阶段：必须有 `need_document` + `quotation_sheet` + `contract`（合同）

## 主要 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表（支持 status/stage/handler_id 筛选） |
| GET | `/api/projects/{id}` | 项目详情（含证据、操作记录、申诉） |
| POST | `/api/projects` | 创建项目 |
| POST | `/api/projects/{id}/submit` | 登记员提交审核 |
| POST | `/api/projects/{id}/receive` | 审核/复核人员接收办理 |
| POST | `/api/projects/{id}/review/approve` | 审核通过 |
| POST | `/api/projects/{id}/review/reject` | 审核驳回 |
| POST | `/api/projects/{id}/return` | 退回补正 |
| POST | `/api/projects/{id}/correct` | 补正后重新提交 |
| POST | `/api/projects/{id}/appeal` | 提交申诉 |
| POST | `/api/projects/{id}/appeal/review` | 复核申诉 |
| POST | `/api/projects/{id}/archive` | 归档项目 |
| POST | `/api/projects/{id}/mark-overdue` | 标记逾期 |
| GET | `/api/statistics` | 统计数据 |
| GET | `/api/labels` | 标签映射（角色、状态、阶段等的中文） |

## 常见问题

### 路由树未生成

前端首次启动报错提示 `routeTree.gen.ts` 找不到：

```bash
cd frontend
npx @tanstack/router-generate
```

### 数据库重置

删除 `backend/data/training_projects.db` 后重新执行：

```bash
cd backend
python seed_data.py
```

### CORS 跨域

后端已默认允许所有来源的跨域请求，如部署到生产环境请在 `backend/app/main.py` 中限制 `allow_origins`。
