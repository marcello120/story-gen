"""
Classify TV tropes into semantic categories:
  Character, Plot Device, Setting, Object, Dialogue, Visual/Style,
  Narrative Device, Relationship, Action, Genre/Tone

Strategy (same hybrid as TMI):
  1. Rule-based classification using trope name patterns + description keywords
  2. TF-IDF + SGD classifier trained on rule-labeled data for the rest

Outputs:
  - tropes_clustered.csv           : full tropes with category column
  - tropes_cluster_report.txt      : human-readable analysis
  - tropes_cluster_distribution.png: bar chart
  - tropes_scatter_all.png         : UMAP scatterplot
  - tropes_scatter_grid.png        : per-category UMAP grid
"""
import csv
import os
import re
import sys
from collections import Counter, defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.model_selection import cross_val_score
import umap

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
csv.field_size_limit(10 * 1024 * 1024)

# =====================================================================
# Step 1: Load unique tropes
# =====================================================================
print("Loading tropes.csv (unique tropes only) ...")
seen_ids = set()
trope_ids = []
trope_names = []
trope_descs = []

with open(os.path.join(DATA_DIR, "tropes.csv"), "r", encoding="utf-8", errors="replace") as f:
    reader = csv.DictReader(f)
    for row in reader:
        tid = row["TropeID"]
        if tid in seen_ids:
            continue
        seen_ids.add(tid)
        trope_ids.append(tid)
        trope_names.append(row["Trope"])
        trope_descs.append(row.get("Description", ""))

print(f"  {len(trope_ids):,} unique tropes loaded")

# =====================================================================
# Step 2: Preprocess trope names (split CamelCase)
# =====================================================================
def split_camel(name):
    """Split CamelCase into lowercase words."""
    parts = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    parts = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', parts)
    return parts.lower()

split_names = [split_camel(n) for n in trope_names]

# Truncate descriptions to first ~300 chars for efficiency
def truncate_desc(desc, max_chars=300):
    desc = desc.strip().replace("\n", " ")
    desc = re.sub(r"\s+", " ", desc)
    if len(desc) > max_chars:
        # Cut at word boundary
        desc = desc[:max_chars].rsplit(" ", 1)[0]
    return desc.lower()

short_descs = [truncate_desc(d) for d in trope_descs]

# =====================================================================
# Step 3: Rule-based classification
# =====================================================================
# Rules match against: split trope name + truncated description

