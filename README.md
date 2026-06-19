# 水产养殖基地 · 苗种记录节点超时追踪系统

> 聚焦「苗种记录」作为第一屏与核心对象，节点超时时把**责任（岗位/办理人）、证据（备注/证据说明）、状态**集中管理，避免分散。列表、详情、批量结果、统计共享后端同一份数据；所有状态变更以后端为准，刷新后列表数量、详情状态、统计、操作记录保持一致。

## 一、技术栈

| 层 | 技术 | 端口 |
| --- | --- | --- |
| 前端 | TanStack Start (React + Vite + Vinxi) | 3001 |
| 后端 | Rust Rocket 0.5 | 8001 |
| 数据库 | 本地 SQLite（rusqlite，bundled，无需单独安装） | 文件存储于 `backend/data/seed_tracking.db` |

## 二、岗位权限（与可见字段/按钮/动作对应）

| 账号 | 密码 | 岗位 | 可见动作 |
| --- | --- | --- | --- |
| `registrar` | `registrar123` | 苗种登记员 | 发起苗种记录 / 补正、登记苗种入塘、登记成活观察、处理超时登记 |
| `auditor` | `auditor123` | 苗种审核主管 | 审核通过 / 审核驳回、处理超时登记、批量审核通过 |
| `reviewer` | `reviewer123` | 水产养殖基地复核负责人 | 批次归档复核、处理超时登记、批量归档 |

> 账号/密码在后端首次启动时自动写入 SQLite，无需手动建库或初始化。

## 三、业务节点 & 状态流转（互相影响，后端统一驱动）

```
苗种登记(registrar) ──► 苗种审核(auditor) ──► 苗种入塘(registrar) ──► 成活观察(registrar) ──► 批次归档复核(reviewer) ──► 已完成
        │                    │
        │                    └── 驳回 ──► 待补正 ──► 登记员补正后重新进入审核
        └── 待处理状态下仍可编辑
```

- **苗种入塘、成活观察、批次归档**任一节点的完成都会刷新苗种记录的 `current_node` / `overall_status`；列表、详情、统计均读取同一字段。
- 每个节点都带时限（deadline），超过时限的节点自动标记 `is_timeout=1`，并在：
  - 列表页顶部：**⚠ 超时节点记录：N 条**
  - 详情页标签：**节点追踪 ⚠**
  - 节点卡片：红色高亮边框+底色
  - 操作按钮：**⚠ 登记节点超时原因与处理**（需填写「超时原因、后续处理措施」，可选备注、证据说明，全程写入 `operation_logs`）。

## 四、启动方式

### 1. 启动后端（Rust Rocket，端口 8001）

前置：本机安装 Rust（https://rustup.rs）。

```bash
cd backend

# 首次启动自动：
#   1) 创建 data/ 目录
#   2) 创建 data/seed_tracking.db（SQLite）
#   3) 执行 schema.sql 建表
#   4) 写入 3 个初始账号（见上文）
cargo run
```

启动成功输出示例：
```
🚀 Rocket has launched from http://0.0.0.0:8001
```

后端 API 基址：`http://localhost:8001/api`

- `POST /api/auth/login` 登录（账号/密码见上表）
- `GET  /api/auth/me`    当前用户
- `GET  /api/records/`    苗种记录分页列表（支持 `status/node/keyword/page/page_size`）
- `GET  /api/records/<id>`            详情（含节点追踪 + 操作记录）
- `POST /api/records/`                登记员发起苗种记录
- `PUT  /api/records/<id>`            登记员修改/补正
- `POST /api/records/<id>/approve-audit`      审核主管通过
- `POST /api/records/<id>/reject-audit`       审核主管驳回
- `POST /api/records/<id>/pond-entry`         登记员入塘登记
- `POST /api/records/<id>/survival-observe`   登记员成活观察
- `POST /api/records/<id>/archive`            复核负责人归档
- `POST /api/records/<id>/handle-timeout`     三岗位均可登记超时原因与处理
- `POST /api/records/batch`                   批量审核通过 / 批量归档
- `GET  /api/logs/`      操作日志
- `GET  /api/stats/overview`  统计（状态/节点/近 7 日趋势，数据源与列表/详情完全一致）

### 2. 启动前端（TanStack Start，端口 3001）

前置：本机安装 Node.js ≥ 18、包管理器（pnpm/npm/yarn 任选）。

```bash
cd frontend

# 安装依赖（任选其一）
npm install
# 或 pnpm install
# 或 yarn

# 开发模式启动
npm run dev
# 访问 http://localhost:3001
```

可选：生产构建与运行
```bash
npm run build
npm run start
```

## 五、样例入口 & 典型使用流程

1. 打开前端：http://localhost:3001 → 自动跳到 `/login`
2. 登录页底部提供 **一键登录样例账号**：
   - 登记员：`registrar / registrar123`
   - 审核主管：`auditor / auditor123`
   - 复核负责人：`reviewer / reviewer123`
3. **登记员视角（首屏就是苗种记录列表）**：
   - 点 **＋ 发起苗种记录** → 填类型/品种/数量/来源/供应商等 → 提交审核
   - 返回列表：看到刚创建的记录，节点=`苗种审核`，状态=`待处理`
4. **审核主管视角**：重新登录为 auditor
   - 列表勾选若干条 → 顶部 **批量审核通过**；或进入详情点 **审核通过/审核驳回**
5. **登记员视角**：
   - 进入详情 → **登记苗种入塘** → 填池塘号/入塘数量
   - 继续 **登记成活观察** → 填成活率
6. **复核负责人视角**：
   - 进入详情 → **批次归档复核** → 填复核意见，记录变为 **已完成**
7. **超时模拟**：
   - 节点超时后（或通过把系统时间往后调）详情页、列表顶部出现 **⚠ 超时**标识
   - 点击 **⚠ 登记节点超时原因与处理** → 必填超时原因 + 后续处理措施 → 提交
   - 节点追踪 Tab：该节点卡片下方会展示 **超时原因 / 后续处理措施 / 备注 / 证据说明**，与责任（办理人+岗位）、当前状态集中在同一视图。
8. **一致性验证**：
   - 完成任一动作后刷新列表 / 详情 / 统计 / 操作记录，数量、状态、节点、日志完全一致 —— 因为所有写入都走后端，前端仅展示后端返回值。

## 六、数据与存储

- 数据库文件位置：`backend/data/seed_tracking.db`
- 如需重置数据：
  ```bash
  rm -rf backend/data
  cd backend && cargo run    # 自动重建库和初始账号
  ```
- `.gitignore` 已包含 `*.db`、`data/*.sqlite*` 等，数据库不会被提交。
