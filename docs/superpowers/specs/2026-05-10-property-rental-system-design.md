# Property Rental Comprehensive Management System — Design Spec

**Date**: 2026-05-10
**Status**: Approved
**Source**: 物业租赁综合管理系统产品方案.pptx (46 slides)

---

## 1. Overview

Enterprise-internal desktop application for property rental management. Covers housing (住房), industrial (厂房), and commercial (商铺) property types, targeting 50-500 properties. Three core modules: Rent Collection, Financial Reporting, Contract Management.

**Tech Stack**: Electron 28+ / Vue 3.4+ / Element Plus 2.5+ / TypeScript / Pinia / Node.js 20 LTS / Express 4.x / Sequelize 6.x / MySQL 8.0 / Redis 7.x

---

## 2. Deployment Model

- **Single-machine bundled application**: MySQL portable edition + Redis (bundled `redis-server.exe`) + Express backend as Electron child process
- Electron main process manages lifecycle: start MySQL → Redis → Backend on app launch, stop in reverse on quit
- Backend at `localhost:3001`, Vue3 renderer calls REST API over HTTP
- Production: Electron loads from `file://` protocol
- Packaged via `electron-builder` into a single installer
- MySQL portable at `./runtime/mysql/`, Redis at `./runtime/redis/`

### 2.1 Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│                  Electron Shell                       │
│  ┌────────────────────┐  ┌────────────────────────┐  │
│  │   Main Process     │  │   Renderer Process     │  │
│  │  • MySQL lifecycle │  │  Vue3 + Element Plus   │  │
│  │  • Redis lifecycle │  │  Pinia + Vue Router    │  │
│  │  • Backend spawn   │  │  ECharts + TypeScript  │  │
│  │  • System tray     │  │                         │  │
│  │  • Auto-update     │  │  ← REST API calls →    │  │
│  │  • IPC bridge      │  │     localhost:3001     │  │
│  └────────────────────┘  └────────────────────────┘  │
│           │                                           │
│           ▼                                           │
│  ┌────────────────────────────────────────────────┐  │
│  │  Node.js Express Backend (child process)       │  │
│  │  RESTful API • JWT Auth • Sequelize ORM       │  │
│  │  Business services • node-cron tasks           │  │
│  │  WebSocket (notifications)                     │  │
│  └────────────┬───────────┬──────────────────────┘  │
│               ▼           ▼                          │
│       ┌──────────┐  ┌──────────┐                    │
│       │  MySQL   │  │  Redis   │                    │
│       │ (portable│  │ (bundled │                    │
│       │  3306)   │  │  6379)   │                    │
│       └──────────┘  └──────────┘                    │
└──────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 Core Entities

```sql
-- Properties (房源)
properties: id, name, type ENUM('公寓','厂房','商铺'), sub_type, area, address,
  floor, unit, status ENUM('空置','已预订','已出租','维修中','退租中'),
  amenities JSON, owner, notes, deleted_at, created_at, updated_at

-- Tenants (租客)
tenants: id, name, id_type ENUM('身份证','营业执照','护照'), id_number, phone,
  email, wechat, contact_person, credit_score INT(0-100), credit_grade ENUM('A','B','C','D'),
  status ENUM('待入住','在租中','已退租'), attachments JSON, notes, created_at, updated_at

-- Contracts (合同)
contracts: id, contract_no VARCHAR(50) UNIQUE, property_id FK, tenant_id FK,
  template_id FK, start_date, end_date, rent_amount DECIMAL(12,2),
  deposit_amount DECIMAL(12,2), payment_cycle ENUM('月','季','年'),
  billing_mode ENUM('固定','阶梯','抽成'), billing_config JSON,
  status ENUM('起草中','审批中','已驳回','已签订','执行中','到期提醒','已到期','已终止'),
  signed_at, created_by FK(users), created_at, updated_at

-- Bills (账单)
bills: id, contract_id FK, bill_no VARCHAR(50), period VARCHAR(7) (YYYY-MM),
  rent_amount DECIMAL(12,2), utility_amount DECIMAL(12,2), other_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2), due_date, paid_date,
  status ENUM('未缴','部分缴','已缴','逾期'), payment_channel ENUM('银行转账','微信','支付宝','现金','POS','支票'),
  created_at, updated_at

-- Vouchers (凭证)
vouchers: id, book_id FK, voucher_no VARCHAR(50), date DATE, period VARCHAR(7),
  type ENUM('收','付','转'), summary TEXT,
  status ENUM('草稿','待复核','待审核','已过账','已作废'),
  created_by FK, reviewed_by FK, approved_by FK, created_at, updated_at

-- Voucher Entries (凭证分录)
voucher_entries: id, voucher_id FK, account_id FK, summary TEXT,
  debit_amount DECIMAL(12,2) DEFAULT 0, credit_amount DECIMAL(12,2) DEFAULT 0,
  contract_id FK NULL, bill_id FK NULL, created_at

-- Approvals (审批)
approvals: id, contract_id FK, node_name, approver_id FK(users),
  status ENUM('待审批','已通过','已驳回','已转审'), opinion TEXT,
  approved_at, created_at
```

