# Database Schema Analysis - Based on Actual Reports

## Reports Overview

### 1. Entrada de Mercadorias (Purchases/Receipts)
**Purpose:** Track fuel purchases/deliveries
**Key Data:**
- Product code (Ref.) + Name (Descrição)
- Purchase date (Entrada) + Issue date (Data Emissão)
- Quantity (Qtde.) in liters
- Cost price (P. Custo R$/liter)
- Planned sale price (P. Venda R$/liter)
- Markup % (Mkp %)
- Total cost (Subtotal R$)
- Invoice number (NFe)
- Storage location (Estoque)
- Supplier (Cliente/Fornecedor)

### 2. Resumo de Estoque (Inventory Summary)
**Purpose:** Complete inventory movement report
**Key Data:**
- Product code + name
- Initial inventory (Quantidade, Valor)
- Entries/Purchases (Quantidade, Valor Un. Médio, Valor)
- Sales/Output (Quantidade, Valor)
- **Internal usage (Uso e Consumo)** - fuel used internally
- **Losses/Gains (Perdas/Sobras)** - critical for true margins!
- Final balance (Saldos)

### 3. RESUMO DO DIA (Daily Sales Summary)
**Purpose:** Sales by pump with daily and monthly totals
**Key Data:**
- Pump number + product (Bico)
- Initial pump reading (Enc. Inicial)
- Final pump reading (Enc. Final)
- **Calibration adjustments (Aferição)** - pump calibration
- Daily volume sold
- Daily revenue (Valor R$)
- Monthly accumulated volume
- Monthly accumulated revenue

### 4. Notas a Pagar (Accounts Payable)
**Purpose:** Finance tracking
**Note:** Not directly fuel-related, might not need to track

---

## Schema Comparison

### ✅ GOOD: Our Schema Already Captures

**fuel_purchases:**
- ✅ Product name → Descrição
- ✅ Purchase date → Entrada
- ✅ Volume → Qtde.
- ✅ Cost per liter → P. Custo
- ✅ Total cost → Subtotal
- ✅ Supplier → Cliente/Fornecedor
- ✅ Invoice (batch_number) → NFe

**fuel_sales_intraday:**
- ✅ Product name
- ✅ Volume sold
- ✅ Revenue
- ✅ Sale timestamp

**current_inventory:**
- ✅ Product name
- ✅ Total volume
- ✅ Inventory value
- ✅ Avg cost per liter

---

## ⚠️ MISSING: Critical Data Not Captured

### 1. **Product Codes**
- Reports use product codes (000002, 000004, 009826, etc.)
- We only store product names
- **Impact:** Harder to match data across reports if names vary slightly

### 2. **Losses and Gains (Perdas/Sobras)**
- **CRITICAL:** This affects true margins!
- Example from Resumo de Estoque:
  - GASOLINA COMUM: -185.198 liters loss
  - DIESEL S10: +382.124 liters gain
  - DIESEL S500: -144.968 liters loss
- **Impact:** Without tracking losses/gains, margin calculations are wrong!

### 3. **Internal Usage (Uso e Consumo)**
- Fuel used internally (e.g., generator, vehicles)
- Should be separated from customer sales
- **Impact:** Internal usage affects inventory but not revenue

### 4. **Pump-Level Sales Tracking**
- Daily summary shows sales by pump number
- Useful for audit trail and pump performance tracking
- **Impact:** Can't identify which pump has issues

### 5. **Pump Readings & Calibration**
- Initial/Final pump readings (Enc. Inicial/Final)
- Calibration adjustments (Aferição)
- **Impact:** Can't verify sales accuracy or detect pump issues

### 6. **Planned Sale Price at Purchase**
- Purchase report includes "P. Venda" (planned sale price)
- Can compare planned vs actual sale price
- **Impact:** Can't track pricing strategy effectiveness

### 7. **Storage Location**
- Reports show "Estoque" field (e.g., "PRINCIPAL")
- **Impact:** May need for multi-tank operations

---

## 🔧 Recommended Schema Adjustments

### Option A: **Minimal Changes** (Quick Fix)
**Goal:** Capture critical missing data with minimal disruption

**1. Add to `fuel_purchases`:**
```sql
ALTER TABLE fuel_purchases
ADD COLUMN product_code TEXT,
ADD COLUMN planned_sale_price DECIMAL(8,4),
ADD COLUMN storage_location TEXT DEFAULT 'PRINCIPAL';
```

