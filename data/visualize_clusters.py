"""
Visualize TMI motif categories as colored 2D scatterplots using UMAP
on TF-IDF vectors.

Outputs:
  - cluster_scatter_all.png      : all categories in one plot
  - cluster_scatter_grid.png     : one subplot per category (highlight vs gray)
  - cluster_scatter_no_being.png : all except Being (to see smaller categories)
"""
import csv
import os
import re

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
import umap

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
csv.field_size_limit(10 * 1024 * 1024)

# ── Load clustered data ──────────────────────────────────────────────
print("Loading tmi_clustered.csv ...")
motif_names = []
categories = []
chapter_names = []

with open(os.path.join(DATA_DIR, "tmi_clustered.csv"), "r", encoding="utf-8", errors="replace") as f:
    reader = csv.DictReader(f)
    for row in reader:
        motif_names.append(row["motif_name"])
        categories.append(row["category"])
        chapter_names.append(row["chapter_name"])

n = len(motif_names)
print(f"  {n:,} motifs")

# ── TF-IDF vectorization ─────────────────────────────────────────────
print("Vectorizing ...")

def preprocess(name):
    name = name.lower()
    name = re.sub(r"[^a-z0-9\s\-]", " ", name)
    return re.sub(r"\s+", " ", name).strip()

texts = [preprocess(nm) + " __CH_" + ch.replace(" ", "_")
         for nm, ch in zip(motif_names, chapter_names)]

vectorizer = TfidfVectorizer(
    max_features=8000, ngram_range=(1, 2),
    min_df=2, max_df=0.5, sublinear_tf=True,
)
tfidf = vectorizer.fit_transform(texts)

# ── UMAP reduction ───────────────────────────────────────────────────
print("Running UMAP (this may take a moment) ...")
reducer = umap.UMAP(
    n_components=2,
    n_neighbors=30,
    min_dist=0.3,
    metric="cosine",
    random_state=42,
    low_memory=True,
)
coords = reducer.fit_transform(tfidf)
print(f"  UMAP done. Shape: {coords.shape}")

# ── Color palette ────────────────────────────────────────────────────
CATEGORY_ORDER = ["Being", "Action", "Place", "Event", "Object",
                  "Origin", "Attribute", "Condition", "Outcome"]

COLORS = {
    "Being":     "#3498db",   # blue
    "Action":    "#e74c3c",   # red
    "Place":     "#2ecc71",   # green
    "Event":     "#f39c12",   # orange
    "Object":    "#9b59b6",   # purple
    "Origin":    "#1abc9c",   # teal
    "Attribute": "#e67e22",   # dark orange
    "Condition": "#95a5a6",   # gray
    "Outcome":   "#d35400",   # burnt orange
}

cat_arr = np.array(categories)

# ── Plot 1: All categories combined ─────────────────────────────────
print("Plotting combined scatter ...")
fig, ax = plt.subplots(figsize=(14, 10))

# Plot smaller categories first so they're not hidden behind Being
for cat in reversed(CATEGORY_ORDER):
    mask = cat_arr == cat
    ax.scatter(
        coords[mask, 0], coords[mask, 1],
        c=COLORS[cat], label=f"{cat} ({mask.sum():,})",
        s=1.5, alpha=0.4, edgecolors="none", rasterized=True,
    )

ax.set_title("TMI Motifs — Semantic Categories (UMAP projection)", fontsize=14, fontweight="bold")
ax.set_xlabel("UMAP 1")
ax.set_ylabel("UMAP 2")
ax.legend(markerscale=8, fontsize=10, loc="upper right",
          framealpha=0.9, edgecolor="gray")
ax.set_xticks([])
ax.set_yticks([])
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "cluster_scatter_all.png"), dpi=200)
plt.close()
print("  Written cluster_scatter_all.png")

# ── Plot 2: Exclude Being to see structure of smaller categories ────
print("Plotting scatter without Being ...")
fig, ax = plt.subplots(figsize=(14, 10))

non_being = cat_arr != "Being"
# Faint Being in background
ax.scatter(
    coords[~non_being, 0], coords[~non_being, 1],
    c="#e0e0e0", s=0.5, alpha=0.15, edgecolors="none", rasterized=True,
    label=f"Being ({(~non_being).sum():,}) [background]",
)
for cat in reversed(CATEGORY_ORDER):
    if cat == "Being":
        continue
    mask = cat_arr == cat
    ax.scatter(
        coords[mask, 0], coords[mask, 1],
        c=COLORS[cat], label=f"{cat} ({mask.sum():,})",
        s=3, alpha=0.5, edgecolors="none", rasterized=True,
    )

ax.set_title("TMI Motifs — Categories (Being faded to background)", fontsize=14, fontweight="bold")
ax.set_xlabel("UMAP 1")
ax.set_ylabel("UMAP 2")
ax.legend(markerscale=6, fontsize=10, loc="upper right",
          framealpha=0.9, edgecolor="gray")
ax.set_xticks([])
ax.set_yticks([])
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "cluster_scatter_no_being.png"), dpi=200)
plt.close()
print("  Written cluster_scatter_no_being.png")

# ── Plot 3: Per-category grid (each highlights one category) ────────
print("Plotting per-category grid ...")
ncats = len(CATEGORY_ORDER)
ncols = 3
nrows = 3
fig, axes = plt.subplots(nrows, ncols, figsize=(18, 16))

for idx, cat in enumerate(CATEGORY_ORDER):
    r, c = divmod(idx, ncols)
    ax = axes[r][c]

    mask = cat_arr == cat

    # Gray background for everything else
    ax.scatter(
        coords[~mask, 0], coords[~mask, 1],
        c="#e8e8e8", s=0.3, alpha=0.2, edgecolors="none", rasterized=True,
    )
    # Highlighted category
    ax.scatter(
        coords[mask, 0], coords[mask, 1],
        c=COLORS[cat], s=2, alpha=0.6, edgecolors="none", rasterized=True,
    )

    ax.set_title(f"{cat}  ({mask.sum():,})", fontsize=13, fontweight="bold",
                 color=COLORS[cat],
                 path_effects=[pe.withStroke(linewidth=0.5, foreground="black")])
    ax.set_xticks([])
    ax.set_yticks([])

plt.suptitle("TMI Motifs — Each Category Highlighted", fontsize=16, fontweight="bold", y=1.01)
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "cluster_scatter_grid.png"), dpi=200, bbox_inches="tight")
plt.close()
print("  Written cluster_scatter_grid.png")

print("\nDone.")
