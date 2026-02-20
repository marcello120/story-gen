"""
Classify TMI motifs into semantic categories:
  Being, Object, Action, Place, Condition, Origin, Attribute, Outcome

Strategy:
  1. Rule-based classification using motif name patterns (primary signal)
  2. Chapter membership as secondary signal for ambiguous cases
  3. TF-IDF + classifier trained on rule-labeled data to handle leftovers

Outputs:
  - tmi_clustered.csv        : full TMI with category labels appended
  - cluster_report.txt       : human-readable analysis
  - cluster_distribution.png : bar chart of category sizes
  - category_by_chapter.png  : heatmap of categories × chapters
"""
import csv
import os
import re
import sys
from collections import Counter, defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import cross_val_score

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
csv.field_size_limit(10 * 1024 * 1024)

# =====================================================================
# Step 1: Load motif names + chapter names (only these two columns matter)
# =====================================================================
print("Reading motif data...")
rows = []  # list of dicts with id, motif_name, chapter_name
with open(os.path.join(DATA_DIR, "tmi.csv"), "r", encoding="utf-8", errors="replace") as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append({
            "id": row["id"],
            "motif_name": row["motif_name"],
            "chapter_name": row["chapter_name"],
            "level": row["level"],
        })
print(f"  {len(rows):,} motifs loaded")

# =====================================================================
# Step 2: Rule-based classification
# =====================================================================
# Each rule is (compiled_regex, category). First match wins.
# Patterns are applied to lowercased motif names.

