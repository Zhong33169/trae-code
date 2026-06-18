# 新闻采编中心 · 选题单离线台账回填系统

面向新闻采编中心业务的选题单登记 / 审核 / 复核归档系统，并支持线下 Excel/台账的批量回填，保留差异与审计痕迹。
当前版本聚焦「离线台账回填能跑通」，不做泛用后台扩展。

## 一、技术栈

| 层       | 选型                                                | 端口     |
| -------- | --------------------------------------------------- | -------- |
| 前端     | Angular 17 (Standalone) + Angular CLI (Vite 内核)   | **3003** |
| 后端     | Rust + Poem 1.3 (Tokio runtime)                     | **8003** |
| 数据库   | SQLite (rusqlite, bundled)                         | —        |
| 前后端协议 | JSON, HTTP `Authorization` 头 (Token)              | — |

- 前端 `/api/*` 请求通过 Angular CLI dev-server 代理转发到 `http://localhost:8003`（`proxy.conf.json`）。
- 后端 CORS 已放行 `http://localhost:3003`，支持凭证。

## 二、快速启动

### 1. 后端

```bash
cd backend
cargo run          # 首次会编译，约 1~2 分钟
# 编译产物：backend/target/debug/backend
```

后端启动：
- HTTP API：<http://localhost:8003/api>
- 首次启动自动在 `backend/data/topics.db` 创建 SQLite 库并写入演示数据（见第三节）。
- 重启若检测到已有用户数据则不会重复写入（保留已有数据）。

### 2. 前端

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev        # 底层：ng serve --port 3003，访问 http://localhost:3003
```

生产构建：
```bash
npm run build      # 产物在 frontend/dist/browser
```

## 三、演示账号与演示数据

### 账号（三角色，密码均为 `123456`）

| 用户名      | 角色                         | 可执行操作                                                     |
| ----------- | ---------------------------- | ------------------------------------------------------------ |
| `registrar` | 选题登记员                   | 发起选题登记、补正退回单、上传附件、执行离线台账回填         |
| `reviewer`  | 选题审核主管                 | 对已登记选题单进行 **通过 / 退回**（退回时必填退回原因）       |
| `archiver`  | 新闻采编中心复核负责人       | 对已审核通过的选题单进行 **复核归档**                         |

登录页可先选择角色，自动同步对应的用户名，并展示当前角色进入后可办理的事项；后端接口会再次校验角色权限，非前端隐藏按钮模式。

### 预置选题单（验收可直接使用）

数据库：`backend/data/topics.db`，首次启动由 `backend/src/db.rs` 的 `seed_demo_data()` 写入。

**选题单样例（4 条）**

| 编号         | 类型       | 状态       | 异常标记         | 说明                                                         |
| ------------ | ---------- | ---------- | ---------------- | ------------------------------------------------------------ |
| `XT202506001` | 正常单     | registered | normal           | 关于加强基层宣传工作的专题报道。可直接由 reviewer 通过/退回 |
| `XT202506002` | 缺材料单   | registered | missing_material | 城市更新专题调研报道（无附件，可在详情页补充上传）           |
| `XT202506003` | 超时单     | registered | overdue          | 上半年经济形势分析报道，截止日期已过 3 天                    |
| `XT202506004` | 退回单     | rejected   | rejected         | 文明城市创建暗访报道。已存在审核主管退回记录与审计日志，`registrar` 可进入详情页补正重提 |

**离线回填历史批次样例（1 批，含 3 类记录）**

启动后在「离线台账回填」页「历史导入批次」中可见一条演示批次（来源：5月历史台账补录），包含：

| 类型     | 选题编号       | 标题                       | 说明                                                 |
| -------- | -------------- | -------------------------- | ---------------------------------------------------- |
| 成功导入 | `XT202505101`  | 五一劳动节劳模系列报道      | 正常离线导入选题（缺材料标签），可在选题列表中查到   |
| 冲突未覆盖 | `XT202506001` | 基层宣传工作专题报道（线下版） | 与线上已存在的 XT202506001 冲突，未覆盖，记录了字段差异 |
| 导入失败 | `XT202505202`  | 文明城市创建复查报道        | 非法状态值 `published`，被拒绝导入                    |

重置演示数据：删除 `backend/data/topics.db` 后重启后端即可。

## 四、页面与功能

### 1. 选题单列表 `/topics`

- 筛选：状态（已登记/已审核/已归档/已退回）、异常（正常/缺材料/超时/退回）、关键词（编号/标题/记者）。
- 角色：
  - `registrar` 可见「发起选题登记」按钮，弹窗填写后提交。
  - 所有登录用户均可见列表和详情入口。

### 2. 选题单详情 `/topics/:id`

围绕 **选题单登记 / 过程核验 / 复核归档** 三段组织：

- **基础信息**：编号、标题、来源、记者、部门、截止日期、登记人、内容、离线回填标记等。
- **处理过程（时间线）**：
  - 选题登记员发起登记
  - 选题审核主管审核（通过/退回，含审核意见与退回原因）
  - 新闻采编中心复核归档
- **附件**：三角色均可查看与上传（文件名 / 类型 / 大小 / 上传人 / 时间）。
- **审计备注**：当前选题单的所有状态变更、附件上传、回填结果等历史。
- **业务处理区（按角色 + 状态渲染，非单纯藏按钮）**：
  - `registered + reviewer`：显示审核表单（通过/退回、退回原因必填）。
  - `reviewed + archiver`：显示复核归档表单。
  - `rejected + registrar`：显示补正表单，补正后状态回到 `registered`。
  - 其他组合显示「当前角色/状态下无可执行操作」，后端同样会校验。

### 3. 离线台账回填 `/import`

- **导入配置**：数据来源（必填，如 `2025年6月线下台账.xlsx`）、批次备注。
- **待导入选题单**：JSON 数组（可点「填充示例」一键生成含成功/冲突/非法状态的样例）。
- **回填规则**（后端 `handlers::handle_execute_import`）：
  - 记录 `import_batches` 批次（批次号、来源、操作人、时间、成功/冲突/失败计数）。
  - 逐条对比 `topic_no`，**已存在则标记为「冲突」不静默覆盖**，保存线上线下字段差异 JSON。
  - 状态不合法（非 registered/reviewed/archived/rejected）标记为失败。
  - 新建成功的选题单 `created_from='offline'`，并关联 `import_batch_id`。
- **结果展示**：成功 / 冲突（未覆盖） / 失败逐条说明；冲突条目显示差异字段（如 title、status）。
- **历史批次**：可查看每个批次的明细（成功/冲突/失败逐条）。

### 4. 审计日志 `/audit`

- 可按选题单 ID 过滤，默认查全库最近 200 条。
- 记录：登记、审核通过、退回、复核归档、补正重提、上传附件、离线回填成功/冲突/失败（含失败原因）。
- 每条含：时间、操作人、动作、状态变更、关联选题、详情说明。
- 数据来源表：`audit_logs`，所有状态变更入口都会写审计（见 `handlers::write_audit`）。

## 五、状态流转与权限

```
 registered  ──(reviewer approve)──▶  reviewed  ──(archiver)──▶  archived
      │                                                                   
      └──(reviewer reject)──▶  rejected  ──(registrar rectify)──▶  registered 
