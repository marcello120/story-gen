"""Inspect the first 10 lines and basic metadata of each CSV file."""
import csv
import os

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILES = ["tmi.csv", "atu_df.csv", "atu_seq.csv", "atu_combos.csv", "aft.csv", "tropes.csv"]

for fname in CSV_FILES:
    fpath = os.path.join(DATA_DIR, fname)
    size_mb = os.path.getsize(fpath) / (1024 * 1024)
    print(f"\n{'='*80}")
    print(f"FILE: {fname}  ({size_mb:.2f} MB)")
    print(f"{'='*80}")

    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i == 0:
                print(f"COLUMNS ({len(row)}): {row}")
                print("-" * 80)
            else:
                print(f"Row {i}: {row}")
            if i >= 10:
                break

    # Count total rows without loading into memory
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        total = sum(1 for _ in f) - 1  # subtract header
    print(f"\nTOTAL ROWS (excluding header): {total:,}")