RULES = [
    # --- CONDITION: tabus, prohibitions, enchantments, curses, spells ---
    (re.compile(r"^tabu\b"), "Condition"),
    (re.compile(r"\btabu\b.*\b(breaking|broken|violated|violating)\b"), "Condition"),
    (re.compile(r"\b(prohibition|forbidden|curse[ds]?|enchant(?:ment|ed)|disenchant|spell|geis|geas|oath|vow|compact|bargain|ban)\b"), "Condition"),

    # --- ORIGIN: etiological motifs ---
    (re.compile(r"^origin\b"), "Origin"),
    (re.compile(r"^why\b"), "Origin"),
    (re.compile(r"^how\b"), "Origin"),
    (re.compile(r"\borigin of\b"), "Origin"),
    (re.compile(r"\bcreation of\b"), "Origin"),
    (re.compile(r"\bfrom (body|blood|bones|tears|sweat|breath|spittle|excrement)\b"), "Origin"),

    # --- OUTCOME: rewards, punishments, consequences ---
    (re.compile(r"^punishment\b"), "Outcome"),
    (re.compile(r"^reward\b"), "Outcome"),
    (re.compile(r"\bpunishment for\b"), "Outcome"),
    (re.compile(r"\breward for\b"), "Outcome"),
    (re.compile(r"\b(retaliation|retribution|vengeance|penance|atonement)\b"), "Outcome"),
    (re.compile(r"\bas punishment\b"), "Outcome"),
    (re.compile(r"\bas reward\b"), "Outcome"),

    # --- ACTION: tasks, deceptions, tests, transformations, pursuits ---
    (re.compile(r"^task\b"), "Action"),
    (re.compile(r"^test\b"), "Action"),
    (re.compile(r"^quest\b"), "Action"),
    (re.compile(r"^deception\b"), "Action"),
    (re.compile(r"^trick\b"), "Action"),
    (re.compile(r"^theft\b"), "Action"),
    (re.compile(r"^pursuit\b"), "Action"),
    (re.compile(r"^escape\b"), "Action"),
    (re.compile(r"^rescue\b"), "Action"),
    (re.compile(r"^capture\b"), "Action"),
    (re.compile(r"^contest\b"), "Action"),
    (re.compile(r"^wager\b"), "Action"),
    (re.compile(r"^sham\b"), "Action"),
    (re.compile(r"^disguise\b"), "Action"),
    (re.compile(r"\btransformation\b"), "Action"),
    (re.compile(r"\b(deceiv|deceit|trickery|imposture|ruse|stratagem)\b"), "Action"),
    (re.compile(r"\b(suitor task|bride task|tasks? (set|imposed|assigned))\b"), "Action"),
    (re.compile(r"\b(abduction|kidnapping|seduction|betrayal|treachery)\b"), "Action"),
    (re.compile(r"\b(flight|pursuit|chase|hunting|fishing)\b"), "Action"),

    # --- EVENT: happenings, narrative events ---
    (re.compile(r"^(birth|death|marriage|war|battle|flood|deluge|famine|plague|fire)\b"), "Event"),
    (re.compile(r"\b(birth of|death of|marriage of|war between|battle of|duel)\b"), "Event"),
    (re.compile(r"\b(resurrection|reincarnation|metempsychosis|rebirth)\b"), "Event"),
    (re.compile(r"\b(wedding|funeral|feast|banquet|sacrifice|ordeal)\b"), "Event"),
    (re.compile(r"\b(murder|suicide|execution|drowning|burning|hanging|beheading)\b"), "Event"),
    (re.compile(r"\b(dream|vision|prophecy|omen|oracle|sign|portent)\b"), "Event"),
    (re.compile(r"\b(adventure|episode|incident|catastrophe|disaster|miracle)\b"), "Event"),
    (re.compile(r"\b(arrival|departure|return|journey|voyage|pilgrimage|migration)\b"), "Event"),
    (re.compile(r"\b(combat|fight|quarrel|dispute|conflict)\b"), "Event"),

    # --- PLACE: locations, realms, geographic features ---
    (re.compile(r"^(heaven|hell|otherworld|underworld|paradise|purgatory)\b"), "Place"),
    (re.compile(r"\b(heaven|hell|otherworld|underworld|paradise|purgatory|land of)\b"), "Place"),
    (re.compile(r"\b(castle|palace|tower|temple|church|monastery|city|village)\b"), "Place"),
    (re.compile(r"\b(forest|mountain|island|lake|river|sea|ocean|cave|well|spring|bridge)\b"), "Place"),
    (re.compile(r"\b(kingdom|realm|country|world|earth|sky|firmament)\b"), "Place"),

    # --- OBJECT: physical and magical items ---
    (re.compile(r"^magic (object|sword|ring|stone|wand|staff|cup|mirror|lamp|cloak|hat|shoe|bag|box|key|horn|belt|book|carpet|rope|chain|net|arrow|spear|shield|boat|ship|mill|drum|flute|pipe|fiddle|harp)\b"), "Object"),
    (re.compile(r"\bmagic (object|weapon|food|drink|fruit|herb|plant|medicine|ointment|salve|water|potion|elixir)\b"), "Object"),
    (re.compile(r"\b(sword|ring|stone|wand|staff|cup|mirror|lamp|cloak|hat|shoes?|boots?|gloves?|belt|girdle)\b.*\b(magic|enchanted|wonderful|extraordinary|remarkable)\b"), "Object"),
    (re.compile(r"\b(magic|enchanted|wonderful|extraordinary|remarkable)\b.*\b(sword|ring|stone|wand|staff|cup|mirror|lamp|cloak|hat)\b"), "Object"),
    (re.compile(r"\b(talisman|amulet|charm|relic|treasure|hoard)\b"), "Object"),
    (re.compile(r"^(magic |enchanted |wonderful |extraordinary )(animal|bird|fish|horse|dog|cat)\b"), "Object"),

    # --- ATTRIBUTE: qualities, characteristics, appearance ---
    (re.compile(r"^(extraordinary|remarkable|marvelous|wonderful|supernatural|magic)\b.*(strength|beauty|wisdom|power|sight|hearing|speed|size|skill|voice|intelligence|memory|appetite|thirst)\b"), "Attribute"),
    (re.compile(r"\b(color|colour|shape|size|form|appearance|beauty|ugliness|deformity)\b"), "Attribute"),
    (re.compile(r"\b(invulnerab|invisibl|immortal|omnisci|omnipoten)\b"), "Attribute"),
    (re.compile(r"\b(strong|weak|wise|foolish|clever|stupid|beautiful|ugly|rich|poor|lucky|unlucky|grateful|ungrateful|kind|cruel)\b.*\b(man|woman|person|hero|king|queen)\b"), "Attribute"),
    (re.compile(r"\b(man|woman|person|hero|king|queen)\b.*\b(strong|weak|wise|foolish|clever|stupid|beautiful|ugly|rich|poor)\b"), "Attribute"),

    # --- BEING: characters, creatures, deities, roles ---
    (re.compile(r"^(god[sd]?|goddess|deity|demiurg|angel|demon|devil|spirit|ghost|soul)\b"), "Being"),
    (re.compile(r"^(king|queen|prince|princess|knight|warrior|chief)\b"), "Being"),
    (re.compile(r"^(hero|heroine|trickster|fool|saint|prophet|priest|shaman|witch|wizard|sorcerer|magician)\b"), "Being"),
    (re.compile(r"^(giant|ogre|dragon|dwarf|elf|fairy|mermaid|vampire|werewolf|monster)\b"), "Being"),
    (re.compile(r"^(animal|bird|fish|snake|serpent|fox|wolf|bear|lion|eagle|raven|crow)\b"), "Being"),
    (re.compile(r"\b(culture hero|fairy|fairies|dwarfs?|elves?|giants?|ogres?|trolls?|dragons?|mermaids?)\b"), "Being"),
]