```

所有动作均：
1. 后端 `require_role` 校验角色；
2. 校验当前状态是否可执行该动作；
3. 写入 `audit_logs`（操作人、时间、旧状态、新状态、原因/备注）。

## 六、验收脚本建议

使用**正常、缺材料、超时、退回、导入失败**五类样例逐条试走，与预置数据保持一致：

1. **正常单 XT202506001**：
   - `registrar` 查看详情 → 上传附件 → `reviewer` 登录 → 审核通过 → `archiver` 复核归档。
2. **缺材料单 XT202506002**：
   - 列表筛「异常=缺材料」→ 进入详情 → 上传附件并在审计备注中留痕。
3. **超时单 XT202506003**：
   - 列表筛「异常=超时」→ `reviewer` 审核退回并填退回原因 → `registrar` 补正后再提交。
4. **退回单 XT202506004**：
   - 进入详情查看审计备注（已有退回日志）→ `registrar` 补正 → `reviewer` 通过 → `archiver` 归档。
5. **离线台账回填（含导入失败追溯）**：
   - `registrar` 登录 → 离线台账回填 → 点「填充示例」→ 执行回填。
   - 预期：3 条记录 = 1 成功（新选题单） + 1 冲突（XT202506001 已存在，显示差异，未覆盖） + 1 失败（状态 `done` 非法）。
   - 批次明细按「成功导入 / 冲突未覆盖 / 导入失败」三类分组展示，包含标题和原因。
   - 审计日志页：
     - 按批次筛选可查到本次回填的三条审计（import_create / import_conflict / import_error）。
     - 所有失败分支均写入审计并关联 `import_batch_id`，可从审计追溯到批次，形成闭环。
   - 历史批次中可见预置的「5月历史台账补录」演示批次，同样含成功/冲突/失败三类记录。

## 七、目录结构

```
.
├── backend/
│   ├── Cargo.toml
│   ├── data/                 # SQLite 数据文件（运行时生成）
│   │   └── topics.db
│   └── src/
│       ├── main.rs           # 服务入口 + 路由 + CORS(8003)
│       ├── db.rs             # 建表 + 演示数据初始化
│       ├── auth.rs           # 登录 / Token 校验 / 角色鉴权
│       ├── models.rs         # 数据模型与通用响应
│       └── handlers.rs       # 所有业务 handler（选题/导入/审计/附件）
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts        # 端口 3003，/api 代理到 8003
    ├── tsconfig.json
    └── src/
        ├── main.ts
        ├── styles.css
        └── app/
            ├── app.component.ts        # 顶层布局、角色标签、导航
            ├── app.config.ts
            ├── app.routes.ts
            ├── guards/auth.guard.ts
            ├── services/
            │   ├── auth.service.ts
            │   └── topic.service.ts
            └── pages/
                ├── login/login.component.ts
                ├── topic-list/topic-list.component.ts
                ├── topic-detail/topic-detail.component.ts
                ├── import-page/import-page.component.ts
                └── audit-page/audit-page.component.ts
```
