# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 行为规则

1. **任务进度更新**：每次完成一个开发任务后，必须用表格实时更新任务进度（含任务编号、名称、状态、变更文件清单），并列出后续剩余开发任务。
2. **语言要求**：开发全程和思考全程必须都用中文显示。所有与用户的沟通、代码注释、文档内容均使用中文。

## 项目概述

物业租赁综合管理系统 — Electron 桌面应用。采用前后端分离架构：Vue3 前端 + Express 后端，Sequelize ORM（默认 SQLite，可选 MySQL），最后打包为 Electron 桌面应用。

## 常用命令

```bash
# 开发环境启动（前后端并行）
npm run dev

# 仅前端 (Vite dev server, port 5173)
npm run dev:frontend

# 仅后端 (Express + tsx watch, port 3001)
npm run dev:backend

# 全局构建（前端→后端→Electron 打包）
npm run build

# 自动化 API 全量测试（需先启动 dev 后端）
bash test-api.sh

# 后端 TypeScript 类型检查（不生成输出）
cd backend && npx tsc --noEmit

# 前端 TypeScript 类型检查
cd frontend && npx vue-tsc --noEmit

# 单独构建后端
cd backend && npm run build    # tsc 输出到 backend/dist/

# 单独构建前端
cd frontend && npm run build   # vue-tsc + vite build 输出到 frontend/dist/

# 打包 Electron 安装包
npm run build:electron         # 先完成前后端构建，再运行此命令
```

**默认登录凭据：** `admin / admin123`（数据库首次启动自动创建）

## 技术栈

| 层 | 技术 | 关键版本 |
|---|------|---------|
| 前端框架 | Vue 3 Composition API (`<script setup lang="ts">`) | 3.4 |
| UI 库 | Element Plus + @element-plus/icons-vue | 2.5 |
| 图表 | ECharts 5 + vue-echarts 6 | - |
| PDF | jspdf 4 + jspdf-autotable 5 + html2canvas 1 | 打印/导出 |
| 状态管理 | Pinia | 2.1 |
| 路由 | Vue Router 4 (hash 模式) | 4.3 |
| HTTP 客户端 | Axios (拦截器自动附加 Bearer token + 401 自动刷新) | - |
| 后端框架 | Express | 4.18 |
| ORM | Sequelize 6 (SQLite 默认 / MySQL 可选) | 6.37 |
| 认证 | JWT (access 4h + refresh 7d) | - |
| 定时任务 | node-cron (账单生成/催缴/折旧/合同到期) | - |
| 实时通信 | WebSocket (ws) — 路径 `/ws` | - |
| 打包 | electron-builder (NSIS 安装包, x64) | - |

## 项目结构

```
├── frontend/                  # Vue3 前端
│   └── src/
│       ├── api/               # Axios 请求模块（每个业务域一个文件）
│       ├── components/
│       │   ├── layout/        # AppLayout.vue — 主布局（侧边栏+顶栏）
│       │   └── print/         # 打印 HTML 模板（5套：合同/租客/账单/收据/批量）
│       ├── router/            # 路由定义（hash 模式，token 导航守卫）
│       ├── utils/             # 工具模块（打印服务/头像/凭证存储）
│       ├── views/             # 页面组件（37个）
│       │   ├── dashboard/     # 首页概览
│       │   ├── rent/          # 租赁管理（房源/租客/账单/门锁/催缴/看板）
│       │   ├── finance/       # 财务管理（账套/科目/凭证/费用/税务/预算/报表/看板）
│       │   ├── contract/      # 合同管理（列表/详情/起草/审批/看板/到期/续约/模板/合规）
│       │   └── system/        # 系统设置（用户/字典/打印设置/审计日志）
│       └── api/request.ts     # Axios 实例（baseURL=/api，拦截器处理 token/401）
├── backend/                   # Express 后端（ESM 模块）
│   └── src/
│       ├── index.ts           # 入口：连接DB→同步表→种子数据→启动HTTP+WS
│       ├── app.ts             # Express 应用（helmet/cors/morgan/json/路由/错误处理）
│       ├── config/            # 配置（数据库/JWT/Redis/上传）
│       ├── models/            # Sequelize 模型（27个数据模型 + index/BaseModel）
│       ├── routes/            # Express 路由（24个模块 + index，统一挂载 /api 前缀）
│       ├── middleware/        # auth（JWT验证）/ rbac / audit-log / validate / rate-limiter / error-handler
│       ├── services/          # 业务服务层（19个服务）
│       ├── jobs/scheduler.ts  # 4个 cron 定时任务
│       └── websocket/         # WebSocket 广播
├── electron/                  # Electron 主进程 + preload
├── runtime/                   # 运行时资源（打包时复制到安装目录）
├── electron-builder.yml       # electron-builder 打包配置
└── data/                      # SQLite 数据库文件（运行时生成）
```

