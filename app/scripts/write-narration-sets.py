"""Write public/_dev/narration/<book>/sets.json: the narration sets in preference order,
keeping only sets whose folder exists with at least one audio file. The reader reads it
once at book open and takes the first set (the &voice=<set> URL flag overrides it).

    python scripts/write-narration-sets.py [--book five-smooth-stones] [set ...]
"""
import argparse
import json
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--book", default="five-smooth-stones")
ap.add_argument("sets", nargs="*", default=["dylan-v3", "dylan-v2-expressive", "dylan-v2"])
a = ap.parse_args()
root = APP / "public" / "_dev" / "narration" / a.book
have = [s for s in a.sets if (root / s).is_dir() and any(p.suffix in (".mp3", ".wav") for p in (root / s).rglob("*"))]
(root / "sets.json").write_text(json.dumps(have) + "\n", encoding="utf-8")
print("sets.json ->", have)
