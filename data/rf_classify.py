"""
Improved TMI motif classification using Random Forest + ollama validation.

Replaces cluster_tmi.py + split_being.py with:
  1. Fixed rule-based classification (Being-priority subject detection)
  2. RandomForestClassifier instead of SGDClassifier
  3. Ollama-based validation on a small sample for accuracy measurement
  4. Being subcategory classification with the same approach

Outputs:
  - tmi_clustered.csv              : full TMI with improved category + subcategory labels
  - rf_classification_report.txt   : accuracy metrics and analysis
"""
import csv
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import cross_val_score

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("WARNING: requests not available — ollama validation will be skipped")

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
csv.field_size_limit(10 * 1024 * 1024)
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "mistral-small3.1"

# =====================================================================
# Step 1: Load data
# =====================================================================
print("Reading motif data from tmi.csv ...")
rows = []
with open(os.path.join(DATA_DIR, "tmi.csv"), "r", encoding="utf-8", errors="replace") as f:
    reader = csv.DictReader(f)
    original_fieldnames = reader.fieldnames
    for row in reader:
        rows.append({
            "id": row["id"],
            "motif_name": row["motif_name"],
            "chapter_name": row["chapter_name"],
            "level": row["level"],
        })
print(f"  {len(rows):,} motifs loaded")

# Keep full rows for CSV output
full_rows = []
with open(os.path.join(DATA_DIR, "tmi.csv"), "r", encoding="utf-8", errors="replace") as f:
    reader = csv.DictReader(f)
    for row in reader:
        full_rows.append(row)

# =====================================================================
# Step 2: Fixed rule-based classification
# =====================================================================
# KEY FIX: Subject-position Being detection runs FIRST.
# If a motif starts with a being word, it's classified as Being regardless
# of other keywords appearing later in the name.

# --- Subject-position Being detector (runs FIRST) ---
_BEING_SUBJECT = re.compile(
    r"^(the )?(god[sd]?|goddess|deity|deities|demiurg|demigod|creator|creators|"
    r"culture hero|divine|angel|angels|archangel|demon|demons|devil|devils|satan|lucifer|"
    r"spirit|spirits|ghost|ghosts|soul|souls|phantom|specter|wraith|banshee|"
    r"fairy|fairies|elf|elves|dwarf|dwarfs|dwarves|gnome|pixie|brownie|leprechaun|"
    r"king|queen|prince|princess|knight|warrior|chief|"
    r"hero|heroine|trickster|fool|saint|prophet|priest|shaman|"
    r"witch|witches|wizard|sorcerer|sorceress|magician|enchanter|enchantress|"
    r"giant|giants|ogre|ogress|dragon|dragons|troll|trolls|cyclop|monster|monsters|"
    r"gorgon|basilisk|hydra|chimera|minotaur|sphinx|griffin|phoenix|unicorn|"
    r"vampire|werewolf|zombie|revenant|ghoul|"
    r"mermaid|merman|siren|selkie|kelpie|"
    r"animal|animals|bird|birds|fish|fishes|insect|insects|serpent|snake|"
    r"fox|wolf|wolves|bear|lion|tiger|eagle|raven|crow|hawk|owl|"
    r"cat|dog|horse|deer|hare|rabbit|mouse|mice|rat|"
    r"frog|toad|turtle|tortoise|monkey|ape|elephant|cow|bull|ox|"
    r"pig|boar|goat|sheep|ram|cock|hen|duck|goose|swan|dove|"
    r"parrot|ant|bee|spider|whale|shark|dolphin|salmon|coyote|jackal|"
    r"hyena|leopard|crocodile|lizard|scorpion|beetle|butterfly|donkey|"
    r"mule|camel|buffalo|stork|crane|heron|sparrow|magpie|cuckoo|"
    r"vulture|bat|squirrel|hedgehog|beaver|otter|badger|weasel|"
    r"peacock|worm|fly|flea|crab|snail|eel|"
    r"man|men|woman|women|person|people|wife|husband|"
    r"boy|girl|child|children|son|daughter|father|mother|brother|sister|"
    r"thief|robber|murderer|criminal|outlaw|bandit|pirate|"
    r"servant|slave|master|lord|lady|nobleman|peasant|farmer|merchant|"
    r"fisherman|hunter|soldier|blacksmith|carpenter|tailor|cobbler|miller|"
    r"baker|innkeeper|shepherd|beggar|orphan|widow|"
    r"maiden|youth|lad|lass|bride|groom|lover|suitor|"
    r"stepmother|stepfather|stepsister|stepbrother|"
    r"monk|nun|hermit|bishop|pope|clergyman|pastor|rabbi|imam|"
    r"mortal|human|cannibal|wild man|wild woman|"
    r"changeling|bogeyman|bogey|imp|succubus|incubus|"
    r"dead man|dead men|dead woman|dead person|dead people)\b", re.I
)