## 核心架构约定

### 模型层 — BaseModel 模式

所有 Sequelize 模型继承 `BaseModel`（非 `Model`），`BaseModel` 提供 `[key: string]: any` 索引签名，让 TypeScript 识别 `init()` 定义的属性：

```typescript
import { BaseModel } from './BaseModel.js';
class MyModel extends BaseModel<Attrs, CreationAttrs> {}
```

模型关联集中在 `models/index.ts` 中定义。路由文件通过 `import '../models/index.js'` 触发关联注册。

### 路由层 — 模式一致性

- 所有业务路由文件在 `routes/index.ts` 中挂载到 `/api` 前缀
- 需登录的路由 `router.use('/xxx', authMiddleware, xxxRoutes)`
- 无需登录的：`/auth`（认证）、`/callbacks`（支付回调）
- 每个路由 Handler 使用 `try/catch` 包装，返回 `{ code: 200, data: ... }` 或 `{ code: 500, message: ... }`

### 前端 API 调用 — 响应拦截器处理

`request.ts` 的响应拦截器（第 25 行 `return response.data`）返回的是 Axios 响应的完整 body 对象 `{ code, data, message }`。因此业务层通过 `res.data.xxx` 访问实际数据：

```typescript
// 后端返回 { code: 200, data: { list: [...], total: 10 }, message: "ok" }
const res = await request.get('/bills', { params });
// res = { code: 200, data: { list: [...], total: 10 }, message: "ok" }
tableData.value = res.data.list;   // ✓ 正确
total.value = res.data.total;      // ✓ 正确
```

非 200 的 code 会被拦截器自动弹出 `ElMessage.error` 并 reject Promise，业务层只需 `catch` 空处理或自定义错误提示。

**API baseURL 策略**：开发模式 Vite proxy 转发 `/api` → `localhost:3001`，生产模式（Electron 打包）直连 `http://localhost:3001/api`。401 响应触发自动 token 刷新，刷新失败清空登录态跳转 `/login`。登录/刷新接口的 401 直接透传（避免死循环）。

### 前端请求 API 模块位置

所有后端 API 调用封装在 `frontend/src/api/` 目录下，按域拆分（bills.ts / dunning.ts / contracts.ts 等），但多数页面直接 `import request from '@/api/request'` 调用，不完全经过封装。

### 数据库 — SQLite 优先

默认使用 SQLite（零配置），`.env` 中设置 `DB_DIALECT=mysql` 可切换到 MySQL。启动时自动建库、建表、创建管理员和标准会计科目（26个科目）。不依赖 Sequelize migrations。

### 启动初始化流程

`index.ts` 启动顺序严格如下，失败会中断后续步骤：

```
1. connectDatabase()     → SQLite 直接连接；MySQL 自动建库 + 5次重试
2. sequelize.sync()      → 建新表（不修改已有列！）
3. initAdminUser()       → 创建 admin / admin123（如不存在）
4. seedChartOfAccounts() → 26 个标准会计科目（如不存在）
5. seedAllDemoData()     → 3 年演示经营数据（如不存在）
6. seedDoorLocks()       → 4 套演示门锁（2智能+2传统）（如不存在）
7. connectRedis()        → 可选，失败自动退化不阻塞
8. HTTP + WebSocket      → 端口 3001
9. scheduler.start()     → 4 个 cron 定时任务
```

