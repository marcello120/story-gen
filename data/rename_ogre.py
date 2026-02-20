"""Replace all mentions of ogre/ogres with monster/monsters in tmi_clustered.csv, preserving case."""
import csv
import os
import re

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
csv.field_size_limit(10 * 1024 * 1024)

def replace_ogre(text):
    """Replace ogre(s) with monster(s), preserving case."""
    def _repl(m):
        word = m.group(0)
        if word == "ogres":   return "monsters"
        if word == "Ogres":   return "Monsters"
        if word == "OGRES":   return "MONSTERS"
        if word == "ogre":    return "monster"
        if word == "Ogre":    return "Monster"
        if word == "OGRE":    return "MONSTER"
        # Fallback: match case of first letter
        if word[0].isupper():
            return "Monster" + ("s" if word.endswith("s") else "")
        return "monster" + ("s" if word.endswith("s") else "")
    return re.sub(r'\b[Oo][Gg][Rr][Ee][Ss]?\b', _repl, text)

src = os.path.join(DATA_DIR, "tmi_clustered.csv")
tmp = os.path.join(DATA_DIR, "tmi_clustered.tmp.csv")

count = 0
with open(src, "r", encoding="utf-8", errors="replace") as fin, \
     open(tmp, "w", encoding="utf-8", newline="") as fout:
    reader = csv.DictReader(fin)
    writer = csv.DictWriter(fout, fieldnames=reader.fieldnames)
    writer.writeheader()
    for row in reader:
        for key in row:
            old = row[key]
            row[key] = replace_ogre(old)
            if row[key] != old:
                count += 1
        writer.writerow(row)

os.replace(tmp, src)
print(f"Done. Replaced ogre/ogres in {count:,} field values.")
