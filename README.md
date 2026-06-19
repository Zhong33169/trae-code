# 访客预约异常申诉复核系统

行政后勤中心访客预约异常申诉全流程管理系统，支持申诉登记、审核办理、复核归档三步闭环，每步操作均留痕可追溯。

## 技术栈

- **前端**：React Router v7 (Remix) + TailwindCSS，端口 3003
- **后端**：Python Litestar + SQLAlchemy + aiosqlite，端口 8003
- **数据库**：SQLite 本地文件 (`backend/data.db`)

## 快速启动

### 1. 前置条件

- Node.js >= 18
- Python >= 3.10
- pip

### 2. 初始化数据库

```bash
cd backend
pip install -r requirements.txt
python init_db.py
```

执行后会创建 `backend/data.db`，包含 3 个预设用户和 5 条样例申诉数据。

### 3. 启动后端

```bash
cd backend
BACKEND_PORT=8003 uvicorn app.main:app --host 0.0.0.0 --port 8003
```

或直接运行：

```bash
cd backend
python -m app.main
```

### 4. 启动前端

```bash
cd frontend
npm install
FRONTEND_PORT=3003 VITE_API_BASE=http://localhost:8003/api npm run dev
```

前端默认运行在 `http://localhost:3003`。

### 5. 访问系统

浏览器打开 `http://localhost:3003`

## 样例数据说明

系统预置 5 条不同状态的申诉，覆盖主要场景：

| 编号 | 访客 | 异常类型 | 当前状态 | 说明 |
|------|------|----------|----------|------|
| VZ-2026-001 | 陈明 | 正常通过 | 已归档 | 完整流程：提交→审核通过→复核归档 |
| VZ-2026-002 | 林芳 | 缺证据 | 待审核 | 无证据材料，审核通过时将校验失败 |
| VZ-2026-003 | 赵强 | 逾期 | 待复核 | 已审核通过，等待复核 |
| VZ-2026-004 | 周丽 | 退回补正 | 退回补正 | 审核退回，等待登记员补正 |
| VZ-2026-005 | 吴刚 | 状态冲突 | 已驳回 | 复核驳回，登记员可再次提交 |

## 用户角色

| 用户 | 角色 | 权限 |
|------|------|------|
| 张登记 | 登记员 | 发起申诉、补正再次提交 |
| 李审核 | 审核主管 | 审核办理（通过/驳回/退回补正） |
| 王复核 | 复核负责人 | 复核归档（通过/驳回/退回补正） |

左侧栏顶部可切换当前操作用户。

## 申诉流程

```
登记员发起/补正提交 → 审核主管办理 → 复核负责人复核归档
                         ↓                    ↓
                      驳回/退回补正 ←←←←←←←←←←┘
                         ↓
                    登记员再次提交
```

- **待审核** → 审核通过 → **待复核** → 复核通过 → **已归档**
- **待审核** → 审核驳回 → **已驳回** → 登记员再次提交 → **待审核**
- **待审核** → 退回补正 → **退回补正** → 登记员补正提交 → **待审核**
- **待复核** → 复核驳回 → **已驳回**
- **待复核** → 退回补正 → **退回补正**

## 后端校验规则

提交处理时后端会校验以下条件，不通过则保留原状态并写入 `validation_failed` 操作记录：

1. **处理人校验**：操作人必须是当前处理人
2. **角色校验**：操作人角色必须匹配当前处理角色
3. **状态校验**：申诉必须处于可处理状态（待审核/待复核）
4. **版本校验**：提交版本必须与当前版本一致（乐观锁）
5. **证据校验**：缺证据类型申诉，证据为空时不可通过

## 审计记录

所有操作（含失败）均写入 `operation_records` 审计表，确保全程可追溯：

| 字段 | 说明 |
|------|------|
| `operator_id` / `operator_name` / `operator_role` | 操作人 ID、姓名、角色 |
| `action` | 操作类型：submit / approve / reject / return / resubmit / archive / validation_failed |
| `opinion` | 操作人填写的意见 |
| `from_status` → `to_status` | 状态流转（失败时保持原状态） |
| `request_summary` | 请求摘要（如"访客姓名:xxx, 异常类型:xxx, 证据数:x"） |
| `failure_reason` | 失败原因（仅 `validation_failed` 时有值） |
| `appeal_id` | 关联申诉 ID（发起失败时为 NULL，仍可通过操作人追溯） |

**审计闭环覆盖场景**：
- ✅ 发起申诉失败（非登记员、缺证据）→ 写 `validation_failed`，`appeal_id = NULL`
- ✅ 办理失败（处理人不匹配、版本冲突、证据不足）→ 写 `validation_failed`，保留原状态
- ✅ 再次提交失败 → 写 `validation_failed`，保留原状态

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/appeals` | 申诉列表，支持 `?status=` 筛选 |
| GET | `/api/appeals/:id` | 申诉详情（含操作记录） |
| POST | `/api/appeals` | 发起申诉 |
| POST | `/api/appeals/:id/process` | 处理申诉 |
| POST | `/api/appeals/:id/resubmit` | 补正再次提交 |
| GET | `/api/stats` | 各状态计数统计 |
| GET | `/api/users` | 用户列表 |

## 端口与环境变量配置

| 环境变量 | 所在端 | 默认值 | 说明 |
|----------|--------|--------|------|
| `FRONTEND_PORT` | 前端 | 3003 | 前端 dev server 端口 |
| `VITE_API_BASE` | 前端 | `http://localhost:8003/api` | 后端 API 基址 |
| `BACKEND_PORT` | 后端 | 8003 | 后端服务端口（`python -m app.main` 启动时生效） |
| `DB_PATH` | 后端 | `./data.db` | SQLite 数据库文件路径 |

前后端均附带 `.env.example` 作为参考，复制为 `.env` 后可直接使用。

- 若通过 `uvicorn` 启动后端，端口由命令行 `--port` 参数决定
- 若通过 `python -m app.main` 启动后端，端口读取 `BACKEND_PORT` 环境变量