**2. Create new table `inventory_adjustments`:**
```sql
CREATE TABLE inventory_adjustments (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    adjustment_date DATE NOT NULL,
    adjustment_type TEXT CHECK (adjustment_type IN ('loss', 'gain', 'internal_usage')),
    volume DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**3. Add to `fuel_sales_intraday`:**
```sql
ALTER TABLE fuel_sales_intraday
ADD COLUMN pump_number TEXT,
ADD COLUMN initial_reading DECIMAL(12,3),
ADD COLUMN final_reading DECIMAL(12,3),
ADD COLUMN calibration_adjustment DECIMAL(10,3) DEFAULT 0;
```

---

### Option B: **Comprehensive Changes** (Better Long-term)
**Goal:** Full alignment with actual reports

**1. Create `products` table** (master product list):
```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT DEFAULT 'fuel',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, product_code)
);
```

**2. Update `fuel_purchases`:**
```sql
ALTER TABLE fuel_purchases
ADD COLUMN product_id BIGINT REFERENCES products(id),
ADD COLUMN product_code TEXT NOT NULL,
ADD COLUMN planned_sale_price DECIMAL(8,4),
ADD COLUMN markup_percent DECIMAL(5,2),
ADD COLUMN storage_location TEXT DEFAULT 'PRINCIPAL';
```

**3. Create `pump_sales_intraday`** (detailed pump-level sales):
```sql
CREATE TABLE pump_sales_intraday (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    pump_number TEXT NOT NULL,
    product_id BIGINT REFERENCES products(id),
    product_name TEXT NOT NULL,
    sale_date DATE NOT NULL,
    initial_reading DECIMAL(12,3) NOT NULL,
    final_reading DECIMAL(12,3) NOT NULL,
    calibration_adjustment DECIMAL(10,3) DEFAULT 0,
    volume_sold DECIMAL(10,2) NOT NULL,
    sale_price_per_liter DECIMAL(8,4) NOT NULL,
    total_revenue DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**4. Create `inventory_adjustments`:**
```sql
CREATE TABLE inventory_adjustments (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
    adjustment_date DATE NOT NULL,
    product_id BIGINT REFERENCES products(id),
    product_code TEXT NOT NULL,
    product_name TEXT NOT NULL,
    adjustment_type TEXT CHECK (adjustment_type IN ('loss', 'gain', 'internal_usage', 'calibration')),
    volume DECIMAL(10,2) NOT NULL, -- positive or negative
    unit_cost DECIMAL(8,4),
    total_cost DECIMAL(12,2),
    notes TEXT,
    source_report TEXT, -- 'resumo_estoque' or manual entry
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, adjustment_date, product_code, adjustment_type)
);
```

---

## 💡 Recommendation

**I recommend Option B (Comprehensive)** because:

1. **Product codes are essential** - All your reports use them
2. **Losses/gains are critical** - Without them, margins are wrong
3. **Pump tracking is useful** - Better audit trail and troubleshooting
4. **Future-proof** - Better structure for adding features later

**Impact:**
- ✅ Accurate margin calculations (accounts for losses)
- ✅ Better data integrity (product codes)
- ✅ Pump performance tracking
- ✅ Internal usage separate from sales
- ✅ More detailed analytics

**Downside:**
- Need to update existing tables (but we just created them, so minimal impact)
- Slightly more complex parsers

---

## Products in Your Reports

Based on the sample data:

| Product Code | Product Name | Category |
|---|---|---|
| 000001 | GASOLINA COMUM | Gasoline |
| 000002 | DIESEL S10 | Diesel |
| 000004 | DIESEL S500 | Diesel |
| 001361 | GASOLINA ADITIVADA | Gasoline |
| 004593 | ETANOL | Ethanol |
| 009826 | GASOLINA COMUM. | Gasoline |
| 009827 | GASOLINA ADITIVADA. | Gasoline |

**Note:** There seems to be duplicate products (with/without trailing period). We should normalize this.

---

## Next Steps

1. **Decide:** Option A (minimal) or Option B (comprehensive)?
2. **Update DATABASE_SCHEMA.sql** with chosen changes
3. **Re-run schema in Supabase** (we can update existing tables)
4. **Build parsers** to extract data from actual reports
5. **Continue with authentication module**

---

## Questions for You

1. Do you have multiple storage tanks/locations, or always just "PRINCIPAL"?
2. Are losses/gains important to track separately, or can we aggregate them?
3. Do you want pump-level detail, or just daily totals by product?
4. Should we track "Notas a Pagar" (accounts payable) or focus only on fuel data?

Let me know your preference and I'll update the schema accordingly!