# --- Rules for non-Being categories (applied only when subject is NOT a being) ---
NON_BEING_RULES = [
    # CONDITION
    (re.compile(r"^tabu\b"), "Condition"),
    (re.compile(r"\btabu\b.*\b(breaking|broken|violated|violating)\b"), "Condition"),
    (re.compile(r"\b(prohibition|forbidden|curse[ds]?|enchant(?:ment|ed)|disenchant|spell|geis|geas|oath|vow|compact|bargain|ban)\b"), "Condition"),

    # ORIGIN
    (re.compile(r"^origin\b"), "Origin"),
    (re.compile(r"^why\b"), "Origin"),
    (re.compile(r"^how\b"), "Origin"),
    (re.compile(r"\borigin of\b"), "Origin"),
    (re.compile(r"\bcreation of\b"), "Origin"),
    (re.compile(r"\bfrom (body|blood|bones|tears|sweat|breath|spittle|excrement)\b"), "Origin"),

    # OUTCOME
    (re.compile(r"^punishment\b"), "Outcome"),
    (re.compile(r"^reward\b"), "Outcome"),
    (re.compile(r"\bpunishment for\b"), "Outcome"),
    (re.compile(r"\breward for\b"), "Outcome"),
    (re.compile(r"\b(retaliation|retribution|vengeance|penance|atonement)\b"), "Outcome"),
    (re.compile(r"\bas punishment\b"), "Outcome"),
    (re.compile(r"\bas reward\b"), "Outcome"),

    # ACTION
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

    # EVENT
    (re.compile(r"^(birth|death|marriage|war|battle|flood|deluge|famine|plague|fire)\b"), "Event"),
    (re.compile(r"\b(birth of|death of|marriage of|war between|battle of|duel)\b"), "Event"),
    (re.compile(r"\b(resurrection|reincarnation|metempsychosis|rebirth)\b"), "Event"),
    (re.compile(r"\b(wedding|funeral|feast|banquet|sacrifice|ordeal)\b"), "Event"),
    (re.compile(r"\b(murder|suicide|execution|drowning|burning|hanging|beheading)\b"), "Event"),
    (re.compile(r"\b(dream|vision|prophecy|omen|oracle|sign|portent)\b"), "Event"),
    (re.compile(r"\b(adventure|episode|incident|catastrophe|disaster|miracle)\b"), "Event"),
    (re.compile(r"\b(arrival|departure|return|journey|voyage|pilgrimage|migration)\b"), "Event"),
    (re.compile(r"\b(combat|fight|quarrel|dispute|conflict)\b"), "Event"),

    # PLACE
    (re.compile(r"^(heaven|hell|otherworld|underworld|paradise|purgatory)\b"), "Place"),
    (re.compile(r"\b(heaven|hell|otherworld|underworld|paradise|purgatory|land of)\b"), "Place"),
    (re.compile(r"\b(castle|palace|tower|temple|church|monastery|city|village)\b"), "Place"),
    (re.compile(r"\b(forest|mountain|island|lake|river|sea|ocean|cave|well|spring|bridge)\b"), "Place"),
    (re.compile(r"\b(kingdom|realm|country|world|earth|sky|firmament)\b"), "Place"),

    # OBJECT
    (re.compile(r"^magic (object|sword|ring|stone|wand|staff|cup|mirror|lamp|cloak|hat|shoe|bag|box|key|horn|belt|book|carpet|rope|chain|net|arrow|spear|shield|boat|ship|mill|drum|flute|pipe|fiddle|harp)\b"), "Object"),
    (re.compile(r"\bmagic (object|weapon|food|drink|fruit|herb|plant|medicine|ointment|salve|water|potion|elixir)\b"), "Object"),
    (re.compile(r"\b(sword|ring|stone|wand|staff|cup|mirror|lamp|cloak|hat|shoes?|boots?|gloves?|belt|girdle)\b.*\b(magic|enchanted|wonderful|extraordinary|remarkable)\b"), "Object"),
    (re.compile(r"\b(magic|enchanted|wonderful|extraordinary|remarkable)\b.*\b(sword|ring|stone|wand|staff|cup|mirror|lamp|cloak|hat)\b"), "Object"),
    (re.compile(r"\b(talisman|amulet|charm|relic|treasure|hoard)\b"), "Object"),

    # ATTRIBUTE
    (re.compile(r"^(extraordinary|remarkable|marvelous|wonderful|supernatural|magic)\b.*(strength|beauty|wisdom|power|sight|hearing|speed|size|skill|voice|intelligence|memory|appetite|thirst)\b"), "Attribute"),
    (re.compile(r"\b(color|colour|shape|size|form|appearance|beauty|ugliness|deformity)\b"), "Attribute"),
    (re.compile(r"\b(invulnerab|invisibl|immortal|omnisci|omnipoten)\b"), "Attribute"),
    (re.compile(r"\b(strong|weak|wise|foolish|clever|stupid|beautiful|ugly|rich|poor|lucky|unlucky|grateful|ungrateful|kind|cruel)\b.*\b(man|woman|person|hero|king|queen)\b"), "Attribute"),
    (re.compile(r"\b(man|woman|person|hero|king|queen)\b.*\b(strong|weak|wise|foolish|clever|stupid|beautiful|ugly|rich|poor)\b"), "Attribute"),
]

# Additional Being patterns for motifs that don't start with a being word
# but are clearly about beings (e.g. "culture hero" anywhere, named deities)
_BEING_ANYWHERE = re.compile(
    r"\b(culture hero|fairy|fairies|dwarfs?|elves?|giants?|ogres?|trolls?|dragons?|mermaids?)\b", re.I
)


def classify_main(motif_name):
    """Classify a motif into a main category. Being-priority first."""
    lower = motif_name.lower()

    # PRIORITY: If subject position is a being word → Being
    if _BEING_SUBJECT.search(lower):
        return "Being"

    # Then check non-Being rules
    for pattern, category in NON_BEING_RULES:
        if pattern.search(lower):
            return category

    # Additional Being catch-all
    if _BEING_ANYWHERE.search(lower):
        return "Being"

    return None


print("Applying fixed rule-based classification (Being-priority) ...")
categories = []
rule_matched = 0
for r in rows:
    cat = classify_main(r["motif_name"])
    categories.append(cat)
    if cat:
        rule_matched += 1

print(f"  Rule-matched: {rule_matched:,} / {len(rows):,} ({100*rule_matched/len(rows):.1f}%)")
unmatched = sum(1 for c in categories if c is None)
print(f"  Unmatched:    {unmatched:,} ({100*unmatched/len(rows):.1f}%)")

# =====================================================================
# Step 3: Random Forest for unmatched motifs
# =====================================================================
print("\nTraining Random Forest on rule-labeled data ...")

def preprocess(name):
    name = name.lower()
    name = re.sub(r"[^a-z0-9\s\-]", " ", name)
    return re.sub(r"\s+", " ", name).strip()

# Features: TF-IDF on name + chapter token
texts_all = [preprocess(r["motif_name"]) + " __CH_" + r["chapter_name"].replace(" ", "_") for r in rows]

vectorizer = TfidfVectorizer(
    max_features=12000,
    ngram_range=(1, 2),
    min_df=2,
    max_df=0.5,
    sublinear_tf=True,
)
X_all = vectorizer.fit_transform(texts_all)

labeled_idx = [i for i, c in enumerate(categories) if c is not None]
unlabeled_idx = [i for i, c in enumerate(categories) if c is None]

X_labeled = X_all[labeled_idx]
y_labeled = [categories[i] for i in labeled_idx]

rf = RandomForestClassifier(
    n_estimators=500,
    max_depth=None,
    min_samples_leaf=2,
    class_weight="balanced",
    oob_score=True,
    n_jobs=-1,
    random_state=42,
)

# Cross-validate
cv_scores = cross_val_score(rf, X_labeled, y_labeled, cv=5, scoring="accuracy", n_jobs=-1)
print(f"  5-fold CV accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std():.3f})")

# Fit on all labeled
rf.fit(X_labeled, y_labeled)
print(f"  OOB accuracy: {rf.oob_score_:.3f}")

if unlabeled_idx:
    X_unlabeled = X_all[unlabeled_idx]
    preds = rf.predict(X_unlabeled)
    pred_proba = rf.predict_proba(X_unlabeled)
    max_probs = pred_proba.max(axis=1)

    for j, idx in enumerate(unlabeled_idx):
        categories[idx] = preds[j]

    print(f"  Predicted {len(unlabeled_idx):,} unlabeled motifs")
    print(f"  Confidence: mean={max_probs.mean():.3f}, min={max_probs.min():.3f}, "
          f"median={np.median(max_probs):.3f}")

