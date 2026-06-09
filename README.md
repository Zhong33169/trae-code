# 社区卫生服务中心 - 移动补录校验随访记录系统

## 系统概述

本系统用于社区卫生服务中心随访记录的移动补录校验管理，实现三级审核流程：
**导诊护士发起 → 全科医生处理 → 医务科主任确认**

后一个岗位不能替前一个岗位补流程，每个角色只能处理自己权限范围内的记录。

## 技术栈

- **前端**: React 18 + TypeScript + Rsbuild
- **后端**: Python 3 + Starlette + SQLAlchemy + SQLite
- **前端端口**: 3001
- **后端端口**: 8001

## 目录结构

```
.
├── backend/                 # 后端项目
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # 应用入口
│   │   ├── config.py       # 配置
│   │   ├── database.py     # 数据库模型
│   │   ├── schemas.py      # Pydantic 模型
│   │   ├── services.py     # 业务逻辑
│   │   ├── validators.py   # 校验规则
│   │   └── routes.py       # 路由定义
│   ├── init_db.py          # 数据库初始化脚本
│   └── requirements.txt
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── components/    # 组件
│   │   ├── context/       # 上下文
│   │   ├── api.ts         # API 封装
│   │   ├── types.ts       # 类型定义
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── index.html
│   ├── rsbuild.config.ts
│   ├── tsconfig.json
│   └── package.json
└── README.md
```

## 快速开始

### 1. 后端初始化

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 初始化数据库（包含样例数据）
python init_db.py

# 启动后端服务
uvicorn app.main:app --reload --port 8001
```

后端服务将在 http://localhost:8001 启动

### 2. 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 http://localhost:3001 启动

## 演示账号

| 用户名   | 姓名   | 角色         | 权限范围               |
|----------|--------|--------------|------------------------|
| nurse1   | 李护士 | 导诊护士     | 草稿状态记录的创建/编辑/提交 |
| nurse2   | 王护士 | 导诊护士     | 草稿状态记录的创建/编辑/提交 |
| doctor1  | 张医生 | 全科医生     | 待医生处理记录的办理/驳回   |
| doctor2  | 刘医生 | 全科医生     | 待医生处理记录的办理/驳回   |
| director1| 陈主任 | 医务科主任   | 待主任确认记录的确认/驳回   |

## 工作流状态

```
草稿(draft) 
    ↓ 导诊护士提交
待医生处理(pending_doctor)
    ↓ 全科医生办理通过
待主任确认(pending_director)
    ↓ 医务科主任确认
已确认(confirmed)

任何环节都可以驳回 → 已驳回(rejected)
```

## 校验规则与拦截点

### 1. 角色权限校验 (ROLE_PERMISSION_DENIED)
- 只有导诊护士可以创建、编辑、提交草稿状态记录
- 只有全科医生可以处理「待医生处理」状态的记录
- 只有医务科主任可以确认「待主任确认」状态的记录
- 后一岗位不能替前一岗位补流程

### 2. 版本号校验 (VERSION_MISMATCH)
- 每次修改/操作都需要携带当前版本号
- 版本号不匹配时拒绝操作，防止并发冲突

### 3. 状态流转校验 (INVALID_STATUS_TRANSITION)
- 只能按工作流顺序流转，不能跳级
- 已确认的记录不能再修改

### 4. 证据完整性校验 (INCOMPLETE_EVIDENCE)
- 提交审核前必须关联三类证据：
  - 预约登记
  - 就诊分诊
  - 随访回访

### 5. 重复补录校验 (DUPLICATE_RECORD)
- 同一患者同一随访类型只能有一条有效记录（未被驳回）

### 6. 已确认记录保护 (RECORD_CONFIRMED)
- 已确认的记录不能被覆盖或修改

## API 接口

### 记录相关
- `GET /api/records` - 获取随访记录列表
- `GET /api/records/{id}` - 获取记录详情
- `POST /api/records` - 创建随访记录
- `PUT /api/records/{id}` - 更新随访记录
- `POST /api/records/{id}/submit` - 提交审核
- `POST /api/records/{id}/process` - 办理通过
- `POST /api/records/{id}/reject` - 驳回

### 批量操作
- `POST /api/batch/process` - 批量通过
- `POST /api/batch/reject` - 批量驳回

### 证据相关
- `GET /api/patients` - 获取患者列表
- `GET /api/patients/{id}/evidence` - 获取患者关联的全部证据

### 系统相关
- `GET /api/health` - 健康检查
- `GET /api/user/current` - 当前用户信息
- `GET /api/users` - 用户列表
- `GET /api/roles` - 角色信息

### 请求头
所有业务接口需要携带以下请求头进行角色模拟：
- `X-User-Role`: 用户角色 (triage_nurse / gp_doctor / medical_director)
- `X-User-Name`: 用户名

## 测试样例说明

初始化脚本会创建 8 条随访记录，覆盖各种测试场景：

| 记录号 | 状态 | 测试场景 |
|--------|------|----------|
| FUR20250101001 | 草稿 | 正常草稿，证据齐全 |
| FUR20250101002 | 待医生处理 | 正常待处理，证据齐全 |
| FUR20250101003 | 待主任确认 | 医生已审核，等待主任确认 |
| FUR20250101004 | 已确认 | 已确认记录，测试覆盖拦截 |
| FUR20250101005 | 待医生处理 | 与001同患者同类型，测试重复补录拦截 |
| FUR20250101006 | 草稿 | 完全缺证据，测试提交拦截 |
| FUR20250101007 | 草稿 | 部分缺证据，测试提交拦截 |
| FUR20250101008 | 待医生处理 | 缺证据却到了医生环节，测试异常状态 |

## 错误响应格式

```json
{
  "detail": "错误详情描述",
  "error_code": "错误代码",
  "field": "相关字段（可选）"
}
```

常见错误代码：
- `ROLE_PERMISSION_DENIED` - 角色权限不足
- `VERSION_MISMATCH` - 版本号不匹配
- `INVALID_STATUS_TRANSITION` - 无效的状态流转
- `INCOMPLETE_EVIDENCE` - 证据不完整
- `DUPLICATE_RECORD` - 重复记录
- `RECORD_CONFIRMED` - 记录已确认
- `RECORD_NOT_FOUND` - 记录不存在