RULES = [
    # --- CHARACTER: archetypes, character types, roles ---
    (re.compile(r"\b(hero|heroine|villain|antagonist|protagonist|sidekick|mentor|love interest)\b"), "Character"),
    (re.compile(r"\b(anti.?hero|anti.?villain|big bad|final boss|dark lord|evil overlord)\b"), "Character"),
    (re.compile(r"\b(girl|boy|guy|man|woman|lady|gentleman|kid|child|baby|teen|youth|elder)\b.*\b(action|badass|cute|tough|smart|dumb|nerdy|shy|cool|nice|mean)\b"), "Character"),
    (re.compile(r"\b(action girl|token|lone|mysterious|eccentric|reluctant|chosen one|mary sue|gary stu)\b"), "Character"),
    (re.compile(r"\b(the .{0,15}(hero|villain|mentor|sidekick|rival|bully|nerd|jock|loner|fool|sage))\b"), "Character"),
    (re.compile(r"\b(archetype|character type|stock character|ensemble|cast)\b"), "Character"),
    (re.compile(r"\b(father|mother|parent|sibling|brother|sister|son|daughter|uncle|aunt|grandpa|grandma)\b.*\b(figure|role|archetype|trope)\b"), "Character"),
    (re.compile(r"\b(robot|android|cyborg|alien|monster|zombie|vampire|werewolf|ghost|witch|wizard|pirate|ninja|samurai|knight|cowboy|detective|spy|assassin)\b"), "Character"),
    (re.compile(r"\b(king|queen|prince|princess|emperor|empress|lord|duke|baron)\b"), "Character"),
    (re.compile(r"\b(captain|commander|general|soldier|warrior|berserker|ranger|paladin|rogue|bard|healer|cleric)\b"), "Character"),
    (re.compile(r"\b(damsel|femme fatale|ice queen|tsundere|yandere|kuudere|dandere|moe|bishounen)\b"), "Character"),
    (re.compile(r"\b(mascot|pet|animal companion|familiar|steed|mount)\b"), "Character"),

    # --- PLOT DEVICE: narrative mechanics, plot structures ---
    (re.compile(r"\b(plot|subplot|story arc|narrative arc|story line|story beat)\b"), "Plot Device"),
    (re.compile(r"\b(plot twist|plot hole|plot armor|plot device|plot point|plot thread)\b"), "Plot Device"),
    (re.compile(r"\b(macguffin|chekhov|deus ex machina|red herring|cliffhanger|foreshadow)\b"), "Plot Device"),
    (re.compile(r"\b(twist ending|surprise ending|reveal|the reveal|dramatic irony)\b"), "Plot Device"),
    (re.compile(r"\b(flashback|flash forward|time skip|cold open|framing device|in medias res)\b"), "Plot Device"),
    (re.compile(r"\b(prophecy|chosen one|quest|mission|objective|macguffin|fetch quest)\b"), "Plot Device"),
    (re.compile(r"\b(conflict|climax|resolution|denouement|exposition|rising action|falling action)\b"), "Plot Device"),
    (re.compile(r"\b(sequel hook|sequel|prequel|retcon|reboot|continuity)\b"), "Plot Device"),
    (re.compile(r"\b(aesop|moral|lesson|message|allegory|parable)\b"), "Plot Device"),

    # --- EVENT/ACTION: things that happen, fights, dramatic moments ---
    (re.compile(r"\b(battle|fight|combat|war|duel|brawl|showdown|final battle)\b"), "Event"),
    (re.compile(r"\b(death|dying|killed|murder|assassination|sacrifice|suicide|execution)\b"), "Event"),
    (re.compile(r"\b(explosion|crash|chase|escape|rescue|kidnap|abduction|heist|robbery)\b"), "Event"),
    (re.compile(r"\b(wedding|funeral|birth|ceremony|ritual|celebration|feast|party|ball|dance)\b"), "Event"),
    (re.compile(r"\b(betrayal|revenge|redemption|fall|rise|transformation|awakening|revelation)\b"), "Event"),
    (re.compile(r"\b(invasion|siege|ambush|attack|assault|raid|coup|rebellion|revolution|uprising)\b"), "Event"),
    (re.compile(r"\b(trial|tournament|competition|contest|race|game|gambit)\b"), "Event"),
    (re.compile(r"\b(training|montage|power.?up|level.?up|upgrade)\b"), "Event"),

    # --- SETTING/PLACE: locations, worlds, environments ---
    (re.compile(r"\b(city|town|village|kingdom|empire|nation|country|world|planet|dimension|realm)\b"), "Setting"),
    (re.compile(r"\b(castle|palace|tower|dungeon|cave|forest|desert|mountain|island|ocean|sea|space)\b"), "Setting"),
    (re.compile(r"\b(school|academy|university|hospital|prison|church|temple|shrine|library|museum)\b"), "Setting"),
    (re.compile(r"\b(bar|tavern|inn|restaurant|hotel|motel|house|home|apartment|mansion|base|lair|hideout)\b"), "Setting"),
    (re.compile(r"\b(abandoned|haunted|underground|underwater|floating|flying|hidden|secret|forbidden)\b.*\b(place|area|zone|location|building|room|lab|laboratory|warehouse)\b"), "Setting"),
    (re.compile(r"\b(dystopia|utopia|wasteland|apocalypse|post.?apocalyptic|cyberpunk|steampunk)\b"), "Setting"),
    (re.compile(r"\b(heaven|hell|afterlife|underworld|limbo|purgatory|void|abyss)\b"), "Setting"),

    # --- OBJECT/ITEM: props, weapons, artifacts ---
    (re.compile(r"\b(sword|blade|weapon|gun|rifle|pistol|bow|arrow|axe|hammer|spear|shield|armor|armour)\b"), "Object"),
    (re.compile(r"\b(artifact|relic|amulet|talisman|ring|gem|crystal|orb|scroll|tome|book|map|key|lock)\b"), "Object"),
    (re.compile(r"\b(potion|elixir|pill|serum|drug|poison|antidote|medicine)\b"), "Object"),
    (re.compile(r"\b(vehicle|car|ship|spaceship|mech|robot|mecha|tank|plane|motorcycle|bicycle|train)\b"), "Object"),
    (re.compile(r"\b(phone|computer|device|gadget|tool|machine|technology|tech)\b"), "Object"),
    (re.compile(r"\b(food|drink|meal|feast|wine|beer|coffee|tea|cake|bread|fruit)\b"), "Object"),
    (re.compile(r"\b(clothing|outfit|costume|uniform|dress|suit|mask|hat|cape|cloak|gloves|boots)\b"), "Object"),
    (re.compile(r"\b(money|gold|treasure|jewel|coin|currency|wealth|fortune)\b"), "Object"),

    # --- DIALOGUE/LANGUAGE: speech, catchphrases, naming ---
    (re.compile(r"\b(catchphrase|one.?liner|quip|witticism|pun|innuendo|double entendre)\b"), "Dialogue"),
    (re.compile(r"\b(speech|monologue|dialogue|soliloquy|rant|lecture|sermon|confession)\b"), "Dialogue"),
    (re.compile(r"\b(name|naming|title|called|known as|nickname|alias|pseudonym|code name)\b"), "Dialogue"),
    (re.compile(r"\b(accent|language|translation|bilingual|foreign|subtitle)\b"), "Dialogue"),
    (re.compile(r"\b(profanity|swearing|curse word|censored|bleep|euphemism|slang)\b"), "Dialogue"),
    (re.compile(r"\b(narrat(or|ion)|voice.?over|breaking the fourth wall|fourth wall|aside|caption)\b"), "Dialogue"),
    (re.compile(r"\b(saying|phrase|expression|idiom|proverb|motto|slogan|tagline|title drop)\b"), "Dialogue"),

    # --- GENRE/TONE: genre markers, mood, atmosphere ---
    (re.compile(r"\b(horror|comedy|drama|romance|tragedy|satire|parody|farce|slapstick)\b"), "Genre/Tone"),
    (re.compile(r"\b(fantasy|sci.?fi|science fiction|western|noir|thriller|mystery|detective|crime)\b"), "Genre/Tone"),
    (re.compile(r"\b(anime|manga|comic|cartoon|sitcom|soap opera|musical|documentary)\b"), "Genre/Tone"),
    (re.compile(r"\b(dark|gritty|lighthearted|whimsical|surreal|absurd|campy|cheesy|corny|narm)\b"), "Genre/Tone"),
    (re.compile(r"\b(deconstruct|reconstruct|subver|avert|invert|play.?straight|lampshade|parody)\b"), "Genre/Tone"),
    (re.compile(r"\b(cliche|trope|convention|formula|archetype|stereotype)\b"), "Genre/Tone"),
    (re.compile(r"\b(grimdark|noblebright|crapsack|sugar bowl|world.?building)\b"), "Genre/Tone"),

    # --- VISUAL/STYLE: cinematography, art, aesthetics ---
    (re.compile(r"\b(camera|shot|angle|zoom|pan|close.?up|wide.?shot|tracking shot|pov shot)\b"), "Visual/Style"),
    (re.compile(r"\b(animation|animated|cgi|special effect|visual effect|practical effect)\b"), "Visual/Style"),
    (re.compile(r"\b(color|colour|palette|lighting|shadow|silhouette|contrast|brightness)\b"), "Visual/Style"),
    (re.compile(r"\b(art style|design|aesthetic|motif|symbol|icon|logo|emblem)\b"), "Visual/Style"),
    (re.compile(r"\b(music|song|soundtrack|score|theme song|leitmotif|sound effect|silence)\b"), "Visual/Style"),
    (re.compile(r"\b(costume|wardrobe|hair|hairstyle|makeup|tattoo|scar|eye.?patch)\b"), "Visual/Style"),
    (re.compile(r"\b(slow motion|freeze frame|split screen|montage|transition|fade|cut|smash cut)\b"), "Visual/Style"),

    # --- RELATIONSHIP: interpersonal dynamics ---
    (re.compile(r"\b(romance|love|crush|flirt|dating|marriage|divorce|affair|jealousy|heartbreak)\b"), "Relationship"),
    (re.compile(r"\b(friendship|rivalry|alliance|team|partner|duo|trio|band of|group)\b"), "Relationship"),
    (re.compile(r"\b(family|parent|child|sibling|twin|orphan|adopted|estranged|reunion)\b"), "Relationship"),
    (re.compile(r"\b(ship|shipping|otp|couple|pair|love triangle|harem|reverse harem|love interest)\b"), "Relationship"),
    (re.compile(r"\b(mentor|student|master|apprentice|protege|sensei|teacher)\b"), "Relationship"),
    (re.compile(r"\b(loyalty|trust|bond|devotion|sacrifice for|protect|guardian)\b"), "Relationship"),

    # --- NARRATIVE DEVICE: meta, structural, storytelling technique ---
    (re.compile(r"\b(trope|meta|fourth wall|lampshade|genre sav|medium aware|leaning on)\b"), "Narrative Device"),
    (re.compile(r"\b(unreliable narrator|framing device|story within|nested|recursive)\b"), "Narrative Device"),
    (re.compile(r"\b(filler|recap|bottle episode|beach episode|breather episode|clip show)\b"), "Narrative Device"),
    (re.compile(r"\b(crossover|spin.?off|shared universe|canon|fanon|word of god|retcon)\b"), "Narrative Device"),
    (re.compile(r"\b(adaptation|remake|reboot|based on|inspired by|alternate)\b"), "Narrative Device"),
    (re.compile(r"\b(censorship|rating|age.?appropriate|content warning|trigger warning)\b"), "Narrative Device"),

    # --- POWER/ABILITY: superpowers, magic systems, combat abilities ---
    (re.compile(r"\b(power|superpower|ability|skill|talent|gift|magic|spell|curse|enchant)\b"), "Power/Ability"),
    (re.compile(r"\b(telekinesis|telepathy|teleport|invisibility|invulnerability|immortal|regenerat)\b"), "Power/Ability"),
    (re.compile(r"\b(element|fire|ice|lightning|wind|earth|water|light|dark|shadow|energy|force)\b.*\b(power|magic|attack|blast|beam|bolt|ball|wave|shield|barrier)\b"), "Power/Ability"),
    (re.compile(r"\b(super strength|super speed|flight|flying|shapeshif|transform|morph)\b"), "Power/Ability"),
    (re.compile(r"\b(healing|resurrection|necromancy|summoning|conjur|enchant|illusion|mind control)\b"), "Power/Ability"),
]

