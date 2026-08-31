# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 行为规则

1. **任务进度更新**：每次完成一个开发任务后，必须用表格实时更新任务进度（含任务编号、名称、状态、变更文件清单），并列出后续剩余开发任务。
2. **语言要求**：开发全程和思考全程必须都用中文显示。所有与用户的沟通、代码注释、文档内容均使用中文。
3. **多Agent并行 + 代码审计**：凡规划任务超过2个，一律采用多Agent并发执行以加快开发进度。所有任务完成后，必须有一个Agent专门进行代码质量审计（检查重复代码、未使用变量、类型安全、安全漏洞、性能问题），审计结果以表格形式输出。

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

# 生成软件使用说明书 PDF（需先启动 dev 后端）
node scripts/generate-manual-pdf.js
```

**默认登录凭据：** `admin / admin123`（数据库首次启动自动创建）

**版本号**：仅根目录 `package.json` 中的 `version` 字段决定打包版本号。发版前先修改此字段，然后执行 `npm run build` 全量构建。构建产物输出到 `release/` 目录（NSIS exe + zip + blockmap）。

## 技术栈

| 层 | 技术 | 关键版本 |
|---|------|---------|
| 前端框架 | Vue 3 Composition API (`<script setup lang="ts">`) | 3.4 |
| UI 库 | Element Plus + @element-plus/icons-vue | 2.5 |
| 图表 | ECharts 5 + vue-echarts 6 | - |
| PDF 导出 | Electron printToPDF（文字PDF，主路径）+ html2canvas/jspdf（截图回退） | 打印/导出 |
| 文档解析 | mammoth (.docx) + word-extractor (.doc) + pdf-parse v2 (.pdf) | 条款文本提取 |
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
│       ├── composables/       # Vue3 组合式函数（useWebSocket / useIdCardReader）
│       ├── utils/             # 工具模块（打印服务/头像/凭证存储）
│       ├── views/             # 页面组件（48+个）
│       │   ├── dashboard/     # 首页概览
│       │   ├── rent/          # 租赁管理（房源/租客/账单/门锁/催缴/房态看板）
│       │   ├── finance/       # 财务管理（账套/科目/凭证/费用/税务/预算/报表/看板）
│       │   ├── contract/      # 合同管理（列表/详情/起草/审批/看板/到期/续约/模板/合规）
│       │   ├── fire/          # 消防管理（看板/检查/器材/违规/演练）
│       │   └── system/        # 系统设置（用户/审计日志/数据字典/打印设置/身份证读卡器/审批流程/权限矩阵/系统参数/系统运维/审批中心/全局检索）
│       └── api/request.ts     # Axios 实例（baseURL=/api，拦截器处理 token/401）
├── backend/                   # Express 后端（ESM 模块）
│   └── src/
│       ├── index.ts           # 入口：连接DB→迁移→同步表→种子数据→启动HTTP+WS
│       ├── app.ts             # Express 应用（helmet/cors/morgan/json/路由/错误处理）
│       ├── config/            # 配置（数据库/JWT/Redis/上传）
│       ├── models/            # Sequelize 模型（30个数据模型 + index/BaseModel）
│       ├── routes/            # Express 路由（24个模块 + index，统一挂载 /api 前缀）
│       ├── middleware/        # auth（JWT验证）/ rbac / requireRole / requirePermission / requireConfirmPassword / audit-log / validate / rate-limiter / error-handler
│       ├── services/          # 业务服务层（22+个服务，含 permission-service / approval-bridge / voucher-status-machine / ttl-cache 等）
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

**API baseURL 策略**：开发模式 Vite proxy 转发 `/api` → `localhost:3001`，生产模式（Electron 打包）直连 `http://localhost:3001/api`。`request.ts` 中导出 `apiBaseURL`，供所有需要手动构造 URL 的场景使用。401 响应触发自动 token 刷新，刷新失败清空登录态跳转 `/login`。登录/刷新接口的 401 直接透传（避免死循环）。

**生产环境 URL 硬编码陷阱（重要）**：Electron 打包后前端通过 `file://` 协议加载，**所有相对路径 URL（如 `/api/...`）会解析为 `file:///api/...` 而失败**。任何原生 `fetch` 调用必须使用动态 `apiBaseURL`：

```typescript
import request, { apiBaseURL } from '@/api/request';

// ✓ 正确：使用 apiBaseURL（dev=/api, prod=http://localhost:3001/api）
const resp = await fetch(`${apiBaseURL}/contracts/extract-clause-text`, { ... });

// ✗ 错误：硬编码相对路径在生产环境失败
const resp = await fetch('/api/contracts/extract-clause-text', { ... });
```

影响的调用方式：原生 `fetch`、`el-upload` 的 `:action` prop、`new WebSocket()` URL。Axios 实例（`request.post/get/...`）不受影响——其 `baseURL` 已配置为 `apiBaseURL`。

当前已验证安全的文件：`health.ts`（已处理 PROD 判断）、`useWebSocket.ts`（已处理 PROD 判断）、`TopNav.vue`（导入 apiBaseURL）、`ContractDetail.vue`（导入 apiBaseURL）、`ClauseImport.vue`（已修复）、`ContractDraft.vue`（已修复，移除本地重复定义）。

**Axios FormData 上传注意**：axios 1.6+ 检测到 FormData 时会自动覆盖默认 `Content-Type`。但如果遇到 multer 收不到文件（返回"请上传文件"），**改用原生 fetch**：

```typescript
// 推荐：原生 fetch（避免 axios Content-Type 冲突）
import { apiBaseURL } from '@/api/request';
const fd = new FormData(); fd.append('file', file);
const token = localStorage.getItem('accessToken');
const resp = await fetch(`${apiBaseURL}/contracts/extract-clause-text`, {
  method: 'POST',
  headers: token ? { Authorization: 'Bearer ' + token } : {},
  body: fd,
});
const data = await resp.json();

// 备选：axios（通常可用）
const res = await request.post('/endpoint', fd);
```

### 前端请求 API 模块位置

所有后端 API 调用封装在 `frontend/src/api/` 目录下，按域拆分（bills.ts / dunning.ts / contracts.ts 等），但多数页面直接 `import request from '@/api/request'` 调用，不完全经过封装。

### 数据库 — SQLite 优先

默认使用 SQLite（零配置），`.env` 中设置 `DB_DIALECT=mysql` 可切换到 MySQL。启动时自动建库、建表、创建管理员和标准会计科目（26个科目）。不依赖 Sequelize migrations。

