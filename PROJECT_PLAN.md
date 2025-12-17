# Executive Fuel BI Dashboard - Multi-Tenant SaaS
## Target Release: Mid-December 2025

---

## Project Overview

**Business Model:** Multi-tenant SaaS product for fuel station management

**Target Users:**
- C-level executives and management teams at fuel companies
- 3 user accounts per company
- Super admin (you) with full system access

**Core Value Proposition:**
- Real-time business intelligence (15-minute updates)
- FIFO-based accurate margin tracking
- 5-year historical data retention
- Competitive advantage through real-time insights

**Key Focus Areas:**
- 📊 Productivity tracking
- 📦 Stock/Inventory management (FIFO system)
- 💰 Financial performance
- 💵 Product costs & true margins
- 📈 Revenue analytics with alerts

---

## System Architecture

### Multi-Tenant SaaS Model

```
┌─────────────────────────────────────────────────────────┐
│           SUPER ADMIN PANEL (Product Owner)             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Company Management                             │   │
│  │  - Add/edit/delete companies                    │   │
│  │  - Manage users (3 per company)                 │   │
│  │  - View any company dashboard                   │   │
│  │                                                  │   │
│  │  Analytics & Monitoring                         │   │
│  │  - Usage tracking (who, when, what)             │   │
│  │  - Login frequency                              │   │
│  │  - System health                                │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Company A   │    │  Company B   │    │  Company C   │
│  Dashboard   │    │  Dashboard   │    │  Dashboard   │
│              │    │              │    │              │
│  3 users     │    │  3 users     │    │  3 users     │
│  Own data    │    │  Own data    │    │  Own data    │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────┐
│      CENTRALIZED SUPABASE DATABASE (RLS)             │
│  ┌──────────────────────────────────────────────┐   │
│  │  Company A Data (company_id=1)              │   │
│  │  Company B Data (company_id=2)              │   │
│  │  Company C Data (company_id=3)              │   │
│  │                                              │   │
│  │  Row-Level Security enforces isolation      │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 + Vite (fast development & HMR)
- React Bootstrap (professional UI components)
- Recharts (interactive data visualization)
- React Router v6 (navigation & routing)
- Axios (API communication)

**Backend/Database:**
- Supabase (PostgreSQL + Storage + Auth)
- Row-Level Security (RLS) for tenant isolation
- Real-time subscriptions (15-min updates)
- Secure REST API

**Data Pipeline:**
- Python 3.11+ (automation & parsing)
- PyAutoGUI (ERP automation)
- OpenPyXL (Excel parsing)
- Supabase Python SDK
- Windows Task Scheduler (automated execution)

**Deployment:**
- Vercel (frontend hosting, serverless)
- Custom domain (GoDaddy DNS)
- HTTPS/SSL enabled
- Environment-based configuration

---

## Database Schema

### Multi-Tenant Core Tables

#### 1. Companies (Tenant Management)
```sql
CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    company_code TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    subscription_tier TEXT DEFAULT 'standard',
    onboarding_date DATE DEFAULT CURRENT_DATE,
    data_retention_years INT DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_code ON companies(company_code);
```

#### 2. Users (Authentication & Access Control)
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('super_admin', 'user')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    login_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- RLS Policy: Users can only see users from their company
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_company_isolation ON users
    FOR SELECT
    USING (
        company_id = current_setting('app.current_company_id')::BIGINT
        OR current_setting('app.user_role') = 'super_admin'
    );
```

#### 3. Access Logs (Usage Tracking)
```sql
CREATE TABLE access_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    company_id BIGINT REFERENCES companies(id),
    page_accessed TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    session_duration INT, -- seconds
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_access_company_date ON access_logs(company_id, accessed_at DESC);
CREATE INDEX idx_access_user ON access_logs(user_id, accessed_at DESC);

-- Partition by month for performance
CREATE TABLE access_logs_2025_12 PARTITION OF access_logs
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
```

### FIFO System Tables