def classify_rule(name_split, desc_short):
    """Return category if a rule matches, else None."""
    text = name_split + " " + desc_short
    for pattern, category in RULES:
        if pattern.search(text):
            return category
    return None

print("Applying rule-based classification ...")
categories = []
rule_matched = 0
for name_s, desc_s in zip(split_names, short_descs):
    cat = classify_rule(name_s, desc_s)
    categories.append(cat)
    if cat:
        rule_matched += 1

print(f"  Rule-matched: {rule_matched:,} / {len(trope_ids):,} ({100*rule_matched/len(trope_ids):.1f}%)")
unmatched = sum(1 for c in categories if c is None)
print(f"  Unmatched: {unmatched:,} ({100*unmatched/len(trope_ids):.1f}%)")

# =====================================================================
# Step 4: Classifier for unmatched tropes
# =====================================================================
print("\nTraining classifier on rule-labeled tropes ...")

# Combine name (repeated for weight) + short description
texts_all = [split_names[i] + " " + split_names[i] + " " + short_descs[i] for i in range(len(trope_ids))]

vectorizer = TfidfVectorizer(
    max_features=15000, ngram_range=(1, 2),
    min_df=2, max_df=0.4, sublinear_tf=True,
    stop_words="english",
)
X_all = vectorizer.fit_transform(texts_all)