**Sequelize JSON 字段更新陷阱**：SQLite 上 Sequelize 的 `instance.update()` 无法检测 JSON 字段变更（内部引用比较失败）。更新 JSON 字段必须用以下模式：

```typescript
(instance as any).jsonField = newValue;
(instance as any).changed('jsonField', true);
await instance.save();
```

项目中 `contracts.ts` 的 `clauses` 字段已使用此模式（`.changed('clauses', true)` + `.save()`），是参考范例。`instance.update({ jsonField })` 在 SQLite 上静默失败——数据不报错但不持久化。

### 启动初始化流程

`index.ts` 分 4 个阶段启动，核心原则：**HTTP 尽早可用**（Phase 2 即监听端口），种子数据和 Redis 在后台异步初始化，失败不中断服务。

```
Phase 0: setupStartupLogging() + setupGlobalErrorHandlers()
Phase 1: connectDatabase() → runAllMigrations() → sequelize.sync() → initAdminUser()
         迁移在 sync 前执行——先补旧表缺失列，再建新表
Phase 2: HTTP + WebSocket 启动（端口 3001，登录立即可用）
Phase 3: 后台种子数据（seedChartOfAccounts → seedAllDemoData → seedDoorLocks → seedContractTemplates → seedIdCardReaders → seedFireSafety）
         幂等执行，失败仅告警不中断，下次重启重试。seedDataReady 标志在 finally 中设为 true
Phase 4: connectRedis()（可选，失败自动退化）
```

**注意**：`scheduler.start()` 已不再自动调用；定时任务需手动触发或通过外部机制调度。

### Redis 可选/退化机制

`config.redis.enabled` 默认为 `true`。`connectRedis()` 失败时打印警告并继续运行，不影响核心业务。生产打包版本在 `spawn-backend.ts` 中设置 `REDIS_ENABLED=false`。

### 文件上传配置

- 上传目录：`backend/uploads/`（可通过 `UPLOAD_DIR` 环境变量覆盖）
- 大小限制：**仅用户头像上传限制 2MB**（`routes/users.ts`），其余上传区（合同附件、消防检查附件、房源导入、条款导入等）均无文件大小限制
- multer 实例在各路由文件中独立定义，`fileFilter` 按路由各自配置允许的文件扩展名。**所有 multer 实例都必须有 fileFilter**（安全要求），防火墙安全：`contracts.ts`（条款导入 + 合同附件）、`fireSafety.ts`（消防附件）、`properties.ts`（房源导入仅 .xlsx/.xls）、`users.ts`（头像 2MB）
- `config/index.ts` 中的 `upload.allowedTypes` 为历史遗留，未被实际引用
- **重要**：前端 `el-upload` 必须通过 `name` prop 指定字段名，必须与后端 multer `.array('xxx')` / `.single('xxx')` 的字段名完全一致，否则 multer 返回 `Unexpected field`。后端当前使用：`files`（合同/消防附件）、`avatar`（头像）、`file`（房源导入/条款导入/文本提取）

**中文文件名编码修复**：multer/busboy 解析 `Content-Disposition` 头的非 ASCII 文件名时可能按 Latin-1 解码，导致 UTF-8 中文变成乱码。修复方法：

```typescript
function decodeFilename(name: string): string {
  const buf = Buffer.from(name, 'latin1');
  const decoded = buf.toString('utf8');
  return decoded.includes('�') ? name : decoded;
}
// 使用: name: decodeFilename(f.originalname)
```

所有使用 `f.originalname` 存储文件名的地方都需要此修复（当前已修复：`contracts.ts` 和 `fireSafety.ts` 的附件上传端点）。纯 ASCII 文件名无损通过。

**el-upload 组件注意事项**：
- `before-upload` 中设置的 `uploading` ref 必须在 `on-success` 和 `on-error` 回调中都复位 `false`，否则按钮一直转圈
- `on-success` 收到的 `res` 是原始 HTTP 响应 body（不经 Axios 拦截器），直接是 `{ code, data, message }` 对象
- 文件上传 URL 使用完整路径（如 `` :action="apiBaseURL + '/contracts/' + id + '/upload'" ``），需手动传递 `Authorization` header

### Electron 主进程生命周期

`electron/main.ts`：

1. `app.whenReady()` → `buildMenu()`（中文菜单栏，macOS/Windows 自适应）→ `spawnBackend()` → `createWindow()`
2. `spawn-backend.ts`：生产模式使用便携 Node.js（`runtime/node/node.exe`），SQLite 数据存储在 `%APPDATA%/物业租赁综合管理系统/data/`，三通道并行检测后端就绪（stdout 多关键字 + 5s 兜底 + HTTP 健康检查轮询 `/api/health`，**60s 安全超时**，适应首次安装建库+迁移+种子数据）
3. IPC 通道：`get-app-version`、`get-backend-status`、`get-backend-url`、`export-pdf`、`print-html`、`save-file-dialog`、`open-file-dialog`、`read-id-card`
4. 开发模式窗口加载 `http://localhost:5173`，生产模式加载 `file://` 协议
5. 生产模式禁止开发者工具（拦截 `devtools-opened` 事件）

### 外部服务 — Mock 优先

支付回调（微信/支付宝）、短信（阿里云/腾讯云）、电子签章（e签宝/Fadada）、银行对账、税务导出等服务均以 Mock 模式运行。通过环境变量切换 Provider（如 `SMS_PROVIDER=aliyun`），日志写入 `backend/logs/` 目录下的 JSONL 文件。

### RBAC 权限体系（双层防护 + 可配置化 + 二次确认）

**后端层** — 三个中间件配合使用：

```typescript
// requireRole — 路由级粗粒度隔离（routes/index.ts 中挂载）
router.use('/properties', authMiddleware, requireRole('管理员', '收租主管', '收租员', '总经理'), propertyRoutes);

// requirePermission — 操作级细粒度控制（routes/*.ts 路由 Handler 中）
router.post('/', requirePermission('rent', 'create'), async (req, res) => { ... });

// requireConfirmPassword — 不可逆操作二次确认（操作者重新输入本人密码）
router.delete('/:id', requirePermission('finance','delete'), requireConfirmPassword('删除发票'), handler);
```

**角色与权限（12 角色，定义见 `middleware/rbac.ts`）**：管理员 / 总经理 / 收租主管 / 收租员 / 财务主管 / 会计 / 出纳 / 合同主管 / 法务 / 物业经理 / 维修工 / 安全主管。

**角色 × 模块 × 6 操作**（create/read/update/delete/approve/export）。管理员拥有全部；总经理只读+审批+导出；财务角色（财务主管/会计/出纳）权限分级（如出纳仅 read/update，禁 create/delete/approve）。