### 3.2 Financial Entities

```sql
account_books: id, name, company_name, start_date, end_date, currency DEFAULT 'CNY',
  is_active BOOLEAN DEFAULT TRUE, settings JSON, created_at, updated_at

chart_of_accounts: id, book_id FK, code VARCHAR(20), name, parent_id FK NULL,
  type ENUM('资产','负债','所有者权益','收入','费用'), level INT, direction ENUM('借','贷'),
  is_enabled BOOLEAN DEFAULT TRUE, created_at, updated_at

payment_records: id, bill_id FK, amount DECIMAL(12,2), channel, transaction_no,
  paid_at, notes, created_by FK, created_at

dunning_tasks: id, bill_id FK, level INT(1-4), channel ENUM('站内信','短信','微信','邮件','电话','书面'),
  title, content TEXT, sent_at, status ENUM('待发送','已发送','失败'), response TEXT, created_at

notifications: id, recipient_id FK(users) NULL, recipient_type ENUM('user','tenant'),
  channel, title, content TEXT, is_read BOOLEAN DEFAULT FALSE, read_at, created_at

budgets: id, book_id FK, account_id FK, year INT, month INT NULL,
  budget_amount DECIMAL(14,2), actual_amount DECIMAL(14,2) DEFAULT 0,
  status ENUM('编制中','待审核','已批准'), created_by FK, created_at, updated_at

contract_templates: id, name, type ENUM('住房','厂房','商铺'), content JSON (clause blocks),
  is_default BOOLEAN, terms JSON, created_at, updated_at

contract_clauses: id, template_id FK, title, content TEXT, type ENUM('标准','可选','风险'),
  sort_order INT, is_required BOOLEAN, created_at, updated_at

contract_changes: id, contract_id FK, change_type ENUM('租金调整','租期变更','提前退租','条款补充'),
  before_data JSON, after_data JSON, reason TEXT, status ENUM('审批中','已通过','已驳回'),
  created_by FK, approved_by FK, created_at, updated_at

contract_logs: id, contract_id FK, action, old_status, new_status, operator_id FK,
  notes TEXT, created_at

expenses: id, book_id FK, category ENUM('维修','保洁','安保','绿化','办公','折旧','其他'),
  amount DECIMAL(12,2), allocation_rule JSON, status ENUM('待审批','已批准','已付款'),
  notes TEXT, created_by FK, created_at

fixed_assets: id, book_id FK, name, category, original_value DECIMAL(12,2),
  residual_value DECIMAL(12,2), useful_months INT, monthly_depreciation DECIMAL(12,2),
  accumulated_depreciation DECIMAL(12,2), start_date, status, created_at
```

### 3.3 System Entities

```sql
users: id, username VARCHAR(50) UNIQUE, password_hash, display_name, role ENUM('管理员','收租主管','收租员','财务主管','会计','出纳','合同主管','法务','总经理'),
  permissions JSON, last_login, status, created_at, updated_at

dict_types: id, code VARCHAR(50) UNIQUE, name
dict_items: id, type_id FK, code, name, sort_order, is_enabled, extra JSON

audit_logs: id, user_id FK, action, module, target_type, target_id, detail JSON, ip, created_at

system_configs: id, config_key VARCHAR(50) UNIQUE, config_value TEXT, description, updated_at
```

### 3.4 Key Relationships

- Property → Contract: one-to-many (one property, multiple contracts over time)
- Tenant → Contract: one-to-many (one tenant can lease multiple properties)
- Contract → Bill: one-to-many (monthly/quarterly bills)
- Bill → PaymentRecord: one-to-many (partial payments allowed)
- Bill → DunningTask: one-to-many (escalation history)
- Contract → Voucher (via bill linkage): indirect
- Voucher → VoucherEntry: one-to-many
- ContractTemplate → ContractClause: one-to-many
- AccountBook → ChartOfAccounts: one-to-many (hierarchical)
- Contract → Approval: one-to-many (multi-level workflow)

---