labeled_idx = [i for i, c in enumerate(categories) if c is not None]
unlabeled_idx = [i for i, c in enumerate(categories) if c is None]

X_labeled = X_all[labeled_idx]
y_labeled = [categories[i] for i in labeled_idx]

clf = SGDClassifier(loss="modified_huber", random_state=42, max_iter=1000, class_weight="balanced")
cv_scores = cross_val_score(clf, X_labeled, y_labeled, cv=5, scoring="accuracy")
print(f"  5-fold CV accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std():.3f})")

clf.fit(X_labeled, y_labeled)
if unlabeled_idx:
    X_unlabeled = X_all[unlabeled_idx]
    preds = clf.predict(X_unlabeled)
    pred_proba = clf.predict_proba(X_unlabeled)
    max_probs = pred_proba.max(axis=1)

    for j, idx in enumerate(unlabeled_idx):
        categories[idx] = preds[j]

    print(f"  Predicted {len(unlabeled_idx):,} unlabeled tropes")
    print(f"  Confidence: mean={max_probs.mean():.3f}, median={np.median(max_probs):.3f}, min={max_probs.min():.3f}")

# =====================================================================
# Step 5: Results
# =====================================================================
cat_counts = Counter(categories)

print(f"\n{'='*70}")
print("TROPE CATEGORY DISTRIBUTION")
print(f"{'='*70}")
for cat, count in cat_counts.most_common():
    print(f"  {cat:20s}  {count:>6,}  ({100*count/len(trope_ids):.1f}%)")