cat_counts = Counter(categories)
print(f"\nMain category distribution:")
for cat, count in cat_counts.most_common():
    print(f"  {cat:15s}  {count:>6,}  ({100*count/len(rows):.1f}%)")


# =====================================================================
# Step 4: Being subcategory classification
# =====================================================================
print("\n" + "=" * 70)
print("BEING SUBCATEGORY CLASSIFICATION")
print("=" * 70)

being_idx = [i for i, c in enumerate(categories) if c == "Being"]
print(f"Being motifs: {len(being_idx):,}")

# --- Subcategory rule functions (same as split_being.py but with fixes) ---

def _first_words(name, n=4):
    return " ".join(name.lower().split()[:n])

# DEITY
_deity_subject = re.compile(
    r"^(the )?(god[sd]?|goddess|deity|deities|demiurg|demigod|creator|creators|"
    r"supreme being|culture hero|divine|divinit|pantheon)\b", re.I)
_deity_anywhere = re.compile(
    r"\b(god of|goddess of|god as|gods and|god[']s|goddess[']s|"
    r"of the gods|of god|deity|deities|divine|demiurg|demigod|"
    r"pantheon|olymp|culture hero|heavenly beings?)\b", re.I)
_deity_names = re.compile(
    r"\b(zeus|odin|thor|vishnu|shiva|brahma|indra|ra|isis|osiris|apollo|"
    r"athena|aphrodite|loki|freya|ganesh|krishna|buddha|allah|yahweh|jehovah|"
    r"jupiter|mars|venus|mercury|neptune|pluto|saturn|diana|juno|minerva|"
    r"hera|ares|hermes|poseidon|hades|dionysus|artemis|hephaestus|demeter|"
    r"persephone|siva|parvati|lakshmi|saraswati|durga|kali|hanuman|rama|"
    r"tyr|balder|heimdall|freyja|frigg|njord|ymir|baal|marduk|enlil|enki|"
    r"inanna|ishtar|tiamat|quetzalcoatl|coyolxauhqui|tezcatlipoca|"
    r"amaterasu|susanoo|izanagi|izanami|maui|pele|anansi|eshu|"
    r"cernunnos|dagda|brigid|lugh|morrigan|manann[aá]n|danu)\b", re.I)
_parent_of_gods = re.compile(
    r"\b(father|mother|parent|ancestor|birth|born)\b.*\b(god|gods|goddess|deities)\b", re.I)

def is_deity(name, chapter):
    lower = name.lower()
    first = _first_words(name)
    if _deity_subject.search(first):
        return True
    if _deity_names.search(lower):
        return True
    if _parent_of_gods.search(lower):
        return True
    if lower.startswith("the gods") or lower.startswith("gods "):
        return True
    if re.match(r"^(the )?(god|goddess|deity|the god|the goddess|creator)", lower):
        return True
    # "X god" or "X goddess" patterns (e.g. "shepherd-god", "monkey as god")
    if re.search(r"\b(as |-)god\b", lower) or re.search(r"\b(as |-)goddess\b", lower):
        return True
    # "Adj God" patterns: "man-eating god", "eldest god", "one-eyed god", etc.
    # God/goddess/deity appears within first ~6 words as the head noun
    first6 = " ".join(lower.split()[:6])
    if re.search(r"\bgod[sd]?\b", first6) or re.search(r"\bgoddess\b", first6) or re.search(r"\bdeity\b", first6):
        # But not "man/woman/person ... god" where human is clearly the subject doing something TO a god
        if not re.match(r"^(man|woman|person|people|men|women|child|boy|girl|son|daughter|wife|husband|queen|king|prince|princess)\b.*(kills?|slays?|defeats?|meets?|marries|visits?|tricks?|deceives?|serves?)\b.*\bgod", lower):
            return True
    # Strong deity words anywhere + Myths chapter
    if chapter == "Myths" and _deity_anywhere.search(lower):
        return True
    # "characteristics/nature/attributes of deity/god"
    if re.search(r"\b(characteristics|nature|attributes|qualities|powers?) of (the )?(god|gods|deity|deities|creator)\b", lower):
        return True
    # "X of the gods" patterns that are about gods
    if re.search(r"\bof (the )?gods\b", lower):
        # These are about the gods as a group
        if any(w in lower for w in ["king of the gods", "queen of the gods", "war of the gods",
                                     "death of the gods", "home of the gods", "food of the gods",
                                     "gift of the gods", "wrath of the gods", "of the gods"]):
            return True
    return False

# WITCH/SORCERER
_witch_subject = re.compile(
    r"^(the )?(witch|witches|wizard|sorcerer|sorceress|magician|enchanter|enchantress|"
    r"necromancer|conjurer|shaman|medicine man|medicine woman|cunning man|cunning woman|"
    r"warlock|hag)\b", re.I)
_witch_anywhere = re.compile(
    r"\b(witch(es|\'s)?|wizard|sorcerer|sorceress|magician|enchanter|enchantress|"
    r"necromancer|conjurer|shaman|warlock)\b", re.I)

def is_witch(name, chapter):
    lower = name.lower()
    first = _first_words(name)
    if _witch_subject.search(first):
        return True
    if chapter == "Monsters" and _witch_anywhere.search(lower):
        return True
    if re.search(r"\bby (witch|sorcerer|magician|wizard|enchant)\b", lower):
        return True
    return False

# SPIRIT
_spirit_subject = re.compile(
    r"^(the )?(spirit|spirits|ghost|ghosts|soul|souls|phantom|specter|wraith|banshee|poltergeist|"
    r"fairy|fairies|elf|elves|dwarf|dwarfs|dwarves|gnome|pixie|brownie|leprechaun|kobold|"
    r"sprite|nymph|sylph|satyr|centaur|valkyrie|muse|genie|djinn|jinn|"
    r"angel|angels|archangel|seraph|cherub|"
    r"demon|demons|devil|devils|satan|lucifer|fiend|imp|succubus|incubus|"
    r"vampire|werewolf|undead|zombie|revenant|ghoul|"
    r"mermaid|merman|merfolk|siren|selkie|kelpie|nixie|naiad|"
    r"changeling|the dead|dead man|dead men|dead woman|dead person|dead people|"
    r"the departed|revenant|bogeyman|bogey|knocker|will-o)\b", re.I)