def classify_rule(motif_name):
    """Return category if a rule matches, else None."""
    lower = motif_name.lower()
    for pattern, category in RULES:
        if pattern.search(lower):
            return category
    return None


print("Applying rule-based classification...")
categories = []
rule_matched = 0
for r in rows:
    cat = classify_rule(r["motif_name"])
    categories.append(cat)
    if cat:
        rule_matched += 1

print(f"  Rule-matched: {rule_matched:,} / {len(rows):,} ({100*rule_matched/len(rows):.1f}%)")
unmatched = sum(1 for c in categories if c is None)
print(f"  Unmatched: {unmatched:,} ({100*unmatched/len(rows):.1f}%)")

# =====================================================================
# Step 3: Train a classifier on rule-labeled data, predict the rest
# =====================================================================
print("\nTraining classifier on rule-labeled data to handle unmatched motifs...")

def preprocess(name):
    name = name.lower()
    name = re.sub(r"[^a-z0-9\s\-]", " ", name)
    return re.sub(r"\s+", " ", name).strip()

# Add chapter as a feature by appending it
texts_all = [preprocess(r["motif_name"]) + " __CH_" + r["chapter_name"].replace(" ", "_") for r in rows]

vectorizer = TfidfVectorizer(
    max_features=10000,
    ngram_range=(1, 2),
    min_df=2,
    max_df=0.5,
    sublinear_tf=True,
)
X_all = vectorizer.fit_transform(texts_all)

# Split into labeled and unlabeled
labeled_idx = [i for i, c in enumerate(categories) if c is not None]
unlabeled_idx = [i for i, c in enumerate(categories) if c is None]

X_labeled = X_all[labeled_idx]
y_labeled = [categories[i] for i in labeled_idx]

# Cross-validate
clf = SGDClassifier(loss="modified_huber", random_state=42, max_iter=1000, class_weight="balanced")
cv_scores = cross_val_score(clf, X_labeled, y_labeled, cv=5, scoring="accuracy")
print(f"  5-fold CV accuracy on rule-labeled data: {cv_scores.mean():.3f} (+/- {cv_scores.std():.3f})")