### Redis 可选/退化机制

`config.redis.enabled` 默认为 `true`。`connectRedis()` 失败时打印警告并继续运行，不影响核心业务。生产打包版本在 `spawn-backend.ts` 中设置 `REDIS_ENABLED=false`。

### 文件上传配置

- 上传目录：`backend/uploads/`（可通过 `UPLOAD_DIR` 环境变量覆盖）
- 大小限制：单文件 ≤ 10MB
- 允许类型：JPEG / PNG / PDF / Word / Excel（见 `config/index.ts`）

### Electron 主进程生命周期

`electron/main.ts`：

1. `app.whenReady()` → `buildMenu()`（中文菜单栏，macOS/Windows 自适应）→ `spawnBackend()` → `createWindow()`
2. `spawn-backend.ts`：生产模式使用便携 Node.js（`runtime/node/node.exe`），SQLite 数据存储在 `%APPDATA%/物业租赁综合管理系统/data/`，监听 stdout 中 `Server running` 确认启动完成（8s 超时）
3. IPC 通道：`get-app-version`（返回版本号）、`get-backend-status`（健康检查）、`print-html`（原生打印）、`save-file-dialog`（保存文件对话框）、`open-file-dialog`（打开文件对话框）
4. 开发模式窗口加载 `http://localhost:5173`，生产模式加载 `file://` 协议
5. 生产模式禁止开发者工具（拦截 `devtools-opened` 事件）

### 外部服务 — Mock 优先

支付回调（微信/支付宝）、短信（阿里云/腾讯云）、电子签章（e签宝/Fadada）、银行对账、税务导出等服务均以 Mock 模式运行。通过环境变量切换 Provider（如 `SMS_PROVIDER=aliyun`），日志写入 `backend/logs/` 目录下的 JSONL 文件。

### RBAC 权限体系（双层防护）

**后端层** — 两个中间件配合使用：

```typescript
// requireRole — 路由级粗粒度隔离（routes/index.ts 中挂载）
router.use('/properties', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), propertyRoutes);

// requirePermission — 操作级细粒度控制（routes/*.ts 路由 Handler 中）
router.post('/', requirePermission('rent', 'create'), async (req, res) => { ... });
```

角色权限定义见 `middleware/rbac.ts`，9 角色 × 6 操作（create/read/update/delete/approve/export），管理员和总经理拥有全部/只读全局权限。

**前端层** — 路由守卫 + 菜单过滤：

- `router/index.ts` 的 `routeRoleMap` 按路径前缀（rent/finance/contract/system）限制角色访问
- `Sidebar.vue` 从 JWT 解析 userRole，隐藏无权模块的菜单项
- JWT 过期检测（`isTokenExpired`）：解析 exp 字段，不依赖后端 401

### 前端路由 — hash 模式 + 导航守卫

使用 `createWebHashHistory()`（Electron 兼容），路由守卫自动检查 `localStorage.accessToken`，无 token 跳转 `/login`。路由守卫同时执行角色模块权限检查（`routeRoleMap`），无权限跳转 `/dashboard`。

### JWT Token 结构

Access Token payload 包含用户身份信息，前后端均可直接解析使用：

```typescript
// JWT Payload
{
  userId: number;
  username: string;
  displayName: string;
  role: string;          // 9 种角色之一
  permissions: object;   // 保留字段
  iat: number;
  exp: number;           // 4h 过期
}
```

前端 `stores/auth.ts` 的 `parseUserFromToken()` 从 JWT 解码用户信息（使用 `TextDecoder` 支持中文），无需额外 API 调用。前端角色判断统一从 JWT 解析，不依赖 `localStorage.userRole`（可能存在编码问题）。

