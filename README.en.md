[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md)

---

# Property Rental Management System

A full-stack desktop application for property rental management, covering property management, tenant management, rent collection & dunning, full contract lifecycle, financial accounting, and report analysis.

> **⚠ Copyright Notice**
>
> This project is for **personal study and research only**. Without explicit written authorization from the copyright holder, **any form of commercial use is strictly prohibited**
> (including but not limited to selling, licensing, renting, commercial hosting, SaaS services, integration into commercial products, etc.).
> Violators will be held legally liable. See [LICENSE](./LICENSE) for details.

## Tech Stack

| Layer | Technology |
|---|------|
| Frontend Framework | Vue 3 Composition API + TypeScript |
| UI Library | Element Plus |
| Charts | ECharts 5 + vue-echarts |
| State Management | Pinia |
| Backend Framework | Express + TypeScript |
| ORM | Sequelize 6 (SQLite by default, MySQL optional) |
| Authentication | JWT (access 4h + refresh 7d) |
| Scheduled Tasks | node-cron (bill generation / dunning / depreciation / contract expiry) |
| Real-time Communication | WebSocket |
| Desktop Packaging | Electron + electron-builder (NSIS installer) |

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
│       └── views/             # Page components
│           ├── dashboard/     # Home dashboard
│           ├── rent/          # Rental management
│           ├── finance/       # Financial management
│           ├── contract/      # Contract management
│           └── system/        # System settings
├── backend/                   # Express Backend (ESM)
│   └── src/
│       ├── models/            # Sequelize models (28+)
│       ├── routes/            # API routes (24+ modules)
│       ├── services/          # Business service layer (19+ services)
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
| Smart Dunning | Three-level dunning escalation, dunning task tracking, overdue marking |
| Door Lock Management | Smart locks (remote unlock / password management / battery monitoring), traditional locks (key borrow-return / loss-report / void workflow), audit logs |
| Printing | Contract / receipt / bill / tenant info printing, native system printing & PDF export, A4 / thermal receipt formats |
| Collection Dashboard | Collection rate, overdue rate, payment channel distribution, rent trend |
| Collection Calendar | Monthly collection calendar view, batch status overview |

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
| User Management | User CRUD, role-based permissions |
| Dictionary Management | System dictionary configuration |
| Print Settings | Company logo / stamp / name configuration, real-time preview |
| Audit Log | Operation audit trail |

## Scheduled Tasks

| Task | Schedule | Description |
|------|------|------|
| Bill Generation | Daily 02:00 | Auto-generate bills based on contract cycles |
| Dunning Escalation | Daily 08:00 | Auto-escalate overdue bill dunning levels |
| Contract Expiry | Daily 07:00 | Auto-update expiring contract status |
| Monthly Depreciation | 1st of month 02:00 | Monthly fixed asset depreciation |

## External Services (Mock Mode)

The following services currently run in mock mode (write to log files). Connect real SDKs to switch to production:

- E-signature (eSignBao / Fadada)
- SMS notifications (Alibaba Cloud SMS / Tencent Cloud SMS)
- WeChat / Email notifications (WeChat template messages / Nodemailer)
- Bank reconciliation
- Payment callbacks (WeChat Pay / Alipay)

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
