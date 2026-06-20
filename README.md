# 订舱管理系统（Booking Management System）

全流程订舱申请 / 装柜确认 / 提单回收 管理系统。覆盖从订舱登记员发起、订舱审核主管办理、到外贸公司复核负责人复核归档的全链路；每一步操作留痕、状态不一致/重复批次拦截、失败原因进入审计可追溯。

- **前端**：Qwik City（端口 **3005**）
- **后端**：Python + Django Ninja（端口 **8005**）
- **数据库**：SQLite（含演示初始化数据）

---

## 一、快速启动

### 1. 后端（8005）

```bash
cd backend
# 一键启动（自动建 venv、装依赖、迁库、初始化演示数据、运行服务）
./start.sh
```

或分步：

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py makemigrations booking
python manage.py migrate
python init_data.py           # 载入演示数据
python manage.py runserver 0.0.0.0:8005
```

- API 文档（Swagger UI）：<http://localhost:8005/api/docs>
- Django 管理后台：<http://localhost:8005/admin>（`admin / admin123`）
- CORS 已放行前端端口 `http://localhost:3005`

### 2. 前端（3005）

```bash
cd frontend
./start.sh   # npm install + npm run dev -- --port 3005
```

或分步：

```bash
cd frontend
npm install
npm run dev -- --port 3005
```

访问：<http://localhost:3005>

> `/api` 请求已在 Vite 中代理到 `http://localhost:8005/api`

---

## 二、演示账号（角色切换测试）

| 账号 | 密码 | 角色 | 典型操作权限 |
|---|---|---|---|
| `registrar` | `123456` | **订舱登记员**（王登记） | 发起订舱 / 提交审核 / 补正资料 / 重新提交 / 安排装柜 / 提单出单回收 / 离线台账回填 / 上传附件 / 添加审计备注 |
| `supervisor` | `123456` | **订舱审核主管**（李主管） | 审核通过 / 审核退回 / 订舱确认 / 订舱失败 / 装柜确认 / 装柜失败 / 批量处理 / 离线台账回填 |
| `reviewer` | `123456` | **外贸公司复核负责人**（赵复核） | 复核归档 / 离线台账回填 / 添加审计备注 |
| `admin` | `admin123` | 管理员（订舱审核主管角色） | Django 管理后台 + 全部主管权限 |

> ⚠️ **角色权限已在后端 API 层强制校验**（非前端隐藏按钮）：越权操作会返回 `403`。

---

## 三、系统样例数据（从哪里看）

初始化数据脚本：[`backend/init_data.py`](backend/init_data.py)

数据库文件首次启动后生成：`backend/db.sqlite3`（若要重置，删除后重新运行 `python init_data.py`）。

**8 条订舱申请覆盖全部验收场景**：

