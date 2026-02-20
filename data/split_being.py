"""
Split the 'Being' category into subcategories:
  Deity, Human, Animal, Spirit, Monster, Witch/Sorcerer

IMPROVED version — fixes:
  1. Specific categories (Deity, Spirit, Monster, Witch, Animal) match BEFORE Human
  2. Rules examine the subject position (first few words) not just any mention
  3. Negative guards prevent Human from matching deity/spirit/animal motifs
  4. Chapter membership is used as a strong signal
  5. Post-classification corrections fix known error patterns

Updates tmi_clustered.csv and regenerates all Being visualizations.
"""
import csv
import os
import re
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
# Step 1: Load clustered data
# =====================================================================
print("Loading tmi_clustered.csv ...")
all_rows = []
with open(os.path.join(DATA_DIR, "tmi_clustered.csv"), "r", encoding="utf-8", errors="replace") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        all_rows.append(row)

being_idx = [i for i, r in enumerate(all_rows) if r["category"] == "Being"]
print(f"  Total motifs: {len(all_rows):,}")
print(f"  Being motifs: {len(being_idx):,}")

# =====================================================================
# Step 2: Improved rule-based classification
# =====================================================================
# Strategy: classify from MOST SPECIFIC to LEAST SPECIFIC.
# Each function returns a subcategory or None.
# We chain them: Deity > Witch > Spirit > Monster > Animal > Human

def _lower(name):
    return name.lower()

def _first_words(name, n=4):
    """Return the first n words, lowercased."""
    return " ".join(name.lower().split()[:n])

# --- DEITY ---
_deity_subject = re.compile(
    r"^(god[sd]?|goddess|deity|deities|demiurg|demigod|creator|supreme being|"
    r"culture hero|divine|divinit|pantheon)\b", re.I)
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
_creator_pattern = re.compile(r"\bcreator\b", re.I)
_parent_of_gods = re.compile(r"\b(father|mother|parent|ancestor|birth|born)\b.*\b(god|gods|goddess|deities)\b", re.I)
_gods_pattern = re.compile(r"\b(the gods|of gods)\b", re.I)

def is_deity(name, chapter):
    lower = _lower(name)
    first = _first_words(name)
    # Strong: starts with god/goddess/deity/creator
    if _deity_subject.search(first):
        return True
    # Named deities anywhere
    if _deity_names.search(lower):
        return True
    # Parent/birth of gods
    if _parent_of_gods.search(lower):
        return True
    # "the gods" as subject
    if lower.startswith("the gods") or lower.startswith("gods "):
        return True
    # Creator in Myths chapter
    if _creator_pattern.search(lower) and chapter == "Myths":
        return True
    # Various god references where god is clearly the subject
    if re.match(r"^(god|goddess|deity|the god|the goddess)", lower):
        return True
    # "X of the gods" where X is about gods
    if _gods_pattern.search(lower) and not any(w in lower for w in ["man", "woman", "hero", "mortal", "human"]):
        if any(w in lower for w in ["king of the gods", "queen of the gods", "war of the gods", "death of the gods",
                                     "home of the gods", "food of the gods", "gift of the gods", "wrath of the gods"]):
            return True
    return False

# --- WITCH/SORCERER ---
_witch_subject = re.compile(
    r"^(witch|witches|wizard|sorcerer|sorceress|magician|enchanter|enchantress|"
    r"necromancer|conjurer|shaman|medicine man|medicine woman|cunning man|cunning woman|"
    r"warlock|hag)\b", re.I)
_witch_anywhere = re.compile(
    r"\b(witch(es|\'s)?|wizard|sorcerer|sorceress|magician|enchanter|enchantress|"
    r"necromancer|conjurer|shaman|warlock)\b", re.I)

