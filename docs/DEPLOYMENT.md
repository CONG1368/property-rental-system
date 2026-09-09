# 物业租赁综合管理系统 — 部署手册

---

## 一、系统概述

本系统是面向物业企业的 **Electron 桌面端租赁管理平台**，覆盖收租管理、物业管理、合同管理、财务报表、消防管理、系统设置等模块。

| 项目 | 说明 |
|------|------|
| 系统名称 | 物业租赁综合管理系统 |
| 适用规模 | 50-500 套房源 |
| 适用业态 | 住房（公寓/住宅）、厂房、商铺 |
| 运行模式 | Electron 桌面应用（内置本地 Web 服务） |
| 用户数量 | 单机部署，支持多人角色协作 |
| 技术栈 | Electron + Vue3 + Element Plus / Node.js + Express + Sequelize / **SQLite（默认）**，可选 MySQL |
| 当前版本 | v1.0.4 |

---

## 二、环境要求

### 2.1 硬件要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 双核 2.0GHz | 四核 2.5GHz+ |
| 内存 | 4 GB | 8 GB+ |
| 硬盘 | 2 GB 可用空间 | 10 GB+ (SSD) |
| 显示器 | 1280×720 | 1920×1080 |

### 2.2 软件依赖（终端用户）

面向最终用户的安装包为 **Electron 桌面版**，无需单独安装 Node/MySQL/Redis——运行时已随安装包分发（`runtime/node` 便携 Node.js，数据库默认 SQLite 零配置）。

| 软件 | 版本要求 | 说明 |
|------|---------|------|
| Windows | Windows 10 / 11 (64位) | 不支持 Windows 7 |

### 2.3 开发/构建环境

仅在源码二次开发或自建安装包时需要：

| 软件 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | 20 LTS / 22 | 构建与开发（CI 用 Node 22） |
| Git | 任意 | 版本管理 |
| electron-builder | 24.x（项目依赖） | Electron 桌面打包 |

---

## 三、快速安装（终端用户）

安装包为 NSIS 安装程序（`release/property-rental-system-setup-1.0.4.exe`）：

1. 双击安装包，按向导选择安装目录（默认 `%LOCALAPPDATA%\Programs\物业租赁综合管理系统`）。
2. 安装完成后桌面/开始菜单出现「物业租赁综合管理系统」快捷方式。
3. 首次启动自动完成：建库（SQLite）→ 迁移 → 同步表结构 → 创建默认管理员（`admin / admin123`）→ 生成演示数据（可关）。
4. 登录即用，**无需手动配置数据库**。

> 数据存储位置：`%APPDATA%\property-rental-system\data\`（Electron `userData`，取 package.json 的 `name`）。`runtime/` 与安装包随包分发，无需手工放置。

---

## 四、启动系统

### 4.1 开发模式

执行 `npm run dev`（自动清理残留进程后，并行启动前端 Vite(5173) + 后端 tsx-watch(3001)）。

浏览器访问 `http://localhost:5173` 即可使用。后端健康检查：`http://localhost:3001/api/health`。

### 4.2 生产（桌面版）

安装包启动后，Electron 主进程 `spawn-backend.ts` 用便携 Node.js（`runtime/node/node.exe`）拉起后端，三通道并行检测后端就绪（stdout 多关键字 + 5s 兜底 + HTTP 健康轮询 `/api/health`，60s 安全超时）。登录页会轮询等待种子数据就绪（`seedReady`）。

### 4.3 默认登录账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |

> 首次登录后请立即修改密码。

---

## 五、系统配置说明

系统配置分两类：**环境变量（`.env`，开发/部署用）** 与 **系统参数中心（`system_configs`，运行时）**。

### 5.1 环境变量（`.env`）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 后端端口 | 3001 |
| DB_DIALECT | 数据库方言 | sqlite（可选 mysql） |
| DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD | MySQL 连接（仅 DB_DIALECT=mysql 时） | - |
| REDIS_ENABLED | Redis 缓存 | true（连接失败自动降级，不影响业务） |
| JWT_SECRET | JWT 签名密钥 | 内置默认（生产请修改） |
| CRON_ENABLED | 定时任务开关 | true |