## 4. Module 1: Rent Collection Management (收租管理)

### 4.1 Feature Tree

```
收租管理
├── 房源管理 (Property Management)
│   ├── Property list (table + filter + batch ops)
│   ├── Property detail (info, contracts, bills, history)
│   ├── Property import (Excel upload + field mapping)
│   └── Property status kanban (空置→已预订→已出租→维修中→退租中)
├── 租客管理 (Tenant Management)
│   ├── Tenant list (searchable, filterable by credit score)
│   ├── Tenant detail (profile, contracts, payments, credit history)
│   ├── Check-in flow (contract → deposit → key)
│   ├── Check-out flow (settlement → refund → release)
│   └── Credit scoring engine (auto-calculate A/B/C/D)
├── 收租核心 (Rent Collection)
│   ├── Auto bill generation (cron, per contract cycle)
│   ├── Payment recording (manual + WeChat/Alipay callback)
│   ├── Receipt calendar (monthly, color-coded by status)
│   └── Bill detail & payment history
├── 智能催缴 (Smart Dunning)
│   ├── Dunning dashboard (tasks grouped by level)
│   ├── Strategy config (days, channels, templates per level)
│   ├── Batch notification dispatch
│   └── Arrears aging analysis (30/60/90/180+ day buckets)
└── 收租看板 (Dashboard)
    ├── KPI cards (收缴率, 逾期率, 应收, 实收, 欠费户数)
    ├── Collection trend chart (monthly 应收 vs 实收 vs 欠费)
    └── Delinquency rate trend (by property type)
```

### 4.2 Key Business Logic

| Logic | Implementation |
|-------|---------------|
| Bill auto-generation | `node-cron` daily scan of active contracts; if `today >= last_bill_date + cycle_days`, create bill |
| Rent calculation | Fixed: `rent_amount`. Tiered: lookup table. Revenue-share: `base_rent + tenant_revenue × rate` |
| Payment matching | FIFO: match payment to earliest unpaid bill for the tenant |
| Credit score | Recalculated on each payment (on-time=+5, late=-10/week) and on contract events |
| Dunning escalation | Cron checks overdue bills → compares days overdue → triggers next level if threshold crossed |
| Utility billing | Manual meter reading entry → auto-calculate amount from price config |

### 4.3 API Endpoints (26 total)

```
GET    /api/properties              List + search + filter
POST   /api/properties              Create
GET    /api/properties/:id          Detail
PUT    /api/properties/:id          Update
DELETE /api/properties/:id          Soft delete
POST   /api/properties/import       Excel import
PATCH  /api/properties/:id/status   Status transition

GET    /api/tenants                 List + search
POST   /api/tenants                 Create
GET    /api/tenants/:id             Detail (with contracts, bills, credit)
PUT    /api/tenants/:id             Update
POST   /api/tenants/:id/check-in    Check-in workflow
POST   /api/tenants/:id/check-out   Check-out workflow

GET    /api/bills                   List + search
POST   /api/bills/generate          Manual generation trigger
GET    /api/bills/:id               Bill detail
PUT    /api/bills/:id               Update (before payment)
POST   /api/bills/:id/pay           Record payment
GET    /api/bills/calendar          Monthly calendar data

GET    /api/dunning/tasks           List tasks
POST   /api/dunning/dispatch        Dispatch notification
PUT    /api/dunning/strategy        Update strategy config
GET    /api/dunning/aging           Arrears aging report

GET    /api/dashboard/rent          Dashboard data
GET    /api/payment-records         List payment records
```

---

## 5. Module 2: Financial Reporting (财务报表)

### 5.1 Feature Tree

```
财务报表
├── 账套管理 (Account Books)
│   ├── Multi-book setup (by project/company)
│   ├── Chart of accounts (standard CN, extensible)
│   ├── Opening balances (historical import)
│   └── Accounting period management (close, year-end结转)
├── 凭证管理 (Vouchers)
│   ├── Auto-generation from rent/expenses
│   ├── Manual entry (double-entry form)
│   ├── Review workflow (制单→复核→审核→过账)
│   └── Print/export
├── 收入与费用核算 (Revenue & Cost)
│   ├── Revenue recognition (accrual basis)
│   ├── Cost classification (维修/保洁/安保/绿化/折旧)
│   ├── Cost allocation engine (面积/户/自定义)
│   ├── Depreciation schedule
│   └── AR aging analysis
├── 税务管理 (Tax Management)
│   ├── Tax calculation (VAT/房产税/城镇土地使用税/印花税/CIT)
│   ├── Tax declaration sheet generation
│   ├── Invoice management (进项/销项)
│   ├── Tax risk alerts
│   └── Tax archive
├── 预算管理 (Budget Management)
│   ├── Budget编制 (annual/quarterly/monthly)
│   ├── Approval flow (编制→审核→批准)
│   ├── Execution monitoring + over-budget alert
│   ├── Rolling adjustment
│   └── Budget vs actual reports
├── 报表体系 (Report System)
│   ├── 资产负债表 (Balance Sheet)
│   ├── 利润表 (Income Statement)
│   ├── 现金流量表 (Cash Flow Statement)
│   ├── 管理报表 (收租汇总/欠费明细/成本分析/预算执行)
│   └── Custom report builder (drag-drop)
└── 财务看板 (Dashboard)
    ├── Revenue/expense/profit trend
    ├── Cash flow waterfall
    └── Key financial ratios
```