#### 4. Fuel Purchase Batches
```sql
CREATE TABLE fuel_purchases (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    product_name TEXT NOT NULL,
    purchase_date TIMESTAMPTZ NOT NULL,
    supplier TEXT NOT NULL,
    volume_purchased DECIMAL(10,2) NOT NULL CHECK (volume_purchased > 0),
    cost_per_liter DECIMAL(8,4) NOT NULL CHECK (cost_per_liter > 0),
    total_cost DECIMAL(12,2) NOT NULL,
    remaining_volume DECIMAL(10,2) NOT NULL CHECK (remaining_volume >= 0),
    batch_status TEXT DEFAULT 'active' CHECK (batch_status IN ('active', 'depleted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, batch_number)
);

CREATE INDEX idx_purchases_company_product ON fuel_purchases(company_id, product_name, purchase_date);
CREATE INDEX idx_purchases_status ON fuel_purchases(company_id, batch_status, product_name);
CREATE INDEX idx_purchases_fifo ON fuel_purchases(company_id, product_name, purchase_date)
    WHERE batch_status = 'active';

-- RLS Policy
ALTER TABLE fuel_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_company_isolation ON fuel_purchases
    FOR ALL
    USING (
        company_id = current_setting('app.current_company_id')::BIGINT
        OR current_setting('app.user_role') = 'super_admin'
    );
```

#### 5. Fuel Sales (Intraday - Cleared Daily)
```sql
CREATE TABLE fuel_sales_intraday (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    transaction_number TEXT,
    product_name TEXT NOT NULL,
    sale_timestamp TIMESTAMPTZ NOT NULL,
    volume_sold DECIMAL(10,2) NOT NULL CHECK (volume_sold > 0),
    sale_price_per_liter DECIMAL(8,4) NOT NULL CHECK (sale_price_per_liter > 0),
    total_revenue DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, transaction_number)
);

CREATE INDEX idx_sales_intraday_company_time ON fuel_sales_intraday(company_id, sale_timestamp DESC);
CREATE INDEX idx_sales_intraday_product ON fuel_sales_intraday(company_id, product_name, sale_timestamp);

-- RLS Policy
ALTER TABLE fuel_sales_intraday ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_intraday_company_isolation ON fuel_sales_intraday
    FOR ALL
    USING (
        company_id = current_setting('app.current_company_id')::BIGINT
        OR current_setting('app.user_role') = 'super_admin'
    );
```

#### 6. FIFO Cost Allocation (Intraday)
```sql
CREATE TABLE fuel_cost_allocation_intraday (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    sale_id BIGINT REFERENCES fuel_sales_intraday(id) ON DELETE CASCADE,
    purchase_batch_id BIGINT REFERENCES fuel_purchases(id),
    volume_allocated DECIMAL(10,2) NOT NULL CHECK (volume_allocated > 0),
    cost_per_liter DECIMAL(8,4) NOT NULL,
    allocated_cost DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_allocation_intraday_sale ON fuel_cost_allocation_intraday(sale_id);
CREATE INDEX idx_allocation_intraday_batch ON fuel_cost_allocation_intraday(purchase_batch_id);

-- RLS Policy
ALTER TABLE fuel_cost_allocation_intraday ENABLE ROW LEVEL SECURITY;

CREATE POLICY allocation_intraday_company_isolation ON fuel_cost_allocation_intraday
    FOR ALL
    USING (
        company_id = current_setting('app.current_company_id')::BIGINT
        OR current_setting('app.user_role') = 'super_admin'
    );
```

### Daily Aggregated Tables (Permanent - 5 Year Retention)

#### 7. Daily Summary (Business Performance)
```sql
CREATE TABLE daily_summary (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_cogs DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
    avg_margin_percent DECIMAL(5,2),
    total_volume_sold DECIMAL(10,2) NOT NULL DEFAULT 0,
    transaction_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, summary_date)
);

CREATE INDEX idx_summary_company_date ON daily_summary(company_id, summary_date DESC);

-- RLS Policy
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY summary_company_isolation ON daily_summary
    FOR ALL
    USING (
        company_id = current_setting('app.current_company_id')::BIGINT
        OR current_setting('app.user_role') = 'super_admin'
    );
```

