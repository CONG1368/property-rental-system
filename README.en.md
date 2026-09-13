[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

---

# Property Rental Management System

A full-stack desktop application for property rental management, covering property management, tenant management, rent collection & dunning, full contract lifecycle, property operations, fire safety management, financial accounting, and report analysis.

> **⚠ Copyright Notice**
>
> This project is for **personal study and research only**. Without explicit written authorization from the copyright holder, **any form of commercial use is strictly prohibited**
> (including but not limited to selling, licensing, renting, commercial hosting, SaaS services, integration into commercial products, etc.).
> Violators will be held legally liable. See [LICENSE](./LICENSE) for details.

## Tech Stack

| Layer | Technology |
|---|------|
| Frontend Framework | Vue 3.5 Composition API + TypeScript |
| UI Library | Element Plus 2.5 (cool-neutral design tokens v2) |
| Charts | ECharts 6 + vue-echarts 8 |
| State Management | Pinia 2.1 |
| Backend Framework | Express 4.22 + TypeScript |
| ORM | Sequelize 6.37 (SQLite by default, MySQL optional) |
| Authentication | JWT (access 4h + refresh 7d) |
| Scheduled Tasks | node-cron (bill generation / dunning escalation / contract expiry / monthly depreciation / property automation / monthly briefing / door-lock cleanup — 7 jobs) |
| Real-time Communication | WebSocket (8 event types) |
| Desktop Packaging | Electron 28 + electron-builder (NSIS installer, compression: normal) |

## Quick Start

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install & Launch

```bash
# 1. Install dependencies
npm install

# 2. Start development services (frontend + backend in parallel)
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Default credentials: `admin / admin123`

### Build & Package

```bash
npm run build          # Full build (frontend → backend → Electron)
npm run build:electron # Package Electron installer only
```

> Stop the dev server before packaging (otherwise `backend/node_modules` and `runtime/node/node.exe` are locked and the build fails with EPERM). `electron-builder.yml` uses `compression: normal` with the NSIS target only; a full package takes about 6 minutes. Artifacts land in `release/` (`property-rental-system-setup-<version>.exe` + blockmap + `latest.yml`); no zip distribution is produced any more.

### Database Switching

SQLite is used by default (zero configuration). Edit `backend/.env` to switch to MySQL:

```env
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=property_rental
```

## Project Structure

```
├── frontend/                  # Vue3 Frontend
│   └── src/
│       ├── api/               # API request modules
│       ├── components/        # Shared components
│       ├── router/            # Router (hash mode)
│       ├── stores/            # Pinia state management
│       └── views/             # Page components (87)
│           ├── dashboard/     # Home dashboard (1)
│           ├── rent/          # Rental management (37: rent / property / tenant / door lock / room kanban / ID card reader)
│           ├── property/      # Property operations (7: work orders / facilities / meters / parking / complaints / residents / announcements)
│           ├── fire/          # Fire safety management (6)
│           ├── finance/       # Financial management (14)
│           ├── contract/      # Contract management (10)
│           └── system/        # System settings (11) + login page
├── backend/                   # Express Backend (ESM)
│   └── src/
│       ├── models/            # Sequelize models (69)
│       ├── routes/            # API routes (67 modules)
│       ├── services/          # Business service layer (41 services)
│       ├── middleware/        # Middleware (auth / audit / validation / rate-limit)
│       ├── jobs/              # Cron job scheduler
│       └── websocket/         # WebSocket real-time push
├── electron/                  # Electron main process
├── scripts/                   # Utility scripts
├── electron-builder.yml       # Packaging config
└── package.json               # Root config
```

## Feature List

### Rental Management

| Feature | Description |
|------|------|
| Property Management | Property registration, status tracking, area/layout/fee standards, bulk import |
| Tenant Management | Tenant info, contract association, credit scoring |
| Rent Collection | Bill generation, manual creation, payment records, fee breakdown (rent / water / electricity / property / other) |
| Smart Dunning | Four-level dunning escalation (before due / 1-7 days overdue / 8-30 days / 30+ days), dunning task tracking, overdue marking |
| Room Status Kanban | Building/floor filtering + card/table view toggle + quick-action drawer + batch status change; dark data dashboard (6 chart types); batch room generation |
| Door Lock Management | Smart locks (remote unlock / password management / battery monitoring), traditional locks (key borrow-return / loss-report / void workflow), audit logs |
| ID Card Reader | Huashi CVR-100U real integration (built-in WHQL driver with one-click install), ID number validation & masking, card-reading audit |
| Printing | 6 template sets (contract / tenant info / bill / receipt / batch summary / monthly briefing), native system printing + text-based PDF export; 80mm thermal receipts in binary layout |
| Collection Dashboard | Collection rate, overdue rate, payment channel distribution, rent trend |
| Collection Calendar | Monthly collection calendar view, batch status overview |

### Property Operations

| Feature | Description |
|------|------|
| Work Orders | Repair work-order dispatch / handling / follow-up; the maintenance-worker role can accept orders |
| Facility Maintenance | Facility and equipment ledger, maintenance records and maintenance plans |
| Meter Reading & Billing | Water / electricity / gas meter readings, billing linked to bills |
| Smart Utility Meters | bzp.iyunmu.com prepaid platform integration (devices / recharge / tenant mapping) |
| Parking Management | Parking space ledger and parking records |
| Complaints & Suggestions | Complaint registration, handling and follow-up tracking |
| Resident Profiles | Resident / owner profiles, visitor registration and patrol records |
| Announcements & Common Revenue | Announcement publishing, common revenue ledger, outsourced vendors and warehouse materials |
| Property Operations Dashboard | KPI summary for work orders / equipment / complaints / parking / residents / revenue |

### Fire Safety Management

| Feature | Description |
|------|------|
| Fire Dashboard | KPIs + equipment / inspection / violation statistics |
| Inspection Records | 6 inspection dimensions + overall score, can be linked to violations |
| Equipment Ledger | Fire equipment status tracking and expiry alerts (expired rows highlighted) |
| Violation Records | Rectification workflow and fine management |
| Drill Records | Drill scoring and improvement measures |

### Contract Management

| Feature | Description |
|------|------|
| Contract List | Full lifecycle: draft / approval / signing / execution / expiry |
| Contract Drafting | Form-based creation, fee configuration (water / electricity / property), property-tenant association |
| Contract Approval | Submit / reject / sign-off workflow, approval record audit trail |
| Contract Details | Full info display, fee config cards, file upload & download |
| Contract Kanban | 8-column kanban by status |
| Renewal Management | Multi-period preview before expiry (7 / 30 / 90 / 180 / 365 days), one-click renewal |
| Expiry Calendar | Monthly expiry contract view, multi-level expiry statistics |
| Contract Templates | Template management |
| Compliance Check | Contract compliance review |

### Financial Management

| Feature | Description |
|------|------|
| Book Management | Multi-book support |
| Chart of Accounts | Standard 26-account system |
| Journal Vouchers | Auto-generated (rent → voucher), manual entry |
| Expense Management | Maintenance / cleaning / security / landscaping / office / depreciation expense categories |
| Tax Management | Tax calculation & export |
| Budget Management | Budget preparation / review / execution tracking |
| Report Center | Income reports, expense reports, profit analysis |
| Finance Dashboard | Key financial indicators overview |

### System Settings

| Feature | Description |
|------|------|
| User Management | User CRUD, role assignment (last-admin protection), password reset with secondary confirmation |
| Permission Matrix | 12 roles × modules × 6 operations, per-module overrides of the defaults, saving requires the admin password |
| Approval Workflow | Approval flow definition and approval center (contracts / budgets / large expenses) |
| Data Dictionary | Dictionary type and dictionary item configuration |
| System Parameters | Parameter center (grouping, sensitive values masked, built-in items cannot be deleted) |
| System Operations | Version / Node / memory / database info, manual execution of 7 scheduled tasks, audit toggle, database backup |
| Print Settings | Company full name / logo / e-signature / certificate info / contact phone configuration, real-time preview |
| ID Card Reader | Reader device registration, driver detection & installation, mock/real mode switching |
| Audit Log | Full operation audit (success / failure / unauthorized), supports filtering and CSV export |

## Scheduled Tasks

| Task | Schedule | Description |
|------|------|------|
| Bill Generation | Daily 02:00 | Auto-generate the current period's bills based on contract cycles |
| Dunning Escalation | Daily 08:00 | Auto-escalate dunning levels for overdue bills |
| Contract Expiry Check | Daily 07:00 | Auto-update the status of expiring contracts |
| Monthly Depreciation | 1st of month 02:00 | Monthly fixed-asset depreciation (period watermark, idempotent) |
| Property Automation | Daily 09:00 | Automated actions such as property inspections / equipment expiry |
| Monthly Business Briefing | 1st of month 09:30 | Generate the monthly business briefing PDF |
| Door Lock Password Cleanup | Daily 08:30 | Clean up expired temporary passwords |

## External Services

All four notification services are **self-developed real implementations with zero third-party SDKs** (using only Node built-in modules and the global `fetch`); they are enabled as soon as credentials are filled into `.env`. **When unconfigured they automatically degrade to Mock mode and write logs, never interrupting business processes**:

| Service | Implementation Highlights | When Unconfigured |
|------|---------|---------|
| SMS Notifications | Alibaba Cloud V1 signature (HMAC-SHA1) + Tencent Cloud TC3-HMAC-SHA256 | Mock writes logs |
| E-Signature | eSignBao Open Platform v3 (token cache + concurrent dedup + status mapping) | Mock writes logs |
| Email Notifications | Built-in SMTP client (node:tls/net, STARTTLS + RFC 2047 Chinese subject) | Mock writes logs |
| WeChat Notifications | Official account template messages (access_token cache + automatic retry on 40001) | Mock writes logs |
| ID Card Reader | Huashi CVR-100U: 32-bit Python bridge + built-in WHQL driver + structured API | Can switch to Mock mode |
| Smart Utility Meters | bzp.iyunmu.com prepaid platform integration, token synced within the session window | Platform account required |
| Bank Reconciliation / Payment Callbacks | Reserved Provider interfaces | Mock writes logs |

Algorithm self-check (no real account required): `cd backend && npx tsx ../scripts/verify-external-providers.ts` (21 test cases).

## Copyright & License

This project is proprietary software, protected by the Copyright Law of the People's Republic of China and international copyright treaties.

- **Permitted**: Personal study, research, education, and other non-commercial use
- **Prohibited**: Without explicit written authorization from the copyright holder, **any form of commercial use is strictly prohibited**, including but not limited to:
  - Selling, licensing, renting, or distributing this software or modified versions as a product/service to third parties
  - Deploying in for-profit organizations for daily business operations
  - Offering paid SaaS, hosting, implementation, or consulting services based on this software
  - Embedding this software into commercial products for distribution
  - Any direct or indirect act of deriving commercial benefit from this software

Violators will be held legally liable.

For commercial licensing, please contact the copyright holder via the GitHub platform.

See [LICENSE](./LICENSE) for details.

---

© 2025-2026 CONG1368. All Rights Reserved.