**权限可配置化（重要）**：
- `services/permission-service.ts` 的 `getRolePerms(role)` 读取的是**生效权限**：以 `rbac.ts` 默认为基底，用 `role_permissions` 表（DB 定制）逐模块覆盖——未覆盖模块保留默认与 `'*'` 全局兜底。
- `requirePermission` 已改为**异步读 DB 定制**（不再静态读 `rolePermissions`）；precedence 为**模块优先**（`perms[module] ?? perms['*']`），与权限矩阵页面的 `effBaseline` 一致。
- 权限矩阵页面 `/system/permissions`（`views/system/PermissionMatrix.vue`）支持**可搜索 + 批量** + 保存/回退前**管理员密码二次确认**；后端 `/api/permissions`（`routes/permissionConfig.ts`）PUT/DELETE/reset 均要求 `confirmPassword`。
- 权限变更使用 `auditLog('权限配置', ...)`，越权尝试（`requirePermission` 拒绝）会额外写入 `越权尝试` 审计。

**审计（enhanced `middleware/audit-log.ts`）**：拦截 `res.json`，记录**所有到达的响应**——2xx=成功（action 原名）、4xx/5xx=失败（action 追加 `(失败)` 标记）。配合 `requirePermission` 的 `越权尝试` 记录，敏感操作的成功/失败/越权均可追查。

**前端层** — 路由守卫 + 菜单过滤：

- `router/index.ts` 的 `routeRoleMap` 按路径前缀（rent/property/finance/contract/fire/system）限制角色访问
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
  role: string;          // 12 种角色之一（见 middleware/rbac.ts）
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
| 后端路由模块 | 全部实现（27 业务模块 + 10 个增强模块） |
| 后端服务 | 全部完整（含 22 个业务服务） |
| 前端页面 | 全部功能完整（含 17 个增强页面） |
| 前端 TypeScript | 0 错误 |
| 后端 TypeScript | 0 错误 |

**已完成的完整新模块**：消防综合管理（4 模型 + 22 端点 + 6 页面）、条款批量导入（3 格式）、合同消防约定、合同起草附件上传。

**物业租赁/物业管理增强模块（新增）**：租客征信风控（credit-scorer）、押金全生命周期台账（Deposit）、退租-交接-押金流程（Checkout）、固定资产折旧管理（FixedAsset）、报修工单（WorkOrder）、设施设备维保（Facility + FacilityMaintenance）、抄表计费（Meter + MeterReading）、停车管理（ParkingSpace + ParkingRecord）、投诉建议（Complaint）、住户/业主档案（Resident）、公告发布（Announcement）、公共收益（CommonRevenue）、外包供应商（Vendor）、仓库物料（Material + InventoryRecord）、物业管理运营看板（PropertyOpsDashboard）。

**仅剩的 3 项工作**（均需第三方服务账号，非代码缺陷）：

| 文件 | 待接入 SDK |
|------|-----------|
| `services/e-signature.ts` | e签宝 / 法大大 API |
| `services/sms-service.ts` | 阿里云 SMS / 腾讯云 SMS |
| `services/notification.ts` 微信/邮件 | 微信公众号模板消息 / nodemailer SMTP |

Mock 模式下这三项均可正常运行（写日志文件），不影响开发调试。

### 消防综合管理模块

**数据模型（4 张新表）**：`FireInspection`（消防检查记录，含 6 项检查维度和综合评分）、`FireEquipment`（消防器材台账，含状态跟踪和过期告警）、`FireViolation`（消防违规记录，含整改流程和罚款管理）、`FireDrill`（消防演练记录，含评分和改进措施）。

所有模型通过 `Property.hasMany()` 关联到房源，关联定义在 `models/index.ts` 中。

**路由**：`/api/fire-safety`（22 个端点），挂载于消防管理角色组（管理员/收租主管/收租员/合同主管/总经理），RBAC 中新增 `fire` 模块权限。

**前端**：`views/fire/` 目录下 6 个页面 — `FireDashboard.vue`（综合看板，含 KPI 卡片、器材状态/检查结果/违规统计、过期器材和待整改列表）、`FireInspectionList.vue`（检查记录 CRUD + 弹窗表单，含 6 项检查 checkbox）、`FireInspectionDetail.vue`（检查详情 + 关联违规）、`FireEquipmentList.vue`（器材台账，过期/即将过期行颜色高亮）、`FireViolationList.vue`（违规记录 + 标记整改操作）、`FireDrillList.vue`（演练记录 CRUD）。

**侧边栏**：新增"消防管理"菜单组（在合同管理和系统设置之间），`Sidebar.vue` 中 `canAccessFire` 控制可见性。

**种子数据**：`seedFireSafety()` — 30+ 件器材、18 条检查记录、3 条违规、2 场演练，已在 `index.ts` Phase 3 中调用。

### 合同消防约定（billingConfig.fireSafety）

`billingConfig` JSON 中新增 `fireSafety` 动态结构：

```typescript
fireSafety: {
  clauses: { title: string; content: string }[],  // 动态列表
  restrictions: string[],                          // 动态列表
  equipment: string[],                             // 动态列表
  responsibilityParty: string,                    // 甲方/乙方/双方
  inspectionFrequency: string,                    // 检查频率
  violationPenalty: string,                       // 自由文本
}
```

**同步位置**：ContractDraft.vue（表单+`buildBillingConfig`+编辑回填+模板加载）、ContractDetail.vue（展示+`handlePrint` 传参）、ContractPrint.ts（`buildFireSafetyHTML` 渲染）。

### 条款批量导入

**后端端点**：
- `POST /api/contracts/extract-clause-text` — 上传 .docx/.doc/.pdf，用 `mammoth`（.docx）、`word-extractor`（.doc）、`pdf-parse` v2（.pdf）提取纯文本。三种格式均有 try/catch 保护，解析失败返回友好提示而非 500 错误。**重要**：此端点使用原生 `fetch` 而非 axios（axios 默认 `Content-Type: application/json` 会与 FormData multipart 冲突导致 multer 收不到文件）。

**pdf-parse v2 API 注意**：当前安装版本 2.4.5（mehmet-kozan），与 v1（modesty）API 完全不同：
```typescript
// v2 正确用法（contracts.ts 当前实现）
const { PDFParse } = await import('pdf-parse');
const buf = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength); // 必须 Uint8Array
const parser = new PDFParse(buf);
const result = await parser.getText();  // 返回 { pages, text, total }
text = result.text || '';

// v2 返回的 text 包含页面分隔符（"-- 1 of 5 --"），需过滤后再判断是否为扫描件
const contentText = text.replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, '').trim();
if (contentText.length < 50) { /* 扫描件提示 */ }
```
- `POST /api/contracts/import-clauses` — 两种模式：Excel 文件上传或 JSON body。支持 `templateId` / `propertyType` 参数，导入后自动同步条款到模板。

