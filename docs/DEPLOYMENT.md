# 物业租赁综合管理系统 — 部署手册

---

## 一、系统概述

本系统是面向物业企业的桌面端租赁管理平台，覆盖收租管理、财务报表、合同管理三大核心模块。

| 项目 | 说明 |
|------|------|
| 系统名称 | 物业租赁综合管理系统 |
| 适用规模 | 50-500 套房源 |
| 适用业态 | 住房（公寓/住宅）、厂房、商铺 |
| 运行模式 | Windows 桌面应用 / 本地 Web 服务 |
| 用户数量 | 单机部署，支持多人角色协作 |
| 技术栈 | Electron + Vue3 + Element Plus / Node.js + Express + Sequelize / MySQL + Redis |

---

## 二、环境要求

### 2.1 硬件要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 双核 2.0GHz | 四核 2.5GHz+ |
| 内存 | 4 GB | 8 GB+ |
| 硬盘 | 2 GB 可用空间 | 10 GB+ (SSD) |
| 显示器 | 1280×720 | 1920×1080 |

### 2.2 软件依赖

| 软件 | 版本要求 | 说明 |
|------|---------|------|
| Windows | Windows 10 / 11 (64位) | 不支持 Windows 7 |
| Node.js | 20 LTS (20.x) | 下载: https://nodejs.org/ |
| MySQL | 8.0+ | 下载: https://dev.mysql.com/downloads/installer/ |
| Redis | 7.x (Windows版) | 下载: https://github.com/tporadowski/redis/releases |

### 2.3 可选依赖

| 软件 | 用途 |
|------|------|
| Electron | 桌面应用打包（生产部署用） |
| Git | 版本管理（开发用） |

---

## 三、快速安装

### 3.1 安装 Node.js

1. 访问 https://nodejs.org/ 下载 Node.js 20 LTS 版本
2. 运行安装程序，选择"添加到 PATH"
3. 验证：打开 **命令提示符** 执行 `node -v` 应输出 v20.x.x

### 3.2 安装 MySQL 8.0

1. 下载 MySQL Installer: https://dev.mysql.com/downloads/installer/
2. 运行安装程序，选择 **Server only** 安装类型
3. 设置 root 密码（建议留空用于开发，生产环境请设强密码）
4. 确保 MySQL 服务已启动（Windows 服务中找到 MySQL80，确保"正在运行"）

### 3.3 安装 Redis

1. 下载 Windows 版 Redis: https://github.com/tporadowski/redis/releases
2. 解压到 `C:\redis\` 目录
3. 打开命令提示符，执行：
   ```
   C:\redis\redis-server.exe
   ```
4. 保持窗口打开即表示 Redis 运行中
5. (可选) 将 Redis 注册为 Windows 服务：
   ```
   C:\redis\redis-server.exe --service-install
   ```

### 3.4 安装本系统

1. 将项目文件夹 `物业租赁综合管理系统` 复制到目标目录（如 `D:\property-system\`）

2. 双击运行 `setup.bat`，等待自动完成依赖安装

3. 配置数据库连接 —— 复制 `.env.example` 为 `.env`，根据实际环境修改：
   ```
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=property_rental
   DB_USER=root
   DB_PASSWORD=你的MySQL密码
   ```

4. 创建数据库 —— 打开 MySQL 客户端执行：
   ```sql
   CREATE DATABASE IF NOT EXISTS property_rental
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

---

## 四、启动系统

### 4.1 开发模式（推荐）

双击运行 `start-dev.bat`，系统将自动：

1. 检查 MySQL 和 Redis 连接
2. 启动后端 API 服务 (端口 3001)
3. 启动前端开发服务器 (端口 5173)
4. 自动打开浏览器访问 `http://localhost:5173`

**默认登录账号：**
- 用户名：`admin`
- 密码：`admin123`

### 4.2 生产模式

双击运行 `start.bat`，系统将：

1. 检查 MySQL 和 Redis 连接
2. 编译前端静态资源
3. 编译后端 TypeScript
4. 启动后端服务 (端口 3001)
5. 启动前端预览服务 (端口 5173)

### 4.3 手动启动

**启动后端：**
```bash
cd backend
npm run dev      # 开发模式（热重载）
# 或
npm run build && node dist/index.js   # 生产模式
```

**启动前端：**
```bash
cd frontend
npm run dev      # 开发模式（热重载，端口 5173）
# 或
npm run build && npm run preview      # 生产预览
```

---

## 五、系统配置说明

### 5.1 环境变量 (`.env`)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 后端端口 | 3001 |
| DB_HOST | MySQL 主机 | 127.0.0.1 |
| DB_PORT | MySQL 端口 | 3306 |
| DB_NAME | 数据库名 | property_rental |
| DB_USER | 数据库用户 | root |
| DB_PASSWORD | 数据库密码 | (空) |
| REDIS_HOST | Redis 主机 | 127.0.0.1 |
| REDIS_PORT | Redis 端口 | 6379 |
| JWT_SECRET | JWT 签名密钥 | (内置默认值，生产环境请修改) |
| NODE_ENV | 运行模式 | development |

### 5.2 开发端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 Vite | 5173 | 开发热重载服务 |
| 后端 API | 3001 | RESTful API 服务 |
| MySQL | 3306 | 数据库 |
| Redis | 6379 | 缓存 |

前端开发服务器已配置代理，`/api` 请求自动转发到后端 `localhost:3001`。

---

## 六、用户角色与权限

系统预置 9 种角色，权限矩阵如下：

