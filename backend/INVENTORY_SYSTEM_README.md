# Inventory System Implementation Guide

## Overview

This system handles "Resumo de Estoque" (Inventory Summary) reports with automatic duplicate product consolidation using a hybrid code mapping approach.

## Problem Solved

**Issue**: The source system uses multiple product codes for the same fuel type:
- GASOLINA COMUM has codes: `000001` and `009826`
- GASOLINA ADITIVADA has codes: `001361` and `009827`

**Solution**: Product Code Mapping Table that maps source codes to canonical products (GC, GA, ET, etc.)

## Architecture

```
Excel File (Resumo de Estoque)
    ↓
Parser (parse_inventory.py)
    ↓
Product Code Mapping Lookup
    ↓
Consolidation by Canonical Product
    ↓
Database (inventory_snapshots + inventory_source_records)
```

## Database Tables

### 1. `product_code_mapping`
Maps source product codes to canonical codes.

```sql
source_product_code | canonical_product_code | company_id
--------------------|------------------------|------------
000001             | GC                     | 1
009826             | GC                     | 1
001361             | GA                     | 1
009827             | GA                     | 1
```

### 2. `inventory_snapshots`
One record per canonical product per date (consolidated data).

Fields:
- Opening inventory (quantity, unit price, value)
- Purchases/Receipts
- Sales/Output
- Usage/Consumption
- Losses/Gains (variance)
- Closing balance

### 3. `inventory_source_records` (optional)
Detailed tracking of which source codes contributed to each snapshot.

## Setup Instructions

### Step 1: Run SQL Schema

```bash
# In Supabase SQL Editor, run:
C:\FRCNC_Local\Thiago\1strev\backend\schema\inventory_schema.sql
```

This creates:
- All 3 tables
- Indexes
- Initial product code mappings
- Helper views

### Step 2: Generate Inventory Reports

Use your automation (or manually) to generate weekly "Resumo de Estoque" files.

**Filename Convention**: `Resumo de Estoque_YYYY_MM_DD.xlsx`

Example:
- `Resumo de Estoque_2025_11_23.xlsx`
- `Resumo de Estoque_2025_11_30.xlsx`

### Step 3: Run Import

```bash
cd C:\FRCNC_Local\Thiago\1strev\backend
python batch_import_inventory.py
```

The script will:
1. Find all inventory files in docs folder
2. Parse each file
3. Look up product code mappings
4. Consolidate duplicates
5. Insert into database

## How Duplicate Consolidation Works

### Example: GASOLINA COMUM on 2025-11-23

**Source File Has**:
```
000001 - GASOLINA COMUM     | Closing: 1000 L | R$ 5500
009826 - GASOLINA COMUM.    | Closing: 500 L  | R$ 2750
```

**After Consolidation**:
```
GC - GASOLINA COMUM         | Closing: 1500 L | R$ 8250
```

**Database Records**:
- `inventory_snapshots`: 1 record (GC, 1500 L, R$ 8250)
- `inventory_source_records`: 2 records (000001 and 009826 with individual data)

## Parser Details

**File**: `parsers/parse_inventory.py`

**Key Functions**:
- `get_product_code_mapping()` - Loads mappings from database
- `parse_inventory_report()` - Reads Excel, extracts all products
- `consolidate_by_canonical_product()` - Sums quantities/values by canonical code

**Column Mapping**:
- Col 0: Product (code - name)
- Cols 2-5: Inicial (Opening)
- Cols 6-9: Entrada (Purchases)
- Cols 10-13: Saída (Sales)
- Cols 14-17: Uso e Consumo (Usage)
- Cols 18-21: Perdas/Sobras (Variance)
- Cols 22-25: Saldos (Closing)

## Adding New Product Mappings

If you discover more duplicate codes:

```sql
INSERT INTO product_code_mapping
    (source_product_code, source_product_name, canonical_product_code, company_id)
VALUES
    ('NEW_CODE', 'PRODUCT NAME', 'CANONICAL_CODE', 1);
```

Example:
```sql
-- If you find another Diesel code
INSERT INTO product_code_mapping
    (source_product_code, source_product_name, canonical_product_code, company_id)
VALUES
    ('000003', 'DIESEL S10', 'DS10', 1);
```

## Querying Inventory Data

### Get Latest Inventory

```sql
SELECT
    snapshot_date,
    product_name,
    closing_quantity AS stock_liters,
    closing_value AS stock_value,
    variance_quantity AS losses_gains
FROM inventory_snapshots
WHERE company_id = 1
ORDER BY snapshot_date DESC, product_code;
```

### Check Consolidation

```sql
SELECT * FROM inventory_consolidation_report
WHERE snapshot_date = '2025-11-23';
```

Shows which source codes were merged for each product.

### Track Variance Over Time

```sql
SELECT
    snapshot_date,
    product_name,
    variance_quantity,
    sales_quantity,
    ROUND(variance_quantity / NULLIF(sales_quantity, 0) * 100, 2) AS variance_pct
FROM inventory_snapshots
WHERE company_id = 1
  AND variance_quantity != 0
ORDER BY snapshot_date DESC, ABS(variance_quantity) DESC;
```

## File Organization

```
backend/
├── schema/
│   └── inventory_schema.sql          # Database schema
├── parsers/
│   └── parse_inventory.py            # Parser with consolidation
├── data_import/
│   └── import_inventory_service.py   # Import service
├── batch_import_inventory.py         # Batch import script
└── docs/
    ├── Resumo de Estoque_2025_11_23.xlsx
    ├── Resumo de Estoque_2025_11_30.xlsx
    └── ... (weekly inventory files)
```

## Troubleshooting

### Missing Product Mapping

**Error**: `[WARN] No mapping found for 000005 - DIESEL ADITIVADO`

**Solution**:
```sql
INSERT INTO product_code_mapping
    (source_product_code, source_product_name, canonical_product_code, company_id)
VALUES
    ('000005', 'DIESEL ADITIVADO', 'DA', 1);
```

### Duplicate Snapshot Error

**Error**: `UNIQUE constraint failed: inventory_snapshots(company_id, product_code, snapshot_date)`

**Cause**: Trying to import the same date twice

**Solution**:
- Delete existing: `DELETE FROM inventory_snapshots WHERE snapshot_date = '2025-11-23'`
- Or use UPSERT in import script

### Data Doesn't Match Excel

**Check**:
```sql
-- Compare consolidated vs source
SELECT
    s.product_code,
    s.closing_quantity AS consolidated_qty,
    SUM(sr.closing_quantity) AS source_total_qty
FROM inventory_snapshots s
LEFT JOIN inventory_source_records sr ON s.id = sr.inventory_snapshot_id
WHERE s.snapshot_date = '2025-11-23'
GROUP BY s.id, s.product_code, s.closing_quantity;
```

Should match!

## Next Steps

1. ✅ Run `inventory_schema.sql` in Supabase
2. ⏳ Generate weekly inventory reports (use automation)
3. ⏳ Run batch import
4. ⏳ Verify data with spot checks
5. ⏳ Create dashboard views for inventory tracking

## Support

For issues or questions:
- Check logs in batch import output
- Query `inventory_consolidation_report` view
- Review `inventory_source_records` for granular data