> 生产打包版在 `spawn-backend.ts` 中强制 `REDIS_ENABLED=false`、`DB_DIALECT=sqlite`。

### 5.2 开发端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 Vite | 5173 | 开发热重载 |
| 后端 API | 3001 | RESTful API |
| 数据库 | - | SQLite 文件，无端口 |

### 5.3 运行时配置（系统参数中心）

业务侧配置已迁移到各业务页（普通用户无需进系统参数中心）：

| 配置 | 入口 |
|------|------|
| 读卡模式 / 读卡器高级设置 | 身份证读卡器页 |
| 水电表平台设置 | 智能水电表页 |
| 打印抬头 | 打印设置页 |
| 审计开关 / 演示数据开关 | 系统运维页 |
| 全部技术键（默认隐藏） | 系统运维 → 技术配置（系统参数） |

---

## 六、用户角色与权限

系统预置 **12 种角色**：管理员 / 总经理 / 收租主管 / 收租员 / 财务主管 / 会计 / 出纳 / 合同主管 / 法务 / 物业经理 / 维修工 / 安全主管。

- 后端：路由级 `requireRole` 粗隔离 + 操作级 `requirePermission` 细粒度 + 不可逆操作 `requireConfirmPassword`（二次确认密码）。
- 前端：路由守卫按角色过滤菜单；权限矩阵页（`/system/permissions`）支持可视化配置各角色各模块权限（改动需管理员密码二次确认）。
- 审计：敏感操作写 `audit_log`，越权尝试额外记「越权尝试」。

---

## 七、数据库初始化

**默认 SQLite 零配置**：启动时 `connectDatabase` → `runAllMigrations` → `sequelize.sync` → `initAdminUser`，自动建库/补列/建表/建管理员。

