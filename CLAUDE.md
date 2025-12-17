# Executive Fuel BI Dashboard - Claude Code Context

## Quick Start (for new sessions)

```powershell
# Start backend API (Flask)
cd C:\FRCNC_Local\Thiago\1strev\backend\api
py app.py

# In another terminal - Start frontend (Vite)
cd C:\FRCNC_Local\Thiago\1strev\frontend
npm run dev
```

**Backend runs on:** http://localhost:5000
**Frontend runs on:** http://localhost:5173

---

## Project Overview

**What:** Multi-tenant SaaS dashboard for fuel station management (gas stations)
**Target:** Mid-December 2025 launch
**Stack:** React + Vite (frontend), Flask API (backend), Supabase (PostgreSQL + Auth)

### Key Features
- Real-time fuel sales tracking (15-min updates planned)
- **FIFO inventory costing** - accurate margin calculation
- Tracks fuel losses/gains (critical for true profitability)
- Multi-tenant with Row-Level Security (RLS)
- Dashboard tabs: Vendas, Compras, Estoque, Metas
- **KPI Configuration System** - set targets for volume, margin, revenue, mix

---

## Current Status (as of Dec 12, 2025)

### COMPLETED
- [x] Database schema (13+ tables with RLS)
- [x] Authentication (JWT tokens, bcrypt passwords)
- [x] Flask API with 30+ endpoints
- [x] FIFO Engine for cost allocation
- [x] Report parsers (purchases, sales, inventory, tank levels, accounts payable)
- [x] React frontend with login + dashboard
- [x] Dashboard tabs: Vendas, Compras, Estoque, Metas
- [x] Data import functionality
- [x] KPI Configuration System (Metas tab)
- [x] KPI Display in Vendas tab (progress cards, per-product targets)
- [x] Product standardization (consistent order across all tabs)
- [x] Product name normalization (handles trailing dots, alternate names)

### IN PROGRESS / TODO
- [ ] Automated ERP report collection (PyAutoGUI scripts exist)
- [ ] Task Scheduler setup (15-min intervals)
- [ ] Real-time subscriptions
- [ ] Super admin panel
- [ ] Production deployment (Vercel)
- [ ] Import missing ET (Etanol) purchase data around Nov 21-22 (~8,262 L missing)

---

## Project Structure

```
C:\FRCNC_Local\Thiago\1strev\
├── backend/
│   ├── api/
│   │   └── app.py              # Flask API (main entry point)
│   ├── auth/
│   │   └── auth_service.py     # JWT authentication
│   ├── fifo/
│   │   └── fifo_engine.py      # FIFO cost allocation
│   ├── parsers/                # ERP report parsers
│   │   ├── parse_daily_sales.py
│   │   ├── parse_purchases.py
│   │   ├── parse_inventory.py
│   │   ├── parse_tank_levels.py
│   │   └── parse_accounts_payable.py
│   ├── automation/             # ERP automation scripts
│   │   └── download_reports.py
│   ├── migrations/             # SQL migration files
│   │   └── create_kpis_table.sql  # KPIs table with CHECK constraints
│   └── data_import/
│       └── import_service.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main React app with routing
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx   # Main dashboard container
│   │   │   ├── FIFOReport.jsx
│   │   │   ├── ProductAnalysis.jsx
│   │   │   └── DataImport.jsx
│   │   ├── components/tabs/    # Dashboard tabs
│   │   │   ├── Vendas.jsx      # Sales (KPI progress cards, per-product targets)
│   │   │   ├── Compras.jsx     # Purchases
│   │   │   ├── Estoque.jsx     # Inventory
│   │   │   └── Metas.jsx       # KPI Configuration UI
│   │   └── services/
│   │       ├── api.js          # Axios instance
│   │       ├── auth.js         # Auth service
│   │       └── dashboardApi.js # Dashboard data + KPIs + product utilities
│   └── package.json
├── config/
│   └── .env.local              # Environment variables (Supabase keys)
└── docs/
    ├── DATABASE_SCHEMA.sql
    └── AUTH_FUNCTIONS.sql
```

---

## KPI Configuration System

### Overview
The Metas tab provides a table-based UI for configuring KPI targets. KPIs are displayed in the Vendas tab with progress tracking.