#### 8. Product Performance (Daily by Product)
```sql
CREATE TABLE product_performance_daily (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    performance_date DATE NOT NULL,
    volume_sold DECIMAL(10,2) NOT NULL DEFAULT 0,
    revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    cogs DECIMAL(12,2) NOT NULL DEFAULT 0,
    profit DECIMAL(12,2) NOT NULL DEFAULT 0,
    margin_percent DECIMAL(5,2),
    avg_price_per_liter DECIMAL(8,4),
    transaction_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, product_name, performance_date)
);

CREATE INDEX idx_performance_company_product_date ON product_performance_daily(
    company_id, product_name, performance_date DESC
);

-- RLS Policy
ALTER TABLE product_performance_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY performance_company_isolation ON product_performance_daily
    FOR ALL
    USING (
        company_id = current_setting('app.current_company_id')::BIGINT
        OR current_setting('app.user_role') = 'super_admin'
    );
```

#### 9. Current Inventory (Real-time Stock)
```sql
CREATE TABLE current_inventory (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    total_volume DECIMAL(10,2) NOT NULL DEFAULT 0,
    inventory_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    avg_cost_per_liter DECIMAL(8,4),
    oldest_batch_date DATE,
    oldest_batch_age_days INT,
    active_batches_count INT DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, product_name)
);

CREATE INDEX idx_inventory_company ON current_inventory(company_id);

-- RLS Policy
ALTER TABLE current_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_company_isolation ON current_inventory
    FOR ALL
    USING (
        company_id = current_setting('app.current_company_id')::BIGINT
        OR current_setting('app.user_role') = 'super_admin'
    );
```

#### 10. Uploaded Reports (File Tracking)
```sql
CREATE TABLE uploaded_reports (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('purchase', 'sales', 'inventory')),
    report_timestamp TIMESTAMPTZ NOT NULL,
    file_size BIGINT,
    processing_status TEXT DEFAULT 'pending' CHECK (
        processing_status IN ('pending', 'processing', 'completed', 'failed')
    ),
    error_message TEXT,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_company_type_date ON uploaded_reports(
    company_id, report_type, report_timestamp DESC
);
CREATE INDEX idx_reports_status ON uploaded_reports(processing_status);

-- RLS Policy
ALTER TABLE uploaded_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_company_isolation ON uploaded_reports
    FOR ALL
    USING (
        company_id = current_setting('app.current_company_id')::BIGINT
        OR current_setting('app.user_role') = 'super_admin'
    );
```

---

## Data Collection Schedule

### Complete Daily Schedule (No Data Loss)

**Real-time Updates (Every 15 minutes):**
```
00:00, 00:15, 00:30, 00:45
01:00, 01:15, 01:30, 01:45
...
23:00, 23:15, 23:30, 23:45
23:59  ← End-of-day report (captures 23:45-23:59)
```

**Daily Aggregation & Cleanup:**
```
00:01 AM (12:01 AM):
  1. Aggregate all intraday data to daily tables
  2. Update daily_summary
  3. Update product_performance_daily
  4. Update current_inventory
  5. Delete intraday sales records
  6. Delete processed report files (keep metadata)
  7. Mark batches as 'depleted' if remaining_volume = 0
```

### Task Scheduler Configuration

**Task 1: Regular Reports (Every 15 Minutes)**
- **Trigger:** Daily, repeat every 15 minutes for 23 hours 45 minutes
- **Start:** 00:00
- **End:** 23:45
- **Script:** `run_data_collection.py --company-id={id}`

**Task 2: End-of-Day Report**
- **Trigger:** Daily at 23:59
- **Script:** `run_data_collection.py --company-id={id} --eod`

**Task 3: Daily Aggregation**
- **Trigger:** Daily at 00:01 AM
- **Script:** `aggregate_daily_data.py --all-companies`

**Per Company Setup:**
Each company gets 3 scheduled tasks (Tasks 1-3 with company-specific parameters)

---

## FIFO System Logic

### Initialization (One-time per company)
```python
1. Load all historical purchase records (sorted by date)
2. Load all historical sales records (sorted by date)
3. Process each sale chronologically:
   - Find oldest active batch for that product
   - Allocate volume using FIFO
   - Update remaining_volume
   - Record cost allocation
4. Calculate current inventory state
5. Set initial batch statuses
```