### TypeScript 注意事项

- 后端是 ESM 模块（`"type": "module"`），所有 import 路径需带 `.js` 后缀
- Sequelize 模型的属性通过 `BaseModel` 的索引签名访问，不使用 `declare` 声明
- 前端使用 `<script setup lang="ts">` 语法
- 模型和路由中的 `create()` / `update()` 调用可能需要 `as any` 类型断言（Sequelize 泛型限制）

### Express 路由顺序陷阱（重要）

Express 按定义顺序匹配路由，`/:id` 会吞噬所有单段路径。**必须**将固定路径放在参数路径前面：

```
// ✓ 正确顺序
router.get('/execution', ...)       // 固定路径在前
router.get('/:id', ...)             // 参数路径在后

// ✗ 错误顺序 — /execution 永远匹配不到
router.get('/:id', ...)
router.get('/execution', ...)       // 被 /:id 吞噬

// 类似地，/:id/status 必须在 /:id 之前
router.put('/:id/status', ...)      // 具体子路径在前
router.put('/:id', ...)             // 通配路径在后
```

### SQLite 模式变更注意

Sequelize `sync()` 只创建新表，不修改已有表的列。**当添加/修改模型字段时，必须删除 SQLite 数据库文件后重启服务**，否则会报 `SQLITE_ERROR: no such column`。

数据库文件位置：`backend/data/database.sqlite`

### 查询参数约定

- **逗号分隔多值**：bills 和 contracts 路由的 `status` 参数支持逗号分隔，如 `status=未缴,部分缴`，后端自动解析为 `Op.in` 查询。
- **日期范围**：contracts 路由支持 `endDateStart` / `endDateEnd` 参数，后端使用 `Op.between` 查询。
- **关键字搜索**：accounts 路由支持 `keyword`（LIKE 匹配 code/name）和 `ids`（逗号分隔 ID 列表）参数。

### 关键模型字段名

前后端字段名必须一致，注意以下容易出错的映射：

| 模型 | 字段名 | 常见误写 |
|------|--------|---------|
| Property | `type`（枚举：公寓/厂房/商铺） | ~~propertyType~~ |
| Budget | `actualAmount`（实际金额） | ~~usedAmount~~ |
| Budget | `status`（枚举：编制中/待审核/已批准） | ~~已审批~~ |
| Expense | `bookId`（必填，关联账套） | 创建费用时必须传入 |
| Bill | `lateFee`（滞纳金） | 模型已定义字段 |
| Contract | `endDate`, `rentAmount` | 续约时前端传 `newEndDate`/`newRent`，后端映射 |

### 项目完成度

| 维度 | 状态 |
|------|------|
| 后端路由 24 个模块 | 全部实现 |
| 后端服务 19 个 | 16 完整 + 3 待第三方 SDK |
| 前端页面 37 个 | 全部功能完整 |
| 前后端 API 对齐 | 完全对齐 |
| TS 编译 | 前后端均 0 错误 |

**仅剩的 3 项工作**（均需第三方服务账号，非代码缺陷）：

| 文件 | 待接入 SDK |
|------|-----------|
| `services/e-signature.ts` | e签宝 / 法大大 API |
| `services/sms-service.ts` | 阿里云 SMS / 腾讯云 SMS |
| `services/notification.ts` 微信/邮件 | 微信公众号模板消息 / nodemailer SMTP |

Mock 模式下这三项均可正常运行（写日志文件），不影响开发调试。

### 门锁管理架构

**数据模型（4 个）**：`DoorLock`（门锁设备，`category` 字段区分 `智能门锁`/`传统门锁`，双品类字段共存于同一张表）、`DoorLockPassword`（智能锁密码，含有效期/次数限制）、`DoorLockKey`（传统锁钥匙，借出/归还/挂失/作废流转）、`DoorLockLog`（统一操作日志，智能锁自动记录+传统锁手动登记）。