**智能拆分**：`ClauseImport.vue` 的 `smartSplit()` 采用四级回退匹配：第X条/款/章/节 → 中文数字编号（一、二、）→ 阿拉伯数字编号（1. / (1)）→ 空行段落拆分 → 单行拆分。

**待处理条款桥接机制（pendingClauses）**：导入条款时**无论租客是否已有合同**，都同时存入 `tenant.pendingClauses`（确保新建合同时也能自动加载）。ContractDraft.vue 的 `loadPendingClausesForCurrentTenant()` 在编辑初始化、租客切换、模板加载后三个时机调用。**注意**：API 返回 `pendingClauses` 可能是 JSON 字符串，前端需 `JSON.parse` 处理。

**条款模板同步（syncToTemplate）**：导入条款时自动按业态创建 `常用条款模板-{公寓/厂房/商铺}`，`content.isAuto: true` 标记。TemplateList.vue 对自动模板显示「自动」标签。ContractDraft 选择房源时自动匹配：默认模板 > 常用条款模板（该业态）> 同类型模板。

**前端**：`ClauseImport.vue` — 侧边栏「合同管理→条款导入」入口。上传区支持拖拽+点击。Word/PDF 上传后自动触发智能拆分。模板选择下拉可指定同步目标。

### 种子数据就绪机制

`backend/src/index.ts` 导出 `seedDataReady` 标志，Phase 3 种子数据完成后设为 `true`。`/api/health` 端点返回 `seedReady` 字段，Electron IPC `get-backend-status` 返回 `{ ok, seedReady }`，Login.vue 轮询等待种子数据就绪后才允许登录（避免首次安装时空表查询导致"后端异常"）。

### Axios 静默模式

`request.ts` 支持 `silent: true` 配置项，非关键 API 调用可跳过 `ElMessage.error` toast。同时内置 3 秒相同错误消息去重。

### PDF 导出引擎（print-service.ts）

PDF 导出采用双层策略，Electron 环境优先走原生文字引擎：

**主路径 — printToPDF 文字引擎**（`exportTextPDF()`）：
```
buildContractHTML() → Electron IPC 'export-pdf' → BrowserWindow 渲染
→ webContents.printToPDF({ preferCSSPageSize: true }) → 保存对话框 → 文字 PDF
```
- 输出真正的文字 PDF（可选中、可搜索、体积小）
- 页面尺寸由 HTML 内 `@page` CSS 决定（A4/A4-landscape/80mm），`preferCSSPageSize: true` 自动适配
- `printDocument({ mode: 'pdf' })` 在 `isElectron()` 时自动走此路径
- 非 Electron 环境（浏览器 dev 模式）回退到截图 PDF

**回退路径 — html2canvas 截图**（`printPDF()`，内部函数）：
- 仅当 `electronAPI.exportPDF` 不可用时触发（浏览器 dev 模式）
- `extractBlocksHTML()` 按 `.section`/`.header-row`/`.sign-area` 边界拆分 HTML 为独立 block
- 每个 block 独立 `html2canvas` 渲染（scale 1.5），超长 block 按页均分切片
- `printNative()`（原生打印）也走 Electron IPC `print-html` → `webContents.print()` 弹出系统对话框

**IPC 通道**（`electron/main.ts`）：
- `export-pdf`：临时文件 → 隐藏 BrowserWindow → `printToPDF()` → 保存对话框
- `print-html`：临时文件 → 隐藏 BrowserWindow → `webContents.print()` → 系统打印对话框

**前端 API**（`preload.ts` → `env.d.ts`）：
```typescript
window.electronAPI.exportPDF(html: string, title: string): Promise<{ success: boolean; filePath?: string | null; error?: string }>
window.electronAPI.printHTML(html: string, title: string): Promise<{ success: boolean; failureReason?: string }>
```

**ContractPrint.ts**（合同打印模板）采用正式法律合同排版：双横线装饰标题、双方当事人两列表格对比、统一表格边框 `#999` 实线、签章区竖线分隔、章节中文数字编号（一~七）、页脚含合同编号和签订日期。`billingConfig.fireSafety` 消防约定通过 `buildFireSafetyHTML()` 渲染为独立区块。

**打印模板多行文本处理（重要）**：HTML 中 `\n` 换行符会被折叠为空格，导致多段落文本挤在一起。`ContractPrint.ts` 提供了两个工具函数：

```typescript
// 统一换行符处理（兼容 \r\n / \r / \n），返回非空行数组
function normLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(p => p.trim());
}
// 将多行文本渲染为独立 <p> 段落，带 text-indent:2em 和 margin:2px 0
function wrapTextAsParagraphs(text: string, extraStyle = ''): string {
  const lines = normLines(text);
  if (lines.length === 0) return '';
  return lines.map(p => `<p style="text-indent:2em;margin:2px 0;${extraStyle}">${p}</p>`).join('');
}
```

- **段落文本**（条款 content、备注 notes、消防违规处罚等）：使用 `wrapTextAsParagraphs(text, extraStyle)`，自动拆分+段落化
- **表格单元格**：`td()` 辅助函数已内置 `normLines(value).join('<br>')`，多行值自动处理
- **屏幕端展示**：Vue 模板中使用 `white-space:pre-wrap` 保留换行

已修复/验证的文件：`ContractPrint.ts`（合同条款、消防条款、其他约定、td()）、`TenantInfoPrint.ts`（备注 含 `\r\n` 兼容+行高）、`TenantDetail.vue`（页面备注）、`ReportCenter.vue`（报表单元格）、`ContractDetail.vue`（条款内容+消防违规处罚）、`FireInspectionDetail.vue`（备注）、`ContractApproval.vue`（条款内容）。

### 门锁管理架构

**数据模型（4 个）**：`DoorLock`（门锁设备，`category` 字段区分 `智能门锁`/`传统门锁`，双品类字段共存于同一张表）、`DoorLockPassword`（智能锁密码，含有效期/次数限制）、`DoorLockKey`（传统锁钥匙，借出/归还/挂失/作废流转）、`DoorLockLog`（统一操作日志，智能锁自动记录+传统锁手动登记）。

**服务层**：`door-lock-service.ts`（密码生成/钥匙借还校验/日志记录）→ `door-lock-provider.ts`（IoT 平台抽象接口 + Mock 实现，写 `backend/logs/door-lock-provider.jsonl`）。