### 5.2 Key Business Logic

| Logic | Implementation |
|-------|---------------|
| Auto-voucher from rent | `bill.paid` event → `借:银行存款 贷:租金收入` |
| Auto-voucher from expense | `expense.approved` event → `借:费用科目 贷:银行存款` |
| Depreciation | Monthly cron: `(原值-残值)/使用月份` |
| Cost allocation | Configurable: `按面积比例 = unit_area / total_area × cost` |
| VAT | General taxpayer: output - input; Small-scale: revenue × 1% |
| 房产税 | 从租计征: rent × 12%; 从价: property_value × 70% × 1.2% |
| Budget alert | `cumulative_expense / budget > threshold` → alert |
| Trial balance | `∑debit = ∑credit` across all voucher entries |

### 5.3 API Endpoints (28 total)

```
GET    /api/account-books
POST   /api/account-books
GET    /api/accounts                    Chart of accounts (tree)
POST   /api/accounts
PUT    /api/accounts/:id
DELETE /api/accounts/:id

GET    /api/vouchers                    List + filter
POST   /api/vouchers                    Manual create
POST   /api/vouchers/auto-generate      Auto from events
GET    /api/vouchers/:id                Detail with entries
PUT    /api/vouchers/:id/status         Review workflow
POST   /api/voucher-entries             Add entry

GET    /api/expenses                    List
POST   /api/expenses                    Create
PUT    /api/expenses/:id/approve        Approve → auto-voucher
DELETE /api/expenses/:id

GET    /api/tax/calculations            Period tax calc results
POST   /api/tax/calculate               Calculate for period
GET    /api/tax/reports                 Declaration sheets
GET    /api/invoices                    Invoice registry

GET    /api/budgets                     List
POST   /api/budgets                     Create
PUT    /api/budgets/:id                 Update/approve
GET    /api/budgets/execution           Execution progress

GET    /api/reports/balance-sheet       ?period=&book_id=
GET    /api/reports/income-statement    ?period=&book_id=
GET    /api/reports/cash-flow           ?period=&book_id=
GET    /api/reports/custom              ?report_type=&params=

GET    /api/dashboard/finance           KPIs + charts
```

---

## 6. Module 3: Contract Management (合同管理)

### 6.1 Feature Tree

```
合同管理
├── 合同起草 (Drafting)
│   ├── Template selector (by property type)
│   ├── Smart clause library (标准/可选/风险)
│   ├── Online editor (rich text + variables + preview)
│   ├── Rent calculator widget
│   └── Attachment upload
├── 合同审批 (Approval)
│   ├── Workflow designer (visual, drag-drop)
│   ├── Multi-level approval (会签/或签)
│   ├── Opinion & annotation
│   ├── Version comparison
│   ├── Timeout escalation
│   └── E-signature integration (CA)
├── 合同履行 (Execution)
│   ├── Clause execution tracker
│   ├── Rent-bill linkage monitor
│   ├── Obligation diary (repairs, etc.)
│   ├── Breach detection
│   └── Progress visualization (timeline)
├── 合同变更 (Changes)
│   ├── Change request + approval
│   ├── Supplemental agreement
│   ├── Before/after diff
│   └── Cross-module impact sync
├── 续约与到期 (Renewal & Expiry)
│   ├── Multi-level expiry alerts
│   ├── Expiry calendar view
│   ├── Renewal evaluation (credit + market + history)
│   ├── Renew/not-renew decision workflow
│   └── Check-out settlement
├── 法务合规 (Legal & Compliance)
│   ├── Clause risk library
│   ├── Pre-sign compliance check
│   ├── Legal document generation
│   ├── Regulation sync
│   └── Compliance reports
├── 合同归档 (Archive)
│   ├── Full-text search
│   ├── Tag system
│   ├── Access control (借阅审批)
│   ├── Auto-cleanup
│   └── Backup & DR
└── 合同看板 (Dashboard)
    ├── Status distribution
    ├── Approval efficiency
    ├── Renewal rate trend
    └── Expiry forecast
```

