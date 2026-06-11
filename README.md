# 电子元器件工厂 - 附件缺失补正物料变更单系统

基于 **SvelteKit 前端** + **Python Django Ninja 后端** + **SQLite** 构建的物料变更单全流程管理系统，聚焦于「附件缺失补正」场景的闭环处理。

---

## 📐 系统架构

```
┌──────────────────────────┐          ┌──────────────────────────┐
│  Frontend (SvelteKit)    │          │  Backend (Django Ninja)  │
│  Port: 3004              │ ───────► │  Port: 8004              │
│  http://localhost:3004   │   CORS   │  http://localhost:8004   │
└──────────────────────────┘          └──────────────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │  SQLite Database  │
                                    │  backend/db.sqlite3│
                                    └──────────────────┘
```

---

## 🧑‍💼 角色说明（非前端隐藏按钮，后端 API 层严格校验）

系统在右上角提供**角色+用户**切换器，每个角色对应独立的操作权限与列表视野：

| 角色 | 可执行操作 | 列表视野 |
|------|-----------|---------|
| **物料变更登记员** | 创建变更单、编辑草稿/补正单、上传/删除附件、提交审核、补正后重提 | 自己登记的单 |
| **物料变更审核主管** | 驳回附件、审核通过（转复核）、整体退回补正 | 分配给自己办理的单 |
| **电子元器件工厂复核负责人** | 复核通过并归档、复核退回 | 分配给自己复核的单 |

> 角色权限在后端 API 层严格校验，前端仅做展示优化。即使前端绕过按钮直接发请求，后端也会返回 400 错误。

---

## 📋 状态流转

```
草稿(draft)
   │ 登记员提交
   ▼
待审核主管办理(pending_review)
   │                            │
   │ 审核主管通过                │ 审核主管退回（需补正附件）
   ▼                            ▼
待复核归档(pending_final)     需补正附件(supplement_required)
   │                            │
   │ 复核负责人通过              │ 登记员补正附件后重新提交
   ▼                            │
已归档(archived)                └───────┘
   │
   │ 复核负责人退回
   ▼
已退回(returned)

【超时标记】任何办理中状态超过截止时间 → 标记为 已超时(overdue)
```

---

## 🚀 启动方式

### 一、启动后端（端口 8004）

```bash
cd backend

# 1. 安装依赖（建议先创建虚拟环境）
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. 数据库迁移 + 初始化种子数据
python manage.py makemigrations
python manage.py migrate
python manage.py seed_data       # ← 生成4类典型测试样例

# 3. 启动后端服务
python manage.py runserver 0.0.0.0:8004
```

后端启动后：
- API 文档：http://localhost:8004/api/docs
- Admin 后台：http://localhost:8004/admin

### 二、启动前端（端口 3004）