**路由**：`/api/door-locks`（17 个端点），挂载于收租管理角色组（管理员/收租主管/收租员/总经理），无独立 RBAC 模块权限（复用 `rent` 模块权限）。

**前端**：`DoorLockList.vue`（统计卡片 + 品类筛选 + 动态操作按钮，智能锁显示远程开锁/临时密码、传统锁显示钥匙借出）、`DoorLockDetail.vue`（根据 `category` 动态切换标签页：基本信息/密码管理or钥匙管理/操作日志）。

**种子数据**：独立函数 `seedDoorLocks()`（4 套演示门锁：2 智能 + 2 传统，含密码/钥匙/日志演示数据），在 `seedAllDemoData()` 之后调用，已有数据时自动跳过。

### 房态流转系统

**数据模型**：`RoomStatusLog`（`backend/src/models/RoomStatusLog.ts`）— 记录每次房源状态变更的完整审计轨迹：

| 字段 | 类型 | 说明 |
|------|------|------|
| `propertyId` | INTEGER | 关联房源 ID |
| `oldStatus` | STRING(20) | 变更前状态 |
| `newStatus` | STRING(20) | 变更后状态 |
| `action` | ENUM | `manual` / `contract_link` / `batch` / `system` |
| `operatorId` | INTEGER | 操作人用户 ID |
| `notes` | TEXT | 变更备注 |
| `linkedContractId` | INTEGER (可空) | 关联合同 ID |
| `linkedTenantId` | INTEGER (可空) | 关联租客 ID |

注意：该模型 `updatedAt: false`（只有 createdAt），仅追加不可修改。

**状态机规则**：`backend/src/services/room-status-workflow.ts` — 9 种房源状态，定义了严格的流转规则：

```
空置   → 已锁定、已预订、已出租、维修中、已冻结
已锁定  → 空置、已预订
已预订  → 空置、已出租
已出租  → 退租中、已冻结
退租中  → 待保洁、已出租、已冻结
待保洁  → 待验收、维修中
待验收  → 空置、待保洁、维修中
维修中  → 空置、待保洁、已出租
已冻结  → 空置、维修中
```

**核心函数**：
- `getValidTransitions(status)` — 查询某状态允许流转到的目标状态列表
- `transitionRoomStatus(propertyId, newStatus, operatorId, options?)` — 执行状态变更，自动完成：合法性校验 → 更新 Property.status → 写入 RoomStatusLog → WebSocket 广播 `room:status-changed`

**调用方式**：
- 前端单独操作：`PATCH /api/properties/:id/status`（body: `{ status, notes }`）
- 前端批量操作：`PATCH /api/properties/rooms/batch-status`（body: `{ ids, newStatus, notes }`）
- 路由 `PUT /api/properties/:id` 中如果 body 含 `status` 变更，也会自动走状态机

**路由端点**（均在 `/api/properties` 下）：

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/rooms/kanban` | 房态看板数据（按楼栋+楼层分组，含门锁/租客关联） |
| `GET` | `/rooms/stats` | 房态统计（总数、各状态计数、入住率、楼栋统计） |
| `GET` | `/rooms/analytics` | 可视化分析数据（楼栋对比、楼层热力图、桑基图原始数据） |
| `POST` | `/rooms/batch-generate` | 批量生成房间（按楼栋+楼层范围+每层房间数） |
| `PATCH` | `/rooms/batch-status` | 批量更新房间状态（逐个调用状态机） |
| `GET` | `/rooms/export` | 导出房态报表（`?format=xlsx` 或 `?format=pdf`） |
| `GET` | `/:id/status-logs` | 某房源的状态变更历史（最近 50 条） |
| `PATCH` | `/:id/status` | 单个房源状态变更（走状态机） |

**注意**：以上固定路径路由（`/rooms/kanban`、`/rooms/stats` 等）全部定义在 `/:id` 参数路由之前，避免被 `/:id` 吞噬。

### 数据库迁移系统

`backend/src/config/migration.ts` — 轻量级 Schema 迁移方案，解决 Sequelize `sync()` 只建新表不修改已有列的限制。

**设计思路**：
- 定义 `MIGRATION_DEFINITIONS` 数组，每项指定表名和待添加的列（名称 + SQLite 类型 + 默认值）
- 启动时在 `sync()` **之前**执行，确保新表（由 sync 创建）和已有表（由迁移补齐）均包含完整列
- 对每个列执行 `addColumnIfNotExists()`：SQLite 用 `PRAGMA table_info()` 检查，MySQL 用 `try/catch` 捕获 `Duplicate column` 错误
- 迁移完成后执行 `backfillPropertyRoomInfo()` 数据回填：从已有房源的 `name` 字段解析出 `buildingName` 和 `roomNumber`（支持楼层命名法 `XF-YY` 和顺次命名法纯数字结尾两种模式）

**当前迁移清单**：

| 表 | 新增列 | 类型 |
|------|--------|------|
| `bills` | `periodMonths` | INTEGER (默认1) |
| `contracts` | `clauses` | TEXT (默认'[]') |
| `properties` | `buildingName` | VARCHAR(50) |
| `properties` | `roomNumber` | VARCHAR(20) |
| `properties` | `buildingOrder` | INTEGER (默认0) |
| `properties` | `floorOrder` | INTEGER (默认0) |
| `tenants` | `gender` / `birthDate` / `ethnicity` / `idAddress` / `idIssuingAuthority` / `idValidFrom` / `idValidTo` / `idPhoto` | VARCHAR/TEXT (8列) |
| `tenants` | `pendingClauses` | TEXT (默认'[]') |

**新增迁移步骤**：在 `MIGRATION_DEFINITIONS` 数组中添加新条目即可，重启后自动应用。

### WebSocket 实时通信

**后端广播**：`backend/src/websocket/index.ts` — 基于 `ws` 库，挂载在 HTTP Server 的 `/ws` 路径上。

```typescript
// 广播消息到所有已连接的客户端
broadcast(event: string, data: any): void
// 消息格式: { event, data, timestamp }
```

**前端 Composable**：`frontend/src/composables/useWebSocket.ts` — 单例 WebSocket 连接，自动重连。

```typescript
const { on, off, isConnected } = useWebSocket();

// 订阅事件（返回取消订阅函数）
const unsubscribe = on('room:status-changed', (data) => {
  // data: { propertyId, propertyName, oldStatus, newStatus, action, timestamp }
});