### 6.2 Contract State Machine

```
需求发起 → 起草中 → 审批中 → 审批通过 → 已签订 → 执行中
                ↘ 审批驳回 ↗              ↓
                                     ┌─────┴──────┐
                                     ↓            ↓
                                  到期提醒     提前终止
                                     ↓            ↓
                                  续约评估   终止结算
                                  ↙    ↘         ↓
                              续签    不续签   已归档
                                ↓      ↓
                             新合同  退租结算→已归档
```

### 6.3 API Endpoints (25 total)

```
GET    /api/contract-templates          List
POST   /api/contract-templates          Create
GET    /api/contract-templates/:id      Detail + clauses
PUT    /api/contract-templates/:id      Update
DELETE /api/contract-templates/:id

GET    /api/clauses                     Clause library
POST   /api/clauses                     Add clause

GET    /api/contracts                   List + filters
POST   /api/contracts                   Create draft
GET    /api/contracts/:id               Full detail
PUT    /api/contracts/:id               Update draft
POST   /api/contracts/:id/submit        Submit for approval
POST   /api/contracts/:id/approve       Approve (per node)
POST   /api/contracts/:id/reject        Reject
POST   /api/contracts/:id/sign          Sign
POST   /api/contracts/:id/terminate     Early termination
POST   /api/contracts/:id/renew         Create renewal

GET    /api/contracts/:id/changes       Change history
POST   /api/contracts/:id/changes       Create change request
GET    /api/contracts/:id/versions      Version diff

GET    /api/contracts/expiry-calendar   Upcoming expiries
GET    /api/contracts/renewals          Renewal evaluations
POST   /api/contracts/renewals/:id/evaluate  Submit evaluation

GET    /api/approvals                   My pending approvals
POST   /api/approvals/:id/comment       Add opinion

GET    /api/compliance/check/:id        Run compliance check
GET    /api/compliance/reports          Reports

GET    /api/dashboard/contracts         Dashboard data
```

---

## 7. System Integration & Shared Services

### 7.1 External Integrations

| Integration | Method | Status |
|------------|--------|--------|
| WeChat Pay callback | Webhook endpoint + API | Real |
| Alipay callback | Webhook endpoint + API | Real |
| SMS gateway | 阿里云/腾讯云 SMS API | Real |
| E-signature (CA) | e签宝/法大大 API | Real |
| Bank reconciliation | Batch file import (银企直连模拟) | Semi-real |
| Tax system export | Excel/XML export for 电子税务局 | Export-only |

### 7.2 Internal Cross-Module Events

| Trigger | Effect |
|---------|--------|
| Contract signed | Auto-create rent schedule (bills for the full lease period) |
| Rent bill paid | Auto-generate financial voucher |
| Expense approved | Auto-generate financial voucher |
| Dunning task triggered | Multi-channel notification dispatch |
| Approval passed | Archive contract, send notification |
| Contract renewed | Link new contract to existing tenant/property |

### 7.3 Notification Service

- Channels supported: 站内信 (in-app), SMS, WeChat template message, Email
- Notification queue in Redis for async dispatch
- Template engine for message content (variable substitution)
- Delivery log + retry mechanism

### 7.4 Scheduled Tasks (node-cron)

| Task | Frequency | Description |
|------|-----------|-------------|
| Bill generation | Daily 2:00 AM | Scan active contracts, generate bills due this cycle |
| Dunning escalation | Daily 8:00 AM | Check overdue bills, escalate to next dunning level |
| Depreciation calculation | Last day of month | Calculate monthly depreciation for all fixed assets |
| Contract expiry check | Daily 7:00 AM | Check contracts expiring within 90/60/30/15/7 days |
| Tax deadline reminder | Daily | Check upcoming tax deadlines |
| Data backup | Daily 3:00 AM | Export database to backup file |
| AR aging update | Daily | Recalculate accounts receivable aging |

---

## 8. UI/UX Design

### 8.1 Global Layout

