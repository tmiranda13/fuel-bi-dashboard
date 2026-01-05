"""
Batch Import Script for Histórico de Consumo (PJ Client Transactions)
Imports all historical PJ transaction data from Excel files
"""

import os
import sys
import glob
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from parsers.parse_pj_transactions import parse_historico_consumo, load_transactions_to_database


def main():
    # Configuration
    DOCS_PATH = Path(__file__).parent.parent / 'docs'
    COMPANY_ID = 2  # Posto PCL

    print("=" * 60)
    print("BATCH IMPORT - HISTÓRICO DE CONSUMO (PJ TRANSACTIONS)")
    print("=" * 60)
    print()

    # Find all Histórico de Consumo files
    # Patterns: "Histórico de Consumo.xlsx", "Histórico de Consumo_*.xlsx"
    files = []

    # Main December file
    dec_file = DOCS_PATH / "Histórico de Consumo.xlsx"
    if dec_file.exists():
        files.append(str(dec_file))

    # Monthly files (Sep, Oct, Nov)
    for pattern in ["Histórico de Consumo_*.xlsx"]:
        found = glob.glob(str(DOCS_PATH / pattern))
        files.extend(found)

    # Remove duplicates and sort
    files = sorted(set(files))

    if not files:
        print("[X] No Histórico de Consumo files found in docs folder")
        return

    print(f"Found {len(files)} files to import:")
    for file in files:
        filename = os.path.basename(file)
        print(f"  - {filename}")
    print()

    # Import each file
    total_inserted = 0
    total_skipped = 0
    total_errors = 0
    total_transactions = 0

    for file_path in files:
        filename = os.path.basename(file_path)
        print(f"\n[*] Processing: {filename}")
        print("-" * 60)

        try:
            # Parse the file
            transactions = parse_historico_consumo(file_path, COMPANY_ID)
            total_transactions += len(transactions)

            # Load to database (excluding walk-in transactions)
            print("\n[*] Loading to database (PJ clients only)...")
            result = load_transactions_to_database(transactions, include_walkin=False)

            print(f"    Inserted: {result['inserted']}")
            print(f"    Skipped (duplicates): {result['skipped']}")

            if result['errors']:
                print(f"    Errors: {len(result['errors'])}")
                for err in result['errors'][:3]:
                    print(f"      - Cupom {err['cupom']}: {err['error']}")

            total_inserted += result['inserted']
            total_skipped += result['skipped']
            total_errors += len(result['errors'])

        except Exception as e:
            print(f"[ERROR] Error processing {filename}: {e}")
            import traceback
            traceback.print_exc()
            total_errors += 1

    # Summary
    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)
    print(f"Files Processed:     {len(files)}")
    print(f"Total Transactions:  {total_transactions}")
    print(f"Records Inserted:    {total_inserted}")
    print(f"Records Skipped:     {total_skipped}")
    print(f"Errors:              {total_errors}")
    print()

    if total_inserted > 0:
        print("[SUCCESS] Import completed!")
        print("   PJ client data is now available in the dashboard")
    elif total_skipped > 0:
        print("[INFO] All records already exist in database")
    else:
        print("[WARNING] No records were imported")


if __name__ == '__main__':
    main()