### Real-time Processing (Every 15 minutes)
```python
def process_new_sales(company_id, sales_data):
    for sale in sales_data:
        remaining_volume = sale.volume_sold
        allocations = []

        # Get oldest active batches for this product
        batches = get_active_batches(
            company_id,
            sale.product_name,
            order_by='purchase_date ASC'
        )

        for batch in batches:
            if remaining_volume <= 0:
                break

            # Allocate from this batch
            allocated = min(batch.remaining_volume, remaining_volume)

            allocations.append({
                'batch_id': batch.id,
                'volume': allocated,
                'cost_per_liter': batch.cost_per_liter,
                'total_cost': allocated * batch.cost_per_liter
            })

            # Update batch
            batch.remaining_volume -= allocated
            if batch.remaining_volume == 0:
                batch.status = 'depleted'

            remaining_volume -= allocated

        # Record sale and allocations
        save_sale(sale, allocations)

        # Update inventory
        update_current_inventory(company_id, sale.product_name)
```

---

## Dashboard Features

### Executive Dashboard (Company View)

**1. KPI Summary Cards**
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  Today's        │  Today's        │  Average        │  Inventory      │
│  Revenue        │  Profit         │  Margin         │  Value          │
│                 │                 │                 │                 │
│  R$ 245,320     │  R$ 28,450      │  11.6%          │  R$ 476,246     │
│  ↑ 5.2% vs Yest │  ↑ 8.1% vs Yest │  ↓ 0.3% vs Yest │  2.8 days stock │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

**2. Alert System (Simple & Clear)**
```
┌──────────────────────────────────────────────────────────────┐
│  🚨 Active Alerts (3)                                        │
├──────────────────────────────────────────────────────────────┤
│  🔴 CRITICAL: DIESEL S10 margin at 7.2% (threshold: 8.0%)   │
│  🟡 WARNING: ETANOL stock at 2.3 days (threshold: 3 days)   │
│  🔵 INFO: Oldest GASOLINA batch is 16 days old              │
└──────────────────────────────────────────────────────────────┘
```

**3. Revenue & Margin Trends**
- Line charts with DoD, WoW, MoM, YoY comparisons
- Product-level breakdown
- True margin based on FIFO costs

**4. Stock Analysis**
- Current inventory by product
- FIFO valuation
- Batch aging visualization
- Days of inventory remaining

**5. Product Performance**
- Sales volume by product
- Margin % by product
- Revenue contribution
- Top/bottom performers

### Super Admin Panel

**1. Company Management**
```
┌────────────────────────────────────────────────────────────┐
│  Companies (5)                         [+ Add Company]     │
├────────────────────────────────────────────────────────────┤
│  Company A      Active    3 users    Last login: 2h ago   │
│  Company B      Active    3 users    Last login: 5m ago   │
│  Company C      Active    2 users    Last login: 1d ago   │
│  Company D      Suspended 3 users    Last login: 15d ago  │
│  Company E      Active    1 user     Last login: 30m ago  │
└────────────────────────────────────────────────────────────┘
```

**2. Usage Analytics**
- Active users by company
- Login frequency
- Most viewed pages
- Session duration
- Engagement metrics

**3. System Monitoring**
- Data pipeline health
- Failed uploads
- Processing errors
- Storage usage

**4. Dashboard Impersonation**
- View any company's dashboard
- Troubleshoot issues
- Verify data accuracy

---

## Development Phases

### Phase 1: Multi-Tenant Foundation (Week 1: Dec 2-8)
**Goal:** Core infrastructure with tenant isolation

**Tasks:**
- [ ] Create Supabase project
- [ ] Set up database schema (all tables)
- [ ] Configure Row-Level Security (RLS)
- [ ] Implement authentication system
- [ ] Create super admin account
- [ ] Add first test company
- [ ] Test data isolation

**Deliverables:**
- Working database with RLS
- Authentication flow
- Test company dashboard (basic)

---

