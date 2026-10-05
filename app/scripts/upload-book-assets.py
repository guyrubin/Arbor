"""B-BOOK release — upload ONE child's private book files to Firebase Storage and
write their metadata doc. ADMIN ONLY (Application Default Credentials). The files
show the child (hero sheet, prints, choice cards) or speak the child's name
(narration): they go to a server-only prefix and are never committed.

    gcloud auth application-default login          # once
    pip install google-cloud-storage google-cloud-firestore

    # DRY RUN (default): lists every file, the bytes and the doc it would write
    python scripts/upload-book-assets.py --project <gcp-project> --uid <parent-uid> --child <childId> \
        --sheet-dir public/_dev/hero-sheets/dylan-v2 \
        --narration-root public/_dev/narration/five-smooth-stones --sets dylan-v3

    # then the same command with --apply

Writes (lib/library/bookAssetPaths.ts is the source of these shapes):
  Storage   gs://<bucket>/children/<childId>/books/<bookId>/hero-sheets/<sheetId>/<pose>.webp
                                                           .../choices/<id>.webp, .../prints/<pageId>.webp, .../manifest.json
                                                           narration/<setId>/<en|he-m|he-f>/<file>.mp3|.wav|.cues.json
  Firestore users/<uid>/children/<childId>/bookAssets/<bookId>
            { bookId, sheetId, setId, sets, sheetManifest, files, bytes, createdAt }
The app reads the files only through GET /api/children/<childId>/book-assets/<bookId>/file
(owner-checked). /privacy/erase and the account deletion remove the prefix; the
export lists the doc. Re-running replaces the files and the doc (a new createdAt
makes devices fetch the new copies).
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SEG = r"[A-Za-z0-9_-]{1,64}"
ID = re.compile(rf"^{SEG}$")
REL = re.compile(
    "^(?:manifest\\.json"
    rf"|hero-sheets/{SEG}/(?:(?:choices|prints)/)?{SEG}\.webp"
    rf"|hero-sheets/{SEG}/manifest\.json"
    rf"|narration/{SEG}/(?:en|he-m|he-f)/{SEG}(?:\.{SEG})*\.(?:mp3|wav|json))$"
)
TYPES = {".webp": "image/webp", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".json": "application/json"}

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--project", required=True, help="GCP / Firebase project id")
ap.add_argument("--uid", required=True, help="the parent uid that owns the child (users/<uid>/children/<childId>)")
ap.add_argument("--child", required=True, help="the child id")
ap.add_argument("--book", default="five-smooth-stones")
ap.add_argument("--sheet-dir", required=True, help="the child's hero sheet folder (manifest.json + <pose>.webp, choices/, prints/)")
ap.add_argument("--narration-root", required=True, help="folder holding <setId>/<en|he-m|he-f>/ narration")
ap.add_argument("--sets", nargs="+", required=True, help="narration set ids to upload, preferred first (the reader plays the first)")
ap.add_argument("--bucket", default=None, help="default <project>.firebasestorage.app")
ap.add_argument("--database", default="(default)", help="Firestore database id")
ap.add_argument("--apply", action="store_true", help="really upload (default: dry run)")
a = ap.parse_args()

for label, v in (("uid", a.uid), ("child", a.child), ("book", a.book), *(("set", s) for s in a.sets)):
    if not ID.match(v):
        sys.exit(f"bad {label} id: {v!r}")
sheet_dir = Path(a.sheet_dir)
sheet_id = sheet_dir.name
if not ID.match(sheet_id):
    sys.exit(f"bad sheet folder name: {sheet_id!r}")
manifest_path = sheet_dir / "manifest.json"
if not manifest_path.exists():
    sys.exit(f"no manifest.json in {sheet_dir}")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

# ── the file list (relative path -> local file) ──────────────────────────────
files: dict[str, Path] = {}
for f in sorted(sheet_dir.rglob("*")):
    if f.is_file():
        rel = f"hero-sheets/{sheet_id}/" + f.relative_to(sheet_dir).as_posix()
        if REL.match(rel):
            files[rel] = f
        else:
            print("  skip (not a book-asset shape):", rel)
narr_root = Path(a.narration_root)
for set_id in a.sets:
    d = narr_root / set_id
    if not d.is_dir():
        sys.exit(f"narration set not found: {d}")
    for f in sorted(d.rglob("*")):
        if f.is_file():
            rel = f"narration/{set_id}/" + f.relative_to(d).as_posix()
            if REL.match(rel):
                files[rel] = f
            else:
                print("  skip (not a book-asset shape):", rel)

# the sheet manifest must name only files that are uploaded
missing = [p["file"] for p in manifest.get("poses", {}).values() if f"hero-sheets/{sheet_id}/{p['file']}" not in files]
missing += [v["file"] for v in manifest.get("prints", {}).values() if f"hero-sheets/{sheet_id}/{v['file']}" not in files]
missing += [v for v in manifest.get("choices", {}).values() if f"hero-sheets/{sheet_id}/{v}" not in files]
if missing:
    sys.exit(f"the sheet manifest names files that are not in {sheet_dir}: {missing}")

total = sum(f.stat().st_size for f in files.values())
created = datetime.now(timezone.utc).isoformat(timespec="seconds")
doc = {
    "bookId": a.book,
    "sheetId": sheet_id,
    "setId": a.sets[0],
    "sets": a.sets,
    "sheetManifest": {k: manifest[k] for k in ("poses", "prints", "choices") if k in manifest},
    "files": sorted(files),
    "bytes": total,
    "createdAt": created,
}
bucket_name = a.bucket or f"{a.project}.firebasestorage.app"
prefix = f"children/{a.child}/books/{a.book}/"
doc_path = f"users/{a.uid}/children/{a.child}/bookAssets/{a.book}"
per_kind: dict[str, int] = {}
for rel in files:
    k = rel.split("/")[0] + ("/" + rel.split("/")[2] if rel.startswith("narration/") else "")
    per_kind[k] = per_kind.get(k, 0) + 1
print(f"bucket   gs://{bucket_name}/{prefix}")
print(f"doc      {doc_path}")
print(f"files    {len(files)} ({total / 1e6:.1f} MB): {per_kind}")
print(f"sheet    {sheet_id}: {len(doc['sheetManifest'].get('poses', {}))} poses, prints {sorted(doc['sheetManifest'].get('prints', {}))}, choices {sorted(doc['sheetManifest'].get('choices', {}))}")
print(f"set      {doc['setId']} (of {a.sets})")
if not a.apply:
    print("\nDRY RUN — nothing written. Re-run with --apply.")
    sys.exit(0)

from google.cloud import firestore, storage  # noqa: E402  (only needed with --apply)

db = firestore.Client(project=a.project, database=a.database)
child_ref = db.document(f"users/{a.uid}/children/{a.child}")
if not child_ref.get().exists:
    sys.exit(f"no child doc at users/{a.uid}/children/{a.child} — check --uid / --child")
bucket = storage.Client(project=a.project).bucket(bucket_name)
# replace: remove the book's old files first (a set or pose that went away)
old = list(bucket.list_blobs(prefix=prefix))
for b in old:
    b.delete()
for i, (rel, f) in enumerate(sorted(files.items()), 1):
    blob = bucket.blob(prefix + rel)
    blob.cache_control = "private, max-age=86400"
    blob.upload_from_filename(str(f), content_type=TYPES.get(f.suffix, "application/octet-stream"))
    if i % 20 == 0 or i == len(files):
        print(f"  uploaded {i}/{len(files)}")
db.document(doc_path).set(doc)
print(f"done: removed {len(old)} old file(s), uploaded {len(files)}, wrote {doc_path}")