# Train on all labeled, predict unlabeled
clf.fit(X_labeled, y_labeled)
if unlabeled_idx:
    X_unlabeled = X_all[unlabeled_idx]
    preds = clf.predict(X_unlabeled)
    pred_proba = clf.predict_proba(X_unlabeled)

    for j, idx in enumerate(unlabeled_idx):
        categories[idx] = preds[j]

    # Report confidence
    max_probs = pred_proba.max(axis=1)
    print(f"  Predicted {len(unlabeled_idx):,} unlabeled motifs")
    print(f"  Prediction confidence: mean={max_probs.mean():.3f}, min={max_probs.min():.3f}, "
          f"p25={np.percentile(max_probs, 25):.3f}, median={np.median(max_probs):.3f}")

# =====================================================================
# Step 4: Analyze results
# =====================================================================
print("\n" + "=" * 80)
print("CATEGORY DISTRIBUTION")
print("=" * 80)

cat_counts = Counter(categories)
for cat, count in cat_counts.most_common():
    print(f"  {cat:15s}  {count:>6,}  ({100*count/len(rows):.1f}%)")

# Category × Chapter cross-tabulation
cat_chapter = defaultdict(Counter)
for r, cat in zip(rows, categories):
    cat_chapter[cat][r["chapter_name"]] += 1

# =====================================================================
# Step 5: Detailed per-category report
# =====================================================================
report_lines = []
report_lines.append("TMI Motif Semantic Category Report")
report_lines.append("=" * 80)
report_lines.append("")
report_lines.append("Categories assigned via rule-based pattern matching on motif names,")
report_lines.append("with a TF-IDF + SGD classifier extending to unmatched motifs.")
report_lines.append(f"Rule-matched: {rule_matched:,} / {len(rows):,} ({100*rule_matched/len(rows):.1f}%)")
report_lines.append(f"Classifier-predicted: {len(rows)-rule_matched:,} ({100*(len(rows)-rule_matched)/len(rows):.1f}%)")
report_lines.append(f"Classifier 5-fold CV accuracy: {cv_scores.mean():.3f}")
report_lines.append("")

CATEGORY_DESCRIPTIONS = {
    "Being":     "Characters, creatures, deities, supernatural entities, animals-as-characters",
    "Object":    "Physical and magical items, artifacts, treasures, tools, weapons",
    "Action":    "Tasks, deceptions, tests, transformations, pursuits, escapes",
    "Event":     "Narrative happenings: births, deaths, marriages, battles, prophecies",
    "Place":     "Locations, realms, geographic features, cosmic settings",
    "Condition": "Tabus, prohibitions, enchantments, curses, rules, compacts",
    "Origin":    "Etiological motifs: why/how things came to be",
    "Attribute": "Qualities, characteristics, appearances, properties",
    "Outcome":   "Rewards, punishments, consequences, fates",
}

for cat, count in cat_counts.most_common():
    report_lines.append(f"\n{'─'*80}")
    report_lines.append(f"  {cat.upper()}  —  {count:,} motifs ({100*count/len(rows):.1f}%)")
    report_lines.append(f"  {CATEGORY_DESCRIPTIONS.get(cat, '')}")
    report_lines.append(f"{'─'*80}")

    # Top chapters
    top_ch = cat_chapter[cat].most_common(5)
    report_lines.append(f"  Top chapters: {', '.join(f'{ch} ({n:,})' for ch, n in top_ch)}")

    # Sample motifs
    samples = [r["motif_name"] for r, c in zip(rows, categories) if c == cat][:15]
    report_lines.append(f"  Sample motifs:")
    for s in samples:
        report_lines.append(f"    • {s}")

report_lines.append(f"\n{'='*80}")
report_lines.append("CATEGORY × CHAPTER CROSS-TABULATION")
report_lines.append(f"{'='*80}")

# Get all chapters sorted by frequency
all_chapters = sorted(set(r["chapter_name"] for r in rows),
                      key=lambda ch: -sum(1 for r in rows if r["chapter_name"] == ch))