def is_witch(name, chapter):
    lower = _lower(name)
    first = _first_words(name)
    if _witch_subject.search(first):
        return True
    # Witch as primary topic (not just mentioned)
    if chapter == "Monsters" and _witch_anywhere.search(lower):
        return True
    # "X by witch/sorcerer"
    if re.search(r"\bby (witch|sorcerer|magician|wizard|enchant)\b", lower):
        return True
    return False

# --- SPIRIT: ghosts, demons, angels, fairies, elves, dwarves ---
_spirit_subject = re.compile(
    r"^(spirit|spirits|ghost|ghosts|soul|souls|phantom|specter|wraith|banshee|poltergeist|"
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
_dead_subject = re.compile(r"^(dead|the dead|ghost|resuscitat|return from (the )?dead|return of the dead)\b", re.I)

def is_spirit(name, chapter):
    lower = _lower(name)
    first = _first_words(name)
    if _spirit_subject.search(first):
        return True
    # Chapter-based strong signals
    if chapter == "Death" and _spirit_anywhere.search(lower):
        return True
    if chapter == "Death" and _dead_subject.search(lower):
        return True
    # Fairy/spirit/ghost/devil as clear topic
    if _spirit_anywhere.search(first):
        return True
    # "of fairy/ghost/spirit/angel/demon/devil" patterns where they're the topic
    if re.search(r"\b(fairy|ghost|spirit|angel|demon|devil|vampire|werewolf|elf|dwarf|mermaid)[s]?\b", lower):
        # Make sure it's not just a passing mention in a human-centric motif
        if chapter in ("Marvels", "Death", "Monsters", "Religion"):
            return True
        # Spirit/ghost/fairy/devil as subject or primary being
        if re.match(r"^(the )?(fairy|ghost|spirit|angel|demon|devil|vampire|werewolf|elf|dwarf|mermaid)", lower):
            return True
        # "X of the fairies/spirits/ghosts/devils"
        if re.search(r"\bof (the )?(fairy|fairies|ghost|spirits?|angel|demons?|devils?|vampires?|elves|dwarfs?)\b", lower):
            return True
    return False

# --- MONSTER: giants, ogres, dragons, trolls ---
_monster_subject = re.compile(
    r"^(giant|giants|monster|monsters|dragon|dragons|troll|trolls|cyclop|gorgon|basilisk|"
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
    lower = _lower(name)
    first = _first_words(name)
    if _monster_subject.search(first):
        return True
    # Chapter signal
    if chapter == "Monsters" and _monster_anywhere.search(lower):
        return True
    # Giant/dragon/troll as clear topic even in other chapters
    if _monster_anywhere.search(first):
        return True
    # Serpent as monster (not just snake)
    if _serpent_monster.search(lower):
        return True
    # "X of the giant(s)/dragon(s)/troll(s)"
    if re.search(r"\bof (the )?(giant|dragon|troll|monster|ogress)[s]?\b", lower):
        return True
    return False

# --- ANIMAL ---
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
    r"finch|wren|jay|jackdaw|rook|starling|thrush|blackbird|robin|"
    r"serpent|snake|viper|cobra|python|asp|adder|"
    r"locust|flea|louse|tick|maggot|caterpillar|moth|wasp|hornet|"
    r"clam|oyster|mussel|snail|octopus|squid|jellyfish|starfish|eel|"
    r"peacock|pheasant|quail|partridge|guinea fowl|turkey|ostrich|flamingo|"
    r"panther|cheetah|puma|cougar|jaguar|gazelle|antelope|giraffe|"
    r"hippopotamus|rhinoceros|gorilla|chimpanzee|baboon|orangutan)\b", re.I)
_animal_subject = re.compile(
    r"^(animal|animals|bird|birds|fish|fishes|insect|insects|serpent|snake|"
    r"fox|wolf|bear|lion|tiger|eagle|raven|crow|hawk|owl|cat|dog|horse|"
    r"deer|hare|rabbit|mouse|rat|frog|toad|turtle|tortoise|monkey|ape|"
    r"elephant|cow|bull|ox|pig|boar|goat|sheep|ram|cock|hen|duck|goose|"
    r"swan|dove|ant|bee|spider|whale|shark|dolphin|salmon|coyote|jackal|"
    r"hyena|leopard|crocodile|lizard|scorpion|beetle|butterfly|donkey|"
    r"mule|camel|buffalo|stork|crane|heron|sparrow|magpie|cuckoo|"
    r"vulture|bat|squirrel|hedgehog|beaver|otter|badger|weasel|parrot|"
    r"peacock|phoenix|unicorn|worm|fly|flies|mosquito|flea|louse|"
    r"crab|lobster|clam|oyster|snail|octopus|eel|"
    r"the (fox|wolf|bear|lion|tiger|eagle|raven|crow|cat|dog|horse|"
    r"deer|hare|rabbit|mouse|frog|turtle|monkey|elephant|cow|bull|pig|"
    r"goat|sheep|cock|hen|duck|goose|swan|dove|ant|bee|spider|whale|"
    r"dolphin|coyote|jackal|crocodile|donkey|camel|buffalo|"
    r"peacock|worm|fly|flea|crab|snail|eel))\b", re.I)

# Words that indicate motif is primarily about a human, not the animal mentioned
_human_subject_words = {"man", "woman", "person", "wife", "husband", "king", "queen",
                        "prince", "princess", "boy", "girl", "child", "children",
                        "son", "daughter", "hero", "heroine", "saint", "fool",
                        "thief", "servant", "master", "lord", "lady", "priest",
                        "monk", "nun", "maiden", "youth", "old", "farmer",
                        "hunter", "fisherman", "shepherd", "soldier", "warrior",
                        "merchant", "tailor", "cobbler", "miller", "baker",
                        "smith", "carpenter", "beggar", "orphan", "widow",
                        "bride", "groom", "lover", "suitor", "paramour"}

def is_animal(name, chapter):
    lower = _lower(name)
    first = _first_words(name, 3)
    first_word = lower.split()[0] if lower.split() else ""

    # Strong: starts with animal name
    if _animal_subject.search(first):
        # But not if it's "animal X of human" where human is the real subject
        return True

    # Chapter signal
    if chapter == "Animals":
        # Animals chapter — default to Animal unless clearly about a human
        first_words_set = set(lower.split()[:3])
        if first_words_set & _human_subject_words:
            return False
        return True

    # Animal name in subject position and no human subject words first
    first_three = set(lower.split()[:3])
    if first_three & _human_subject_words:
        return False

    # Animal is the topic: "Why X (animal)" pattern
    if re.match(r"^(why|how|origin of|creation of)\b.*\b", lower) and _animal_names.search(lower):
        return True

    # Animal-specific motif patterns
    if re.search(r"\b(animal (as|bride|groom|husband|wife|king|language|helper|grateful))\b", lower):
        return True
    if re.search(r"\b(speaking|talking|helpful|grateful|faithful|treacherous) (animal|bird|fish|fox|wolf|bear|lion|horse|dog|cat|eagle|raven|snake|serpent)\b", lower):
        return True

    return False

# --- HUMAN (catch-all, but with negative guards) ---
_human_subject = re.compile(
    r"^(man|woman|person|wife|husband|king|queen|prince|princess|knight|warrior|"
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
    """Human is the fallback — only if nothing else matches first."""
    lower = _lower(name)
    first = _first_words(name, 3)
    if _human_subject.search(first):
        return True
    # Chapters strongly associated with human characters
    if chapter in ("Wisdom and Folly", "Deceptions", "Sex", "Society",
                   "Humor", "Cruelty", "Captives and Fugitives"):
        return True
    return False


def classify_being(name, chapter):
    """Classify a Being motif. Order matters: specific before general."""
    # 1. Witch/Sorcerer (very specific)
    if is_witch(name, chapter):
        return "Witch/Sorcerer"
    # 2. Deity
    if is_deity(name, chapter):
        return "Deity"
    # 3. Spirit
    if is_spirit(name, chapter):
        return "Spirit"
    # 4. Monster
    if is_monster(name, chapter):
        return "Monster"
    # 5. Animal
    if is_animal(name, chapter):
        return "Animal"
    # 6. Human (catch-all)
    if is_human(name, chapter):
        return "Human"
    return None


print("Applying improved rule-based Being subcategorization ...")
subcategories = [None] * len(all_rows)
rule_matched = 0

for i in being_idx:
    subcat = classify_being(all_rows[i]["motif_name"], all_rows[i]["chapter_name"])
    subcategories[i] = subcat
    if subcat:
        rule_matched += 1

# For non-Being motifs, subcategory = category
for i, r in enumerate(all_rows):
    if r["category"] != "Being":
        subcategories[i] = r["category"]

unmatched_being = sum(1 for i in being_idx if subcategories[i] is None)
print(f"  Rule-matched Being: {rule_matched:,} / {len(being_idx):,} ({100*rule_matched/len(being_idx):.1f}%)")
print(f"  Unmatched Being: {unmatched_being:,} ({100*unmatched_being/len(being_idx):.1f}%)")

# =====================================================================
# Step 3: Classifier for remaining unmatched
# =====================================================================
print("\nTraining classifier on rule-labeled Being motifs ...")

def preprocess(name):
    name = name.lower()
    name = re.sub(r"[^a-z0-9\s\-]", " ", name)
    return re.sub(r"\s+", " ", name).strip()

being_texts = [preprocess(all_rows[i]["motif_name"]) + " __CH_" + all_rows[i]["chapter_name"].replace(" ", "_")
               for i in being_idx]

vectorizer = TfidfVectorizer(
    max_features=8000, ngram_range=(1, 2),
    min_df=2, max_df=0.5, sublinear_tf=True,
)
X_being = vectorizer.fit_transform(being_texts)

labeled_mask = [j for j, i in enumerate(being_idx) if subcategories[i] is not None]
unlabeled_mask = [j for j, i in enumerate(being_idx) if subcategories[i] is None]

X_labeled = X_being[labeled_mask]
y_labeled = [subcategories[being_idx[j]] for j in labeled_mask]

clf = SGDClassifier(loss="modified_huber", random_state=42, max_iter=1000, class_weight="balanced")
cv_scores = cross_val_score(clf, X_labeled, y_labeled, cv=5, scoring="accuracy")
print(f"  5-fold CV accuracy: {cv_scores.mean():.3f} (+/- {cv_scores.std():.3f})")

clf.fit(X_labeled, y_labeled)

if unlabeled_mask:
    X_unlabeled = X_being[unlabeled_mask]
    preds = clf.predict(X_unlabeled)
    pred_proba = clf.predict_proba(X_unlabeled)
    max_probs = pred_proba.max(axis=1)

    for j, local_j in enumerate(unlabeled_mask):
        global_i = being_idx[local_j]
        subcategories[global_i] = preds[j]

    print(f"  Predicted {len(unlabeled_mask):,} unlabeled Being motifs")
    print(f"  Confidence: mean={max_probs.mean():.3f}, median={np.median(max_probs):.3f}")

# =====================================================================
# Step 4: Post-classification corrections
# =====================================================================
print("\nApplying post-classification corrections ...")
corrections = 0

for i in being_idx:
    name = all_rows[i]["motif_name"]
    chapter = all_rows[i]["chapter_name"]
    lower = name.lower()
    old = subcategories[i]

    # Fix: "god/goddess/deity" in subject => Deity, not Human
    if old == "Human" and re.match(r"^(god[sd]?|goddess|deity|creator|the god|the goddess|the creator|demigod|culture hero)\b", lower, re.I):
        subcategories[i] = "Deity"
        corrections += 1
    # Fix: "spirit/ghost/fairy/angel/demon/devil" in subject => Spirit
    elif old == "Human" and re.match(r"^(spirit|ghost|fairy|fairies|angel|demon|devil|satan|soul|phantom|elf|elves|dwarf|vampire|werewolf|mermaid|banshee|the spirit|the ghost|the fairy|the angel|the demon|the devil)\b", lower, re.I):
        subcategories[i] = "Spirit"
        corrections += 1
    # Fix: "giant/dragon/troll/monster/ogress/cannibal" in subject => Monster
    elif old == "Human" and re.match(r"^(giant|dragon|troll|monster|ogress|cannibal|cyclop|the giant|the dragon|the troll|the monster)\b", lower, re.I):
        subcategories[i] = "Monster"
        corrections += 1
    # Fix: "witch/sorcerer/magician" in subject => Witch/Sorcerer
    elif old != "Witch/Sorcerer" and re.match(r"^(witch|witches|wizard|sorcerer|sorceress|magician|enchanter|enchantress|the witch|the wizard|the sorcerer)\b", lower, re.I):
        subcategories[i] = "Witch/Sorcerer"
        corrections += 1
    # Fix: animal name in subject position, no human words before it => Animal
    elif old == "Human" and chapter == "Animals":
        first_words = set(lower.split()[:3])
        if not (first_words & _human_subject_words):
            subcategories[i] = "Animal"
            corrections += 1
    # Fix: Monsters chapter + monster-related content => Monster (not Human)
    elif old == "Human" and chapter == "Monsters" and _monster_anywhere.search(lower):
        subcategories[i] = "Monster"
        corrections += 1

print(f"  Corrections applied: {corrections:,}")

# =====================================================================
# Step 5: Report
# =====================================================================
being_subcats = [subcategories[i] for i in being_idx]
subcat_counts = Counter(being_subcats)

print(f"\n{'='*70}")
print("BEING SUBCATEGORY DISTRIBUTION (improved)")
print(f"{'='*70}")
for sc, count in subcat_counts.most_common():
    print(f"  {sc:20s}  {count:>6,}  ({100*count/len(being_idx):.1f}%)")

subcat_chapter = defaultdict(Counter)
for i in being_idx:
    subcat_chapter[subcategories[i]][all_rows[i]["chapter_name"]] += 1

SUBCAT_DESCRIPTIONS = {
    "Deity":           "Gods, goddesses, creator figures, demigods, culture heroes",
    "Human":           "Ordinary people, royalty, social roles, named humans, heroes",
    "Animal":          "Animals as characters, speaking/helpful/grateful animals",
    "Spirit":          "Spirits, ghosts, angels, demons, fairies, elves, undead, merfolk",
    "Monster":         "Giants, monsters, dragons, trolls, cannibals",
    "Witch/Sorcerer":  "Witches, wizards, sorcerers, magicians, shamans",
}

report_lines = []
report_lines.append("\n" + "=" * 80)
report_lines.append("BEING SUBCATEGORY BREAKDOWN (improved)")
report_lines.append("=" * 80)
report_lines.append(f"\nRule-matched: {rule_matched:,} / {len(being_idx):,} ({100*rule_matched/len(being_idx):.1f}%)")
report_lines.append(f"Classifier-predicted: {unmatched_being:,} ({100*unmatched_being/len(being_idx):.1f}%)")
report_lines.append(f"Post-classification corrections: {corrections:,}")
report_lines.append(f"Classifier 5-fold CV accuracy: {cv_scores.mean():.3f}")

for sc, count in subcat_counts.most_common():
    report_lines.append(f"\n{'─'*80}")
    report_lines.append(f"  {sc.upper()}  —  {count:,} motifs ({100*count/len(being_idx):.1f}% of Being)")
    report_lines.append(f"  {SUBCAT_DESCRIPTIONS.get(sc, '')}")
    report_lines.append(f"{'─'*80}")

    top_ch = subcat_chapter[sc].most_common(5)
    report_lines.append(f"  Top chapters: {', '.join(f'{ch} ({n:,})' for ch, n in top_ch)}")

    samples = [all_rows[i]["motif_name"] for i in being_idx if subcategories[i] == sc][:12]
    report_lines.append(f"  Sample motifs:")
    for s in samples:
        report_lines.append(f"    • {s}")

# Overwrite the Being section in the report
report_path = os.path.join(DATA_DIR, "cluster_report.txt")
with open(report_path, "r", encoding="utf-8") as f:
    old_content = f.read()
# Remove old Being breakdown if present
marker = "\n" + "=" * 80 + "\nBEING SUBCATEGORY BREAKDOWN"
if marker in old_content:
    old_content = old_content[:old_content.index(marker)]
with open(report_path, "w", encoding="utf-8") as f:
    f.write(old_content + "\n".join(report_lines))
print(f"\nUpdated {report_path}")

# =====================================================================
# Step 6: Update tmi_clustered.csv
# =====================================================================
print("Writing updated tmi_clustered.csv ...")
out_path = os.path.join(DATA_DIR, "tmi_clustered.csv")
if "subcategory" not in fieldnames:
    fieldnames = fieldnames + ["subcategory"]

with open(out_path, "w", encoding="utf-8", newline="") as fout:
    writer = csv.DictWriter(fout, fieldnames=fieldnames)
    writer.writeheader()
    for i, row in enumerate(all_rows):
        row["subcategory"] = subcategories[i]
        writer.writerow(row)
print(f"  Written {out_path}")

# =====================================================================
# Step 7: Visualizations
# =====================================================================
SUBCAT_COLORS = {
    "Deity":          "#1a5276",
    "Human":          "#2e86c1",
    "Animal":         "#27ae60",
    "Spirit":         "#8e44ad",
    "Monster":        "#c0392b",
    "Witch/Sorcerer": "#7d3c98",
}

# Bar chart
print("Plotting Being subcategory bar chart ...")
fig, ax = plt.subplots(figsize=(10, 5))
sorted_sc = subcat_counts.most_common()
sc_names = [s for s, _ in sorted_sc]
sc_sizes = [n for _, n in sorted_sc]
colors = [SUBCAT_COLORS.get(s, "#999") for s in sc_names]

bars = ax.barh(range(len(sc_names)), sc_sizes, color=colors)
ax.set_yticks(range(len(sc_names)))
ax.set_yticklabels(sc_names, fontsize=11)
ax.set_xlabel("Number of Motifs")
ax.set_title("Being — Subcategories (improved)", fontsize=14, fontweight="bold")
ax.invert_yaxis()
for bar, size in zip(bars, sc_sizes):
    ax.text(bar.get_width() + 50, bar.get_y() + bar.get_height() / 2,
            f"{size:,} ({100*size/len(being_idx):.1f}%)", va="center", fontsize=9)
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "being_subcategories.png"), dpi=150)
plt.close()
print("  Written being_subcategories.png")