| 角色 | 收租管理 | 财务管理 | 合同管理 | 系统设置 |
|------|:---:|:---:|:---:|:---:|
| 管理员 | ●●●●●● | ●●●●●● | ●●●●●● | ●●●●●● |
| 收租主管 | ●●●●●● | ○ | ○ | - |
| 收租员 | ●●●○ | - | - | - |
| 财务主管 | ○ | ●●●●●● | - | - |
| 会计 | - | ●●●○ | - | - |
| 出纳 | ●○ | ●○ | - | - |
| 合同主管 | ○ | - | ●●●●●● | - |
| 法务 | - | - | ●● | - |
| 总经理 | ●○ | ●○ | ●○ | - |

图例: ● 全部权限 ○ 只读权限 - 无权限

---

## 七、数据库初始化

系统首次启动时会通过 Sequelize 自动建表 (`sequelize.sync`)。如需手动管理：

```bash
cd backend
# 执行迁移（需先配置 sequelize-cli）
npx sequelize-cli db:migrate

# 导入种子数据（默认管理员账号）
npx sequelize-cli db:seed:all
```

种子数据包括：
- 默认管理员账号 `admin / admin123`
- 后续可扩展标准会计科目表、合同模板等

---

## 八、Electron 桌面打包

将系统打包为独立 Windows 安装程序：

```bash
# 1. 构建前端
cd frontend && npm run build && cd ..

# 2. 编译后端
cd backend && npm run build && cd ..

# 3. 编译 Electron 主进程
npx tsc -p electron/tsconfig.json

# 4. 打包安装程序
npx electron-builder
```

生成的安装程序位于 `release/` 目录。

**注意事项：**
- 打包前需将 MySQL 便携版放入 `runtime/mysql/` 目录
- 打包前需将 Redis 放入 `runtime/redis/` 目录
- 安装程序约 200-400 MB（含 MySQL + Redis 运行时）

---

## 九、目录结构

```
物业租赁综合管理系统/
├── setup.bat                   # 首次安装脚本
├── start.bat                   # 一键启动（生产模式）
├── start-dev.bat               # 一键启动（开发模式）
├── .env.example                # 环境变量模板
├── package.json                # 根 monorepo 配置
├── electron-builder.yml        # 打包配置
│
├── electron/                   # Electron 主进程
│   ├── main.ts                 # 应用入口
│   ├── preload.ts              # 预加载脚本
│   ├── spawn-mysql.ts          # MySQL 便携版管理
│   ├── spawn-redis.ts          # Redis 管理
│   └── spawn-backend.ts        # 后端生命周期管理
│
├── frontend/                   # Vue3 前端
│   ├── src/
│   │   ├── views/              # 32 个页面视图
│   │   ├── api/                # API 请求层
│   │   ├── router/             # 路由配置
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── components/         # 通用组件
│   │   └── styles/             # 设计令牌
│   └── vite.config.ts
│
├── backend/                    # Express 后端
│   ├── src/
│   │   ├── models/             # 22 个 Sequelize 模型
│   │   ├── routes/             # 24 个 API 路由模块
│   │   ├── services/           # 业务服务
│   │   ├── middleware/         # 认证/权限/校验
│   │   └── jobs/               # 定时任务
│   └── seeders/               # 种子数据
│
├── runtime/                    # 便携运行时（打包用）
│   ├── mysql/
│   └── redis/
│
└── docs/                       # 文档
    ├── DEPLOYMENT.md           # 部署手册（本文件）
    └── superpowers/            # 设计/计划文档
```

---

## 十、常见问题排查

### 问题 1：MySQL 连接失败

**症状：** 启动时提示 "MySQL 未运行" 或后端日志显示 "connect ECONNREFUSED"

**解决：**
1. 检查 MySQL 服务是否运行：`services.msc` 找 MySQL80 → 右键"启动"
2. 检查 `.env` 中数据库连接参数是否正确
3. 确认数据库 `property_rental` 已创建

### 问题 2：Redis 连接失败

**症状：** 启动时提示 "Redis error"

**解决：**
1. 确保 `redis-server.exe` 正在运行
2. 检查 6379 端口是否被占用: `netstat -ano | findstr 6379`

### 问题 3：端口被占用

**症状：** 启动时提示 "Port 3001 already in use"

**解决：**
1. 找到占用进程: `netstat -ano | findstr 3001`
2. 停止进程 或 修改 `.env` 中 `PORT` 为其他端口（如 3002）

### 问题 4：前端页面空白

**症状：** 浏览器打开 localhost:5173 显示空白页

**解决：**
1. 确认后端已正常启动（访问 http://localhost:3001/api/dashboard/rent）
2. 打开浏览器开发者工具 (F12) 查看控制台错误
3. 清除浏览器缓存后重试

### 问题 5：登录失败

**症状：** 使用 admin/admin123 无法登录

**解决：**
1. 确认数据库已运行且 `property_rental` 数据库存在
2. 确认已执行种子数据 (seeders) 创建默认管理员
3. 手动在 `users` 表中检查是否有 `admin` 用户记录

### 问题 6：批量导入报错

**症状：** 房源批量导入时提示格式错误

**解决：**
1. 确保上传 .xlsx 格式文件
2. 模板要求第一行包含字段名：`名称`/`类型`/`面积`/`地址` 等
3. 面积列必须是数字

---

## 十一、联系与支持

| 渠道 | 说明 |
|------|------|
| 技术架构 | Electron + Vue3 + Express + MySQL + Redis |
| 数据库 | 22 张数据表，关系模型完整 |
| API 接口 | 79 个 RESTful 端点 |
| 前端页面 | 32 个业务视图 |

---

*文档版本：v1.0.0 | 更新日期：2026-05-11*