_spirit_anywhere = re.compile(
    r"\b(ghost[s]?[\'s]?|spirit[s]?[\'s]?|soul[s]?[\'s]?|phantom|specter|wraith|banshee|poltergeist|"
    r"fairy|fairies|fairy[\'s]|elf|elves|dwarf[s]?|dwarves|gnome|pixie|brownie|leprechaun|kobold|"
    r"angel[s]?|archangel|seraph|cherub|"
    r"demon[s]?|devil[s]?|satan[\'s]?|lucifer|fiend|imp[s]?\b|"
    r"vampire|werewolf|undead|zombie|revenant|ghoul|"
    r"mermaid|merman|siren|selkie|kelpie|nixie|"
    r"changeling|revenant|bogey|bogeyman)\b", re.I)
_dead_subject = re.compile(r"^(the )?(dead|the dead|ghost|resuscitat|return from (the )?dead|return of the dead)\b", re.I)

def is_spirit(name, chapter):
    lower = name.lower()
    first = _first_words(name)
    if _spirit_subject.search(first):
        return True
    if chapter == "Death" and _spirit_anywhere.search(lower):
        return True
    if chapter == "Death" and _dead_subject.search(lower):
        return True
    if _spirit_anywhere.search(first):
        return True
    if re.search(r"\b(fairy|ghost|spirit|angel|demon|devil|vampire|werewolf|elf|dwarf|mermaid)[s]?\b", lower):
        if chapter in ("Marvels", "Death", "Monsters", "Religion"):
            return True
        if re.match(r"^(the )?(fairy|ghost|spirit|angel|demon|devil|vampire|werewolf|elf|dwarf|mermaid)", lower):
            return True
        if re.search(r"\bof (the )?(fairy|fairies|ghost|spirits?|angel|demons?|devils?|vampires?|elves|dwarfs?)\b", lower):
            return True
    return False

# MONSTER
_monster_subject = re.compile(
    r"^(the )?(giant|giants|monster|monsters|dragon|dragons|troll|trolls|cyclop|gorgon|basilisk|"
    r"hydra|chimera|minotaur|sphinx|griffin|phoenix|unicorn|thunderbird|"
    r"kraken|leviathan|behemoth|manticore|cerberus|"
    r"sea.?monster|water.?monster|man.?eater|cannibal|wild man|wild woman|"
    r"ogress)\b", re.I)
_monster_anywhere = re.compile(
    r"\b(giant[s]?[\'s]?|monster[s]?|dragon[s]?|troll[s]?|cyclop|gorgon|basilisk|"
    r"hydra|chimera|minotaur|griffin|manticore|cerberus|kraken|leviathan|"
    r"cannibal[s]?|man.?eat|wild man|wild woman|"
    r"ogress)\b", re.I)
_serpent_monster = re.compile(r"\b(great serpent|world serpent|sea serpent|serpent monster|monstrous serpent)\b", re.I)

def is_monster(name, chapter):
    lower = name.lower()
    first = _first_words(name)
    if _monster_subject.search(first):
        return True
    if chapter == "Monsters" and _monster_anywhere.search(lower):
        return True
    if _monster_anywhere.search(first):
        return True
    if _serpent_monster.search(lower):
        return True
    if re.search(r"\bof (the )?(giant|dragon|troll|monster|ogress)[s]?\b", lower):
        return True
    return False

# ANIMAL
_animal_names = re.compile(
    r"\b(fox|wolf|wolves|bear[s]?\b|lion|tiger|eagle|raven|crow|hawk|owl|"
    r"cat[s]?\b|dog[s]?\b|horse[s]?\b|deer|hare|rabbit|mouse|mice|rat[s]?\b|"
    r"frog|toad|turtle|tortoise|monkey|ape|elephant|cow[s]?\b|bull|ox|oxen|"
    r"pig[s]?\b|boar|goat|sheep|ram|cock|hen|duck|goose|geese|swan|dove|pigeon|"
    r"parrot|ant[s]?\b|bee[s]?\b|spider|fly|flies|mosquito|worm|crab|lobster|"
    r"whale|shark|dolphin|salmon|trout|fish|fishes|coyote|jackal|hyena|"
    r"leopard|panther|crocodile|alligator|lizard|scorpion|beetle|butterfly|"
    r"grasshopper|cricket|snail|slug|donkey|mule|camel|buffalo|"
    r"stork|crane|heron|sparrow|robin|magpie|cuckoo|woodpecker|pelican|"
    r"vulture|bat[s]?\b|squirrel|hedgehog|beaver|otter|seal[s]?\b|porcupine|"
    r"badger|skunk|raccoon|weasel|ferret|mink|lark|nightingale|swallow|"
    r"serpent|snake|viper|cobra|python|asp|adder|"
    r"locust|flea|louse|tick|maggot|caterpillar|moth|wasp|hornet|"
    r"clam|oyster|mussel|octopus|squid|jellyfish|starfish|eel|"
    r"peacock|pheasant|quail|partridge|ostrich|flamingo)\b", re.I)
_animal_subject = re.compile(
    r"^(the )?(animal|animals|bird|birds|fish|fishes|insect|insects|serpent|snake|"
    r"fox|wolf|bear|lion|tiger|eagle|raven|crow|hawk|owl|cat|dog|horse|"
    r"deer|hare|rabbit|mouse|rat|frog|toad|turtle|tortoise|monkey|ape|"
    r"elephant|cow|bull|ox|pig|boar|goat|sheep|ram|cock|hen|duck|goose|"
    r"swan|dove|ant|bee|spider|whale|shark|dolphin|salmon|coyote|jackal|"
    r"hyena|leopard|crocodile|lizard|scorpion|beetle|butterfly|donkey|"
    r"mule|camel|buffalo|stork|crane|heron|sparrow|magpie|cuckoo|"
    r"vulture|bat|squirrel|hedgehog|beaver|otter|badger|weasel|parrot|"
    r"peacock|worm|fly|flies|mosquito|flea|louse|"
    r"crab|lobster|clam|oyster|snail|octopus|eel)\b", re.I)

_human_subject_words = {"man", "woman", "person", "wife", "husband", "king", "queen",
                        "prince", "princess", "boy", "girl", "child", "children",
                        "son", "daughter", "hero", "heroine", "saint", "fool",
                        "thief", "servant", "master", "lord", "lady", "priest",
                        "monk", "nun", "maiden", "youth", "old", "farmer",
                        "hunter", "fisherman", "shepherd", "soldier", "warrior",
                        "merchant", "tailor", "cobbler", "miller", "baker",
                        "smith", "carpenter", "beggar", "orphan", "widow",
                        "bride", "groom", "lover", "suitor", "paramour"}

# Words indicating the motif is about a deity, not an animal
_deity_indicator_words = {"god", "gods", "goddess", "deity", "deities", "creator",
                          "creators", "divine", "demiurge", "demigod", "culture"}

