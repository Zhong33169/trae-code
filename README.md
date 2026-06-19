# 财务共享中心 - 预算调整单管理系统

## 项目概述

预算调整单管理子系统，集成在财务共享中心日常使用页面中。支持预算调整登记员发起/补正、审核主管办理、复核负责人归档的完整流程，后端严格校验角色权限与状态流转。

## 技术栈

- **前端**: React + Rsbuild（端口 3002）
- **后端**: Node.js + Hono + SQLite（端口 8002）
- **数据存储**: 本地 SQLite (`backend/data.db`)

## 初始化

```bash
# 1. 安装后端依赖
cd backend
npm install

# 2. 安装前端依赖
cd ../frontend
npm install

# 3. 启动后端（自动初始化数据库和样例数据）
cd ../backend
npm start

# 4. 启动前端（新终端）
cd frontend
npm run dev
```

启动后访问 http://localhost:3002

## 演示账号

| 账号   | 姓名   | 角色               | 密码    |
|--------|--------|--------------------|---------|
| registrar1 | 张登记 | 预算调整登记员     | 123456  |
| registrar2 | 李登记 | 预算调整登记员     | 123456  |
| supervisor1 | 王审核 | 预算调整审核主管   | 123456  |
| supervisor2 | 赵审核 | 预算调整审核主管   | 123456  |
| reviewer1 | 孙复核 | 复核负责人         | 123456  |
| reviewer2 | 周复核 | 复核负责人         | 123456  |

## 角色与流程

```
登记员 → 提交/补正 → 审核主管 → 审核(通过/驳回/退回) → 复核负责人 → 归档
```

- **预算调整登记员**: 创建调整单、添加证据、提交审核、补正被退回的单据
- **预算调整审核主管**: 审核通过、驳回、退回补正
- **复核负责人**: 复核归档

后一个岗位不能替前一个岗位操作。状态变更由后端判定，前端以服务器返回为准。

## 状态流转

| 当前状态 | 登记员 | 审核主管 | 复核负责人 |
|----------|--------|----------|------------|
| 草稿 | 提交审核 | - | - |
| 待审核 | - | 通过/驳回/退回 | - |
| 被退回 | 补正/提交 | - | - |
| 待归档 | - | - | 归档 |
| 已归档 | - | - | - |
| 已驳回 | - | - | - |

## 后端校验规则

1. **角色校验**: 后端检查请求头 `X-User-Id` 和 `X-User-Role`，角色与用户不匹配返回 401
2. **状态校验**: 操作只能在允许的状态下执行，否则返回具体原因
3. **证据校验**: 提交审核必须具备三类证据（预算调整、部门确认、审批生效），缺一不可
4. **重复校验**: 同类型证据不能重复添加
5. **补录权限**: 各角色只能在对应状态下补录
6. **批量操作**: 批量操作逐条校验，返回每条的成功/失败状态

## 样例数据说明

系统预置 8 条预算调整单样例，覆盖以下场景：

- **ADJ-2026-001**: 正常待审核单（证据齐全）
- **ADJ-2026-002**: 草稿单（仅有预算调整证据，提交会被拒）
- **ADJ-2026-003**: 待归档单（审核主管已通过）
- **ADJ-2026-004**: 待审核但缺证据（审核主管通过会被拦截，因为证据不足）
- **ADJ-2026-005**: 被退回后补正的单（有补录记录，版本从v1升到v2）
- **ADJ-2026-006**: 已归档单
- **ADJ-2026-007**: 重复提交测试单
- **ADJ-2026-008**: 补录测试单

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/login | 登录 |
| GET | /api/users | 获取用户列表 |
| GET | /api/forms | 获取调整单列表（支持筛选） |
| GET | /api/forms/:id | 获取调整单详情（含证据、操作、补录） |
| POST | /api/forms | 创建调整单 |
| POST | /api/forms/:id/action | 执行操作（submit/review_approve/review_reject/review_return/archive/correct） |
| POST | /api/forms/:id/evidence | 添加证据 |
| POST | /api/forms/:id/supplement | 补录信息 |
| POST | /api/forms/batch-action | 批量操作 |
| GET | /api/forms/:id/validate-action | 校验操作是否可执行 |
| GET | /api/stats | 获取统计数据 |

## 绕过页面的后端拦截测试

```bash
# 错角色：审核主管尝试提交
curl -s -X POST http://localhost:8002/api/forms/ADJ-2026-002/action \
  -H "Content-Type: application/json" \
  -H "X-User-Id: supervisor1" -H "X-User-Role: supervisor" \
  -d '{"action":"submit"}'
# 返回: {"error":"角色(supervisor)无权执行\"submit\"操作"}

# 缺证据提交
curl -s -X POST http://localhost:8002/api/forms/ADJ-2026-002/action \
  -H "Content-Type: application/json" \
  -H "X-User-Id: registrar1" -H "X-User-Role: registrar" \
  -d '{"action":"submit"}'
# 返回: {"error":"证据不足，缺少：部门确认函、审批生效通知书"}

# 错状态提交
curl -s -X POST http://localhost:8002/api/forms/ADJ-2026-001/action \
  -H "Content-Type: application/json" \
  -H "X-User-Id: registrar1" -H "X-User-Role: registrar" \
  -d '{"action":"submit"}'
# 返回: {"error":"当前状态为\"pending_review\"，无法执行\"submit\"，允许的状态：draft、returned"}

# 重复证据
curl -s -X POST http://localhost:8002/api/forms/ADJ-2026-002/evidence \
  -H "Content-Type: application/json" \
  -H "X-User-Id: registrar1" -H "X-User-Role: registrar" \
  -d '{"evidence_type":"budget_adjustment","description":"重复"}'
# 返回: {"error":"该预算调整单已存在\"budget_adjustment\"类型证据，不能重复添加"}
```

## 重置数据库

删除 `backend/data.db` 后重启后端即可重新初始化。