// 取消订阅
off('room:status-changed', callback);
// 或直接调用 on() 返回的取消函数: unsubscribe()
```

**关键行为**：
- 连接断开后 3 秒自动重连
- `isConnected` 是 `Ref<boolean>`，组件可 watch 展示连接状态
- 生产模式（Electron `file://` 协议）下自动回退到 `ws://localhost:3001/ws`
- 消息解析失败静默忽略（容错设计）

**当前使用的事件**：
- `room:status-changed` — 单个房态变更后广播
- `room:batch-status-changed` — 批量房态变更后广播
- `contract:created` — 合同创建
- `contract:deleted` — 合同删除
- `contract:renewed` — 合同续约
- `contract:status-changed` — 合同状态变更
- `id-card:read-success` — 身份证读卡成功
- `id-card:read-failure` — 身份证读卡失败

### 房态看板前端架构

**3 个页面**：

| 页面 | 路由 | 说明 |
|------|------|------|
| `RoomStatusKanban.vue` | `/rent/room-kanban` | 房态看板主页面：楼栋/楼层筛选 + 网格卡片 + 快捷操作抽屉 + 批量状态对话框 |
| `RoomDashboard.vue` | `/rent/room-kanban/dashboard` | 数据大屏：暗色主题，KPI 卡片 + ECharts 可视化（玫瑰饼图/柱图/仪表盘/热力图/趋势线/桑基图 + 告警跑马灯） |
| `RoomBatchGenerate.vue` | `/rent/room-kanban/batch-gen` | 批量生成房间表单：配置楼栋名称、起止楼层、每层房间数、命名规则、默认面积 |

**7 个组件**（全部在 `frontend/src/components/` 下）：

| 组件 | 职责 |
|------|------|
| `RoomCard.vue` | 单个房间卡片：9 种状态颜色映射 + 门锁状态图标 + 租客/合同到期信息 |
| `RoomGrid.vue` | CSS Grid 自适应布局容器，循环渲染 RoomCard |
| `RoomTableView.vue` | el-table 表格视图（含 selection 列、排序、状态标签、门锁图标） |
| `RoomStatsPanel.vue` | KPI 统计面板：总房源/已出租/空置/入住率/维护中 |
| `BuildingFloorSelector.vue` | 楼栋+楼层联动筛选器（el-radio-group 切换） |
| `RoomQuickActionDrawer.vue` | 房间快捷操作抽屉：信息描述 + 状态变更下拉 + 门锁操作 + 最近变更时间线 |
| `BatchStatusDialog.vue` | 批量状态更新对话框：选择目标状态 + 备注，提交到 `PATCH /properties/rooms/batch-status` |

**数据流**：
1. `RoomStatusKanban` 调用 `GET /properties/rooms/kanban` 获取完整数据（含楼栋分组、楼层分组、门锁、租客关联）
2. 楼栋/楼层筛选在**前端**完成（后端始终返回全量数据，保证 BuildingFloorSelector 的选项完整）
3. 通过 `useWebSocket()` 的 `on('room:status-changed')` 和 `on('room:batch-status-changed')` 监听变更，自动刷新看板数据
4. `RoomDashboard` 使用 `vue-echarts` 渲染图表，单独调用 `GET /properties/rooms/stats` 和 `GET /properties/rooms/analytics`

**状态颜色映射**：定义在 `RoomCard.vue` 的 9 个 `status-*` CSS class 中（空置/已锁定/已预订/已出租/退租中/待保洁/待验收/维修中/已冻结），颜色见组件源码。

### 打印功能架构

**打印服务**：`frontend/src/utils/print-service.ts` — 统一封装三种打印模式：
- `native`：调用 `window.electronAPI.printHTML(html)` → Electron 开隐藏 BrowserWindow → `webContents.print()` 弹出系统打印对话框
- `pdf`（Electron）：`printDocument()` → `exportTextPDF()` → IPC `export-pdf` → `printToPDF()` 生成真正文字 PDF
- `pdf`（浏览器回退）：`printDocument()` → `printPDF()` → html2canvas + jsPDF 截图方案
- 页面尺寸由 HTML 模板内 `@page` CSS 决定，`preferCSSPageSize: true` 自动适配

**打印模板**：`frontend/src/components/print/` 下 5 个纯函数（数据→HTML 字符串，内联 CSS）：
- `ContractPrint.ts` — 租赁合同（法律标准格式 + 双方签章位 + 公司 Logo）
- `TenantInfoPrint.ts` — 租客信息表 + 关联合同列表
- `BillPrint.ts` — 账单明细（费用分项表 + 金额大写）
- `ReceiptPrint.ts` — 收款收据（80mm 热敏小票格式）
- `ContractBatchPrint.ts` — 合同批量汇总表

**打印入口**：合同详情页（头部打印下拉：直接打印 / 导出PDF）、租客详情页（头部打印按钮）、收租管理列表（每行操作列，已缴→收据、未缴→账单）、合同管理列表（批量操作栏，勾选后一键批量打印）。

**打印设置**：`PrintSettings.vue`（`/system/print-settings`）— 配置公司全称/Logo/电子签章/证件类型/证件号码/联系电话（6 个 system_configs key），实时预览合同抬头。Base64 存储图片。

**后端 API**：`/api/system-configs`（admin 权限）— `GET /keys?keys=k1,k2` 批量查询配置、`PUT /:key` 保存单个配置（upsert 模式）。

**Electron IPC**：`main.ts` 注册 8 个 IPC handler：`export-pdf`（文字PDF导出+保存对话框）、`print-html`（系统打印对话框）、`read-id-card`（预留硬件SDK）、`save-file-dialog`/`open-file-dialog`（文件对话框）、`get-app-version`/`get-backend-status`/`get-backend-url`（状态查询）。`preload.ts` 通过 `contextBridge.exposeInMainWorld('electronAPI', {...})` 暴露到渲染进程。

### 身份证读卡器模块

**Provider 模式**：参照 `door-lock-provider.ts` 架构，`backend/src/services/id-card-provider.ts` 定义 `IdCardReaderProvider` 抽象接口 + `MockIdCardProvider` 实现（日志写入 `backend/logs/id-card-provider.jsonl`）。通过工厂函数 `getIdCardProvider()` 获取单例 Provider。

**数据模型（3 个）**：
- `IdCardReader` — 设备注册表（品牌枚举：华视/新中新/普天/精伦/中控/其他，接口类型：USB/串口/蓝牙/WiFi，状态：在线/离线/故障/未激活）
- `IdCardReadLog` — 读卡审计日志（仅追加，`updatedAt: false`，身份证号脱敏存储，关联读卡器+操作人+租客）
- `Tenant` 扩展 8 字段 — `gender`/`birthDate`/`ethnicity`/`idAddress`/`idIssuingAuthority`/`idValidFrom`/`idValidTo`/`idPhoto`