| 订舱单号 | 批次号 | 客户 | 当前状态 | 异常标记 | 验收场景 |
|---|---|---|---|---|---|
| **PK-2026-001** | BATCH-2026-001 | 上海华盛进出口贸易有限公司 | 订舱：已归档<br/>装柜：已装柜<br/>提单：已归档 | 无 | ✅ **正常流程单**<br/>（全流程闭环：发起→审核→订舱→装柜→提单→归档，含完整操作记录和 4 条审计日志） |
| **PK-2026-002** | BATCH-2026-002 | 广州汇通外贸有限公司 | 订舱：待审核<br/>装柜：未安排<br/>提单：未出单 | 🔴 异常：缺材料 | 📋 **缺材料单**<br/>（缺失商业发票、装箱单电子签章，已记一条失败审计，登记员需补附件后重新提交） |
| **PK-2026-003** | BATCH-2026-003 | 北京新丝路国际贸易有限公司 | 订舱：订舱失败<br/>装柜：未安排<br/>提单：未出单 | 🔴 异常：超时 + 订舱失败 | ⏱️ **超时单**<br/>（办理时限已过期 + 航线爆舱缺柜，失败原因已进审计，失败人/时间/原因可查） |
| **PK-2026-004** | BATCH-2026-004 | 宁波东方海运代理有限公司 | 订舱：补正中<br/>装柜：未安排<br/>提单：未出单 | 🔴 异常：退回 | 🔙 **退回单**<br/>（审核退回 3 条原因：缺非危鉴定书 / 起运港不具体 / 未注明预提；登记员补正中） |
| **PK-2026-005** | BATCH-DUP-2026-999 | 苏州智造科技股份有限公司 | 草稿 | 无 | 🔁 **重复批次测试（源单）** |
| **PK-2026-006** | BATCH-DUP-2026-999 | 苏州智造科技股份有限公司 | 草稿 | 🔴 异常：重复批次 | 🔁 **重复批次测试（重复单）**<br/>（与 PK-2026-005 批次号相同，异常标记已自动加上；新建时也会被校验拦截） |
| **PK-2026-007** | BATCH-2026-007 | 青岛海洋之星进出口有限公司 | 订舱：审核通过<br/>装柜：已确认<br/>提单：未出单 | 🔴 异常：状态不一致 | ❗ **状态不一致单**<br/>（线上 vs 离线台账不一致：订舱/装柜/提单三个状态均对不上；流转时会被拦截要求先同步） |
| **PK-2026-008** | BATCH-2026-008 | 成都熊猫跨境电商有限公司 | 订舱：已订舱<br/>装柜：待确认<br/>提单：待回收 | 无 | ✅ **在途正常单**<br/>（订舱成功、已安排装柜、提单已出单待回收；可测装柜确认→提单回收→复核归档后续流程） |

---

## 四、页面与功能

### 核心三大模块（左侧导航）

| 模块 | 对应路由 | 说明 |
|---|---|---|
| **订舱申请** | `/booking` | 所有订舱单（含草稿/待审核/已订舱/失败/退回/补正/归档） |
| **装柜确认** | `/loading` | 过滤出已安排装柜以上的单（待确认→已确认→已装柜 / 装柜失败） |
| **提单回收** | `/bl` | 过滤出已提单出单以上的单（待回收→已回收→已归档） |

### 列表页通用能力

- **关键字搜索**：订舱单号 / 批次号 / 客户 / 提单号
- **状态筛选**：订舱状态、装柜状态、提单状态（独立下拉）
- **异常筛选**：是否异常 + 异常类型（缺材料/超时/退回/状态不一致/重复批次）
- **表格列**：订舱单号、批次号、客户、三个状态彩色徽章、异常标记、提交人、时间、操作（详情）
- **批量操作**：多选后 → 批量审核通过 / 批量订舱确认（逐条返回成功/失败+原因）

### 详情页（Tabs 组织）

| Tab | 内容 | 可执行操作 |
|---|---|---|
| **基本信息** | 客户/货代/港口/柜型/货物/SO号/提单号/船名/ETD/ETA/办理时限 等；三状态显示；退回原因 / 审计备注 / 处理结果 | 按角色显示对应操作按钮（后端再校验权限） |
| **附件** | 分类（订舱资料/装柜单据/提单文件/证明文件/其他）上传、下载、删除 | 上传附件、删除附件 |
| **操作记录** | 每一步操作：操作类型、操作人、角色、变更前后状态、变更字段、备注、时间 | 只读（信号自动记录，不可篡改） |
| **审计日志** | 订舱/装柜/提单/复核归档 四次审计，通过/失败/退回、失败原因、审计人、时间 | 失败/退回原因永久留痕（订舱申请失败原因进入此处） |
| **离线台账** | 离线台账回填每一步的记录：字段名、旧值→新值、来源、操作人、备注 | 回填离线状态（订舱/装柜/提单状态、SO号、提单号、船名、ETD/ETA） |

**详情页顶部会自动检测并高亮红色告警**：
- 🚩 重复批次：提示该批次号已存在于哪些订舱单
- 🚩 状态不一致：列出线上 vs 离线台账对不上的字段（订舱/装柜/提单三个维度）

### 状态流转图（按角色）