# UMAP
print("Vectorizing all motifs for UMAP ...")
all_texts = [preprocess(r["motif_name"]) + " __CH_" + r["chapter_name"].replace(" ", "_") for r in all_rows]
vec_all = TfidfVectorizer(max_features=8000, ngram_range=(1, 2), min_df=2, max_df=0.5, sublinear_tf=True)
X_all = vec_all.fit_transform(all_texts)

print("Running UMAP ...")
reducer = umap.UMAP(n_components=2, n_neighbors=30, min_dist=0.3, metric="cosine", random_state=42, low_memory=True)
coords = reducer.fit_transform(X_all)

ALL_COLORS = {**SUBCAT_COLORS,
    "Action": "#e74c3c", "Place": "#2ecc71", "Event": "#f39c12",
    "Object": "#9b59b6", "Origin": "#1abc9c", "Attribute": "#e67e22",
    "Condition": "#95a5a6", "Outcome": "#d35400",
}
CATEGORY_ORDER = ["Human", "Deity", "Animal", "Spirit", "Monster", "Witch/Sorcerer",
                  "Action", "Place", "Event", "Object", "Origin", "Attribute", "Condition", "Outcome"]
subcat_arr = np.array(subcategories)

# All categories scatter
print("Plotting full scatter ...")
fig, ax = plt.subplots(figsize=(16, 11))
for cat in reversed(CATEGORY_ORDER):
    mask = subcat_arr == cat
    if mask.sum() == 0: continue
    ax.scatter(coords[mask, 0], coords[mask, 1], c=ALL_COLORS[cat], label=f"{cat} ({mask.sum():,})",
               s=1.5, alpha=0.4, edgecolors="none", rasterized=True)