**服务层**：`id-card-service.ts` — ISO 7064:1983 MOD 11-2 校验位算法、身份证重复检测、年龄/有效期校验、脱敏工具、读卡流程（含 WebSocket 广播 `id-card:read-success`/`id-card:read-failure`）。

**路由**：`/api/id-card-readers`（8 个端点），挂载于管理员角色。`/api/tenants` POST 创建时自动检测重复身份证号（409 冲突）。

**前端**：
- `useIdCardReader` composable — 设备列表获取、读卡触发、自动寻找在线设备
- `IdCardReadButton.vue` — 通用读卡按钮（Props: `readerId?`/`mode`，Emit: `@success`/`@error`）
- `IdCardReaderSettings.vue` — 设备管理页面（`/system/id-card-readers`）

**Electron IPC**：`read-id-card` 通道（当前返回 Mock 提示，预留 SDK 接入点）。

### 合同 billingConfig — 可扩展 JSON 字段

`Contract.billingConfig`（JSON 类型）是合同的元数据容器，**新增可选配置项时不需修改模型列**，只需在表单、打印模板、详情页三处同步即可。当前字段：

| 字段组 | 字段 | 说明 |
|--------|------|------|
| 费用 | `feeItems[]` | `{ name, amount, unit }` |
| 收款 | `paymentMethod` / `bankName` / `bankAccountNumber` / `bankAccountName` | 收款方式及银行账号 |
| 税务 | `taxType` / `taxRate` / `invoiceType` | 含税/不含税、税率、发票类型 |
| 细则 | `lateFeeRate` / `depositTerms` / `maintenanceParty` / `terminationNotice` / `renewalNotice` / `subletAllowed` | 滞纳金/押金/维修/转租/解约/续约 |
| 附件 | `attachments[]` | `{ name, path, size, uploadedAt }` |

**注意**：新增 billingConfig 字段时，必须同步修改 3 个位置：ContractDraft.vue（表单+变量+`buildBillingConfig`+编辑回填）、ContractPrint.ts（`ContractPrintData` 接口+打印内容）、ContractDetail.vue（展示+`handlePrint` 传参）。

### 合同审批页（ContractApproval.vue）

审批列表支持**展开行**查看合同详情：点击展开图标 → `onExpandChange` 懒加载合同数据（`GET /contracts/:id`）→ 展示合同基本信息、全部条款（卡片式布局，兼容 JSON 字符串自动解析）、消防安全约定。

`GET /api/approvals` 返回的合同数据现在包含 `clauses`、`billingConfig` 和 Tenant 关联（`include: [{ model: Tenant, as: 'tenant' }]`），使审批页可直接显示租客名称。

### 财务模块安全加固（权限/审计/审批/状态机）

本轮对财务模块做了系统性安全/合规/内控加固，关键约定如下：

**1. 写操作统一防护模式**：所有财务路由（vouchers/expenses/budgets/accounts/accountBooks/tax/fixedAssets/invoices/bankReconciliation/costAllocation）的**每个写操作**（POST/PUT/DELETE）都必须同时挂 `requirePermission('finance', 动作)` + `auditLog(模块, 动作)`。已 100% 覆盖（可用脚本统计校验）。动作映射：POST=create、PUT=update、DELETE=delete、审批/作废/红冲/折旧等状态类=approve、导出=export、计算触发=create。

**2. 不可逆操作二次确认**：发票作废/红冲/删除、固定资产删除/折旧、凭证作废、账套修改、费用审批、权限变更，均需操作者**重新输入本人登录密码**。后端用 `middleware/confirm-password.ts` 的 `requireConfirmPassword(label)` 中间件（读 body/query 的 `confirmPassword`，`bcrypt.compare` 校验当前用户）；前端用 `utils/confirm-password.ts` 的 `confirmWithPassword(msg)` 弹窗，请求体携带 `confirmPassword`（DELETE 用 `{ data: { confirmPassword } }`）。

**3. 权限可配置化**：`role_permissions` 表 + `services/permission-service.ts`（`getRolePerms`/`getAllMatrix`/`setRolePerms`/`clearCache`）。`requirePermission` 异步读 DB 定制；precedence **模块优先**（`perms[module] ?? perms['*']`）。权限矩阵页 `/system/permissions`（`PermissionMatrix.vue`）可搜索/批量/二次确认；后端 `/api/permissions`（`permissionConfig.ts`）PUT/DELETE/reset 均要求 `confirmPassword`。

**4. 审计增强**（`middleware/audit-log.ts`）：记录所有到达的 `res.json`——2xx=成功、4xx/5xx=失败（action 加 `(失败)`）；`requirePermission` 拒绝额外写 `越权尝试` 审计。敏感操作成功/失败/越权均可追查。

**5. 凭证状态机**（`services/voucher-status-machine.ts`）：`草稿→待复核→待审核→已过账→已作废`（终态）。`已过账` 只能→`已作废`，**禁止回退**（防篡改已过账凭证）。`vouchers.ts` 的 `PUT /:id/status` 用 `canTransition(from, to)` 校验非法流转返回 400，并记录 `approvedBy`/`reviewedBy`。

**6. 报表角色矩阵**（`services/report-registry.ts` + `routes/reports.ts`）：`reportAuthz` 以 registry 每报表声明的 `roles` 为**唯一权威**（不再用模块启发式/`*` 泄漏）。`/reports` mount 扩为 registry 全部角色并集，细粒度门禁交给 `reportAuthz`。未登记报表一律 403。

**7. 审批引擎**（`services/approval-bridge.ts` + `routes/approvalRequests.ts` + `dict-seed.ts`）：`submitApproval(opts, userId)` 按 `bizType` 找缺省流程（`FlowDefinition`）创建 `ApprovalRequest`，无配置流程则静默跳过。默认流程：`合同`（合同主管→总经理）、`预算`（财务主管→总经理）、`费用`（财务主管→总经理）。终审通过联动业务状态（合同→已签订、预算→已批准、费用→已批准），驳回回滚（合同→已驳回、预算→编制中）。

**8. 财务审批/内控**：
- **大额费用自动审批**：`expenses.ts` POST 创建时若 `amount >= LARGE_EXPENSE_THRESHOLD`（默认 5000，env `LARGE_EXPENSE_THRESHOLD`）自动桥接 `bizType='费用'` 审批。
- **预算超支保护**：`budgets.ts` PUT 用字段白名单（仅 `budgetAmount`/`notes`）；**已批准预算禁改金额**（400），须走预算调整审批。
- **通用字段白名单**：invoices/fixedAssets/vouchers/accountBooks 的 PUT 均白名单化，剔除 `status`/`invoiceNo`/`taxAmount` 等敏感字段（状态只能走审批端点）。

