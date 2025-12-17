# Purchases System Setup Guide

## Overview

This guide walks you through setting up the complete purchases tracking system for fuel purchase/receipt data (Entrada de Mercadorias).

## What You'll Get

- Full purchase transaction tracking with individual delivery records
- Automatic product code mapping (handles duplicates like 000001 + 009826 → GC)
- Cost price history for FIFO costing
- Invoice tracking with duplicate prevention
- 13 weeks of historical purchase data (Sept-Nov 2025)

## Files Created

```
backend/
├── schema/
│   └── purchases_schema.sql              # Database schema (RUN THIS FIRST!)
├── parsers/
│   └── parse_purchases.py                # Excel parser with code mapping
├── batch_import_purchases.py             # Batch import for all 13 files
└── PURCHASES_SETUP_GUIDE.md              # This file
```

## Step-by-Step Setup

### Step 1: Run SQL Schema in Supabase

**IMPORTANT**: This must be done first before any imports!

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy the contents of `schema/purchases_schema.sql`
4. Run the entire script

This will create:
- `product_code_mapping` table (maps source codes to canonical codes)
- Initial product code mappings (GC, GA, DS10, DS500, ET)
- `purchases` table (main purchase records)
- Indexes for performance
- Helper views for analysis

The schema is now self-contained and includes everything needed!

### Step 2: Verify Prerequisites

Ensure these tables exist in your database (they should already exist from your initial setup):
- ✅ `companies` (should have company_id = 1)
- ✅ `products` (canonical product codes: GC, GA, DS10, DS500, ET)

You can verify with this SQL:

```sql
-- Check companies
SELECT id, name FROM companies LIMIT 5;

-- Check products
SELECT product_code, product_name FROM products WHERE company_id = 1;

-- Check product code mappings
SELECT source_product_code, canonical_product_code
FROM product_code_mapping
WHERE company_id = 1;
```

### Step 3: Run the Batch Import

Once the schema is in place, import all 13 purchase files:

```bash
cd C:\FRCNC_Local\Thiago\1strev\backend
python batch_import_purchases.py
```

The script will:
1. Find all 13 "Entrada de mercadorias" files
2. Parse each file using product code mapping
3. Insert purchase records into the database
4. Skip duplicates automatically
5. Show progress for each file

Expected output:
```
[INFO] Found 13 purchase files to import
[1/13] Processing: Entrada de mercadorias_1.xlsx
  [SECTION] DIESEL S10
  [SECTION] DIESEL S500
  ... etc
  [SUCCESS] Parsed 45 purchase transactions
  [RESULT] Inserted: 45 | Skipped: 0 | Errors: 0

... (repeats for all 13 files)

IMPORT COMPLETE
Files Processed:    13/13
Total Purchases:    ~550-600 transactions
Successfully Inserted: ~550-600
```

### Step 4: Verify the Data

Check that data was imported correctly:

```sql
-- Count purchases by product
SELECT
    canonical_product_code,
    product_name,
    COUNT(*) AS num_deliveries,
    SUM(quantity) AS total_liters,
    SUM(subtotal) AS total_cost
FROM purchases
WHERE company_id = 1
GROUP BY canonical_product_code, product_name
ORDER BY canonical_product_code;

-- Check date range
SELECT
    MIN(receipt_date) AS first_purchase,
    MAX(receipt_date) AS last_purchase,
    COUNT(*) AS total_purchases
FROM purchases
WHERE company_id = 1;

-- Sample recent purchases
SELECT
    receipt_date,
    product_name,
    quantity,
    cost_price,
    subtotal,
    invoice_number
FROM purchases
WHERE company_id = 1
ORDER BY receipt_date DESC
LIMIT 10;
```

### Step 5: Use the Helper Views

The schema includes pre-built views for analysis:

```sql
-- Weekly purchase summary
SELECT * FROM purchases_weekly_summary
WHERE week_start >= '2025-09-01'
ORDER BY week_start DESC, product_code;

-- Cost price trends
SELECT * FROM purchase_price_trends
WHERE product_code = 'DS10'
  AND receipt_date >= '2025-09-01'
ORDER BY receipt_date;

-- Check duplicate consolidation
SELECT * FROM purchases_duplicate_mapping
WHERE receipt_date = '2025-09-02';

-- All purchase invoices
SELECT * FROM purchase_invoices
WHERE invoice_date >= '2025-09-01'
ORDER BY invoice_date DESC;
```