- 数据文件：`backend/data/database.sqlite`（开发）；打包版在 `%APPDATA%\property-rental-system\data\`。
- 迁移系统：`backend/src/config/migration.ts` 声明「表 + 待补列」，在 `sync` 前执行，解决 Sequelize 只建新表不改旧列的问题。
- 演示数据：`demo_enabled`（默认开）控制，`demo_seeded` 一次性标记防重种；两点可在「系统运维」页切换。

---

## 八、Electron 桌面打包

### 8.1 构建 + 打包

```bash
# 一条命令：构建前端 → 编译后端 → 编译 Electron 主进程 → electron-builder 打包
npm run build
```

分步等价：

```bash
npm run build:frontend   # cd frontend && npm run build (vue-tsc + vite build)
npm run build:backend    # cd backend && npm run build  (gen-build-version + fix-esm + tsc + verify-esm)
npm run build:electron   # tsc -p electron/tsconfig.json && electron-builder
```

产物位于 `release/`：

| 文件 | 说明 |
|------|------|
| `property-rental-system-setup-1.0.4.exe` | NSIS 安装包（自动更新用） |
| `物业租赁综合管理系统-1.0.4-x64.zip` | zip 分发包 |
| `latest.yml` | electron-updater 更新清单（url 指向 setup 名） |
| `win-unpacked/` | 解包目录（调试用） |

### 8.2 打包注意

- **版本号**：仅根 `package.json` 的 `version` 决定；发版前先改它再 `npm run build`。构建期 `gen-build-version.cjs` 注入 `BUILD_VERSION` 到 `backend/src/build-version.ts`。
- **运行时资源**：`electron-builder.yml` 的 `extraResources` 按需从磁盘复制 `runtime/node`（Node）、`runtime/python-x86`（32 位 Python 桥）、`runtime/idcard`（华视 SDK + 桥 + license.dat）、`runtime/idcard-driver`（华视内核驱动）。`runtime/*` **不进 Git**（gitignore），仅随包分发。
- **安装包命名一致性**：NSIS 目标 `artifactName` 为 `${name}-setup-${version}.exe`（纯 ASCII），保证磁盘安装包名与 `latest.yml` 的 url 一致（否则 electron-updater 自动更新找不到安装包）。
- 打包前需**停掉 dev 进程**（dev 会锁定 `backend/node_modules` 与 `runtime/node/node.exe`）。
- `compression: maximum` 时 NSIS 压缩较慢（约 10-20 分钟）。

---

## 九、目录结构

```
物业租赁综合管理系统/
├── package.json                # 根配置（version 决定打包版本）
├── electron-builder.yml        # 打包配置（extraResources / nsis / win）
├── electron/                   # Electron 主进程 + preload
│   ├── main.ts                 # 应用入口 / 菜单 / IPC / 驱动检测安装
│   ├── preload.ts              # preload 桥（contextBridge）
│   └── spawn-backend.ts        # 便携 Node 拉起后端（生产）
├── frontend/                   # Vue3 前端
│   └── src/
│       ├── views/              # 87 个页面视图
│       ├── api/                # API 请求层
│       ├── router/             # hash 路由 + 角色守卫
│       ├── stores/             # Pinia
│       ├── components/         # 通用组件 + layout + print 模板
│       └── styles/             # 设计令牌（湛蓝玻璃拟物）
├── backend/                    # Express 后端（ESM）
│   └── src/
│       ├── models/             # 69 个 Sequelize 模型
│       ├── routes/             # 67 个 API 路由模块
│       ├── services/           # 业务服务
│       ├── middleware/         # 认证/权限/审计/校验
│       ├── config/             # 数据库/迁移/配置
│       ├── jobs/               # 定时任务（7 个 cron）
│       └── websocket/          # WebSocket 广播
├── runtime/                    # 便携运行时（打包用，gitignore）
│   ├── node/                   # 便携 Node.js（生产后端运行时）
│   ├── idcard/                 # 华视 SDK + 桥 + license.dat
│   ├── idcard-driver/          # 华视内核驱动（V3.5 64位 WHQL）
│   └── python-x86/             # 32 位 Python（读卡桥）
├── scripts/                    # E2E/回归/截图/PDF/门禁脚本
├── data/                       # 运行时 SQLite（开发）
└── docs/                       # 文档（使用说明书 / 部署 / 接入指南）
```

---

## 十、常见问题排查

### 问题 1：端口被占用（3001/5173）
**解决：** `netstat -ano | findstr :3001` 定位进程；或 `npm run dev:clean`（`kill-dev.ps1`）清理残留。

### 问题 2：登录失败 / 后端异常
**解决：** 确认 `/api/health` 返回 200 且 `seedReady=true`（登录页会轮询等待种子就绪，避免空表查询误报）。

### 问题 3：读卡器「未找到内置驱动包」
**解决：** 用含修复的安装包（v1.0.3+ 已补 `resources` 路径段）；到「身份证读卡器 → 读卡器驱动」卡片【检测】→【安装驱动（需管理员）】。

### 问题 4：房源列表楼栋/房号显示「-」
**解决：** 新建/编辑房源时补充「楼栋」「房号」（典型命名会自动解析）；对存量数据跑 `cd backend && npx tsx ../scripts/backfill-property-building.ts [库路径]`。

### 问题 5：批量导入报错
**解决：** 仅支持 .xlsx（exceljs）；老版 .xls 请在 Excel/WPS 另存为 .xlsx。

### 问题 6：打包时 EPERM / node.exe 被占用
**解决：** 停止 dev 进程后再 `npm run build`。

---

## 十一、联系与支持

| 项目 | 说明 |
|------|------|
| 技术架构 | Electron + Vue3 + Express + Sequelize（SQLite 默认 / MySQL 可选） |
| 数据表 | 69 个 Sequelize 模型 |
| API 路由 | 67 个路由模块（`/api` 前缀） |
| 前端页面 | 87 个业务视图 |
| 读卡器 | 华视 CVR-100U（32 位桥 + 内置 WHQL 驱动） |
| 智能水电表 | bzp.iyunmu.com 预付费平台对接 |

---

*文档版本：v1.0.4 | 更新日期：2026-09-09*