def is_animal(name, chapter):
    lower = name.lower()
    first = _first_words(name, 3)
    first_words_set = set(lower.split()[:4])

    # If deity words are prominent, this is NOT an animal motif
    if first_words_set & _deity_indicator_words:
        return False

    # Strong: starts with animal name
    if _animal_subject.search(first):
        return True

    # Chapter signal
    if chapter == "Animals":
        if first_words_set & _human_subject_words:
            return False
        if first_words_set & _deity_indicator_words:
            return False
        return True

    first_three = set(lower.split()[:3])
    if first_three & _human_subject_words:
        return False

    # "Why X (animal)" pattern
    if re.match(r"^(why|how|origin of|creation of)\b.*\b", lower) and _animal_names.search(lower):
        return True

    if re.search(r"\b(animal (as|bride|groom|husband|wife|king|language|helper|grateful))\b", lower):
        return True
    if re.search(r"\b(speaking|talking|helpful|grateful|faithful|treacherous) (animal|bird|fish|fox|wolf|bear|lion|horse|dog|cat|eagle|raven|snake|serpent)\b", lower):
        return True

    return False

# HUMAN (catch-all)
_human_subject = re.compile(
    r"^(the )?(man|woman|person|wife|husband|king|queen|prince|princess|knight|warrior|"
    r"boy|girl|child|children|son|daughter|father|mother|brother|sister|"
    r"hero|heroine|fool|trickster|saint|prophet|priest|monk|nun|hermit|"
    r"bishop|pope|clergyman|pastor|rabbi|imam|"
    r"thief|robber|murderer|criminal|outlaw|bandit|pirate|"
    r"servant|slave|master|lord|lady|nobleman|peasant|farmer|merchant|"
    r"fisherman|hunter|soldier|blacksmith|carpenter|tailor|cobbler|miller|"
    r"baker|innkeeper|shepherd|beggar|orphan|widow|"
    r"maiden|youth|lad|lass|bride|groom|lover|suitor|paramour|"
    r"stepmother|stepfather|stepsister|stepbrother|stepdaughter|stepson|"
    r"eldest|youngest|rich|poor|clever|stupid|lazy|"
    r"mortal|human|people|men|women)\b", re.I)

def is_human(name, chapter):
    lower = name.lower()
    first = _first_words(name, 3)
    if _human_subject.search(first):
        return True
    if chapter in ("Wisdom and Folly", "Deceptions", "Sex", "Society",
                   "Humor", "Cruelty", "Captives and Fugitives"):
        return True
    return False


def classify_being(name, chapter):
    """Classify a Being motif. Order: specific → general."""
    if is_witch(name, chapter):
        return "Witch/Sorcerer"
    if is_deity(name, chapter):
        return "Deity"
    if is_spirit(name, chapter):
        return "Spirit"
    if is_monster(name, chapter):
        return "Monster"
    if is_animal(name, chapter):
        return "Animal"
    if is_human(name, chapter):
        return "Human"
    return None


print("Applying Being subcategorization rules ...")
subcategories = [None] * len(rows)
being_rule_matched = 0

for i in being_idx:
    subcat = classify_being(rows[i]["motif_name"], rows[i]["chapter_name"])
    subcategories[i] = subcat
    if subcat:
        being_rule_matched += 1

# Non-Being motifs: subcategory = category
for i in range(len(rows)):
    if categories[i] != "Being":
        subcategories[i] = categories[i]

unmatched_being = sum(1 for i in being_idx if subcategories[i] is None)
print(f"  Rule-matched Being: {being_rule_matched:,} / {len(being_idx):,} ({100*being_rule_matched/len(being_idx):.1f}%)")
print(f"  Unmatched Being:    {unmatched_being:,} ({100*unmatched_being/len(being_idx):.1f}%)")

# =====================================================================
# Step 5: RF for unmatched Being motifs
# =====================================================================
print("\nTraining Random Forest for Being subcategories ...")

being_texts = [preprocess(rows[i]["motif_name"]) + " __CH_" + rows[i]["chapter_name"].replace(" ", "_")
               for i in being_idx]

vec_being = TfidfVectorizer(
    max_features=10000, ngram_range=(1, 2),
    min_df=2, max_df=0.5, sublinear_tf=True,
)
X_being = vec_being.fit_transform(being_texts)

labeled_mask = [j for j, i in enumerate(being_idx) if subcategories[i] is not None]
unlabeled_mask = [j for j, i in enumerate(being_idx) if subcategories[i] is None]

X_being_labeled = X_being[labeled_mask]
y_being_labeled = [subcategories[being_idx[j]] for j in labeled_mask]

rf_being = RandomForestClassifier(
    n_estimators=500,
    max_depth=None,
    min_samples_leaf=2,
    class_weight="balanced",
    oob_score=True,
    n_jobs=-1,
    random_state=42,
)

cv_being = cross_val_score(rf_being, X_being_labeled, y_being_labeled, cv=5, scoring="accuracy", n_jobs=-1)
print(f"  5-fold CV accuracy: {cv_being.mean():.3f} (+/- {cv_being.std():.3f})")

rf_being.fit(X_being_labeled, y_being_labeled)
print(f"  OOB accuracy: {rf_being.oob_score_:.3f}")

if unlabeled_mask:
    X_being_unlabeled = X_being[unlabeled_mask]
    being_preds = rf_being.predict(X_being_unlabeled)
    being_proba = rf_being.predict_proba(X_being_unlabeled)
    being_max_probs = being_proba.max(axis=1)

    for j, local_j in enumerate(unlabeled_mask):
        global_i = being_idx[local_j]
        subcategories[global_i] = being_preds[j]

    print(f"  Predicted {len(unlabeled_mask):,} unlabeled Being motifs")
    print(f"  Confidence: mean={being_max_probs.mean():.3f}, median={np.median(being_max_probs):.3f}")