# =====================================================================
# Step 6: Report
# =====================================================================
CATEGORY_DESCRIPTIONS = {
    "Character":        "Character archetypes, types, roles, species",
    "Plot Device":      "Narrative mechanics, plot structures, story patterns",
    "Event":            "Dramatic moments, battles, deaths, transformations",
    "Setting":          "Locations, worlds, environments, time periods",
    "Object":           "Props, weapons, artifacts, vehicles, technology",
    "Dialogue":         "Speech patterns, catchphrases, naming conventions",
    "Genre/Tone":       "Genre markers, mood, atmosphere, meta-genre",
    "Visual/Style":     "Cinematography, art, music, aesthetics",
    "Relationship":     "Interpersonal dynamics, romance, family, teams",
    "Narrative Device": "Meta-narrative, structural, storytelling techniques",
    "Power/Ability":    "Superpowers, magic systems, combat abilities",
}

cat_to_idx = defaultdict(list)
for i, c in enumerate(categories):
    cat_to_idx[c].append(i)

report_lines = []
report_lines.append("TV Tropes Semantic Category Report")
report_lines.append("=" * 80)
report_lines.append("")
report_lines.append("Categories assigned via rule-based pattern matching on trope names")
report_lines.append("and descriptions, with a TF-IDF + SGD classifier for unmatched tropes.")
report_lines.append(f"Rule-matched: {rule_matched:,} / {len(trope_ids):,} ({100*rule_matched/len(trope_ids):.1f}%)")
report_lines.append(f"Classifier-predicted: {len(trope_ids)-rule_matched:,} ({100*(len(trope_ids)-rule_matched)/len(trope_ids):.1f}%)")
report_lines.append(f"Classifier 5-fold CV accuracy: {cv_scores.mean():.3f}")
report_lines.append("")

for cat, count in cat_counts.most_common():
    report_lines.append(f"\n{'─'*80}")
    report_lines.append(f"  {cat.upper()}  —  {count:,} tropes ({100*count/len(trope_ids):.1f}%)")
    report_lines.append(f"  {CATEGORY_DESCRIPTIONS.get(cat, '')}")
    report_lines.append(f"{'─'*80}")

    samples = [trope_names[i] for i in cat_to_idx[cat][:15]]
    report_lines.append(f"  Sample tropes:")
    for s in samples:
        report_lines.append(f"    • {s}")

report_path = os.path.join(DATA_DIR, "tropes_cluster_report.txt")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines))
print(f"\nWritten {report_path}")

# =====================================================================
# Step 7: Write tropes_clustered.csv
# =====================================================================
print("Writing tropes_clustered.csv ...")

# Build lookup: TropeID -> category
id_to_cat = {}
for i, tid in enumerate(trope_ids):
    id_to_cat[tid] = categories[i]

out_path = os.path.join(DATA_DIR, "tropes_clustered.csv")
with open(os.path.join(DATA_DIR, "tropes.csv"), "r", encoding="utf-8", errors="replace") as fin, \
     open(out_path, "w", encoding="utf-8", newline="") as fout:
    reader = csv.DictReader(fin)
    fieldnames = reader.fieldnames + ["category"]
    writer = csv.DictWriter(fout, fieldnames=fieldnames)
    writer.writeheader()
    for row in reader:
        row["category"] = id_to_cat.get(row["TropeID"], "")
        writer.writerow(row)
print(f"  Written {out_path}")

# =====================================================================
# Step 8: Visualizations
# =====================================================================

