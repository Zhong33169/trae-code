# 货运物流公司 - 批量变更复核运输订单系统

全流程运输订单管理系统，支持从运输委托 → 车辆调度 → 运输中 → 签收回单 → 复核归档 的连续办理。
严格按岗位分段，后岗不能替前岗补流程；支持批量变更生成批次号、部分成功、失败重试、完整审计。

## 技术栈

- **前端**: Angular 17 + Vite (端口 3003)
- **后端**: Python + Litestar (端口 8003)
- **数据库**: SQLite (本地文件 `backend/transport.db`)

## 初始化

### 后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8003
```

首次启动会自动创建数据库表并初始化演示数据。

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3003

## 演示账号（右上角选择角色登录）

| 用户名 | 显示名 | 角色 | 职责 |
|--------|--------|------|------|
| fqr | 冯庆荣 | 发起岗 | 新建订单、上传委托单、提交运输委托 |
| bl | 办理员 | 办理岗 | 车辆调度、上传调度单、发车、签收上传回单 |
| fhr | 复核人 | 复核岗 | 对已签收订单复核归档，或对任意环节驳回 |

## 业务流程

```
草稿 (draft)
  ↓ 发起岗 + 上传运输委托单
已委托 (entrusted)
  ↓ 办理岗 + 填写车牌司机 + 上传车辆调度单
已调度 (dispatched)
  ↓ 办理岗
运输中 (in_transit)
  ↓ 办理岗 + 填写签收人 + 上传签收回单
已签收 (delivered)
  ↓ 复核岗
已归档 (reviewed)
```

**驳回**: 复核岗可在已委托/已调度/运输中/已签收任一步驳回为 `rejected`，
然后发起岗可退回草稿、办理岗可重新委托。

## 样例数据说明

系统启动时自动生成 8 条覆盖各状态的订单，其中刻意设计了可验证校验规则的案例：

| 订单 | 状态 | 说明 |
|------|------|------|
| TO...001 (华盛物流) | 已委托 | 只有委托单，办理岗可调度但需补车牌和调度单 |
| TO...002 (顺丰快运) | 已调度 | 缺签收回单，无法直接签收 |
| TO...003 (德邦物流) | 运输中 | 缺签收人信息，无法签收 |
| TO...004 (中通物流) | 已签收 | 可由复核岗归档 |
| TO...005 (圆通速递) | 已归档 | 已完成不可修改 |
| TO...006 (韵达快递) | 草稿 | 需先上传委托单才能提交 |
| TO...007 (极兔速递) | 已驳回 | 测试驳回场景 |
| TO...008 (EMS邮政) | 草稿 | 可正常走全流程 |

## 后端校验规则（绕过前端也会被拦截）

后端在 `backend/app/services/order_service.py` 中实现了严格校验，**所有错误均返回具体原因**：

| 错误码 | 场景 | 返回消息示例 |
|--------|------|------------|
| `VERSION_CONFLICT` | 客户端版本与服务端不一致（乐观锁） | `版本冲突：当前版本为 v3，您提交的是 v1，请刷新后重试` |
| `INVALID_STATUS_TRANSITION` | 非法状态跳转 | `状态不允许变更：draft 不能直接变更为 reviewed` |
| `ROLE_PERMISSION_DENIED` | 角色越权 | `角色无权限：您是【办理岗】，无权从 draft 变更为 entrusted` |
| `MISSING_EVIDENCE` | 缺失证据 | `缺少必要证据：变更为 dispatched 需要 车辆调度单` |
| `MISSING_DISPATCH_INFO` | 调度前缺车牌/司机 | `调度前必须填写车牌号和司机信息` |
| `MISSING_RECEIVER_INFO` | 签收前缺签收人 | `签收必须填写签收人信息` |
| `ORDER_NOT_FOUND` | 订单不存在 | `订单不存在：id=999` |
| `ORDER_ARCHIVED` | 已归档订单再修改 | `订单已归档，不能再上传证据` |
| `ORDER_LOCKED` | 已签收/归档订单改信息 | `订单状态为 reviewed，不可修改基本信息` |

## API 测试（绕过前端）

示例 curl：

```bash
# 不选角色 → 401
curl -i http://localhost:8003/api/orders

# 用办理员 (bl id=2) 尝试从草稿直接提交委托 → 400 ROLE_PERMISSION_DENIED
curl -X POST http://localhost:8003/api/orders/5/transition \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: 2' \
  -d '{"target_status":"entrusted","expected_version":1}'

# 版本号不对 → 400 VERSION_CONFLICT
curl -X POST http://localhost:8003/api/orders/1/transition \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: 2' \
  -d '{"target_status":"dispatched","expected_version":1}'
```

## 批量变更

在运输订单队列左侧勾选多条订单 → 点「批量变更」按钮 → 选择目标状态。

- 自动生成批次号 `BATCHYYYYMMDDHHMMSS`
- 执行时逐条校验，**成功/失败都保留在批次结果中，失败项不被吞掉**
- 批次结果状态：`待执行 / 执行中 / 部分成功 / 全部成功 / 全部失败`
- 失败项可勾选或全部一键重试，重试次数计入审计
- 所有操作（创建批次、执行、重试）均留痕到审计日志

可到「批量变更批次」页面查看批次明细、失败原因、重试操作、审计记录。

## 项目结构

```
backend/
  app/
    main.py                 # Litestar 入口 + CORS + 数据种子
    models/
      database.py           # SQLAlchemy ORM 模型
      db_config.py          # SQLite 连接与会话
    schemas/
      order_schemas.py      # Pydantic 请求/响应模型
    services/
      order_service.py      # 订单核心：状态机/权限/版本/证据校验
      batch_service.py      # 批量变更：批次/部分成功/重试
      seed_service.py       # 演示用户与样例订单
    routers/
      api.py                # REST API 控制器
frontend/
  src/
    app/
      app.component.ts      # 顶栏：角色切换、导航
      services/
        api.service.ts      # HTTP 封装，自动带 X-User-Id
      models/
        index.ts            # 类型与常量
      components/
        order-list/         # 第一屏：订单队列 + 证据侧栏 + 办理详情 + 批量
        batch-list/         # 批次列表 + 明细 + 失败详情 + 重试
```