```
┌────────────────────────────────────────────────────────┐
│ Top Nav (56px): Logo │ 全局搜索 │ 消息通知 │ 用户头像  │
├───────────┬────────────────────────────────────────────┤
│ Sidebar   │  Breadcrumb                                │
│ (220px)   ├────────────────────────────────────────────┤
│           │  Title Bar (页面标题 + 操作按钮)            │
│           ├────────────────────────────────────────────┤
│ ─ 首页   │                                             │
│ ─ 收租   │  Content Area                               │
│   ·房源   │  (Table / Cards / Charts / Forms)           │
│   ·租客   │                                             │
│   ·收租   │                                             │
│   ·催缴   │                                             │
│ ─ 财务   │                                             │
│   ·账套   │                                             │
│   ·凭证   │                                             │
│   ·核算   │                                             │
│   ·税务   │                                             │
│   ·预算   │                                             │
│   ·报表   │                                             │
│ ─ 合同   │                                             │
│   ·起草   │                                             │
│   ·审批   │                                             │
│   ·履行   │                                             │
│   ·续约   │                                             │
│   ·归档   │                                             │
│ ─ 系统   │                                             │
│   ·用户   │                                             │
│   ·字典   │                                             │
│   ·日志   │                                             │
└───────────┴────────────────────────────────────────────┘
```

### 8.2 Design Tokens

```
--color-primary: #0A3D62
--color-accent: #F6B93B
--color-success: #00B894
--color-warning: #FF6B35
--color-info: #82CCDD
--color-bg-light: #DFE6E9
--color-text-title: #2C3E50
--color-text-body: #34495E
--color-text-aux: #7F8C8D
--font-family: 'Noto Sans CJK SC', sans-serif
--radius-sm: 4px (buttons, inputs)
--radius-md: 8px (cards, modals)
--radius-lg: 12px (tags)
```

### 8.3 Typography Scale

| Usage | Size | Weight | Color |
|-------|------|--------|-------|
| Page title | 26px | Bold | #0A3D62 |
| Module title | 18px | Bold | #0A3D62 |
| Card title | 14px | Bold | #0A3D62 |
| Body text | 12px | Regular | #34495E |
| Auxiliary text | 10px | Regular | #7F8C8D |
| Data label | 9px | Regular | #7F8C8D |

### 8.4 Component Mapping

| Feature | Element Plus | Custom Work |
|---------|-------------|-------------|
| KPI cards | el-card + el-statistic | Styling |
| Data tables | el-table | Virtual scroll wrapper |
| Kanban board | None | **Custom** (drag-drop cards) |
| Rent calendar | el-calendar | Color badges |
| Contract editor | None | **Custom** (Tiptap or Quill) |
| Approval flow designer | None | **Vue Flow** |
| Flow visualization | None | **Vue Flow** |
| Charts | vue-echarts | Wrapper components |
| Account tree | el-tree | As-is |
| Voucher entries | el-table inline edit | Minor customization |
| Report designer | None | **Custom** drag-drop (later phase) |
| Notifications | el-notification | As-is |

### 8.5 Responsive Breakpoints

1280px / 1440px / 1920px (per PPTX spec)

### 8.6 Interaction Spec

- Page transitions: smooth 200ms animation
- Table rows: hover show action buttons, confirm on delete
- Form: real-time validation, error fields highlighted
- Loading: skeleton screens, spinner overlay
- Feedback: success/failure toast, 2-second auto-dismiss

---

## 9. Project Structure