### Phase 2: FIFO Engine & Data Pipeline (Week 2: Dec 9-15)
**Goal:** Automated data collection and FIFO calculations

**Tasks:**
- [ ] Port ERP automation from 4tabs project
- [ ] Make company-aware (accept company_id parameter)
- [ ] Excel parsing for purchases
- [ ] Excel parsing for sales
- [ ] FIFO allocation engine
- [ ] Historical data initialization script
- [ ] Set up Task Scheduler (00:00-23:45, 23:59, 00:01)
- [ ] Error handling & logging
- [ ] Test with real company data

**Deliverables:**
- Automated data pipeline for 1 company
- FIFO system working correctly
- Historical data loaded

---

### Phase 3: Client Dashboard Core (Week 3: Dec 16-22)
**Goal:** Essential executive views with alerts

**Tasks:**
- [ ] React app setup (Vite + Router)
- [ ] Login page
- [ ] Homepage with KPI cards
- [ ] Alert system (color-coded)
- [ ] Revenue & margin charts
- [ ] Stock analysis dashboard
- [ ] Product performance breakdown
- [ ] Period comparison selectors (DoD, WoW, MoM, YoY)
- [ ] Responsive design (mobile-friendly)
- [ ] Company name customization
- [ ] Real-time data updates (15-min refresh)

**Deliverables:**
- Functional executive dashboard
- All critical features (margins, stock, sales)
- Mobile-responsive

---

### Phase 4: Super Admin Panel (Week 4: Dec 23-29)
**Goal:** Multi-company management

**Tasks:**
- [ ] Admin dashboard UI
- [ ] Company CRUD operations
- [ ] User management (3 per company)
- [ ] Usage analytics views
- [ ] Access logs tracking
- [ ] Dashboard impersonation feature
- [ ] System health monitoring
- [ ] Bulk company onboarding tools

**Deliverables:**
- Complete admin panel
- Company management workflow
- Usage analytics

---

### Phase 5: Polish & Production Deploy (Week 5: Dec 30 - Jan 5)
**Goal:** Production-ready system

**Tasks:**
- [ ] Performance optimization
  - [ ] Database query optimization
  - [ ] Index tuning
  - [ ] Caching strategy
- [ ] Security audit
  - [ ] RLS policy review
  - [ ] SQL injection prevention
  - [ ] XSS protection
  - [ ] Password policies
- [ ] User testing with pilot companies
- [ ] Bug fixes
- [ ] Documentation
  - [ ] User guide
  - [ ] Admin guide
  - [ ] Onboarding checklist
- [ ] Vercel deployment
- [ ] Custom domain setup
- [ ] SSL certificate
- [ ] Training materials

**Deliverables:**
- Production deployment
- Complete documentation
- Launch-ready system

---

## Key Performance Indicators

### Executive Dashboard Metrics

**Financial Performance:**
- Today's Revenue (vs Yesterday %)
- Today's Profit (vs Yesterday %)
- Average Margin % (FIFO-based)
- Revenue Trend (7/30/90 days)
- Profit Trend (7/30/90 days)

**Inventory Management:**
- Current Inventory Value
- Days of Inventory Remaining
- Oldest Batch Age
- Low Stock Alerts
- Stock Turnover Rate

**Product Analytics:**
- Sales Volume by Product
- Margin % by Product
- Revenue Contribution %
- Top Performing Products
- Underperforming Products

**Alerts & Notifications:**
- Margin Below Threshold
- Low Stock Warning
- Old Batch Alert
- Price Anomaly Detection

### Admin Panel Metrics

**Company Health:**
- Active Companies
- Suspended Companies
- Total Users
- Companies by Engagement Level

**Usage Analytics:**
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Average Session Duration
- Most Viewed Pages
- Peak Usage Times

**System Performance:**
- Data Pipeline Success Rate
- Failed Uploads Count
- Processing Errors
- Average Response Time
- Database Storage Used

---

## Data Retention Policy

**Intraday Data (Deleted Daily at 00:01 AM):**
- fuel_sales_intraday
- fuel_cost_allocation_intraday
- uploaded_reports (files, keep metadata)

