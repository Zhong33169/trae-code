# 眼科诊所 - 离线台账回填配镜订单系统

基于 React + Vite + Python + Django Ninja 的配镜订单管理系统，支持配镜登记、审核、复核归档全流程。

## 技术栈

- **前端**: React 18 + Vite + React Router
- **后端**: Django 5 + Django Ninja + SQLite
- **前端端口**: 3004
- **后端端口**: 8004

## 项目结构

```
.
├── frontend/                # 前端项目
│   ├── src/
│   │   ├── api/             # API 封装
│   │   ├── components/      # 公共组件
│   │   ├── pages/           # 页面组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── utils/           # 工具函数和常量
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── backend/                 # 后端项目
│   ├── glasses/             # 配镜订单 App
│   │   ├── models.py        # 数据模型
│   │   ├── api.py           # API 接口
│   │   ├── schemas.py       # Pydantic Schema
│   │   ├── admin.py         # Django Admin
│   │   └── management/
│   │       └── commands/
│   │           └── seed_data.py  # 初始化数据命令
│   ├── config/              # Django 项目配置
│   ├── manage.py
│   └── requirements.txt
└── README.md
```

## 快速开始

### 1. 启动后端

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 数据库迁移
python manage.py migrate

# 初始化测试数据
python manage.py seed_data

# 启动服务器 (端口 8004)
python manage.py runserver 0.0.0.0:8004
```

后端 API 文档地址: http://localhost:8004/api/docs

### 2. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器 (端口 3004)
npm run dev
```

前端访问地址: http://localhost:3004

## 角色与工作流

系统支持三种角色，角色切换在页面顶部：

### 配镜登记员 (registrar)
- 新建配镜订单
- 编辑待登记/已退回的订单
- 提交订单进入审核流程
- 批量提交审核
- 管理订单附件

### 配镜审核主管 (supervisor)
- 审核待审核的订单
- 审核通过 → 进入待复核
- 审核退回 → 退回登记员补正
- 批量审核通过

### 眼科诊所复核负责人 (reviewer)
- 复核待复核的订单
- 复核通过 → 归档（终态）
- 复核退回 → 退回登记员补正

## 状态流转

```
待登记 → 提交 → 待审核 → 审核通过 → 待复核 → 复核通过 → 已归档
  ↑           ↑              ↓                ↓
  └──退回补正──┘              └────退回────────┘
```

## 异常检测

系统自动检测以下异常类型，订单详情页会显示异常提示：

### 1. 重复批次 (duplicate_batch)
- **判定规则**: 同一批次号下存在多条订单记录
- **影响**: 标记异常，不阻止流程推进
- **查看方式**: 异常类型筛选 → 选择「重复批次」

### 2. 状态不一致 (status_mismatch)
- **判定规则**: 线上订单状态与线下台账状态不匹配
- **影响**: 标记异常，提示线上线下差异
- **查看方式**: 异常类型筛选 → 选择「状态不一致」
- **示例**: 线上「待登记」但线下「已登记」

### 3. 材料缺失 (missing_materials)
- **判定规则**: 进入审核/复核环节但缺少处方单等必备材料
- **影响**: 提交审核时会被系统拦截，无法提交
- **查看方式**: 异常类型筛选 → 选择「材料缺失」
- **示例**: GZ20260602A003（无处方单）

### 4. 超时 (overdue)
- **判定规则**: 订单创建超过 3 天仍未归档
- **影响**: 标记超时，订单行显示黄色背景
- **查看方式**: 超时筛选 → 选择「已超时」
- **示例**: GZ20260602A004、GZ20260528A007

## 测试样例说明

运行 `python manage.py seed_data` 后会创建 10 条订单，覆盖各种场景：

### 正常订单
| 订单号 | 状态 | 说明 |
|--------|------|------|
| GZ20260601A001 | 已归档 | 完整流程的正常订单，含所有材料和附件 |
| GZ20260601A002 | 待复核 | 审核通过，等待复核的正常订单 |
| GZ20260603A005 | 待审核 | 登记完成，等待审核的正常订单 |
| GZ20260603A006 | 待审核 | 登记完成，等待审核的正常订单 |

