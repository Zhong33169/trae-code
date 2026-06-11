# 建筑施工项目部 - 分包进场单移动补录校验系统

## 项目概述

专门针对建筑施工项目部的分包进场单移动补录校验系统。严格按照 **资料员 → 施工负责人 → 项目经理** 三级角色流程办理，不允许越权代办。支持补录证据与原始记录分离展示，后端对绕过前端的非法请求（错角色、旧版本、缺证据、错状态）做严格校验并返回具体原因。

## 技术栈

- **前端**：React 18 + Vite（端口 3001）
- **后端**：Go 1.26 + Echo v4（端口 8001）
- **数据库**：SQLite（本地文件 `backend/subcontract.db`，首次启动自动创建并初始化样例数据）

## 目录结构

```
.
├── backend/                  # Go 后端
│   ├── main.go               # 入口
│   ├── go.mod / go.sum
│   ├── db/database.go        # SQLite 初始化 + 样例数据
│   ├── models/models.go      # 数据模型
│   ├── handlers/             # API 处理
│   │   ├── auth.go
│   │   └── subcontract.go
│   ├── middleware/auth.go    # JWT + 角色中间件
│   └── utils/utils.go
└── frontend/                 # React 前端
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── styles.css
        ├── context/AuthContext.jsx
        ├── pages/
        │   ├── Login.jsx
        │   └── Dashboard.jsx
        └── components/
            ├── FormList.jsx
            ├── FormDetail.jsx
            ├── EvidencePanel.jsx
            ├── BatchToolbar.jsx
            └── CreateFormModal.jsx
```

## 初始化与启动

### 1. 后端启动

```bash
cd backend
go mod tidy
go run main.go
# 或编译后运行
go build -o subcontract-server .
./subcontract-server
```

后端默认监听 `http://localhost:8001`。首次启动自动创建 `subcontract.db` 并写入演示账号与样例分包进场单。

### 2. 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端默认监听 `http://localhost:3001`，已配置 Vite 代理将 `/api` 转发到后端 `http://localhost:8001`。

### 3. 访问系统

打开浏览器访问 `http://localhost:3001`，使用下方演示账号登录。

## 演示账号

| 角色 | 姓名 | 账号 | 密码 | 权限范围 |
|------|------|------|------|---------|
| 资料员 | 张资料 | `clerk01` | `clerk123` | 创建/编辑/提交登记单、补录驳回、上传证据、归档 |
| 施工负责人 | 李施工 | `foreman01` | `foreman123` | 现场核验（需有核验证据）或驳回给资料员 |
| 项目经理 | 王经理 | `manager01` | `manager123` | 最终确认（需三类证据齐全）或驳回 |

## 业务流程

```
草稿(draft)
  ↓ [资料员 提交登记 + 登记类证据]
待施工负责人核验(pending_foreman)
  ↓ [施工负责人 核验通过 + 过程核验证据]    ← 或驳回 → 待资料员补录(pending_clerk)
待项目经理确认(pending_manager)
  ↓ [项目经理 确认通过 + 复核归档证据]        ← 或驳回 → 待资料员补录(pending_clerk)
已确认(verified)
  ↓ [资料员 归档]
已归档(archived)
```

**关键规则：**
1. 每个操作只允许对应角色执行，其他角色会被后端直接拒绝。
2. 施工负责人与项目经理只能处理 `current_handler` 为自己的表单。
3. 每次流转版本号 +1，提交时需 `expected_version` 与当前一致，否则返回版本冲突（409）。
4. 状态流转前校验必要证据，缺失时返回具体缺失类型。
5. 补录证据需标记 `is_supplemental=true` 并填写 `supplement_note`，且只能由当前处理人执行。
6. 驳回必须填写原因。
7. 同名同类型非补录证据不可重复上传。

## 预置分包进场单样例（可用于暴露问题）

| 编号 | 分包单位 | 状态 | 可用于测试的问题场景 |
|------|---------|------|------------------|
| FB-2025-001 | 安徽宏建劳务有限公司 | `pending_foreman` | 正常核验流程；若用资料员或经理账号核验 → 错角色拦截 |
| FB-2025-002 | 江苏华宇装饰工程有限公司 | `pending_clerk`（已被驳回，v2） | 资料员补录后重新提交；模拟提交旧版本号 → 版本冲突 |
| FB-2025-003 | 山东鲁建机电安装公司 | `pending_manager`（v3） | 经理确认但缺归档证据 → 缺证据拦截 |
| FB-2025-004 | 浙江大地防水工程有限公司 | `verified` | 已确认状态；若尝试再核验/确认 → 错状态拦截 |
| FB-2025-005 | 四川川渝脚手架工程队 | `draft` | 草稿无证据直接提交 → 缺证据拦截 |
| FB-2025-006 | 河北冀东混凝土搅拌站 | `rejected` | 已驳回表单，资料员补录证据后重提 |

## 后端校验说明（绕过前端时的拦截）

后端 `handlers/subcontract.go` 中每个操作均包含以下检查，任一不满足返回 `4xx` 与具体 `reason`：

| 错误 | HTTP | Reason |
|------|------|--------|
| 非资料员创建/提交 | 403 | `wrong_role_create` / `wrong_role_submit` |
| 非施工负责人核验/驳回 | 403 | `wrong_role_foreman_verify` / `wrong_role_foreman_reject` |
| 非项目经理确认/驳回 | 403 | `wrong_role_manager_confirm` / `wrong_role_manager_reject` |
| 不是当前处理人 | 403 | `not_current_handler` |
| 版本不匹配 | 409 | `version_conflict` |
| 状态不允许操作 | 400 | `wrong_status_*` |
| 缺少必要证据 | 400 | `missing_evidence_*` |
| 驳回无原因 | 400 | `missing_reject_reason` |
| 补录无原因说明 | 400 | `missing_supplement_note` |
| 同名证据重复 | 409 | `duplicate_evidence` |

## 主要 API

所有需认证接口需带 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录，返回 token 与用户信息 |
| GET | `/api/me` | 当前用户 |
| GET | `/api/forms` | 分包进场单列表（按角色过滤），支持 `status / project / search` 查询参数 |
| GET | `/api/forms/:id` | 详情（含证据、补录记录、审计日志） |
| POST | `/api/forms` | 资料员创建草稿 |
| POST | `/api/forms/process` | 办理（`submit` / `verify_foreman` / `reject_foreman` / `confirm_manager` / `reject_manager` / `archive` / `update_draft`） |
| POST | `/api/forms/batch` | 批量办理 |
| POST | `/api/evidences` | 上传/补录证据 |
| DELETE | `/api/evidences/:id` | 删除本人上传的证据 |
| GET | `/api/projects` | 项目列表（用于筛选） |

## CORS

后端已配置允许 `http://localhost:3001` 与 `http://127.0.0.1:3001`，带 cookie/credentials。
