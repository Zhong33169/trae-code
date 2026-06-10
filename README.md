# 高校实验室移动补录校验系统

实验预约单移动补录校验系统，用于高校实验室实验预约单的审批流程管理。

## 技术栈

- **前端**: SvelteKit + Vite
- **后端**: Python + Django + Django Ninja
- **数据库**: SQLite
- **前端端口**: 5173
- **后端端口**: 8004

## 功能特性

- 三级审批流程：实验助教 → 实验室管理员 → 学院负责人
- 后一个岗位不能替前一个岗位补流程
- 三类关键证据：实验预约方案、耗材申领单、安全确认书
- 补录记录独立保存，不混入原始记录
- 版本号控制，防止并发冲突
- 批量操作支持
- 详细的操作日志和审批记录
- 完整的错误提示和原因说明

## 快速开始

### 后端启动

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install django django-ninja django-cors-headers

# 数据库迁移
python manage.py makemigrations
python manage.py migrate

# 初始化演示数据
python manage.py seed_data

# 启动服务
python manage.py runserver 0.0.0.0:8004
```

后端 API 文档: http://localhost:8004/api/docs

### 前端启动

```bash
cd frontend

# 安装依赖
npm install --legacy-peer-deps

# 启动开发服务
npm run dev
```

前端地址: http://localhost:5173

## 演示账号

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| ta_wang | 123456 | 实验助教 | 计算机学院王助教 |
| ta_li | 123456 | 实验助教 | 物理学院李助教 |
| labadmin_zhang | 123456 | 实验室管理员 | 张管理员 |
| labadmin_liu | 123456 | 实验室管理员 | 刘管理员 |
| college_chen | 123456 | 学院负责人 | 计算机学院陈主任 |
| college_zhao | 123456 | 学院负责人 | 物理学院赵院长 |

## 测试样例说明

系统预置了 8 条实验预约单，覆盖各种场景：

| 预约单号 | 状态 | 说明 |
|----------|------|------|
| LAB202506010001 | 草稿 | 缺少耗材申领和安全确认，用于测试缺证据提交拦截 |
| LAB202506010002 | 待实验室审核 | 证据齐全，可正常审核通过 |
| LAB202506010003 | 待实验室审核 | 缺少耗材申领单，测试证据不足拦截 |
| LAB202506010004 | 待学院确认 | 实验室已审核通过，可测试学院确认 |
| LAB202506010005 | 已确认 | 完整审批流程完成的样例 |
| LAB202506010006 | 实验室退回 | 被退回的预约单，可测试补录后重提 |
| LAB202506010007 | 待学院确认 | 有补录记录的预约单（安全确认书是补录的） |
| LAB202506010008 | 草稿 | 完全空白，测试各种缺证据场景 |

## 后端校验规则

系统会对以下情况进行拦截并返回具体原因：

1. **错角色操作** - 非对应角色不能执行对应操作
2. **版本号冲突** - 防止并发修改，提交时需带当前版本号
3. **证据不足** - 缺少必要证据材料时不能提交/通过
4. **状态错误** - 不能跳过审批流程，后岗不能替前岗补流程
5. **非本人操作** - 只能操作自己创建或自己权限范围内的预约单

## API 接口

主要接口列表：

- `GET /api/reservations` - 获取预约单列表
- `GET /api/reservations/{id}` - 获取预约单详情
- `POST /api/reservations` - 创建预约单
- `POST /api/reservations/{id}/submit` - 提交预约单
- `POST /api/reservations/{id}/lab-review` - 实验室审核
- `POST /api/reservations/{id}/college-confirm` - 学院确认
- `POST /api/reservations/{id}/supplement-evidence` - 补录证据材料
- `POST /api/reservations/batch` - 批量操作
- `GET /api/reservations/{id}/evidences` - 获取证据列表
- `GET /api/reservations/{id}/supplementary-records` - 获取补录记录
- `GET /api/reservations/{id}/audit-logs` - 获取审核日志

## 目录结构

```
trae-code-4/
├── backend/                 # 后端 Django 项目
│   ├── lab_system/         # Django 项目配置
│   ├── reservations/       # 预约单应用
│   │   ├── models.py       # 数据模型
│   │   ├── api.py          # API 接口
│   │   ├── schemas.py      # Pydantic 模式
│   │   └── management/     # 管理命令（种子数据）
│   ├── manage.py
│   └── db.sqlite3          # SQLite 数据库
└── frontend/               # 前端 SvelteKit 项目
    ├── src/
    │   ├── routes/         # 页面路由
    │   └── lib/            # 工具库和组件
    │       ├── components/ # Svelte 组件
    │       ├── stores.js   # 状态管理
    │       ├── api.js      # API 客户端
    │       └── constants.js # 常量定义
    └── package.json
```