### 异常订单
| 订单号 | 异常类型 | 说明 |
|--------|----------|------|
| GZ20260602A003 | 材料缺失 | 无处方单、无身份证、无收费凭证，无法提交审核 |
| GZ20260602A004 | 材料缺失 + 超时 | 审核退回，缺少收费凭证，已超时 5 天 |
| GZ20260528A007 | 状态不一致 + 超时 | 线上待审核但线下已审核，已超时 12 天 |
| GZ20260604A009 | 状态不一致 | 线上待登记但线下已登记 |
| GZ20260601A010 | 重复批次 | 与 A001、A002 同属 BATCH-2026-0601 批次 |
| GZ20260602A003 | 待登记 | 新建未处理的订单 |

## 验收测试场景

### 场景 1：正常流程走单
1. 切换到「配镜登记员」角色
2. 点击「新建订单」创建订单
3. 填写完整信息并勾选所有材料
4. 提交审核 → 状态变为「待审核」
5. 切换到「配镜审核主管」角色
6. 找到该订单，点击「审核通过」
7. 状态变为「待复核」
8. 切换到「眼科诊所复核负责人」角色
9. 点击「复核归档」→ 状态变为「已归档」

### 场景 2：材料缺失拦截
1. 切换到「配镜登记员」角色
2. 找到 GZ20260602A003（材料缺失的待登记订单）
3. 点击「提交审核」
4. 系统报错：「提交失败：缺少处方单」
5. 审计日志中可查到失败记录

### 场景 3：退回补正流程
1. 切换到「配镜审核主管」角色
2. 任选一条待审核订单
3. 点击「审核退回」
4. 填写退回原因并确认
5. 切换到「配镜登记员」角色
6. 该订单出现在「已退回」队列中
7. 点击编辑，补正信息后重新提交

### 场景 4：批量操作
1. 切换到「配镜登记员」角色
2. 在待登记列表中勾选多条订单
3. 点击「批量提交审核」
4. 查看批量操作结果弹窗
5. 成功和失败的订单会逐条说明原因

### 场景 5：异常检测
1. 点击任意订单查看详情
2. 如果存在异常，页面顶部显示红色异常提示
3. 异常说明会列出具体问题（如：线上线下状态不一致）
4. 列表页可按异常类型筛选

### 场景 6：审计追溯
1. 进入任意订单详情页
2. 切换到「审计日志」标签
3. 可查看所有操作记录：操作人、角色、时间、原因
4. 失败操作会标记「失败」标签并显示失败原因
5. 顶部导航「审计日志」可查看全局审计记录

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/glasses/queue-stats | 队列统计 |
| GET | /api/glasses/orders | 订单列表（支持筛选） |
| GET | /api/glasses/orders/{id} | 订单详情 |
| POST | /api/glasses/orders | 创建订单 |
| PUT | /api/glasses/orders/{id} | 更新订单 |
| POST | /api/glasses/orders/{id}/submit | 提交审核 |
| POST | /api/glasses/orders/{id}/review-pass | 审核通过 |
| POST | /api/glasses/orders/{id}/review-return | 审核退回 |
| POST | /api/glasses/orders/{id}/final-pass | 复核归档 |
| POST | /api/glasses/orders/{id}/final-return | 复核退回 |
| POST | /api/glasses/orders/batch-submit | 批量提交审核 |
| POST | /api/glasses/orders/batch-review | 批量审核通过 |
| GET | /api/glasses/orders/{id}/attachments | 附件列表 |
| POST | /api/glasses/orders/{id}/attachments | 上传附件 |
| DELETE | /api/glasses/orders/{id}/attachments/{aid} | 删除附件 |
| GET | /api/glasses/orders/{id}/audit-logs | 订单审计日志 |
| GET | /api/glasses/audit-logs | 全局审计日志 |
| GET | /api/glasses/filter-options | 筛选选项 |
| GET | /api/glasses/users | 用户列表 |

### 请求头说明

前端通过自定义请求头传递当前用户和角色信息：
- `X-Current-User`: 用户名（默认 wang_ling）
- `X-Current-Role`: 角色（registrar / supervisor / reviewer）

## 数据库

项目使用 SQLite，数据库文件位于 `backend/db.sqlite3`

重新初始化数据：
```bash
cd backend
rm db.sqlite3
python manage.py migrate
python manage.py seed_data
```

## CORS 配置

后端已配置 CORS 允许所有来源（开发环境）：
- `corsheaders` 中间件已启用
- `CORS_ALLOW_ALL_ORIGINS = True`
- `CORS_ALLOW_CREDENTIALS = True`

前端通过 Vite 代理转发 API 请求：
- `/api/*` → `http://localhost:8004/api/*`