```
订舱登记员(registrar)           订舱审核主管(supervisor)            外贸复核(reviewer)
──────────────────────         ────────────────────────          ───────────────────
发起 (草稿)
   ↓
提交 (待审核) ────────→ 审核通过 (审核通过) ──→ 订舱确认 (已订舱)
                      审核退回 (已退回) ←──┘      订舱失败 (订舱失败)
   ↑                        │                            │
重新提交 (待审核)           ↓                            ↓
   ↑                   (可加批量)                   失败原因进审计
补正 (补正中) ←──────────────────────────────────────────┘
                                                              ↓
                                                        复核归档 (已归档)
                                                          (提单需已回收)
```

装柜 / 提单子流：

```
安排装柜(登记员) → 装柜确认(主管) → 完成装柜
               ↘ 装柜失败(主管，异常标记+失败审计)

提单出单(登记员) → 提单回收(登记员) → 复核归档(复核人+提单归档)
```

---

## 五、数据校验规则（会拦截并说明）

### 1. 重复批次拦截
- **创建/更新订舱申请**时：若 `batch_no` 已被其他订舱单使用 → 返回 400 并明确列出重复的订舱单号
- 校验接口：`POST /api/bookings/validate`（可前端边输入边校验）

### 2. 状态不一致拦截
- **提交审核 / 重新提交 / 复核归档** 三个关键节点：对比线上状态与离线台账回填状态
- 三个维度（订舱、装柜、提单）只要任何一个对不上 → 拦截，返回形如：
  > 状态校验未通过，线上线下状态不一致：
  > 订舱状态不一致：线上【审核通过】 vs 离线台账【已订舱】；
  > 装柜状态不一致：线上【未安排】 vs 离线台账【已装柜】

### 3. 超时自动标记
- 列表页/详情页读取时自动检测 `deadline` 是否过期；过期且未完成的单自动标记异常=超时

### 4. 必填校验（关键节点）
| 节点 | 必填项 |
|---|---|
| 提交审核 | 客户名称、货代/船公司 |
| 订舱确认 | SO号 |
| 审核退回 / 订舱失败 / 装柜失败 | 必须填写失败/退回原因（进入审计） |
| 提单出单 | 提单号 |
| 复核归档 | 提单状态需为"已回收" |

---

## 六、操作留痕 & 审计追踪

### 操作记录（OperationLog，自动）
- 每次状态变更：操作类型、操作人、**操作人角色**、变更前→变更后状态、变更字段、原值→新值、备注、IP、时间
- 离线台账回填：变更字段 + 原值→新值，单独建表 `OfflineLedgerRecord` + 同时写操作记录
- 触发方式：**Django signal 自动记录**（任何保存途径都不会漏）

### 审计日志（AuditLog，强制）
四次关键审计：订舱审核、装柜、提单、复核归档 —— 通过/失败/退回三选一，**失败和退回必须填写原因**，永久记录：
- 审计类型、审计人、审计结果、**失败/退回原因**、备注、时间

查询："订舱申请失败原因要进审计，回头能查到是谁、什么时候、为什么没处理成功" —— 在详情页 **审计日志** Tab，或 `GET /api/bookings/{id}/audit-logs`，`result=fail|return` 即为失败记录。

---

## 七、批量处理（验收时逐条说明）

接口：`POST /api/bookings/batch`

请求：
```json
{ "ids": [1,2,3], "action": "review_pass|book_confirm", "remark": "批量审核通过" }
```

响应示例：
```json
{
  "success_count": 2,
  "fail_count": 1,
  "results": [
    { "id": 1, "form_no": "PK-2026-002", "success": true,  "message": "审核通过" },
    { "id": 2, "form_no": "PK-2026-005", "success": false, "message": "状态【草稿】不是待审核，跳过" },
    { "id": 3, "form_no": "PK-2026-007", "success": true,  "message": "审核通过" }
  ]
}
```

**每条结果独立说明**，不会因单条异常终止整个批处理。

---

## 八、工程信息