all_cats = [cat for cat, _ in cat_counts.most_common()]

report_lines.append(f"\n{'':20s} " + " ".join(f"{cat:>10s}" for cat in all_cats))
for ch in all_chapters:
    vals = [cat_chapter[cat].get(ch, 0) for cat in all_cats]
    report_lines.append(f"{ch:20s} " + " ".join(f"{v:>10,}" for v in vals))

report_path = os.path.join(DATA_DIR, "cluster_report.txt")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines))
print(f"\nWritten {report_path}")

# =====================================================================
# Step 6: Write clustered CSV
# =====================================================================
print("Writing tmi_clustered.csv ...")
out_path = os.path.join(DATA_DIR, "tmi_clustered.csv")
with open(os.path.join(DATA_DIR, "tmi.csv"), "r", encoding="utf-8", errors="replace") as fin, \
     open(out_path, "w", encoding="utf-8", newline="") as fout:
    reader = csv.DictReader(fin)
    fieldnames = reader.fieldnames + ["category"]
    writer = csv.DictWriter(fout, fieldnames=fieldnames)
    writer.writeheader()
    for i, row in enumerate(reader):
        row["category"] = categories[i]
        writer.writerow(row)
print(f"  Written {out_path}")

# =====================================================================
# Step 7: Visualizations
# =====================================================================

# 7a. Category distribution bar chart
fig, ax = plt.subplots(figsize=(10, 5))
sorted_cats = cat_counts.most_common()
cat_names = [c for c, _ in sorted_cats]
cat_sizes = [n for _, n in sorted_cats]
colors = plt.cm.Set2(np.linspace(0, 1, len(cat_names)))
bars = ax.barh(range(len(cat_names)), cat_sizes, color=colors)
ax.set_yticks(range(len(cat_names)))
ax.set_yticklabels(cat_names, fontsize=11)
ax.set_xlabel("Number of Motifs")
ax.set_title("TMI Motifs by Semantic Category")
ax.invert_yaxis()
for bar, size in zip(bars, cat_sizes):
    ax.text(bar.get_width() + 80, bar.get_y() + bar.get_height() / 2,
            f"{size:,} ({100*size/len(rows):.1f}%)", va="center", fontsize=9)
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "cluster_distribution.png"), dpi=150)
print("  Written cluster_distribution.png")

# 7b. Category × Chapter heatmap
fig2, ax2 = plt.subplots(figsize=(14, 8))
top_chapters = all_chapters[:15]  # top 15 chapters by size
matrix = np.zeros((len(top_chapters), len(all_cats)))
for i, ch in enumerate(top_chapters):
    for j, cat in enumerate(all_cats):
        matrix[i, j] = cat_chapter[cat].get(ch, 0)

# Normalize per row (chapter) to show proportions
row_sums = matrix.sum(axis=1, keepdims=True)
row_sums[row_sums == 0] = 1
matrix_norm = matrix / row_sums

im = ax2.imshow(matrix_norm, cmap="YlOrRd", aspect="auto")
ax2.set_xticks(range(len(all_cats)))
ax2.set_xticklabels(all_cats, rotation=45, ha="right", fontsize=10)
ax2.set_yticks(range(len(top_chapters)))
ax2.set_yticklabels(top_chapters, fontsize=10)
ax2.set_title("Category Proportion by TMI Chapter (row-normalized)")
plt.colorbar(im, ax=ax2, shrink=0.8, label="Proportion")

# Annotate cells with counts
for i in range(len(top_chapters)):
    for j in range(len(all_cats)):
        val = int(matrix[i, j])
        if val > 0:
            color = "white" if matrix_norm[i, j] > 0.4 else "black"
            ax2.text(j, i, f"{val}", ha="center", va="center", fontsize=7, color=color)

plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "category_by_chapter.png"), dpi=150)
print("  Written category_by_chapter.png")

print("\nDone.")
