# Fuel BI Dashboard - Multi-Tenant SaaS Platform

Real-time business intelligence dashboard for fuel station management with FIFO inventory tracking.

## Project Structure

```
1strev/
├── backend/
│   ├── data_pipeline/      # ERP automation & data collection
│   ├── fifo_engine/        # FIFO calculation logic
│   ├── parsers/            # Excel/PDF parsing
│   ├── utils/              # Shared utilities
│   └── scripts/            # Setup & maintenance scripts
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── utils/          # Frontend utilities
│   │   └── assets/         # Images, styles
│   └── public/             # Static files
├── docs/                   # Documentation
├── config/                 # Configuration files
└── PROJECT_PLAN.md         # Complete project specification

```

## Technology Stack

- **Frontend:** React 18 + Vite + React Bootstrap + Recharts
- **Backend/Database:** Supabase (PostgreSQL + Storage + Auth)
- **Data Pipeline:** Python 3.11+ + PyAutoGUI + OpenPyXL
- **Deployment:** Vercel (frontend) + Supabase (backend)

## Quick Start

### Phase 1: Supabase Setup (Week 1)
1. Create Supabase project
2. Run database schema
3. Configure Row-Level Security
4. Set up authentication

See `docs/SETUP_GUIDE.md` for detailed instructions.

## Features

### V1 (December Launch)
- ✅ Multi-tenant architecture (3 users per company)
- ✅ Real-time data updates (15-minute intervals)
- ✅ FIFO inventory tracking with true margin calculations
- ✅ Executive KPI dashboard
- ✅ Alert system (margin, stock, batch aging)
- ✅ Period comparisons (DoD, WoW, MoM, YoY)
- ✅ Super admin panel
- ✅ Mobile-responsive design

### V2 (Future)
- 📊 Advanced analytics & forecasting
- 🤖 AI-powered insights & recommendations
- 📧 Email/SMS alerts
- 📱 Native mobile app
- 💳 Billing integration
- 🌍 Multi-location support

## Development Timeline

- **Week 1 (Dec 2-8):** Multi-Tenant Foundation
- **Week 2 (Dec 9-15):** FIFO Engine & Data Pipeline
- **Week 3 (Dec 16-22):** Client Dashboard
- **Week 4 (Dec 23-29):** Admin Panel
- **Week 5 (Dec 30 - Jan 5):** Polish & Deploy

**Target:** Mid-December with 1 pilot company

## Documentation

- `PROJECT_PLAN.md` - Complete technical specification
- `docs/SETUP_GUIDE.md` - Step-by-step setup instructions
- `docs/DATABASE_SCHEMA.sql` - Complete database schema
- `docs/API_DOCUMENTATION.md` - API reference (coming soon)

## License

Proprietary - All rights reserved