### 后端目录结构

```
backend/
├── manage.py
├── requirements.txt          # Django + django-ninja + django-cors-headers
├── start.sh                  # 一键启动脚本
├── init_data.py              # 演示数据初始化脚本（含全部样例说明）
├── fix_api.py                # 临时脚本，可删除
├── db.sqlite3                # 运行后生成的 SQLite 数据库
└── app/
    ├── settings.py           # 端口8005、CORS放行3005、SQLite、AUTH_USER_MODEL
    ├── urls.py               # /api/* 挂载 NinjaAPI
    ├── api.py                # 全部接口（认证/CRUD/流转/离线/附件/审计/批量/元数据）
    ├── schema.py             # Pydantic 请求/响应 Schema
    └── booking/
        ├── models.py         # User / BookingApplication / OperationLog / AuditLog / Attachment / OfflineLedgerRecord
        ├── signals.py        # pre_save/post_save 信号：自动捕获变化 + 写入操作日志
        ├── admin.py          # Django Admin 注册
        └── migrations/       # 数据库迁移（首次运行自动生成）
```

### 前端目录结构

```
frontend/
├── package.json
├── vite.config.ts            # 端口 3005 + /api → http://localhost:8005/api 代理
├── tsconfig.json
├── start.sh                  # 一键启动脚本
└── src/
    ├── root.tsx              # 根组件（Tailwind CDN 引入）
    ├── global.css
    ├── api/index.ts          # 全部后端 API 封装（fetch + withCredentials）
    ├── types/index.ts        # Booking / User / 枚举 类型
    ├── store/                # Auth / Meta 全局 Context
    ├── components/           # StatusBadge / UI / BookingList / BookingDetail
    └── routes/               # 登录页 + (app) 三大模块路由 / 详情
```

### 常见重置操作

```bash
# 重置后端数据库（清所有数据，重新载入样例）
cd backend && source .venv/bin/activate
rm -f db.sqlite3
python manage.py makemigrations booking
python manage.py migrate
python init_data.py

# 清理前端依赖重装
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 九、验收清单（对应需求）

| 需求点 | 实现位置 |
|---|---|
| 订舱申请一进系统就能分辨状态 | `BookingApplication` 三个状态字段 + 列表彩色徽章 |
| 离线台账回填每一步留痕 | `OfflineLedgerRecord` + 信号写 `OperationLog` |
| 角色切换三种角色（非前端隐藏按钮） | 后端 `ROLE_PERMISSIONS` + `check_action_permission()` 强制校验，越权 403 |
| 页面围绕订舱申请/装柜确认/提单回收组织 | `(app)/booking` `(app)/loading` `(app)/bl` 三大路由 + 列表按 module 过滤 |
| 列表能筛状态和异常 | 列表页多条件筛选（booking_status / loading_status / bl_status / is_exception / exception_type） |
| 详情可处理附件、结果、退回原因、审计备注 | 详情页 Tabs：附件/操作记录/审计日志/离线台账 + 对应接口 |
| 重复批次 + 状态不一致拦截 → 说明线上线下哪里对不上 | `check_duplicate_batch()` + `check_status_consistency()` 在创建/提交/归档节点拦截，返回可读文字 |
| 验收拿 4 类单（正常/缺材料/超时/退回） | PK-2026-001 / 002 / 003 / 004 四条样例 |
| 批量结果逐条说明 | `POST /api/bookings/batch` 返回 `results[]` 每条独立 `success + message` |
| 订舱失败原因进审计（人/时间/原因） | 失败类操作写 `AuditLog(result=fail/return, fail_reason=..., auditor=..., created_at)` |
| 前端 Qwik City 端口 3005 → 后端 8005 + CORS | `vite.config.ts` 代理 + `settings.py` 的 `CORS_ALLOWED_ORIGINS` |
| SQLite 演示数据初始化放项目里 | `backend/init_data.py` + README 第三部分逐条说明 |
| README 写明样例位置与使用方法 | 本文档第三、第八节 |