**服务层**：`door-lock-service.ts`（密码生成/钥匙借还校验/日志记录）→ `door-lock-provider.ts`（IoT 平台抽象接口 + Mock 实现，写 `backend/logs/door-lock-provider.jsonl`）。

**路由**：`/api/door-locks`（17 个端点），挂载于收租管理角色组（管理员/收租主管/收租员/总经理），无独立 RBAC 模块权限（复用 `rent` 模块权限）。

**前端**：`DoorLockList.vue`（统计卡片 + 品类筛选 + 动态操作按钮，智能锁显示远程开锁/临时密码、传统锁显示钥匙借出）、`DoorLockDetail.vue`（根据 `category` 动态切换标签页：基本信息/密码管理or钥匙管理/操作日志）。

**种子数据**：独立函数 `seedDoorLocks()`（4 套演示门锁：2 智能 + 2 传统，含密码/钥匙/日志演示数据），在 `seedAllDemoData()` 之后调用，已有数据时自动跳过。

### 打印功能架构

**打印服务**：`frontend/src/utils/print-service.ts` — 统一封装两种打印模式：
- `native`：调用 `window.electronAPI.printHTML(html)` → Electron 主进程开隐藏 `BrowserWindow` 渲染 → `webContents.print()` 弹出系统打印对话框
- `pdf`：html2canvas 截图 → jspdf 生成 PDF 下载（复用 `ReportCenter.vue` 已有模式）

支持 3 种纸张规格：`A4`（竖版 210×297mm）、`A4-landscape`（横版 297×210mm）、`80mm`（热敏小票，宽 80mm 高自适应）。

**打印模板**：`frontend/src/components/print/` 下 5 个纯函数（数据→HTML 字符串，内联 CSS 保证截图一致性）：
- `ContractPrint.ts` — 租赁合同（法律标准格式 + 双方签章位 + 公司 Logo）
- `TenantInfoPrint.ts` — 租客信息表 + 关联合同列表
- `BillPrint.ts` — 账单明细（费用分项表 + 金额大写）
- `ReceiptPrint.ts` — 收款收据（80mm 热敏小票格式）
- `ContractBatchPrint.ts` — 合同批量汇总表

**打印入口**：合同详情页（头部打印按钮，状态为执行中/已签订/已到期时可用）、租客详情页（头部打印按钮）、收租管理列表（每行操作列，已缴→收据、未缴→账单）、合同管理列表（批量操作栏，勾选后一键批量打印）。

**打印设置**：`PrintSettings.vue`（`/system/print-settings`）— 上传公司 Logo/电子签章（Base64 存储），编辑公司全称，实时预览合同抬头和收据效果。存储于 `system_configs` 表（`company_logo`/`company_seal`/`company_name_for_print` 三个 key）。

**后端 API**：`/api/system-configs`（admin 权限）— `GET /keys?keys=k1,k2` 批量查询配置、`PUT /:key` 保存单个配置（upsert 模式）。

**Electron IPC**：`main.ts` 新增 `print-html`（开隐藏窗口渲染 HTML 后调用系统打印）、`open-file-dialog`、`save-file-dialog` 三个 handler。`preload.ts` 暴露 `printHTML`、`saveFile` 到渲染进程。

### 已知孤立文件

- `frontend/src/views/rent/PaymentRecord.vue` — 收款功能已集成在 BillList 详情抽屉中，无路由注册

### scripts 脚本目录

| 脚本 | 用途 |
|------|------|
| `fix-esm-imports.js` | 修复 ESM 编译产物的 `.js` 后缀缺失 |
| `full-e2e-test.js` | 全量 E2E 测试（250+ 测试用例） |
| `generate-icon.js` | 从 build/icon.png 生成各尺寸图标 |
| `generate-manual-pdf.js` | 从 Markdown 生成说明书 PDF |
| `installer.nsi` | NSIS 安装包脚本 |
| `7za-wrapper.bat` | 7-Zip 便携版压缩包装器 |