```
property-rental-system/
├── electron/                      # Electron main process
│   ├── main.ts                    # App entry, lifecycle
│   ├── preload.ts                 # Preload script
│   ├── spawn-backend.ts           # Child process management
│   ├── spawn-mysql.ts             # MySQL portable management
│   ├── spawn-redis.ts             # Redis management
│   ├── tray.ts                    # System tray
│   └── updater.ts                 # Auto-update
│
├── frontend/                      # Vue3 renderer
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router/
│   │   │   └── index.ts           # Routes + guards
│   │   ├── stores/                # Pinia stores
│   │   │   ├── auth.ts
│   │   │   ├── property.ts
│   │   │   ├── tenant.ts
│   │   │   ├── bill.ts
│   │   │   ├── contract.ts
│   │   │   ├── finance.ts
│   │   │   └── notification.ts
│   │   ├── api/                   # Axios API layer
│   │   │   ├── request.ts         # Axios instance + interceptors
│   │   │   ├── properties.ts
│   │   │   ├── tenants.ts
│   │   │   ├── bills.ts
│   │   │   ├── dunning.ts
│   │   │   ├── contracts.ts
│   │   │   ├── vouchers.ts
│   │   │   ├── finance.ts
│   │   │   ├── budgets.ts
│   │   │   ├── reports.ts
│   │   │   ├── tax.ts
│   │   │   └── auth.ts
│   │   ├── views/
│   │   │   ├── dashboard/         # 首页概览
│   │   │   ├── rent/              # 收租管理
│   │   │   │   ├── PropertyList.vue
│   │   │   │   ├── PropertyDetail.vue
│   │   │   │   ├── PropertyImport.vue
│   │   │   │   ├── TenantList.vue
│   │   │   │   ├── TenantDetail.vue
│   │   │   │   ├── BillList.vue
│   │   │   │   ├── BillCalendar.vue
│   │   │   │   ├── PaymentRecord.vue
│   │   │   │   ├── DunningCenter.vue
│   │   │   │   └── RentDashboard.vue
│   │   │   ├── finance/           # 财务报表
│   │   │   │   ├── AccountBookList.vue
│   │   │   │   ├── AccountList.vue
│   │   │   │   ├── VoucherList.vue
│   │   │   │   ├── VoucherEdit.vue
│   │   │   │   ├── ExpenseList.vue
│   │   │   │   ├── TaxManagement.vue
│   │   │   │   ├── BudgetList.vue
│   │   │   │   ├── BudgetEdit.vue
│   │   │   │   ├── ReportCenter.vue
│   │   │   │   └── FinanceDashboard.vue
│   │   │   ├── contract/          # 合同管理
│   │   │   │   ├── ContractList.vue
│   │   │   │   ├── ContractDraft.vue
│   │   │   │   ├── ContractDetail.vue
│   │   │   │   ├── ContractApproval.vue
│   │   │   │   ├── ContractKanban.vue
│   │   │   │   ├── ExpiryCalendar.vue
│   │   │   │   ├── RenewalList.vue
│   │   │   │   ├── TemplateList.vue
│   │   │   │   ├── ComplianceReport.vue
│   │   │   │   └── ContractDashboard.vue
│   │   │   └── system/            # 系统设置
│   │   │       ├── UserList.vue
│   │   │       ├── RoleConfig.vue
│   │   │       ├── DictList.vue
│   │   │       └── AuditLog.vue
│   │   ├── components/            # Shared components
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.vue
│   │   │   │   ├── TopNav.vue
│   │   │   │   ├── Sidebar.vue
│   │   │   │   └── Breadcrumb.vue
│   │   │   ├── common/
│   │   │   │   ├── KpiCard.vue
│   │   │   │   ├── StatusTag.vue
│   │   │   │   ├── FileUpload.vue
│   │   │   │   ├── ExcelImport.vue
│   │   │   │   └── ChartCard.vue
│   │   │   ├── rent/              # Module-specific
│   │   │   ├── finance/
│   │   │   └── contract/
│   │   ├── composables/           # Vue composables
│   │   ├── utils/
│   │   └── styles/
│   │       ├── variables.scss
│   │       ├── element-overrides.scss
│   │       └── global.scss
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                       # Express API server
│   ├── src/
│   │   ├── index.ts               # Entry, server start
│   │   ├── app.ts                 # Express app setup
│   │   ├── config/
│   │   │   ├── database.ts        # Sequelize instance
│   │   │   ├── redis.ts
│   │   │   └── index.ts           # env config
│   │   ├── models/                # Sequelize models
│   │   │   ├── Property.ts
│   │   │   ├── Tenant.ts
│   │   │   ├── Contract.ts
│   │   │   ├── Bill.ts
│   │   │   ├── PaymentRecord.ts
│   │   │   ├── Voucher.ts
│   │   │   ├── VoucherEntry.ts
│   │   │   ├── AccountBook.ts
│   │   │   ├── ChartOfAccount.ts
│   │   │   ├── Budget.ts
│   │   │   ├── Expense.ts
│   │   │   ├── FixedAsset.ts
│   │   │   ├── ContractTemplate.ts
│   │   │   ├── ContractClause.ts
│   │   │   ├── ContractChange.ts
│   │   │   ├── Approval.ts
│   │   │   ├── DunningTask.ts
│   │   │   ├── Notification.ts
│   │   │   ├── User.ts
│   │   │   ├── DictItem.ts
│   │   │   └── AuditLog.ts
│   │   ├── routes/
│   │   │   ├── index.ts           # Route aggregator
│   │   │   ├── auth.ts
│   │   │   ├── properties.ts
│   │   │   ├── tenants.ts
│   │   │   ├── bills.ts
│   │   │   ├── paymentRecords.ts
│   │   │   ├── dunning.ts
│   │   │   ├── vouchers.ts
│   │   │   ├── accountBooks.ts
│   │   │   ├── accounts.ts
│   │   │   ├── expenses.ts
│   │   │   ├── tax.ts
│   │   │   ├── budgets.ts
│   │   │   ├── reports.ts
│   │   │   ├── contracts.ts
│   │   │   ├── contractTemplates.ts
│   │   │   ├── approvals.ts
│   │   │   ├── compliance.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── users.ts
│   │   │   ├── dicts.ts
│   │   │   └── auditLogs.ts
│   │   ├── services/              # Business logic
│   │   │   ├── bill-generator.ts
│   │   │   ├── dunning-engine.ts
│   │   │   ├── voucher-generator.ts
│   │   │   ├── credit-scorer.ts
│   │   │   ├── cost-allocator.ts
│   │   │   ├── tax-calculator.ts
│   │   │   ├── depreciation.ts
│   │   │   ├── report-engine.ts
│   │   │   ├── contract-workflow.ts
│   │   │   ├── compliance-checker.ts
│   │   │   ├── notification.ts
│   │   │   └── payment-reconciler.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT verification
│   │   │   ├── rbac.ts            # Role-based access
│   │   │   ├── validate.ts        # Request validation
│   │   │   ├── rate-limiter.ts
│   │   │   └── audit-log.ts
│   │   ├── jobs/                  # Cron jobs
│   │   │   └── scheduler.ts
│   │   ├── utils/
│   │   └── websocket/
│   │       └── index.ts
│   ├── migrations/                # Sequelize migrations
│   ├── seeders/                   # Seed data
│   ├── tests/
│   ├── tsconfig.json
│   └── package.json
│
├── runtime/                       # Bundled services (gitignored)
│   ├── mysql/
│   └── redis/
├── package.json                   # Root package (monorepo scripts)
├── electron-builder.yml
└── README.md
```