# Post-classification corrections
print("\nApplying post-classification corrections ...")
corrections = 0
for i in being_idx:
    name = rows[i]["motif_name"]
    chapter = rows[i]["chapter_name"]
    lower = name.lower()
    old = subcategories[i]

    # Fix: deity words in subject → Deity
    if old != "Deity" and re.match(
        r"^(the )?(god[sd]?|goddess|deity|creator|creators|the god|the goddess|"
        r"the creator|demigod|culture hero|demiurg)\b", lower, re.I):
        subcategories[i] = "Deity"
        corrections += 1
    # Fix: spirit words in subject → Spirit
    elif old == "Human" and re.match(
        r"^(the )?(spirit|ghost|fairy|fairies|angel|demon|devil|satan|soul|phantom|"
        r"elf|elves|dwarf|vampire|werewolf|mermaid|banshee)\b", lower, re.I):
        subcategories[i] = "Spirit"
        corrections += 1
    # Fix: monster words in subject → Monster
    elif old == "Human" and re.match(
        r"^(the )?(giant|dragon|troll|monster|ogress|cannibal|cyclop)\b", lower, re.I):
        subcategories[i] = "Monster"
        corrections += 1
    # Fix: witch words in subject → Witch/Sorcerer
    elif old != "Witch/Sorcerer" and re.match(
        r"^(the )?(witch|witches|wizard|sorcerer|sorceress|magician|enchanter|enchantress)\b", lower, re.I):
        subcategories[i] = "Witch/Sorcerer"
        corrections += 1
    # Fix: Animals chapter, no human subject words → Animal
    elif old == "Human" and chapter == "Animals":
        first_words = set(lower.split()[:3])
        if not (first_words & _human_subject_words) and not (first_words & _deity_indicator_words):
            subcategories[i] = "Animal"
            corrections += 1
    # Fix: Monsters chapter + monster content → Monster
    elif old == "Human" and chapter == "Monsters" and _monster_anywhere.search(lower):
        subcategories[i] = "Monster"
        corrections += 1

print(f"  Corrections applied: {corrections:,}")

being_subcats = [subcategories[i] for i in being_idx]
subcat_counts = Counter(being_subcats)
print(f"\nBeing subcategory distribution:")
for sc, count in subcat_counts.most_common():
    print(f"  {sc:20s}  {count:>6,}  ({100*count/len(being_idx):.1f}%)")


# =====================================================================
# Step 6: Ollama validation
# =====================================================================
def query_ollama(motifs, valid_labels, task_description):
    """Send a batch of motifs to ollama for labeling. Returns dict {motif_name: label}."""
    if not HAS_REQUESTS:
        return {}

    motif_list = "\n".join(f"{i+1}. {m}" for i, m in enumerate(motifs))
    label_str = ", ".join(valid_labels)

    prompt = f"""You are classifying folklore motifs from the Thompson Motif Index.

{task_description}

Valid labels: {label_str}

For each motif below, respond with ONLY a JSON object mapping the motif number to its label.
Example: {{"1": "Being", "2": "Action"}}

Motifs:
{motif_list}

Respond with ONLY the JSON object, no other text."""

    try:
        resp = requests.post(OLLAMA_URL, json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1, "num_predict": 512},
        }, timeout=120)
        resp.raise_for_status()
        text = resp.json().get("response", "").strip()

        # Extract JSON from response
        # Try to find JSON in the response
        json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            result = json.loads(text)

        labels = {}
        for key, val in result.items():
            idx = int(key) - 1
            if 0 <= idx < len(motifs) and val in valid_labels:
                labels[motifs[idx]] = val
        return labels
    except Exception as e:
        print(f"  Ollama error: {e}")
        return {}


def ollama_validate(sample_indices, all_rows_data, current_labels, valid_labels, task_desc, batch_size=10):
    """Validate a sample against ollama labels. Returns (agreements, total, ollama_labels_dict)."""
    if not HAS_REQUESTS:
        print("  Skipping ollama validation (requests not available)")
        return 0, 0, {}

    # Check ollama is reachable
    try:
        requests.get("http://localhost:11434/api/tags", timeout=5)
    except Exception:
        print("  Skipping ollama validation (ollama not reachable)")
        return 0, 0, {}

    all_ollama_labels = {}
    agreements = 0
    total = 0

    for batch_start in range(0, len(sample_indices), batch_size):
        batch_idx = sample_indices[batch_start:batch_start + batch_size]
        motif_names = [all_rows_data[i]["motif_name"] for i in batch_idx]

        print(f"  Querying ollama batch {batch_start//batch_size + 1} ({len(batch_idx)} motifs) ...")
        ollama_labels = query_ollama(motif_names, valid_labels, task_desc)

        for i, idx in enumerate(batch_idx):
            name = all_rows_data[idx]["motif_name"]
            if name in ollama_labels:
                all_ollama_labels[idx] = ollama_labels[name]
                total += 1
                if ollama_labels[name] == current_labels[idx]:
                    agreements += 1

        time.sleep(0.5)  # Be gentle with ollama

    return agreements, total, all_ollama_labels


print("\n" + "=" * 70)
print("OLLAMA VALIDATION")
print("=" * 70)

# --- Main category validation ---
# Sample: stratified by category, prefer low-confidence RF predictions
MAIN_CATS = ["Being", "Action", "Place", "Event", "Object", "Origin", "Attribute", "Condition", "Outcome"]
np.random.seed(42)

# Get confidence scores for all predictions
all_proba = rf.predict_proba(X_all)
all_max_conf = all_proba.max(axis=1)

# For rule-matched items, set confidence to 1.0 (we trust rules more now)
for i in labeled_idx:
    all_max_conf[i] = 1.0

# Sample ~80 motifs: mix of low-confidence and random per category
main_sample_idx = []
for cat in MAIN_CATS:
    cat_indices = [i for i in range(len(rows)) if categories[i] == cat]
    if len(cat_indices) < 3:
        continue
    # Take ~4 lowest confidence + ~4 random from each category
    cat_confs = [(all_max_conf[i], i) for i in cat_indices]
    cat_confs.sort()
    low_conf = [idx for _, idx in cat_confs[:5]]
    remaining = [idx for _, idx in cat_confs[5:]]
    if remaining:
        random_pick = list(np.random.choice(remaining, size=min(4, len(remaining)), replace=False))
    else:
        random_pick = []
    main_sample_idx.extend(low_conf + random_pick)

main_sample_idx = main_sample_idx[:80]  # Cap at 80
np.random.shuffle(main_sample_idx)

print(f"\nValidating {len(main_sample_idx)} main-category labels with ollama ...")
main_task_desc = (
    "Classify each motif into ONE of these semantic categories:\n"
    "- Being: Characters, creatures, deities, supernatural entities, animals-as-characters\n"
    "- Action: Tasks, deceptions, tests, transformations, pursuits, escapes\n"
    "- Event: Narrative happenings: births, deaths, marriages, battles, prophecies\n"
    "- Place: Locations, realms, geographic features, cosmic settings\n"
    "- Object: Physical and magical items, artifacts, treasures, tools, weapons\n"
    "- Origin: Etiological motifs: why/how things came to be\n"
    "- Attribute: Qualities, characteristics, appearances, properties\n"
    "- Condition: Tabus, prohibitions, enchantments, curses, rules, compacts\n"
    "- Outcome: Rewards, punishments, consequences, fates\n"
    "\nClassify based on what the motif is PRIMARILY about."
)

main_agree, main_total, main_ollama = ollama_validate(
    main_sample_idx, rows, categories, MAIN_CATS, main_task_desc, batch_size=10
)

