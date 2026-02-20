"""Gather detailed statistics for each CSV file without loading full data into memory."""
import csv
import os
from collections import Counter

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
csv.field_size_limit(10 * 1024 * 1024)  # 10 MB field limit


def analyze_tmi():
    """Analyze tmi.csv - Thompson Motif Index."""
    fpath = os.path.join(DATA_DIR, "tmi.csv")
    chapters = Counter()
    levels = Counter()
    notes_present = 0
    total = 0
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            chapters[row["chapter_name"]] += 1
            levels[row["level"]] += 1
            if row["notes"] and row["notes"] != "NA":
                notes_present += 1
    print("=== tmi.csv (Thompson Motif Index) ===")
    print(f"Total motifs: {total:,}")
    print(f"Motifs with notes: {notes_present:,} ({100*notes_present/total:.1f}%)")
    print(f"\nChapters ({len(chapters)}):")
    for ch, count in chapters.most_common():
        print(f"  {ch}: {count:,}")
    print(f"\nHierarchy levels: {dict(sorted(levels.items()))}")


def analyze_atu_df():
    """Analyze atu_df.csv - ATU Tale Type Index."""
    fpath = os.path.join(DATA_DIR, "atu_df.csv")
    chapters = Counter()
    has_litvar = 0
    has_remarks = 0
    has_combos = 0
    total = 0
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            chapters[row["chapter"]] += 1
            if row["litvar"] and row["litvar"] != "NA":
                has_litvar += 1
            if row["remarks"] and row["remarks"] != "NA":
                has_remarks += 1
            if row["combos"] and row["combos"] != "NA":
                has_combos += 1
    print("\n=== atu_df.csv (ATU Tale Type Index) ===")
    print(f"Total tale types: {total:,}")
    print(f"With literary variants: {has_litvar:,}")
    print(f"With remarks: {has_remarks:,}")
    print(f"With combos: {has_combos:,}")
    print(f"\nChapters ({len(chapters)}):")
    for ch, count in chapters.most_common():
        print(f"  {ch}: {count:,}")


def analyze_atu_seq():
    """Analyze atu_seq.csv - ATU motif sequences."""
    fpath = os.path.join(DATA_DIR, "atu_seq.csv")
    unique_atus = set()
    unique_motifs = set()
    max_order = 0
    max_variant = 0
    total = 0
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            unique_atus.add(row["atu_id"])
            unique_motifs.add(row["motif"])
            order = int(row["motif_order"])
            variant = int(row["tale_variant"])
            if order > max_order:
                max_order = order
            if variant > max_variant:
                max_variant = variant
    print("\n=== atu_seq.csv (ATU Motif Sequences) ===")
    print(f"Total rows: {total:,}")
    print(f"Unique ATU tale types: {len(unique_atus):,}")
    print(f"Unique motifs referenced: {len(unique_motifs):,}")
    print(f"Max motif_order: {max_order}")
    print(f"Max tale_variant: {max_variant}")


def analyze_atu_combos():
    """Analyze atu_combos.csv."""
    fpath = os.path.join(DATA_DIR, "atu_combos.csv")
    unique_atus = set()
    total = 0
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            unique_atus.add(row["atu_id"])
    print("\n=== atu_combos.csv (ATU Combo Pairs) ===")
    print(f"Total combo pairs: {total:,}")
    print(f"Unique ATU types with combos: {len(unique_atus):,}")


def analyze_aft():
    """Analyze aft.csv - Annotated Folktales."""
    fpath = os.path.join(DATA_DIR, "aft.csv")
    unique_atus = set()
    sources = Counter()
    total = 0
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            unique_atus.add(row["atu_id"])
            sources[row["data_source"]] += 1
    print("\n=== aft.csv (Annotated Folktales) ===")
    print(f"Total tales: {total:,}")
    print(f"Unique ATU types covered: {len(unique_atus):,}")
    print(f"\nData sources:")
    for src, count in sources.most_common():
        print(f"  {src}: {count:,}")


def analyze_tropes():
    """Analyze tropes.csv."""
    fpath = os.path.join(DATA_DIR, "tropes.csv")
    total = 0
    desc_lengths = []
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            desc_lengths.append(len(row.get("Description", "")))
    print("\n=== tropes.csv (TV Tropes) ===")
    print(f"Total tropes: {total:,}")
    if desc_lengths:
        avg_len = sum(desc_lengths) / len(desc_lengths)
        print(f"Avg description length: {avg_len:.0f} chars")
        print(f"Min description length: {min(desc_lengths)} chars")
        print(f"Max description length: {max(desc_lengths):,} chars")


if __name__ == "__main__":
    analyze_tmi()
    analyze_atu_df()
    analyze_atu_seq()
    analyze_atu_combos()
    analyze_aft()
    analyze_tropes()