---

## 10. Security & Performance

### 10.1 Security

| Measure | Implementation |
|---------|---------------|
| Authentication | JWT with access/refresh tokens, 4h/7d expiry |
| Authorization | RBAC: 9 roles with granular permissions |
| Password storage | bcrypt, salt rounds=12 |
| Sensitive data | AES-256-CBC encryption for id_number, bank_account fields |
| API rate limiting | express-rate-limit: 100 req/min per endpoint |
| Input validation | Joi/Zod validation on all inputs |
| SQL injection | Sequelize parameterized queries |
| Audit logging | All CRUD operations logged with user + IP + timestamp |
| File upload | Size limits, type whitelist, virus scan skip (local app) |

### 10.2 Performance

| Strategy | Detail |
|----------|--------|
| Redis cache | Hot data (dicts, configs) cached 5 min TTL |
| Database indexes | On all foreign keys + frequent search fields (name, phone, contract_no) |
| API pagination | Cursor-based for large lists, page-based for standard |
| Virtual scroll | For tables with >100 rows |
| Lazy loading | Vue router lazy loading for all page components |
| Asset optimization | Vite code splitting, tree shaking |

---

## 11. Build & Packaging

- **Dev mode**: `npm run dev` → starts Vite dev server (5173) + backend in watch mode (3001) + MySQL + Redis
- **Production build**: `npm run build` → Vite builds to `frontend/dist`, backend compiles TypeScript, electron-builder packages everything
- **Installer**: NSIS for Windows (.exe), bundles MySQL portable + Redis + backend + frontend
- **Auto-update**: electron-updater with private update server

---

## 12. Implementation Order

Per user preference: sequential module-by-module build.

1. **Phase 0: Scaffold** — Project structure, Electron shell, build pipeline, database setup, auth
2. **Phase 1: Rent Collection** — 房源 + 租客 + 收租 + 催缴 + 收租看板
3. **Phase 2: Financial Reporting** — 账套 + 凭证 + 核算 + 税务 + 预算 + 报表 + 财务看板
4. **Phase 3: Contract Management** — 起草 + 审批 + 履行 + 续约 + 合规 + 归档 + 合同看板
5. **Phase 4: Integrations** — Payment gateways, SMS, e-signature, bank reconciliation
6. **Phase 5: Polish** — UI refinement, performance optimization, installer testing, documentation

---

## 13. Self-Review

- No TBDs or TODOs — all sections are complete
- Architecture matches deployment model C (Electron + bundled MySQL portable + backend child process)
- Database schema covers all 3 modules' entity needs
- API endpoint count: 79 total (26 rent + 28 finance + 25 contract)
- UI component mapping identifies what's stock Element Plus vs custom development
- Cross-module integration via event bus is specified
- Security and performance measures are defined
- Project structure reflects the chosen architecture
- Build strategy: sequential module build per user choice