### KPI Types (Database Constraint)
The `kpis` table has a CHECK constraint allowing only these `kpi_type` values:
- `sales_volume` - Volume Mensal (liters)
- `margin` - Margem Bruta (percentage)
- `revenue` - Lucro Bruto (R$)
- `cost` - Mix de Aditivados (percentage) - repurposed for mix tracking

### How KPIs Work

**Metas Tab (Configuration):**
- Table-based input with rows for TOTAL + each product
- `InputCell` component moved outside render function (prevents focus loss)
- Uses `modifiedKeys` Set to track changes - only saves modified values
- Saves to Supabase `kpis` table with `kpi_type` and `product_code`

**Vendas Tab (Display):**
- "Metas do Mes" section shows progress cards for total KPIs
- Per-product table shows volume/margin/lucro targets with color coding
- Colors based on meta achievement:
  - Green: achieved (current >= target)
  - Red/Warning: below target
- Metric cards show meta values when configured

### Key Functions

**dashboardApi.js:**
- `fetchKpis()` - Fetches all KPIs for company
- `PRODUCT_ORDER = ['GC', 'GA', 'ET', 'DS10', 'DS500']` - Standard product order
- `normalizeProductName(name)` - Removes trailing dots, fixes alternate names
- `sortProductsByStandardOrder(products, codeField)` - Sorts products consistently

**Vendas.jsx:**
- `getKpiTarget(kpiType, productCode)` - Gets target value from KPIs array
- `getProductCode(productName)` - Maps product name to code (with normalization fallback)
- `getVolumeTarget(productName)` - Gets sales_volume KPI for product
- `getMarginTarget(productName)` - Gets margin KPI for product
- `getRevenueTarget(productName)` - Gets revenue KPI for product
- `getMixTarget(category)` - Gets cost KPI for mix category

### Product Code Mapping
```javascript
const productNameToCode = {
  'GASOLINA COMUM': 'GC',
  'GASOLINA ADITIVADA': 'GA',
  'ETANOL': 'ET',
  'DIESEL S10': 'DS10',
  'DIESEL S500': 'DS500'
}
```

---

## Database Tables (Supabase)

### Core Tables
- `companies` - Tenant management
- `users` - Auth with company_id foreign key
- `products` - Fuel products (GC, GA, ET, DS10, DS500, etc.)

### Transaction Tables
- `purchases` - Fuel purchase records
- `pump_sales_intraday` - Daily pump sales
- `fuel_purchases` - FIFO batch tracking

### Inventory Tables
- `current_inventory` - Current stock levels
- `current_tank_levels` - Real tank sensor data
- `inventory_adjustments` - Losses/gains tracking

### KPIs Table
- `kpis` - Performance targets with CHECK constraints:
  - `kpi_type`: sales_volume, revenue, margin, cost, inventory_min, inventory_max
  - `period_type`: daily, weekly, monthly, quarterly, yearly
  - `status`: active, inactive, achieved, missed

### Other
- `accounts_payable` - Supplier invoices
- `company_settings` - Per-company configuration
- `access_logs` - Usage tracking

---

## API Endpoints (Flask - port 5000)

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/auth/me` - Get current user info

### Dashboard Data
- `GET /api/dashboard/vendas` - Sales dashboard
- `GET /api/dashboard/compras` - Purchases dashboard
- `GET /api/dashboard/estoque` - Inventory dashboard
- `GET /api/dashboard/estoque/evolution` - Stock evolution chart data

### FIFO
- `GET /api/fifo/report` - FIFO profit/loss report
- `GET /api/fifo/product-analysis` - Per-product FIFO analysis
- `GET /api/fifo/settings` - Company FIFO settings
- `POST /api/fifo/settings` - Update FIFO start date

### Data
- `GET /api/purchases` - Get purchases
- `GET /api/sales` - Get sales
- `GET /api/inventory` - Get inventory
- `GET /api/products` - Get products

### KPIs
- `GET /api/kpis` - Get all KPIs
- `POST /api/kpis` - Create KPI
- `PUT /api/kpis/<id>` - Update KPI
- `DELETE /api/kpis/<id>` - Delete KPI

### Settings
- `GET /api/settings` - Get company settings
- `PUT /api/settings` - Update settings

---

## Test Credentials

**Test Manager:**
- Email: manager@testcompany.com
- Password: TestPass123!
- Company: TEST001

**Test Analyst:**
- Email: analyst@testcompany.com
- Password: TestPass123!

**Test Viewer:**
- Email: viewer@testcompany.com
- Password: TestPass123!

---

## Common Commands

```powershell
# Backend
cd C:\FRCNC_Local\Thiago\1strev\backend\api
py app.py