## Data Structure

### Main Table: `purchases`

Each row represents one fuel delivery/purchase transaction:

| Field | Description | Example |
|-------|-------------|---------|
| `company_id` | Company identifier | 1 |
| `source_product_code` | Original code from Excel | "000002" |
| `source_product_name` | Original product name | "DIESEL S10" |
| `canonical_product_code` | Mapped standard code | "DS10" |
| `product_name` | Canonical product name | "Diesel S10" |
| `invoice_date` | When invoice was issued | 2025-09-01 |
| `receipt_date` | When fuel arrived (for FIFO) | 2025-09-02 |
| `quantity` | Liters received | 15000.000 |
| `cost_price` | Cost per liter (R$/L) | 3.45000 |
| `selling_price` | Planned selling price (R$/L) | 4.20 |
| `markup_percentage` | Markup % | 21.74 |
| `subtotal` | Total purchase cost (R$) | 51750.00 |
| `invoice_number` | NFe number | "12345" |
| `warehouse` | Storage location | "PRINCIPAL" |

### Product Code Mapping

Handles duplicate product codes automatically:

| Source Code | Canonical Code | Product |
|-------------|----------------|---------|
| 000001 | GC | Gasolina Comum |
| 009826 | GC | Gasolina Comum (duplicate) |
| 001361 | GA | Gasolina Aditivada |
| 009827 | GA | Gasolina Aditivada (duplicate) |
| 000002 | DS10 | Diesel S10 |
| 000004 | DS500 | Diesel S500 |
| 004593 | ET | Etanol |

When the parser encounters either 000001 or 009826, both get mapped to canonical code "GC".

## Troubleshooting

### Error: "Could not find table 'purchases'"

**Solution**: You forgot to run `schema/purchases_schema.sql` in Supabase first!

```sql
-- Run the entire purchases_schema.sql file in Supabase SQL Editor
```

### Error: "Could not find table 'product_code_mapping'"

**Solution**: Run the inventory schema first (or just the product_code_mapping portion):

```sql
-- From schema/inventory_schema.sql, run the product_code_mapping section
```

### Warning: "No mapping found for 000XXX"

**Solution**: Add the missing product code to the mapping table:

```sql
INSERT INTO product_code_mapping
    (source_product_code, source_product_name, canonical_product_code, company_id)
VALUES
    ('000XXX', 'PRODUCT NAME', 'CANONICAL_CODE', 1);
```

### Duplicate Key Error

**Solution**: Purchases already exist. The script skips duplicates automatically. If you need to re-import:

```sql
-- Delete existing purchases for a specific date range
DELETE FROM purchases
WHERE receipt_date BETWEEN '2025-09-01' AND '2025-09-07';
```

## Next Steps

After importing purchases data:

1. **Verify Data Accuracy**: Compare database totals with Excel reports
2. **FIFO Costing**: Use `receipt_date` to match costs to sales chronologically
3. **Margin Analysis**: Compare `cost_price` vs selling prices from sales data
4. **Trend Analysis**: Use helper views to analyze price trends over time
5. **Frontend Integration**: Create API endpoints to serve purchase data to dashboard

## Maintenance

### Adding New Purchase Files

When you have new "Entrada de mercadorias" files:

1. Name them sequentially: `Entrada de mercadorias_14.xlsx`, etc.
2. Place in `docs/` folder
3. Run `python batch_import_purchases.py` again
4. Script will skip existing records and only import new ones

### Adding New Product Mappings

If you discover new duplicate product codes:

```sql
INSERT INTO product_code_mapping
    (source_product_code, source_product_name, canonical_product_code, company_id)
VALUES
    ('NEW_CODE', 'PRODUCT NAME', 'EXISTING_CANONICAL', 1);
```

## Database Schema Details

See `schema/purchases_schema.sql` for:
- Complete table definitions with data types
- All indexes for performance optimization
- Helper view definitions
- Example queries
- Implementation notes

## Support

If you encounter issues:
1. Check the error message carefully
2. Verify prerequisites (tables exist, schemas run)
3. Review the SQL schema comments
4. Check purchase records in database manually

The system is designed to be robust:
- Duplicate prevention via unique constraints
- Automatic product code mapping
- Graceful handling of missing data
- Clear error messages

---

**Summary**: Run the SQL schema in Supabase, then run `batch_import_purchases.py`. That's it!