if main_total > 0:
    print(f"  Main category agreement: {main_agree}/{main_total} ({100*main_agree/main_total:.1f}%)")
    # Show disagreements
    disagree_count = 0
    for idx, ollama_label in main_ollama.items():
        if ollama_label != categories[idx]:
            if disagree_count < 15:
                print(f"    DISAGREE: [{rows[idx]['chapter_name']}] \"{rows[idx]['motif_name']}\"")
                print(f"             RF={categories[idx]}, Ollama={ollama_label}")
            disagree_count += 1
    if disagree_count > 15:
        print(f"    ... and {disagree_count - 15} more disagreements")

# --- Being subcategory validation ---
BEING_SUBCATS = ["Deity", "Human", "Animal", "Spirit", "Monster", "Witch/Sorcerer"]

being_sample_idx = []
for sc in BEING_SUBCATS:
    sc_indices = [i for i in being_idx if subcategories[i] == sc]
    if len(sc_indices) < 3:
        continue
    # Prioritize the known problem areas
    cat_confs_b = []
    for i in sc_indices:
        # Use being RF confidence where available
        local_j = being_idx.index(i)
        if local_j in unlabeled_mask and unlabeled_mask:
            # Was predicted by RF — find its confidence
            uj = unlabeled_mask.index(local_j) if local_j in unlabeled_mask else -1
            conf = being_max_probs[uj] if uj >= 0 else 1.0
        else:
            conf = 1.0
        cat_confs_b.append((conf, i))

    cat_confs_b.sort()
    low_conf_b = [idx for _, idx in cat_confs_b[:4]]
    remaining_b = [idx for _, idx in cat_confs_b[4:]]
    if remaining_b:
        random_pick_b = list(np.random.choice(remaining_b, size=min(3, len(remaining_b)), replace=False))
    else:
        random_pick_b = []
    being_sample_idx.extend(low_conf_b + random_pick_b)

being_sample_idx = being_sample_idx[:40]
np.random.shuffle(being_sample_idx)

print(f"\nValidating {len(being_sample_idx)} Being subcategory labels with ollama ...")
being_task_desc = (
    "These are folklore motifs about BEINGS (characters/creatures). "
    "Classify each into ONE subcategory:\n"
    "- Deity: Gods, goddesses, creator figures, demigods, culture heroes\n"
    "- Human: Ordinary people, royalty, social roles, named humans, heroes\n"
    "- Animal: Animals as characters, speaking/helpful/grateful animals\n"
    "- Spirit: Spirits, ghosts, angels, demons, fairies, elves, undead, merfolk\n"
    "- Monster: Giants, monsters, dragons, trolls, cannibals\n"
    "- Witch/Sorcerer: Witches, wizards, sorcerers, magicians, shamans\n"
    "\nClassify based on what the motif is PRIMARILY about."
)

being_agree, being_total, being_ollama = ollama_validate(
    being_sample_idx, rows, subcategories, BEING_SUBCATS, being_task_desc, batch_size=10
)

if being_total > 0:
    print(f"  Being subcategory agreement: {being_agree}/{being_total} ({100*being_agree/being_total:.1f}%)")
    disagree_count_b = 0
    for idx, ollama_label in being_ollama.items():
        if ollama_label != subcategories[idx]:
            if disagree_count_b < 15:
                print(f"    DISAGREE: [{rows[idx]['chapter_name']}] \"{rows[idx]['motif_name']}\"")
                print(f"             RF={subcategories[idx]}, Ollama={ollama_label}")
            disagree_count_b += 1
    if disagree_count_b > 15:
        print(f"    ... and {disagree_count_b - 15} more disagreements")


# =====================================================================
# Step 7: Incorporate ollama corrections and retrain
# =====================================================================
# Use ollama labels as corrections where they disagree with our labels
ollama_corrections_main = 0
for idx, ollama_label in main_ollama.items():
    if ollama_label != categories[idx]:
        categories[idx] = ollama_label
        ollama_corrections_main += 1
        # If changed away from Being, clear subcategory
        if ollama_label != "Being":
            subcategories[idx] = ollama_label
        else:
            # Re-classify being subcategory
            subcategories[idx] = classify_being(rows[idx]["motif_name"], rows[idx]["chapter_name"])

ollama_corrections_being = 0
for idx, ollama_label in being_ollama.items():
    if ollama_label != subcategories[idx] and categories[idx] == "Being":
        subcategories[idx] = ollama_label
        ollama_corrections_being += 1

print(f"\nOllama corrections applied: {ollama_corrections_main} main, {ollama_corrections_being} Being")

# Retrain RF on corrected data for final predictions
if ollama_corrections_main > 0:
    print("Retraining main RF with ollama corrections ...")
    labeled_idx2 = [i for i, c in enumerate(categories) if c is not None]
    X_labeled2 = X_all[labeled_idx2]
    y_labeled2 = [categories[i] for i in labeled_idx2]
    rf.fit(X_labeled2, y_labeled2)
    # Re-predict only the originally unlabeled ones (minus ollama-corrected)
    still_unlabeled = [i for i in unlabeled_idx if i not in main_ollama]
    if still_unlabeled:
        X_still = X_all[still_unlabeled]
        preds2 = rf.predict(X_still)
        for j, idx in enumerate(still_unlabeled):
            categories[idx] = preds2[j]
            if preds2[j] != "Being":
                subcategories[idx] = preds2[j]

# Final counts
final_cat_counts = Counter(categories)
final_subcat_counts = Counter(subcategories)

print(f"\n{'='*70}")
print("FINAL MAIN CATEGORY DISTRIBUTION")
print(f"{'='*70}")
for cat, count in final_cat_counts.most_common():
    print(f"  {cat:15s}  {count:>6,}  ({100*count/len(rows):.1f}%)")

print(f"\n{'='*70}")
print("FINAL SUBCATEGORY DISTRIBUTION")
print(f"{'='*70}")
for sc, count in final_subcat_counts.most_common():
    print(f"  {sc:20s}  {count:>6,}  ({100*count/len(rows):.1f}%)")

# =====================================================================
# Step 8: Write output
# =====================================================================

# Backup original
import shutil
orig_path = os.path.join(DATA_DIR, "tmi_clustered.csv")
backup_path = os.path.join(DATA_DIR, "tmi_clustered_pre_rf.csv")
if os.path.exists(orig_path):
    shutil.copy2(orig_path, backup_path)
    print(f"\nBacked up original to {backup_path}")

# Write improved CSV
print("Writing improved tmi_clustered.csv ...")
out_fieldnames = list(original_fieldnames)
if "category" not in out_fieldnames:
    out_fieldnames.append("category")
if "subcategory" not in out_fieldnames:
    out_fieldnames.append("subcategory")