新开一个终端窗口：

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
```

前端启动后：
- 访问 http://localhost:3004

---

## 🧪 验收样例说明（seed 数据自动生成）

执行 `python manage.py seed_data` 后，系统会预置以下 4 类典型单据，可直接用于验收测试：

### ✅ 正常单（MCO-2026-0001）：已归档
- **状态**：`已归档`
- **场景**：完整走完「登记→主管审核通过→复核归档」全流程
- **看点**：3 个附件均已通过、审计日志完整记录全流程操作、进度条全部打勾
- **操作人**：
  - 登记员：张登记
  - 审核主管：王主管
  - 复核负责人：陈复核

### ⚠️ 缺材料单（MCO-2026-0002）：需补正附件
- **状态**：`需补正附件`
- **场景**：审核主管发现附件缺失+1个附件被驳回，退回登记员补正
- **看点**：
  - 存在 1 个「已驳回」状态的附件（有驳回原因）
  - 顶部显示「需补正附件」橙色警告
  - 显示退回原因：缺少封装尺寸图纸、SMT评估报告、焊盘对比表
- **操作人**：
  - 登记员：李登记
  - 审核主管：王主管
- **验收操作建议**：
  1. 切换为「李登记（登记员）」进入详情
  2. 删除被驳回的附件「初步方案说明.pdf」
  3. 上传新的附件文件
  4. 点击「补正并重新提交」→ 单据回到 `待审核主管办理`

### ⏰ 超时单（MCO-2026-0003）：已超时
- **状态**：`已超时`
- **场景**：审核主管超过 7 天未处理，系统标记为超时异常
- **看点**：状态红色标注 ⚠️、截止时间已过、审计日志中含「标记超时」记录
- **操作人**：
  - 登记员：张登记
  - 审核主管：赵主管

### ❌ 退回单（MCO-2026-0004）：复核阶段退回
- **状态**：`已退回`
- **场景**：主管审核通过后，复核负责人发现缺少可靠性测试报告，最终退回
- **看点**：
  - 进度条中「复核归档」节点显示红色 ✕
  - 显示完整的复核退回原因
- **操作人**：
  - 登记员：李登记
  - 审核主管：王主管
  - 复核负责人：陈复核

### 预置用户账号（seed 自动创建）

| 用户名 | 姓名 | 角色 |
|--------|------|------|
| registrar01 | 张登记 | 物料变更登记员 |
| registrar02 | 李登记 | 物料变更登记员 |
| supervisor01 | 王主管 | 物料变更审核主管 |
| supervisor02 | 赵主管 | 物料变更审核主管 |
| reviewer01 | 陈复核 | 电子元器件工厂复核负责人 |

---

## 📑 核心功能验证清单

验收时，请逐条检查：

- [ ] **列表页**：能按「状态」「是否超时」「关键字」筛选，统计卡片数字准确
- [ ] **角色切换**：顶部切换角色/用户后，列表内容和操作按钮对应变化
- [ ] **新建单据**：登记员可创建草稿并上传附件
- [ ] **提交审核**：草稿至少有1个附件才能提交
- [ ] **附件驳回**：审核主管可单独驳回某个附件（需填写原因），驳回原因永久保留
- [ ] **审核退回**：审核主管整体退回时必填原因，单据状态变为「需补正附件」
- [ ] **补正重提**：登记员补齐附件后（被驳回的附件需先删除再重传）才能重提
- [ ] **复核归档**：复核负责人通过后状态变为「已归档」，流程结束
- [ ] **复核退回**：复核负责人退回后状态为「已退回」，原因进入审计
- [ ] **审计日志**：所有操作（创建/提交/通过/退回/附件驳回/超时标记）均有记录，含操作人、角色、时间、原因
- [ ] **批量结果逐条说明**：在审计日志 Timeline 中可逐条查看每一步处理结果及失败原因

---

## 📁 项目目录结构

```
trae-code-4/
├── backend/
│   ├── api/                     # Django app（所有业务逻辑）
│   │   ├── management/commands/
│   │   │   └── seed_data.py     # 种子数据脚本
│   │   ├── admin.py
│   │   ├── models.py            # 数据模型
│   │   ├── schemas.py           # API Schema
│   │   └── urls.py              # Django Ninja API 路由
│   ├── config/                  # Django 配置
│   │   ├── settings.py          # CORS 已放行 3004 端口
│   │   └── urls.py
│   ├── manage.py
│   ├── requirements.txt
│   └── db.sqlite3               # 运行 migrate + seed_data 后生成
└── frontend/
    ├── src/
    │   ├── lib/
    │   │   ├── api.js           # 后端请求封装（指向 8004）
    │   │   └── store.js         # 全局状态（角色/用户/状态映射）
    │   ├── routes/
    │   │   ├── +layout.svelte   # 布局（含角色切换器）
    │   │   ├── +page.svelte     # 列表页
    │   │   └── orders/[id]/
    │   │       └── +page.svelte # 详情页
    │   ├── app.css              # 全局样式
    │   └── app.html
    ├── svelte.config.js
    ├── vite.config.js           # 端口固定 3004
    └── package.json
```

---

## 🔌 API 说明

所有 API 前缀：`http://localhost:8004/api`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users` | 用户列表 |
| GET | `/roles` | 角色枚举 |
| GET | `/orders` | 单据列表（支持 status、is_overdue、q、role、user_id 过滤） |
| GET | `/orders/{id}` | 单据详情（含附件、审计日志） |
| POST | `/orders` | 创建单据（仅登记员） |
| POST | `/orders/{id}/submit` | 提交审核（仅登记员、草稿状态） |
| POST | `/orders/{id}/supervisor/approve` | 审核主管通过 |
| POST | `/orders/{id}/supervisor/return` | 审核主管退回 |
| POST | `/orders/{id}/supplement` | 补正后重提（仅登记员、需补正状态） |
| POST | `/orders/{id}/reviewer/approve` | 复核通过归档 |
| POST | `/orders/{id}/reviewer/return` | 复核退回 |
| POST | `/orders/{id}/attachments` | 上传附件（multipart/form-data） |
| DELETE | `/attachments/{id}` | 删除附件 |
| POST | `/attachments/{id}/reject` | 驳回附件（需 reason） |
| GET | `/orders/{id}/audit-logs` | 审计日志 |
| GET | `/stats` | 状态统计 |

详细文档见后端启动后的 Swagger UI：http://localhost:8004/api/docs