**9. 其他**：
- tax 计算缓存：`services/ttl-cache.ts` + `tax-calculator.ts` 的 `getCachedTaxes`/`invalidateTaxCache`（5 分钟 TTL）；读接口用缓存，`POST /calculate` 重算并失效。
- 分页钳制：`page≥1`、`1≤pageSize≤200`（fixedAssets/invoices/vouchers）。
- 发票号生成：日期+时间戳+随机，创建遇唯一键冲突自动重试≤3 次。
- 发票状态机：issue 仅待开票、void 拒已作废/已红冲、redflush 仅已开票。

### 系统设置模块安全加固（本次迭代）

系统设置模块（`/system`）在财务加固基础上做了系统性安全/可用性增强，关键约定：

**1. 打印配置只读放行**：`/system-configs` 挂载从 `requireAdmin` 改为仅 `authMiddleware`（路由级），因 `GET /keys` 是**只读**接口，供**非管理员角色**在打印/导出场景读取公司抬头/Logo/签章（BillList/ContractList/ContractDetail/TenantDetail 均调用）。写操作（PUT/POST/DELETE）在路由文件内部挂 `requireAdmin` + `requireConfirmPassword` + `auditLog`。**关键**：`GET /keys` 返回**完整值**（不脱敏），因为打印场景需要真实 Logo/签章；`isSensitive` 标记由系统参数中心 `GET /` 由前端打码展示。

**2. 系统参数中心**（`SystemParams.vue` + `GET /system-configs`）：`SystemConfig` 模型新增 `configGroup`（分组）/`valueType`（string/number/boolean/json）/`isSensitive`（敏感值）/`builtIn`（内置项，禁删）/`extra` 元数据。支持分组筛选（前端内存过滤）、新增/编辑/删除配置项（均二次确认）、内置项不可删除。`POST /batch` 批量保存。迁移 `system_configs` 表新增对应 5 列。

**3. 审计日志筛选 + 导出**（`AuditLog.vue` + `auditLogs.ts`）：`buildWhere()` 支持 `module/userId/action/keyword(模糊)/status(success|fail)/startDate/endDate` 多条件；`GET /export` 返回 CSV（含 BOM，`Content-Disposition` 下载）。前端加筛选栏 + 导出按钮 + 结果列（根据 `action` 是否有 `(失败)` 显示成功/失败 tag）。

**4. 用户安全**（`users.ts` + `UserList.vue`）：
- **角色枚举校验**（`VALID_ROLES = ALL_ROLES`，来自 `rbac.ts`）：POST/PUT 拒绝非白名单角色，防止注入任意角色字符串。
- **字段白名单**（`pickUserFields`）：仅接受 displayName/role/status/permissions/projectIds/password，剔除 `id`/`passwordHash`/`username` 越权注入。
- **最后管理员保护**：删除/降权最后一名 `管理员` 被拒绝（400）；不能删除当前登录账号。
- **不可逆二次确认**：删除用户、重置密码均需操作者重新输入登录密码（DELETE 用 `{ data: { confirmPassword } }`）。

**5. 审计开关**（`audit-log.ts` 增强）：新增 `isAuditEnabled()`（5 秒 TTL 缓存读 `system_configs.audit_enabled`），关闭时跳过落库。`GET/POST /system-ops/audit-toggle` 切换（需二次确认）。

**6. 系统运维页**（`SystemOps.vue` + `systemOps.ts`）：`GET /info`（版本/Node/平台/内存/DB 类型与路径/用户数/时长）、`GET /cron`（定时任务描述列表）、`GET/POST /audit-toggle`（审计开关）、`GET /backup`（SQLite 数据库备份下载，需二次确认）。挂载于 `/system-ops`（requireAdmin）。

**7. 数据字典**（`DictList.vue` + `/dicts`）：前端路由 `/system/dicts` 补全；`DELETE /types/:code` 与 `DELETE /items/:id` 加 `requireConfirmPassword` + `auditLog`（级联破坏性操作）。

**8. 其他**：`rbac.ts` 导出 `ALL_ROLES`；`/system-ops` 独立挂载避免被参数路由吞噬；系统菜单新增 数据字典/系统参数/系统运维。

### 已知孤立文件

- `frontend/src/views/rent/PaymentRecord.vue` — 收款功能已集成在 BillList 详情抽屉中，无路由注册
- `frontend/src/components/RoomTableView.vue` — 表格视图组件已定义（在 `components.d.ts` 中全局注册），但未在现有页面中使用。如需表格/网格切换功能，可在 RoomStatusKanban 中引入

### scripts 脚本目录

| 脚本 | 用途 |
|------|------|
| `fix-esm-imports.js` | 修复 ESM 编译产物的 `.js` 后缀缺失 |
| `verify-esm-build.js` | 验证后端编译产物中所有 ESM import 路径有效 |
| `full-e2e-test.js` | 全量 E2E 测试（37 项 + 250+ 断言） |
| `generate-icon.js` | 从 build/icon.png 生成各尺寸图标 |
| `generate-manual-pdf.js` | 从 `docs/使用说明书.md` 生成说明书 PDF（截图 base64 内嵌，跨平台可移植） |
| `generate-proposal-pdf.js` | 从 Markdown 生成产品方案 PDF |
| `kill-dev.ps1` | 清理占用开发端口的残留进程（`dev:clean` 调用） |
| `installer.nsi` | NSIS 安装包脚本 |
| `7za-wrapper.bat` | 7-Zip 便携版压缩包装器 |
| `permission-regression.js` | 权限回归（12 角色 × 端点断言，33 用例）；需先启动 dev 后端 |
| `e2e-permission-matrix.js` | 权限矩阵页面 E2E（角色选择/搜索/批量/二次确认弹窗，8 用例） |
| `e2e-confirm-password.js` | 不可逆操作二次确认 E2E（发票作废：弹窗/密码/取消/成功，5 用例） |
| `verify-system-settings.js` | 系统设置模块运行时回归（登录/配置只读/二次确认/非管理员/审计/字典/运维，9 用例）；需先启动 dev 后端 |
| `e2e-newmodules-regression.js` | 新增模块回归（34 页面渲染） |
| `e2e-new-modules.js` | 新增模块 E2E |
| `run-all-regression.js` | 串联运行全部回归脚本 |