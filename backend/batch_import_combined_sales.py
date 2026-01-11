"""
Batch Import Combined Sales Data to Supabase

Parses Vendas por Bico + Cupons por Período reports and imports to combined_sales table.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, time

# Add parsers to path
sys.path.insert(0, str(Path(__file__).parent / 'parsers'))
from parse_combined_sales import parse_vendas_por_bico, parse_cupons_por_periodo, combine_reports

# Supabase client
from supabase import create_client, Client

# Load environment variables
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / 'config' / '.env.local')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def format_time(sale_time):
    """Convert sale_time to string format for database"""
    if sale_time is None:
        return None
    if isinstance(sale_time, time):
        return sale_time.strftime('%H:%M:%S')
    if isinstance(sale_time, datetime):
        return sale_time.strftime('%H:%M:%S')
    if isinstance(sale_time, str):
        return sale_time
    return None


def import_combined_sales(combined_data, company_id=2, batch_size=100):
    """
    Import combined sales data to Supabase

    Args:
        combined_data: List of combined transaction dicts from combine_reports()
        company_id: Company ID for the data
        batch_size: Number of records per batch insert
    """
    print(f"\n[INFO] Importing {len(combined_data)} transactions...")

    # Prepare records for insert and dedupe
    seen = set()
    records = []
    duplicates = 0

    for txn in combined_data:
        # Create a unique key for deduplication (includes sale_time to distinguish same-value transactions)
        key = (
            company_id,
            str(txn.get('sale_date')),
            txn.get('pump_number'),
            txn.get('product_code'),
            round(float(txn.get('volume', 0)), 3),
            round(float(txn.get('value', 0)), 2),
            txn.get('cupom_number'),
            format_time(txn.get('sale_time'))
        )

        if key in seen:
            duplicates += 1
            continue
        seen.add(key)

        record = {
            'company_id': company_id,
            'pump_number': txn.get('pump_number'),
            'product_code': txn.get('product_code'),
            'product_name': txn.get('product_name'),
            'sale_date': str(txn.get('sale_date')),
            'client': txn.get('client'),
            'volume': float(txn.get('volume', 0)),
            'value': float(txn.get('value', 0)),
            'payment_method': txn.get('payment_method'),
            'cupom_number': txn.get('cupom_number'),
            'sale_time': format_time(txn.get('sale_time')),
            'employee': txn.get('employee'),
            'unit_price': float(txn.get('unit_price', 0)) if txn.get('unit_price') else None,
        }
        records.append(record)

    if duplicates > 0:
        print(f"  Skipped {duplicates} duplicate records")
    print(f"  Unique records to insert: {len(records)}")

    # Insert in batches using upsert with ignore duplicates
    inserted = 0
    skipped_db = 0
    errors = 0

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            # Use upsert with ignore to skip duplicates instead of failing
            result = supabase.table('combined_sales').upsert(
                batch,
                on_conflict='company_id,sale_date,pump_number,product_code,volume,value,cupom_number,sale_time',
                ignore_duplicates=True
            ).execute()
            inserted += len(batch)
            if (i // batch_size + 1) % 10 == 0:  # Print every 10 batches
                print(f"  Progress: {inserted:,} records inserted...")
        except Exception as e:
            error_msg = str(e)
            if 'duplicate key' in error_msg.lower() or '23505' in error_msg:
                # Batch failed - try one by one
                for record in batch:
                    try:
                        supabase.table('combined_sales').upsert(
                            record,
                            on_conflict='company_id,sale_date,pump_number,product_code,volume,value,cupom_number,sale_time',
                            ignore_duplicates=True
                        ).execute()
                        inserted += 1
                    except:
                        skipped_db += 1
            else:
                print(f"  ERROR in batch {i//batch_size + 1}: {e}")
                errors += len(batch)

    if skipped_db > 0:
        print(f"  Skipped {skipped_db} DB duplicates")
    print(f"[OK] Imported {inserted} records, {errors} errors")
    return inserted, errors


def process_month(docs_path, month, company_id=2):
    """Process a single month's reports"""
    print(f"\n{'='*70}")
    print(f"PROCESSING {month.upper()}")
    print('='*70)

    vendas_file = docs_path / f'Vendas por Bico_{month}.xlsx'
    cupons_file = docs_path / f'Cupons por Período_{month}.xlsx'

    if not vendas_file.exists():
        print(f"  ERROR: {vendas_file.name} not found")
        return 0, 0
    if not cupons_file.exists():
        print(f"  ERROR: {cupons_file.name} not found")
        return 0, 0

    # Parse reports
    vendas_data = parse_vendas_por_bico(str(vendas_file), company_id)
    cupons_data = parse_cupons_por_periodo(str(cupons_file), company_id)

    # Combine
    combined = combine_reports(vendas_data, cupons_data)

    # Import to Supabase
    inserted, errors = import_combined_sales(combined, company_id)

    return inserted, errors


def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(description='Batch import combined sales to Supabase')
    parser.add_argument('--docs-path', '-d', default='docs', help='Path to docs folder with reports')
    parser.add_argument('--company-id', '-c', type=int, default=2, help='Company ID (default: 2)')
    parser.add_argument('--months', '-m', nargs='+', default=['Sep', 'Oct', 'Nov', 'Dec'],
                        help='Months to process (default: Sep Oct Nov Dec)')

    args = parser.parse_args()

    docs_path = Path(args.docs_path)
    if not docs_path.is_absolute():
        docs_path = Path(__file__).parent.parent / args.docs_path

    print("="*70)
    print("BATCH IMPORT COMBINED SALES")
    print("="*70)
    print(f"Docs path: {docs_path}")
    print(f"Company ID: {args.company_id}")
    print(f"Months: {args.months}")

    total_inserted = 0
    total_errors = 0

    for month in args.months:
        inserted, errors = process_month(docs_path, month, args.company_id)
        total_inserted += inserted
        total_errors += errors

    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Total inserted: {total_inserted:,}")
    print(f"Total errors: {total_errors:,}")
    print("\n[DONE]")


if __name__ == '__main__':
    main()