ax.set_title("TMI Motifs — All Categories (Being split, improved)", fontsize=14, fontweight="bold")
ax.legend(markerscale=8, fontsize=9, loc="upper right", framealpha=0.9, edgecolor="gray")
ax.set_xticks([]); ax.set_yticks([])
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "cluster_scatter_all.png"), dpi=200)
plt.close()
print("  Written cluster_scatter_all.png")

# Per-category grid
print("Plotting per-category grid ...")
fig, axes = plt.subplots(4, 4, figsize=(22, 20))
for idx, cat in enumerate(CATEGORY_ORDER):
    r, c = divmod(idx, 4)
    ax = axes[r][c]
    mask = subcat_arr == cat
    ax.scatter(coords[~mask, 0], coords[~mask, 1], c="#e8e8e8", s=0.3, alpha=0.15, edgecolors="none", rasterized=True)
    ax.scatter(coords[mask, 0], coords[mask, 1], c=ALL_COLORS[cat], s=2, alpha=0.6, edgecolors="none", rasterized=True)
    ax.set_title(f"{cat}  ({mask.sum():,})", fontsize=12, fontweight="bold", color=ALL_COLORS[cat],
                 path_effects=[pe.withStroke(linewidth=0.5, foreground="black")])
    ax.set_xticks([]); ax.set_yticks([])
