"""Audit Being subcategory classifications — find suspicious assignments."""
import csv
import os
import re
from collections import Counter, defaultdict

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
csv.field_size_limit(10 * 1024 * 1024)

rows = []
with open(os.path.join(DATA_DIR, "tmi_clustered.csv"), "r", encoding="utf-8", errors="replace") as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row["category"] == "Being":
            rows.append(row)

print(f"Total Being motifs: {len(rows):,}\n")

subcats = ["Deity", "Human", "Animal", "Spirit", "Monster", "Witch/Sorcerer"]

# Show random samples from each subcategory, stratified by chapter
for sc in subcats:
    sc_rows = [r for r in rows if r["subcategory"] == sc]
    print(f"\n{'='*80}")
    print(f"  {sc.upper()} — {len(sc_rows):,} motifs")
    print(f"{'='*80}")

    # Chapter distribution
    chapters = Counter(r["chapter_name"] for r in sc_rows)
    print(f"  Chapters: {chapters.most_common(8)}")

    # Show samples from each major chapter
    by_chapter = defaultdict(list)
    for r in sc_rows:
        by_chapter[r["chapter_name"]].append(r)

    shown = 0
    for ch, ch_rows in sorted(by_chapter.items(), key=lambda x: -len(x[1])):
        if shown >= 30:
            break
        # Show some from each chapter
        sample_count = min(5, len(ch_rows))
        # Pick evenly spaced samples
        step = max(1, len(ch_rows) // sample_count)
        for idx in range(0, len(ch_rows), step):
            if shown >= 30:
                break
            r = ch_rows[idx]
            print(f"  [{ch:20s}] {r['id']:10s} {r['motif_name']}")
            shown += 1

# Also look for obvious misclassifications by keyword
print(f"\n\n{'='*80}")
print("POTENTIAL MISCLASSIFICATIONS")
print(f"{'='*80}")

# Animals classified as Human
print("\n--- Likely animals classified as Human ---")
animal_words = re.compile(r"\b(fox|wolf|bear|lion|tiger|eagle|raven|crow|hawk|owl|cat[s]?\b|dog[s]?\b|horse|deer|hare|rabbit|mouse|rat|frog|toad|turtle|monkey|elephant|cow|bull|pig|boar|goat|sheep|cock|hen|duck|goose|swan|dove|ant[s]?\b|bee[s]?\b|spider|fly|whale|shark|dolphin|coyote|jackal|hyena|leopard|crocodile|lizard|scorpion|beetle|butterfly|donkey|camel|buffalo|stork|crane|sparrow|magpie|cuckoo|bat[s]?\b|squirrel|hedgehog|beaver|otter|porcupine|badger|weasel|parrot|pelican|vulture|serpent|snake)\b", re.I)
count = 0
for r in rows:
    if r["subcategory"] == "Human" and animal_words.search(r["motif_name"]):
        # Check if it's really about an animal, not just mentioning one
        name_lower = r["motif_name"].lower()
        if not any(w in name_lower for w in ["man", "woman", "person", "wife", "husband", "king", "queen", "prince", "princess", "boy", "girl", "child", "son", "daughter", "hero", "saint", "fool"]):
            print(f"  {r['id']:10s} [{r['subcategory']:15s}] {r['motif_name']}")
            count += 1
            if count >= 20:
                break

# Deities classified as Human
print("\n--- Likely deities classified as Human ---")
deity_words = re.compile(r"\b(god[s]?\b|goddess|deity|divine|creator|demiurg|demigod|culture hero)\b", re.I)
count = 0
for r in rows:
    if r["subcategory"] == "Human" and deity_words.search(r["motif_name"]):
        print(f"  {r['id']:10s} [{r['subcategory']:15s}] {r['motif_name']}")
        count += 1
        if count >= 20:
            break

# Spirits classified as Human
print("\n--- Likely spirits classified as Human ---")
spirit_words = re.compile(r"\b(ghost[s]?\b|spirit[s]?\b|fairy|fairies|elf|elves|dwarf|dwarves|demon[s]?\b|devil[s]?\b|angel[s]?\b|vampire|werewolf|phantom|banshee|goblin|gnome|troll[s]?\b|mermaid|siren|undead|zombie)\b", re.I)
count = 0
for r in rows:
    if r["subcategory"] == "Human" and spirit_words.search(r["motif_name"]):
        name_lower = r["motif_name"].lower()
        if not any(w in name_lower for w in ["man", "woman", "person", "wife", "husband", "boy", "girl"]):
            print(f"  {r['id']:10s} [{r['subcategory']:15s}] {r['motif_name']}")
            count += 1
            if count >= 20:
                break

# Monsters classified as Human
print("\n--- Likely monsters classified as Human ---")
monster_words = re.compile(r"\b(giant[s]?\b|monster[s]?\b|dragon[s]?\b|ogre[s]?\b|cannibal|wild man|wild woman|cyclop|gorgon|basilisk|hydra|chimera|minotaur)\b", re.I)
count = 0
for r in rows:
    if r["subcategory"] == "Human" and monster_words.search(r["motif_name"]):
        name_lower = r["motif_name"].lower()
        if not any(w in name_lower for w in ["man", "woman", "person", "wife", "husband", "boy", "girl"]):
            print(f"  {r['id']:10s} [{r['subcategory']:15s}] {r['motif_name']}")
            count += 1
            if count >= 20:
                break

# Witches classified as other categories
print("\n--- Likely witches classified wrong ---")
witch_words = re.compile(r"\b(witch(es)?|wizard|sorcerer|sorceress|magician|enchanter|enchantress|necromancer|shaman)\b", re.I)
count = 0
for r in rows:
    if r["subcategory"] != "Witch/Sorcerer" and witch_words.search(r["motif_name"]):
        name_lower = r["motif_name"].lower()
        # Only flag if witch/sorcerer seems primary
        words = name_lower.split()
        if words and any(w in words[0:3] for w in ["witch", "witches", "wizard", "sorcerer", "sorceress", "magician"]):
            print(f"  {r['id']:10s} [{r['subcategory']:15s}] {r['motif_name']}")
            count += 1
            if count >= 20:
                break

# Humans classified as Animal
print("\n--- Likely humans classified as Animal ---")
human_words = re.compile(r"\b(man|woman|person|wife|husband|king|queen|prince|princess|boy|girl|child|son|daughter|hero|saint|fool|thief|servant|master|lord|lady|priest|monk|nun)\b", re.I)
count = 0
for r in rows:
    if r["subcategory"] == "Animal" and human_words.search(r["motif_name"]):
        name_lower = r["motif_name"].lower()
        # Only if human word appears early (subject position)
        words = name_lower.split()
        if words and any(w in ["man", "woman", "person", "wife", "husband", "king", "queen", "prince", "princess", "boy", "girl", "child", "hero", "saint", "fool", "thief"] for w in words[0:3]):
            print(f"  {r['id']:10s} [{r['subcategory']:15s}] {r['motif_name']}")
            count += 1
            if count >= 20:
                break
