# 能耗账单管理系统

基于 **SolidStart + Python Litestar + SQLite** 构建的全栈能耗账单流程管理系统，支持岗位权限控制、节点超时追踪、三单（抄表/账单/缴费）联动。

---

## 🌟 核心特性

### 🎯 岗位分工与流程
| 岗位 | 角色标识 | 职责 |
|------|----------|------|
| 能耗账登记员 | `registrar` | 发起/补正账单、录入抄表、生成账单、登记缴费 |
| 能耗账审核主管 | `auditor` | 审核办理、通过/驳回 |
| 产业园物业复核负责人 | `property` | 复核归档、缴费核销 |

### ⏱️ 节点超时追踪
- **登记节点**: 24小时超时
- **审核节点**: 48小时超时
- **复核节点**: 24小时超时
- 详情页展示超时节点、责任人、超时时长、下一步接收方
- 推进操作时可写入异常原因

### 🔗 三单联动
- 能耗抄表 → 影响账单 `has_meter_reading` 状态
- 账单生成 → 影响账单 `has_bill_generated` 状态
- 缴费核销 → 影响账单 `has_payment_verified` 状态
- 列表、详情、批量操作、统计数据来源一致

### 📊 数据一致性保证
- 状态变更以后端数据库为准
- 操作后自动刷新列表、详情、统计数据
- 所有状态变更均记录操作日志
- 接口返回错误信息明确，不使用通用失败提示

---

## 🚀 快速启动

### 1. 环境要求
- **Python**: >= 3.10
- **Node.js**: >= 18
- **SQLite**: 本地文件存储（无需额外安装）

### 2. 目录结构
```
trae-code-2/
├── backend/                 # 后端 Litestar 服务
│   ├── app/
│   │   ├── __init__.py
│   │   ├── models.py        # 数据模型
│   │   ├── database.py      # 数据库连接
│   │   ├── schemas.py       # 请求响应模型
│   │   ├── auth.py          # 认证与权限
│   │   ├── services.py      # 业务逻辑（超时计算、状态流转）
│   │   └── routers/         # API 路由
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── bills.py
│   │       ├── meter.py
│   │       └── payment.py
│   ├── main.py              # 服务入口
│   ├── init_db.py           # 数据库初始化脚本
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/                # 前端 SolidStart 应用
│   ├── src/
│   │   ├── components/      # 公共组件
│   │   ├── lib/             # API、状态管理
│   │   ├── routes/          # 页面路由
│   │   ├── entry-client.tsx
│   │   ├── entry-server.tsx
│   │   ├── root.tsx
│   │   └── root.css
│   ├── app.config.ts
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

### 3. 后端启动 (端口 8002)

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
# 或者使用 poetry
# poetry install

# 初始化数据库（建表 + 测试账号 + 样例数据）
python init_db.py

# 启动服务
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

### 4. 前端启动 (端口 3002)

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install
# 或
yarn install
# 或
pnpm install

# 启动开发服务器
npm run dev
```

### 5. 访问地址
| 服务 | 地址 | 说明 |
|------|------|------|
| 前端应用 | http://localhost:3002 | 主入口 |
| 后端API | http://localhost:8002 | API服务 |
| API文档 | http://localhost:8002/schema | Swagger/OpenAPI文档 |
| 健康检查 | http://localhost:8002/health | 服务状态检查 |

---

## 👤 测试账号

| 用户名 | 密码 | 岗位 | 说明 |
|--------|------|------|------|
| `registrar` | `123456` | 能耗账登记员 | 张登记 |
| `auditor` | `123456` | 能耗账审核主管 | 李审核 |
| `property` | `123456` | 产业园物业复核负责人 | 王物业 |

---

## 📋 样例数据

初始化后系统预置5条样例账单，覆盖不同状态：

| 账单编号 | 状态 | 节点 | 说明 |
|----------|------|------|------|
| EB-2026-06-001 | 待审核 | 审核节点 | **已超时30小时**（测试超时追踪） |
| EB-2026-06-002 | 草稿 | 登记节点 | 可编辑、提交审核 |
| EB-2026-06-003 | 已审核 | 复核节点 | 可复核归档 |
| EB-2026-06-004 | 已驳回 | 登记节点 | 可补正后重提 |
| EB-2026-05-001 | 已归档 | 已完成 | 流程完成样例 |

---