**Permanent Data (5 Year Retention):**
- daily_summary
- product_performance_daily
- fuel_purchases (purchase batches)
- current_inventory
- companies
- users
- access_logs (partitioned by month)

**Automated Cleanup:**
```sql
-- Run daily at 00:01 AM
DELETE FROM fuel_sales_intraday
WHERE sale_timestamp < CURRENT_DATE;

DELETE FROM fuel_cost_allocation_intraday
WHERE created_at < CURRENT_DATE;

-- Archive old access logs (>5 years)
DELETE FROM access_logs
WHERE accessed_at < CURRENT_DATE - INTERVAL '5 years';
```

---

## Security Considerations

**Row-Level Security (RLS):**
- All data tables enforce company_id isolation
- Super admin can access all data
- Regular users can only access their company data

**Authentication:**
- Bcrypt password hashing
- Session-based authentication
- JWT tokens (optional for API)
- Password complexity requirements

**API Security:**
- Supabase API key protection
- Environment variables for secrets
- CORS configuration
- Rate limiting

**Data Privacy:**
- No cross-company data sharing
- Audit logs for admin access
- Secure file storage
- HTTPS only

---

## Scalability Considerations

**Database:**
- Indexed queries
- Partitioned tables (access_logs)
- Connection pooling
- Query optimization

**Storage:**
- Daily cleanup reduces storage
- 5-year retention manageable
- Supabase storage limits (check plan)

**Performance:**
- Cached aggregations
- Materialized views for complex queries
- CDN for static assets (Vercel)
- Lazy loading for dashboards

---

## Success Criteria

### Must-Have for Mid-December Launch:
- ✅ Multi-tenant architecture working
- ✅ Authentication & RLS functional
- ✅ Real-time data updates (15-min + 23:59)
- ✅ FIFO inventory tracking accurate
- ✅ True margin calculations
- ✅ Alert system operational
- ✅ Executive dashboard with all KPIs
- ✅ Mobile-friendly interface
- ✅ Super admin panel (basic)
- ✅ At least 1 pilot company live

### Nice-to-Have (Can Wait for v2):
- 📊 Advanced analytics & forecasting
- 📧 Email/SMS alerts
- 👥 More granular user roles
- 📱 Native mobile app
- 🔔 Push notifications
- 💳 Billing integration
- 📈 Predictive analytics
- 🌍 Multi-location support per company

---

## Risk Management

**Technical Risks:**
1. **RLS complexity** → Test thoroughly, document policies
2. **Data pipeline failures** → Robust error handling, alerts
3. **Performance with multiple companies** → Optimize early, monitor
4. **ERP changes** → Flexible parsers, version detection

**Business Risks:**
1. **Timeline pressure** → Focus on MVP, prioritize ruthlessly
2. **Scope creep** → Lock features for v1, parking lot for v2
3. **Data accuracy** → Validation layer, reconciliation reports
4. **User adoption** → Simple UI, training materials

**Mitigation Strategies:**
- Weekly progress reviews
- Daily standups (self-check)
- Automated testing
- Incremental deployment
- Pilot company feedback
- Clear feature prioritization

---

## Project Timeline

**Week 1 (Dec 2-8):** Multi-Tenant Foundation
- Database setup
- Authentication
- RLS configuration

**Week 2 (Dec 9-15):** FIFO & Data Pipeline
- Automated data collection
- FIFO engine
- Historical data load

**Week 3 (Dec 16-22):** Client Dashboard
- Executive views
- KPIs & alerts
- Charts & visualizations

**Week 4 (Dec 23-29):** Admin Panel
- Company management
- User management
- Analytics

**Week 5 (Dec 30 - Jan 5):** Polish & Deploy
- Testing
- Bug fixes
- Production deployment

**Target:** Mid-December (Core features with 1 pilot company)
**Full Launch:** Early January (Multiple companies, all features)

---

## Next Steps

### Immediate Actions:
1. **Review & Approve Plan** ← YOU ARE HERE
2. **Create Supabase Project**
3. **Set Up Database Schema**
4. **Create Project Structure**
5. **Begin Phase 1 Development**

---

**Ready to build a game-changing product! 🚀**
