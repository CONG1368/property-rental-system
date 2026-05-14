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
│       ├── components/layout/ # AppLayout.vue — 主布局（侧边栏+顶栏）
│       ├── router/            # 路由定义（hash 模式，token 导航守卫）
│       ├── views/             # 页面组件
│       │   ├── dashboard/     # 首页概览
│       │   ├── rent/          # 租赁管理（房源/租客/账单/催缴/看板）
│       │   ├── finance/       # 财务管理（账套/科目/凭证/费用/税务/预算/报表/看板）
│       │   ├── contract/      # 合同管理（列表/详情/起草/审批/看板/到期/续约/模板/合规）
│       │   └── system/        # 系统设置（用户/字典/审计日志）
│       └── api/request.ts     # Axios 实例（baseURL=/api，拦截器处理 token/401）
├── backend/                   # Express 后端（ESM 模块）
│   └── src/
│       ├── index.ts           # 入口：连接DB→同步表→种子数据→启动HTTP+WS
│       ├── app.ts             # Express 应用（helmet/cors/morgan/json/路由/错误处理）
│       ├── config/            # 配置（数据库/JWT/Redis/上传）
│       ├── models/            # Sequelize 模型（24个）+ 关联定义(index.ts)
│       ├── routes/            # Express 路由（22个模块，统一挂载 /api 前缀）
│       ├── middleware/        # auth（JWT验证）/ audit-log / validate / rate-limiter / error-handler
│       ├── services/          # 业务服务层（17个服务）
│       ├── jobs/scheduler.ts  # 4个 cron 定时任务
│       └── websocket/         # WebSocket 广播
├── electron/                  # Electron 主进程代码
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

### 前端请求 API 模块位置

所有后端 API 调用封装在 `frontend/src/api/` 目录下，按域拆分（bills.ts / dunning.ts / contracts.ts 等），但多数页面直接 `import request from '@/api/request'` 调用，不完全经过封装。

### 数据库 — SQLite 优先

默认使用 SQLite（零配置），`.env` 中设置 `DB_DIALECT=mysql` 可切换到 MySQL。启动时自动建库、建表、创建管理员和标准会计科目（26个科目）。不依赖 Sequelize migrations。

### 定时任务 — 4 个 Cron

| 任务 | 频率 | 服务 |
|------|------|------|
| 账单生成 | 每日 02:00 | bill-generator.ts |
| 催缴升级 | 每日 08:00 | dunning-engine.ts |
| 合同到期标记 | 每日 07:00 | contract-workflow.ts |
| 月度折旧 | 每月1日 02:00 | depreciation.ts |

### 外部服务 — Mock 优先

支付回调（微信/支付宝）、短信（阿里云/腾讯云）、电子签章（e签宝/Fadada）、银行对账、税务导出等服务均以 Mock 模式运行。通过环境变量切换 Provider（如 `SMS_PROVIDER=aliyun`），日志写入 `backend/logs/` 目录下的 JSONL 文件。

### 前端路由 — hash 模式 + 导航守卫

使用 `createWebHashHistory()`（Electron 兼容），路由守卫自动检查 `localStorage.accessToken`，无 token 跳转 `/login`。

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
| 后端路由 22 个模块 | 全部实现，API 自动化测试 66/69 PASS |
| 后端服务 17 个 | 14 完整 + 3 待 SDK（见下方） |
| 前端页面 34 个 | 全部功能完整 |
| 前后端 API 对齐 | 完全对齐 |
| TS 编译 | 前后端均 0 错误 |

**仅剩的 3 项工作**（均需第三方服务账号，非代码缺陷）：

| 文件 | 待接入 SDK |
|------|-----------|
| `services/e-signature.ts` | e签宝 / 法大大 API |
| `services/sms-service.ts` | 阿里云 SMS / 腾讯云 SMS |
| `services/notification.ts` 微信/邮件 | 微信公众号模板消息 / nodemailer SMTP |

Mock 模式下这三项均可正常运行（写日志文件），不影响开发调试。

### 已知孤立文件

- `frontend/src/views/rent/PaymentRecord.vue` — 收款功能已集成在 BillList 详情抽屉中，无路由注册