## 🔄 完整流程演示

### 标准流程
1. **registrar** 登录 → 新建账单 → 录入抄表 → 生成账单 → 提交审核
2. **auditor** 登录 → 审核通过（或驳回，填写异常原因）
3. **property** 登录 → 登记缴费 → 核销缴费 → 复核归档

### 超时演示
1. 使用 `auditor` 账号查看 `EB-2026-06-001` 详情
2. 红色超时面板展示：超时30小时、责任人、下一步接收方
3. 审核操作时可填写异常原因

### 批量操作
1. 列表页勾选多条相同状态的账单
2. 点击批量操作按钮（批量审核/批量归档等）
3. 查看操作结果统计

---

## 📡 API 概览

### 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录获取token |
| GET | `/api/me` | 获取当前用户信息 |
| GET | `/api/health` | 健康检查 |
| POST | `/api/refresh-overdue` | 刷新超时状态 |

### 账单接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bills` | 账单列表（支持筛选） |
| GET | `/api/bills/stats` | 账单统计 |
| GET | `/api/bills/{id}` | 账单详情（含超时信息、操作权限） |
| POST | `/api/bills` | 创建账单 |
| PUT | `/api/bills/{id}` | 更新账单 |
| DELETE | `/api/bills/{id}` | 删除账单 |
| POST | `/api/bills/{id}/action` | 执行状态流转操作 |
| POST | `/api/bills/batch-action` | 批量操作 |

### 抄表接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/meter-readings` | 录入抄表数据 |
| GET | `/api/meter-readings/{bill_id}` | 获取账单抄表记录 |

### 缴费接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/payments` | 登记缴费记录 |
| POST | `/api/payments/{id}/verify` | 核销缴费 |
| POST | `/api/bills/{id}/generate-bill` | 自动生成账单金额 |

---

## 🛠️ 技术栈

### 后端
- **框架**: Litestar 2.x (高性能 ASGI)
- **ORM**: SQLAlchemy 2.x
- **认证**: JWT (python-jose) + passlib (bcrypt)
- **数据库**: SQLite
- **验证**: Pydantic 2.x

### 前端
- **框架**: SolidStart 0.x (SolidJS 全栈框架)
- **路由**: @solidjs/router
- **状态管理**: SolidJS Context + Signals
- **构建**: Vinxi

---

## ⚠️ 注意事项

1. **数据库文件**: `backend/energy_bill.db`，删除后重新运行 `init_db.py` 即可重置
2. **Token有效期**: 24小时，过期后需重新登录
3. **权限控制**: 每个接口均校验用户角色，无权限返回403及明确错误信息
4. **超时刷新**: 列表页每30秒自动刷新，详情页每15秒自动刷新，也可手动刷新
5. **CORS**: 后端已配置允许跨域，前端可直接调用 `localhost:8002`

---

## 📝 开发说明

### 状态流转说明
```
草稿(DRAFT)
    ↓ [登记员提交审核]
待审核(PENDING_AUDIT)
    ├─↓ [审核主管通过]
    │  已审核(AUDITED)
    │      ├─↓ [物业复核通过]
    │      │  已归档(ARCHIVED)  [流程结束]
    │      └─↓ [物业复核驳回]
    │         复核驳回(REVIEW_REJECTED) → 返回登记员补正
    └─↓ [审核主管驳回]
       已驳回(REJECTED) → 返回登记员补正
```

### 错误响应格式
所有错误均返回结构化信息：
```json
{
  "code": 400,
  "message": "当前状态 draft 不允许执行 审核通过",
  "current_status": "draft",
  "required_status": ["pending_audit"]
}
```

---

## 🤝 验收要点核对清单

- ✅ **岗位分工**: 登记员/审核主管/物业 三个角色权限分离
- ✅ **超时追踪**: 按节点计算超时，详情展示超时节点、责任人、下一步
- ✅ **三单联动**: 抄表、账单生成、缴费核销互相影响账单状态
- ✅ **数据一致**: 列表/详情/批量/统计 数据来源统一，刷新后一致
- ✅ **操作记录**: 所有状态变更均记录日志，含异常原因
- ✅ **后端为准**: 状态变更由后端计算，前端展示
- ✅ **错误提示**: 接口返回明确错误，页面提示与接口一致
- ✅ **技术栈**: SolidStart(3002) + Litestar(8002) + SQLite