# Color palette
COLORS = {
    "Character":        "#3498db",
    "Plot Device":      "#e74c3c",
    "Event":            "#f39c12",
    "Setting":          "#2ecc71",
    "Object":           "#9b59b6",
    "Dialogue":         "#1abc9c",
    "Genre/Tone":       "#e67e22",
    "Visual/Style":     "#34495e",
    "Relationship":     "#e91e63",
    "Narrative Device": "#00bcd4",
    "Power/Ability":    "#8bc34a",
}

CATEGORY_ORDER = [cat for cat, _ in cat_counts.most_common()]
cat_arr = np.array(categories)

# 8a. Bar chart
print("Plotting bar chart ...")
fig, ax = plt.subplots(figsize=(11, 6))
sorted_cats = cat_counts.most_common()
cat_names_s = [c for c, _ in sorted_cats]
cat_sizes_s = [n for _, n in sorted_cats]
colors = [COLORS.get(c, "#999") for c in cat_names_s]

bars = ax.barh(range(len(cat_names_s)), cat_sizes_s, color=colors)
ax.set_yticks(range(len(cat_names_s)))
ax.set_yticklabels(cat_names_s, fontsize=10)
ax.set_xlabel("Number of Tropes")
ax.set_title("TV Tropes by Semantic Category", fontsize=14, fontweight="bold")
ax.invert_yaxis()
for bar, size in zip(bars, cat_sizes_s):
    ax.text(bar.get_width() + 30, bar.get_y() + bar.get_height() / 2,
            f"{size:,} ({100*size/len(trope_ids):.1f}%)", va="center", fontsize=9)
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "tropes_cluster_distribution.png"), dpi=150)
plt.close()
print("  Written tropes_cluster_distribution.png")

# 8b. UMAP
print("Running UMAP on tropes (this will take a moment) ...")
reducer = umap.UMAP(
    n_components=2, n_neighbors=25, min_dist=0.25,
    metric="cosine", random_state=42, low_memory=True,
)
coords = reducer.fit_transform(X_all)
print(f"  UMAP done. Shape: {coords.shape}")

# 8c. All categories scatter
print("Plotting combined scatter ...")
fig, ax = plt.subplots(figsize=(16, 11))
for cat in reversed(CATEGORY_ORDER):
    mask = cat_arr == cat
    ax.scatter(coords[mask, 0], coords[mask, 1],
               c=COLORS.get(cat, "#999"), label=f"{cat} ({mask.sum():,})",
               s=2, alpha=0.4, edgecolors="none", rasterized=True)

ax.set_title("TV Tropes — Semantic Categories (UMAP projection)", fontsize=14, fontweight="bold")
ax.set_xlabel("UMAP 1")
ax.set_ylabel("UMAP 2")
ax.legend(markerscale=6, fontsize=9, loc="upper right", framealpha=0.9, edgecolor="gray")
ax.set_xticks([])
ax.set_yticks([])
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "tropes_scatter_all.png"), dpi=200)
plt.close()
print("  Written tropes_scatter_all.png")

# 8d. Per-category grid
print("Plotting per-category grid ...")
ncats = len(CATEGORY_ORDER)
ncols = 4
nrows = 3
fig, axes = plt.subplots(nrows, ncols, figsize=(22, 15))

for idx, cat in enumerate(CATEGORY_ORDER):
    r, c = divmod(idx, ncols)
    ax = axes[r][c]
    mask = cat_arr == cat
    ax.scatter(coords[~mask, 0], coords[~mask, 1],
               c="#e8e8e8", s=0.3, alpha=0.15, edgecolors="none", rasterized=True)
    ax.scatter(coords[mask, 0], coords[mask, 1],
               c=COLORS.get(cat, "#999"), s=2.5, alpha=0.6, edgecolors="none", rasterized=True)
    ax.set_title(f"{cat}  ({mask.sum():,})", fontsize=12, fontweight="bold",
                 color=COLORS.get(cat, "#999"),
                 path_effects=[pe.withStroke(linewidth=0.5, foreground="black")])
    ax.set_xticks([])
    ax.set_yticks([])

# Hide unused subplots
for idx in range(ncats, nrows * ncols):
    r, c = divmod(idx, ncols)
    axes[r][c].set_visible(False)

plt.suptitle("TV Tropes — Each Category Highlighted", fontsize=16, fontweight="bold", y=1.005)
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "tropes_scatter_grid.png"), dpi=200, bbox_inches="tight")
plt.close()
print("  Written tropes_scatter_grid.png")

print("\nDone.")
