# 畜牧免疫记录管理系统

畜牧养殖场免疫记录全流程管理，覆盖免疫计划、接种登记、异常复查三个核心业务，支持角色切换和工作流审批。

## 技术栈

- **前端**: Remix + React (端口 3002)
- **后端**: Python + Flask (端口 8002)
- **数据库**: SQLite (演示数据内置)

## 快速启动

### 1. 后端

```bash
cd backend
pip install -r requirements.txt
python seed.py        # 初始化演示数据
python app.py         # 启动后端 http://localhost:8002
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev           # 启动前端 http://localhost:3002
```

## 角色说明

| 角色 | 职责 |
|------|------|
| 饲养员 (breeder) | 创建免疫计划和接种记录、提交记录 |
| 兽医主管 (vet_supervisor) | 审核记录、标记异常、创建复查 |
| 场长 (farm_manager) | 复核批准、解决异常复查 |

页面右上角可切换角色，不同角色看到的操作按钮不同。

## 工作流

```
草稿(draft) → 已提交(submitted) → 审核中(under_review) → 已批准(approved)
                                    ↓                      ↓
                                 退回(returned)          退回(returned)
```

- 饲养员创建并提交 → 兽医主管审核 → 场长批准
- 审核时可标记异常（不良反应/无效/未完成），自动创建复查
- 退回时可选驳回附件，饲养员需补传

## 演示样例

种子数据包含 6 条典型免疫记录：

| 单号 | 类型 | 说明 |
|------|------|------|
| VAC-2026-001 | 正常单 | 已完成全部审批流程（草稿→提交→审核→批准） |
| VAC-2026-002 | 缺材料单 | 草稿状态，缺少必传附件"接种证明"，已超期 |
| VAC-2026-003 | 超时单 | 已提交但审核超时，截止日期已过 |
| VAC-2026-004 | 退回单 | 接种证明被驳回（照片模糊），需要补传 |
| VAC-2026-005 | 异常单 | 接种后不良反应，审核中，待复查 |
| VAC-2026-006 | 草稿单 | 禽流感计划，全部附件缺失 |

## 附件分类

- **必传 (required)**: 接种证明、疫苗标签照片等必传项，缺失时无法提交
- **补传 (supplementary)**: 补充材料，如现场照片、异常反应照片
- **已驳回 (rejected)**: 被退回的附件，显示驳回原因，可补传替换

## 批量处理

列表页支持多选后批量操作（提交/审核/批准/退回），处理结果逐条展示：
- 每条记录显示单号、成功/失败、失败原因、下一步建议
- 失败原因自动写入审计日志，可追溯是谁、什么时候、为什么没处理成功

## API 概览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/dashboard/stats` | GET | 总览统计 |
| `/api/immunization-plans` | GET/POST | 免疫计划列表/创建 |
| `/api/immunization-plans/:id` | GET | 计划详情 |
| `/api/vaccination-records` | GET/POST | 接种记录列表/创建 |
| `/api/vaccination-records/:id` | GET | 记录详情（含附件、复查、审计日志） |
| `/api/vaccination-records/:id/submit` | POST | 提交（饲养员） |
| `/api/vaccination-records/:id/review` | POST | 审核（兽医主管） |
| `/api/vaccination-records/:id/approve` | POST | 批准（场长） |
| `/api/vaccination-records/:id/return` | POST | 退回 |
| `/api/vaccination-records/:id/attachments` | POST | 上传附件 |
| `/api/abnormal-rechecks` | GET | 异常复查列表 |
| `/api/abnormal-rechecks/:id/recheck` | POST | 执行复查（兽医主管） |
| `/api/abnormal-rechecks/:id/resolve` | POST | 解决复查（场长） |
| `/api/batch/process` | POST | 批量处理 |
| `/api/audit-logs` | GET | 审计日志 |

所有接口通过 `X-User-Id` 请求头标识当前用户，角色权限在后端校验。