for idx in range(len(CATEGORY_ORDER), 16):
    r, c = divmod(idx, 4)
    axes[r][c].set_visible(False)
plt.suptitle("TMI Motifs — Each Category Highlighted (improved)", fontsize=16, fontweight="bold", y=1.005)
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "cluster_scatter_grid.png"), dpi=200, bbox_inches="tight")
plt.close()
print("  Written cluster_scatter_grid.png")

# Being-only scatter
print("Plotting Being-only scatter ...")
fig, ax = plt.subplots(figsize=(14, 10))
non_being = np.array([r["category"] != "Being" for r in all_rows])
ax.scatter(coords[non_being, 0], coords[non_being, 1], c="#e0e0e0", s=0.3, alpha=0.1, edgecolors="none", rasterized=True, label="Other categories")
for sc in reversed(["Human", "Deity", "Animal", "Spirit", "Monster", "Witch/Sorcerer"]):
    mask = subcat_arr == sc
    if mask.sum() == 0: continue
    ax.scatter(coords[mask, 0], coords[mask, 1], c=SUBCAT_COLORS[sc], label=f"{sc} ({mask.sum():,})",
               s=2, alpha=0.5, edgecolors="none", rasterized=True)
ax.set_title("Being Subcategories — improved (non-Being in gray)", fontsize=14, fontweight="bold")
ax.legend(markerscale=6, fontsize=10, loc="upper right", framealpha=0.9, edgecolor="gray")
ax.set_xticks([]); ax.set_yticks([])
plt.tight_layout()
plt.savefig(os.path.join(DATA_DIR, "being_scatter.png"), dpi=200)
plt.close()
print("  Written being_scatter.png")

print("\nDone.")