# Frontend
cd C:\FRCNC_Local\Thiago\1strev\frontend
npm run dev

# Run all parsers
cd C:\FRCNC_Local\Thiago\1strev\backend
py run_all_parsers.py

# Test authentication
cd C:\FRCNC_Local\Thiago\1strev\backend\auth
py test_auth.py

# Test API endpoints
cd C:\FRCNC_Local\Thiago\1strev\backend
py test_endpoints.py

# Query database directly (when API unavailable)
py -c "
from supabase import create_client
import os
with open('config/.env.local', 'r') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            key, val = line.strip().split('=', 1)
            os.environ[key] = val
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
supabase = create_client(url, key)
result = supabase.table('kpis').select('*').execute()
print(result.data)
"
```

---

## Key Business Logic

### FIFO (First-In-First-Out)
- Fuel is tracked in purchase batches
- When sold, cost is calculated from oldest batches first
- This gives TRUE margin (not just sale price - avg cost)
- Critical for accurate profitability reporting

### Losses/Gains Tracking
- Fuel evaporates, leaks, or has measurement errors
- Without tracking losses, margins are WRONG
- Example: 185L gasoline loss = hidden cost!

### Product Codes
- GC = Gasolina Comum (Regular Gas)
- GA = Gasolina Aditivada (Premium Gas)
- ET = Etanol (Ethanol)
- EA = Etanol Aditivado (Premium Ethanol) - **EXCLUDED from UI** (company doesn't sell)
- DS10 = Diesel S10
- DS500 = Diesel S500

### Standard Product Order
All tabs display products in this order: GC, GA, ET, DS10, DS500
- Implemented via `sortProductsByStandardOrder()` in dashboardApi.js
- Consistent across Vendas, Compras, Estoque, Metas tabs

### Product Name Normalization
Database has inconsistent product names:
- "DIESEL S500." (trailing dot) vs "DIESEL S500"
- "Diesel comum" vs "DIESEL S500"

`normalizeProductName()` function handles this:
- Removes trailing dots and whitespace
- Maps alternate names to canonical names

---

## Environment Variables

Located in `config/.env.local`:
```
SUPABASE_URL=https://jpjspmcmsnzvbfnanbyy.supabase.co
SUPABASE_ANON_KEY=[key]
SUPABASE_SERVICE_KEY=[key]
JWT_SECRET=[secret]
NODE_ENV=development
PORT=5173
```

---

## Known Issues / Notes

1. **Database has duplicate products** - 13 products when 6 expected (same product with different codes like `000001` vs `GC`)
2. **Product names inconsistent** - Some have trailing dots, some use alternate names
3. **No refresh tokens yet** - JWT expires in 24h
4. **ERP automation not fully automated** - Manual trigger needed
5. **Hardcoded dates in some parsers** - Need to extract from report files

---

## Key Learnings / Patterns

### React Component Anti-Pattern (Fixed)
**NEVER define components inside render function** - they get recreated each render, causing focus loss.
- InputCell in Metas.jsx was originally inside the component
- Moved outside with `memo()` wrapper
- Use `useCallback` for event handlers passed as props

### KPI Type Mapping
Database CHECK constraint limits kpi_type values. Frontend must use exact values:
- `sales_volume` (not `volume_mensal`)
- `margin` (not `margem_bruta`)
- `revenue` (not `lucro_bruto`)
- `cost` (repurposed for mix_aditivados)

### Tracking Modifications
Use `Set<string>` for tracking modified items:
```javascript
const [modifiedKeys, setModifiedKeys] = useState(new Set())
// On change:
setModifiedKeys(prev => new Set([...prev, key]))
// On save: iterate only modifiedKeys
```

### Product Code Lookup with Fallback
When DB returns names with inconsistencies, use fallback normalization:
```javascript
const getProductCode = (productName) => {
  if (productNameToCode[productName]) return productNameToCode[productName]
  const normalized = normalizeProductName(productName)
  return productNameToCode[normalized] || null
}
```

---

## Development Phases (from PROJECT_PLAN.md)

- **Phase 1:** Multi-Tenant Foundation - DONE
- **Phase 2:** FIFO Engine & Data Pipeline - MOSTLY DONE
- **Phase 3:** Client Dashboard Core - IN PROGRESS
- **Phase 4:** Super Admin Panel - NOT STARTED
- **Phase 5:** Polish & Production Deploy - NOT STARTED

---

## Last Session Notes

*Update this section at the end of each session:*

**Date:** Dec 12, 2025
**What was done:**
- **KPI Progress Cards Fix:**
  - Fixed "Metas do Mes" section using wrong KPI type names
  - Changed `volume_mensal` → `sales_volume`, `lucro_bruto` → `revenue`, `margem_bruta` → `margin`
  - Progress cards now display when TOTAL KPIs are configured

- **Enhanced KPI Display in Vendas:**
  - Margem Bruta column: color now based on meta (green if >= meta, red if below)
  - Lucro Bruto column: added meta display with color coding
  - Volume Total card: shows meta value and changes color based on achievement
  - Lucro Bruto Total card: shows meta value and changes color based on achievement
  - Added `getRevenueTarget()` function for per-product revenue targets

- **KPI Total Bug Fix:**
  - Fixed bug where total KPI was applied to wrong product (DIESEL S500)
  - Root cause: `productNameToCode` returned `undefined` for names with trailing dots
  - `undefined` is falsy, so `getKpiTarget()` matched total KPI (product_code=null)
  - Solution: Added `getProductCode()` helper with normalization fallback

**Key files modified:**
- `frontend/src/components/tabs/Vendas.jsx` - KPI display enhancements, bug fixes

**What's next:**
- Import missing ET (Etanol) purchase data around Nov 21-22 (~8,262 L missing)
- Continue with real-time subscriptions or super admin panel

---

**Date:** Dec 10, 2025
**What was done:**
- **KPI/Metas System Overhaul:**
  - Redesigned Metas tab with simple table-based UI (minimal typing required)
  - 4 KPI types: Volume Mensal (L), Margem Bruta (%), Mix de Aditivados (%), Lucro Bruto (R$)
  - Side-by-side layout (2 columns) for better UX
  - Button shows "Salvar X Meta(s)" - only saves modified values
  - Fixed InputCell focus loss bug (moved component outside render)

- **Product Standardization:**
  - All tabs now use consistent product order (GC, GA, ET, DS10, DS500)
  - Added `PRODUCT_ORDER` constant and `sortProductsByStandardOrder()` function
  - Added `normalizeProductName()` for handling database inconsistencies

- **Compras Tab Improvements:**
  - Fixed status badge: zero/null variation now shows "Otimo"
  - When "Todos os Produtos" selected, shows all 5 fuels including those with 0 purchases

- **Etanol Aditivado (EA) Excluded:**
  - This company doesn't sell EA - excluded from dashboard display
  - NOT removed from database (other companies may use it)

---

**Date:** Dec 9, 2025
**What was done:**
- Added `tank_capacity` column to Estoque tab table with occupation percentage
- Created `/api/dashboard/estoque/evolution` endpoint for stock evolution chart
- Updated Estoque tab chart to use real calculated data
- Imported missing sales data (Dec 5-8) and purchase data

---

## Quick Recovery After Crash

If the server was running when crashed:
1. Check if port 5000 is still in use: `netstat -ano | findstr :5000`
2. Kill process if needed: `taskkill /PID <pid> /F`
3. Restart backend: `cd backend/api && py app.py`
4. Restart frontend: `cd frontend && npm run dev`

## File Quick Reference

### Frontend Key Files
| File | Purpose |
|------|---------|
| `dashboardApi.js` | API calls, `fetchKpis()`, `PRODUCT_ORDER`, `normalizeProductName()`, `sortProductsByStandardOrder()` |
| `Vendas.jsx` | Sales dashboard, KPI progress cards, per-product targets |
| `Compras.jsx` | Purchases dashboard, status badges |
| `Estoque.jsx` | Inventory dashboard, stock evolution chart |
| `Metas.jsx` | KPI configuration UI, InputCell component |

### Backend Key Files
| File | Purpose |
|------|---------|
| `app.py` | Flask API entry point, all endpoints |
| `create_kpis_table.sql` | KPI table schema with CHECK constraints |