with open(orig_path, "w", encoding="utf-8", newline="") as fout:
    writer = csv.DictWriter(fout, fieldnames=out_fieldnames)
    writer.writeheader()
    for i, row in enumerate(full_rows):
        row["category"] = categories[i]
        row["subcategory"] = subcategories[i]
        writer.writerow(row)
print(f"  Written {orig_path}")

# =====================================================================
# Step 9: Write report
# =====================================================================
report_lines = []
report_lines.append("TMI Motif Classification Report (Random Forest + Ollama Validation)")
report_lines.append("=" * 80)
report_lines.append("")
report_lines.append("Method: Rule-based classification (Being-priority) + RandomForestClassifier")
report_lines.append("        + ollama validation/correction on a stratified sample")
report_lines.append("")
report_lines.append(f"Total motifs: {len(rows):,}")
report_lines.append(f"Main category rule-matched: {rule_matched:,} / {len(rows):,} ({100*rule_matched/len(rows):.1f}%)")
report_lines.append(f"Main RF 5-fold CV accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std():.3f})")
report_lines.append(f"Main RF OOB accuracy: {rf.oob_score_:.3f}")
report_lines.append("")
report_lines.append(f"Being rule-matched: {being_rule_matched:,} / {len(being_idx):,} ({100*being_rule_matched/len(being_idx):.1f}%)")
report_lines.append(f"Being RF 5-fold CV accuracy: {cv_being.mean():.3f} (+/- {cv_being.std():.3f})")
report_lines.append(f"Being RF OOB accuracy: {rf_being.oob_score_:.3f}")
report_lines.append("")

if main_total > 0:
    report_lines.append(f"Ollama main-category agreement: {main_agree}/{main_total} ({100*main_agree/main_total:.1f}%)")
if being_total > 0:
    report_lines.append(f"Ollama Being-subcategory agreement: {being_agree}/{being_total} ({100*being_agree/being_total:.1f}%)")
report_lines.append(f"Ollama corrections applied: {ollama_corrections_main} main + {ollama_corrections_being} Being")
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

# Main category details
cat_chapter = defaultdict(Counter)
for r, cat in zip(rows, categories):
    cat_chapter[cat][r["chapter_name"]] += 1

for cat, count in final_cat_counts.most_common():
    report_lines.append(f"\n{'─'*80}")
    report_lines.append(f"  {cat.upper()}  —  {count:,} motifs ({100*count/len(rows):.1f}%)")
    report_lines.append(f"  {CATEGORY_DESCRIPTIONS.get(cat, '')}")
    report_lines.append(f"{'─'*80}")
    top_ch = cat_chapter[cat].most_common(5)
    report_lines.append(f"  Top chapters: {', '.join(f'{ch} ({n:,})' for ch, n in top_ch)}")
    samples = [r["motif_name"] for r, c in zip(rows, categories) if c == cat][:12]
    report_lines.append(f"  Sample motifs:")
    for s in samples:
        report_lines.append(f"    - {s}")

# Being subcategory details
SUBCAT_DESCRIPTIONS = {
    "Deity":           "Gods, goddesses, creator figures, demigods, culture heroes",
    "Human":           "Ordinary people, royalty, social roles, named humans, heroes",
    "Animal":          "Animals as characters, speaking/helpful/grateful animals",
    "Spirit":          "Spirits, ghosts, angels, demons, fairies, elves, undead, merfolk",
    "Monster":         "Giants, monsters, dragons, trolls, cannibals",
    "Witch/Sorcerer":  "Witches, wizards, sorcerers, magicians, shamans",
}

report_lines.append(f"\n\n{'='*80}")
report_lines.append("BEING SUBCATEGORY BREAKDOWN")
report_lines.append(f"{'='*80}")

being_subcat_counts = Counter(subcategories[i] for i in being_idx)
subcat_chapter = defaultdict(Counter)
for i in being_idx:
    subcat_chapter[subcategories[i]][rows[i]["chapter_name"]] += 1

for sc, count in being_subcat_counts.most_common():
    report_lines.append(f"\n{'─'*80}")
    report_lines.append(f"  {sc.upper()}  —  {count:,} motifs ({100*count/len(being_idx):.1f}% of Being)")
    report_lines.append(f"  {SUBCAT_DESCRIPTIONS.get(sc, '')}")
    report_lines.append(f"{'─'*80}")
    top_ch = subcat_chapter[sc].most_common(5)
    report_lines.append(f"  Top chapters: {', '.join(f'{ch} ({n:,})' for ch, n in top_ch)}")
    samples = [rows[i]["motif_name"] for i in being_idx if subcategories[i] == sc][:12]
    report_lines.append(f"  Sample motifs:")
    for s in samples:
        report_lines.append(f"    - {s}")

# Cross-tabulation
all_chapters = sorted(set(r["chapter_name"] for r in rows),
                      key=lambda ch: -sum(1 for r in rows if r["chapter_name"] == ch))
all_cats = [cat for cat, _ in final_cat_counts.most_common()]

report_lines.append(f"\n\n{'='*80}")
report_lines.append("CATEGORY x CHAPTER CROSS-TABULATION")
report_lines.append(f"{'='*80}")
report_lines.append(f"\n{'':20s} " + " ".join(f"{cat:>10s}" for cat in all_cats))
for ch in all_chapters:
    vals = [cat_chapter[cat].get(ch, 0) for cat in all_cats]
    report_lines.append(f"{ch:20s} " + " ".join(f"{v:>10,}" for v in vals))

# Ollama disagreements detail
if main_ollama or being_ollama:
    report_lines.append(f"\n\n{'='*80}")
    report_lines.append("OLLAMA VALIDATION DETAILS")
    report_lines.append(f"{'='*80}")

    if main_ollama:
        report_lines.append(f"\nMain category validation ({main_total} motifs sampled):")
        for idx, ollama_label in sorted(main_ollama.items()):
            current = categories[idx]
            status = "AGREE" if ollama_label == current else f"CORRECTED {current}->{ollama_label}"
            report_lines.append(f"  [{rows[idx]['chapter_name']:20s}] {rows[idx]['motif_name'][:60]:60s}  {status}")

    if being_ollama:
        report_lines.append(f"\nBeing subcategory validation ({being_total} motifs sampled):")
        for idx, ollama_label in sorted(being_ollama.items()):
            current = subcategories[idx]
            status = "AGREE" if ollama_label == current else f"CORRECTED {current}->{ollama_label}"
            report_lines.append(f"  [{rows[idx]['chapter_name']:20s}] {rows[idx]['motif_name'][:60]:60s}  {status}")

report_path = os.path.join(DATA_DIR, "rf_classification_report.txt")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines))
print(f"\nWritten {report_path}")

print("\nDone.")
