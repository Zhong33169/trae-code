# 快速启动指南

## 三步启动系统

### 第一步：安装依赖

```bash
# 在项目根目录执行
npm run install:all
```

或分别安装：
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 第二步：初始化数据库

```bash
# 在项目根目录执行
npm run init:db
```

或手动执行：
```bash
cd backend
npm run init-db
npm run seed-data
```

### 第三步：启动服务

**打开两个终端窗口：**

**终端1 - 启动后端（端口8004）：**
```bash
cd backend
npm start
```

**终端2 - 启动前端（端口3004）：**
```bash
cd frontend
npm run dev
```

### 访问系统

打开浏览器访问：http://localhost:3004

## 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 旁站记录登记员 | registrar1 | 123456 |
| 旁站记录登记员 | registrar2 | 123456 |
| 旁站记录审核主管 | supervisor1 | 123456 |
| 旁站记录审核主管 | supervisor2 | 123456 |
| 工程监理公司复核负责人 | reviewer1 | 123456 |
| 工程监理公司复核负责人 | reviewer2 | 123456 |

## 演示流程建议

### 1. 完整流程演示（推荐）

**场景：申诉提交 → 驳回补正 → 再次提交 → 审核通过 → 复核归档**

1. 登录 **registrar1**（登记员）
   - 查看工作台"待我处理"中的"需补正"
   - 点击 PZ-2024-003 进入详情
   - 查看"上一处理人意见"卡片（审核主管的补正要求）
   - 点击【补正材料】按钮，填写补正说明，补充证据
   - 提交后状态变为"已补正"

2. 登录 **supervisor2**（审核主管）
   - 在待办中看到 PZ-2024-003（已补正）
   - 查看补正内容和新增证据
   - 点击【审核通过】，填写审核意见
   - 状态变为"审核通过"，流转到复核负责人

3. 登录 **reviewer1**（复核负责人）
   - 在待办中看到 PZ-2024-003（审核通过）
   - 查看完整的审核历史时间线
   - 点击【开始复核】→【复核通过】→【归档】
   - 流程完成

### 2. 异常场景演示

**缺证据场景（PZ-2024-004）：**
- 登录 registrar1，进入PZ-2024-004详情
- 查看"缺证据"标记和原因说明
- 补充照片证据，点击【补正材料】
- 后端会校验是否包含必需的照片证据

**状态冲突场景（PZ-2024-009）：**
- 登录 supervisor1，进入PZ-2024-009详情
- 查看状态冲突说明
- 可标记为"状态冲突"或要求补正

## 修改端口

如需修改端口：

### 修改后端端口
```bash
# 修改 backend/.env
PORT=8004  # 改为需要的端口
```

### 修改前端端口
```bash
# 修改 frontend/.env
FRONTEND_PORT=3004  # 改为需要的端口
BACKEND_PORT=8004   # 与后端端口保持一致
```

修改后需要重启服务。

## 重置数据库

如需重置数据库到初始状态：
```bash
npm run reset:db
```

或手动：
```bash
cd backend
rm -rf data/supervision.db*
npm run init-db
npm run seed-data
```

## 常见问题

### better-sqlite3 安装失败
better-sqlite3 需要编译原生模块：
- **macOS**: 执行 `xcode-select --install`
- **Windows**: 执行 `npm install --global windows-build-tools`
- **Linux**: 执行 `sudo apt-get install build-essential python3`

### 前端无法连接后端
1. 确认后端已启动，端口为8004
2. 确认 frontend/.env 中 BACKEND_PORT 与后端一致
3. 检查 vite.config.ts 中的代理配置

### 端口被占用
修改 .env 文件中的端口配置，确保前后端端口不冲突且未被占用。

## 系统功能检查清单

- [ ] 登录功能（不同角色）
- [ ] 工作台统计面板
- [ ] 旁站记录单列表（筛选、搜索）
- [ ] 记录详情展示（基本信息、证据、审核历史、操作日志）
- [ ] 上一处理人意见展示
- [ ] 状态流转操作（提交、审核、补正、复核、归档）
- [ ] 新建记录单（含证据上传）
- [ ] 操作日志查询
- [ ] 后端校验（角色、状态、版本、证据）
- [ ] 版本冲突提示
- [ ] 多角色权限控制
