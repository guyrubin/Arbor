"""B-BOOK-07: import a book's delivered art into the app (re-runnable).

    python scripts/import-book-art.py <art-dir> [--book five-smooth-stones] [--sheet dylan-v2] [--step assets|geometry|prints|all]

<art-dir> is the art agent's folder (proof-art/david): app/plates/*.webp,
app/overlays/*.webp, app/hero-sheets/<sheet>/*.webp, plates.json, pages/<id>-print.jpg.

assets   : plates  -> public/visuals/books/<book>/<plate>.webp     (child-free; COMMITTED)
                      re-encoded to <= 2048 px wide at q84 when a file is > 450 KB
           overlays-> public/visuals/books/<book>/overlays/<id>.webp (objects only; COMMITTED)
           sprites -> public/_dev/hero-sheets/<sheet>/<pose>.webp   (a child's likeness; GIT-IGNORED)
           + public/_dev/hero-sheets/<sheet>/manifest.json (per pose: aspect, foot anchor, foot width)
prints   : pages/<id>-print.jpg -> public/_dev/hero-sheets/<sheet>/prints/<id>.webp (GIT-IGNORED)
           and lists them in the sheet manifest
geometry : plates.json -> src/lib/library/books/<camel>.geometry.json (the ONE geometry object the
           book reads; schema in src/lib/library/bookGeometry.ts)

Nothing here calls a model or the network.
"""
import argparse
import json
import re
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parent.parent
MAX_BYTES = 450_000
MAX_W = 2048

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("--book", default="five-smooth-stones")
ap.add_argument("--sheet", default="dylan-v2")
ap.add_argument("--geometry", default="src/lib/library/books/fiveSmoothStones.geometry.json")
ap.add_argument("--step", default="all")
ap.add_argument("--plates", default="plates.json", help="geometry file name inside <art-dir> (e.g. plates-r1.json)")
args = ap.parse_args()

SRC = Path(args.src)
PLATES_OUT = APP / "public" / "visuals" / "books" / args.book
OVERLAYS_OUT = PLATES_OUT / "overlays"
SHEET_OUT = APP / "public" / "_dev" / "hero-sheets" / args.sheet
G = json.load(open(SRC / args.plates, encoding="utf-8"))

# Art rounds add plate VERSIONS (PL3-r2b, PL7-r2c, PL1-v2 ...). The book keeps
# stable plate ids (PL3, PL7, PL1 ...); the version a page names is shipped under
# the stable name. New compositions (PL3e, PL3w2, PL3w3, PL7-rise) are plates of
# their own. Pages whose id carries a suffix (p5-tunic, p9-boom, p9-rise,
# p8-squat, card-c ...) are variants / states / card compositions, not pages.
VERSION = re.compile(r"-(r\d+[a-z]?|v\d+)$")


def base_plate(pid: str) -> str:
    return VERSION.sub("", pid)


BOOK_PAGES = {k: v for k, v in G["pages"].items() if "-" not in k}
PLATE_VERSION = {}
for _pg in BOOK_PAGES.values():
    PLATE_VERSION[base_plate(_pg["plate"])] = _pg["plate"]
_named = set(PLATE_VERSION)
for _pid in G["plates"]:
    # a plate no page names (PL3w after v2, PL7-dust): its LATEST listed version
    if base_plate(_pid) not in _named:
        PLATE_VERSION[base_plate(_pid)] = _pid


def alpha_meta(path: Path):
    """aspect = w/h of the image; footX = centre of the lowest 6 % of opaque rows (as compose.py
    anchors feet), as a fraction of the width; footW = that band's width fraction; centreY = the
    vertical centre of the opaque box (fraction of height)."""
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im.getchannel("A"))
    rows = np.where(a.max(1) > 80)[0]
    bot = int(rows.max())
    band = a[int(bot - 0.06 * im.height): bot + 1]
    xs = np.where(band.max(0) > 80)[0]
    return {
        "aspect": round(im.width / im.height, 4),
        "footX": round(float((xs.min() + xs.max()) / 2 / im.width), 4),
        "footW": round(float((xs.max() - xs.min()) / im.width), 4),
        "bottom": round(float(bot / im.height), 4),
    }


def assets():
    PLATES_OUT.mkdir(parents=True, exist_ok=True)
    OVERLAYS_OUT.mkdir(parents=True, exist_ok=True)
    SHEET_OUT.mkdir(parents=True, exist_ok=True)
    for base, version in sorted(PLATE_VERSION.items()):
        f = SRC / "app" / "plates" / f"{version}.webp"
        if not f.exists():
            print("MISSING plate file", f)
            continue
        out = PLATES_OUT / f"{base}.webp"
        im = Image.open(f)
        if f.stat().st_size > MAX_BYTES:
            if im.width > MAX_W:
                im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
            im.convert("RGB").save(out, "WEBP", quality=84, method=6)
        else:
            shutil.copyfile(f, out)
        print("plate", base, "<-", f.name, Image.open(out).size, out.stat().st_size)
    # dedicated choice-card pictures: the scene version (no child) is committed;
    # the per-hero versions (they show the child) go to the sheet (git-ignored)
    scene_choices = SRC / "app" / "choices"
    if scene_choices.exists():
        (PLATES_OUT / "choices").mkdir(parents=True, exist_ok=True)
        for f in sorted(scene_choices.glob("*.webp")):
            shutil.copyfile(f, PLATES_OUT / "choices" / f.name)
            print("choice (scene)", f.name)
    for f in sorted((SRC / "app" / "overlays").glob("*.webp")):
        shutil.copyfile(f, OVERLAYS_OUT / f.name)
        print("overlay", f.name, (OVERLAYS_OUT / f.name).stat().st_size)
    poses = {}
    for f in sorted((SRC / "app" / "hero-sheets" / args.sheet).glob("*.webp")):
        shutil.copyfile(f, SHEET_OUT / f.name)
        poses[f.stem] = {"file": f.name, **alpha_meta(f)}
    man_path = SHEET_OUT / "manifest.json"
    man = json.load(open(man_path, encoding="utf-8")) if man_path.exists() else {}
    man.update({"id": args.sheet, "poses": poses})
    hero_choices = SRC / "app" / "hero-sheets" / args.sheet / "choices"
    if hero_choices.exists():
        (SHEET_OUT / "choices").mkdir(parents=True, exist_ok=True)
        man["choices"] = {}
        for f in sorted(hero_choices.glob("*.webp")):
            shutil.copyfile(f, SHEET_OUT / "choices" / f.name)
            man["choices"][f.stem] = f"choices/{f.name}"
            print("choice (hero)", f.name)
    man.setdefault("prints", {})
    json.dump(man, open(man_path, "w", encoding="utf-8"), indent=1)
    print("sprites", len(poses), "->", SHEET_OUT)


def prints():
    out_dir = SHEET_OUT / "prints"
    out_dir.mkdir(parents=True, exist_ok=True)
    found = {}
    # the latest r-round's prints (pages/<id>-rN-print.jpg), then the pages that
    # name a newer print in plates.json ("print": app/prints/<id>-v2-print.webp)
    # replace theirs; a page whose plate changed and was not re-printed shows the
    # live composite. Stale print files are removed.
    files = sorted((SRC / "pages").glob("*-print.jpg"))
    rounds = sorted({m.group(1) for f in files for m in [re.search(r"-(r\d+)-print$", f.stem)] if m})
    latest = rounds[-1] if rounds else None
    files = [f for f in files if (latest and f.stem.endswith(f"-{latest}-print")) or (not latest)]
    chosen = {re.sub(r"(-r\d+)?-print$", "", f.stem): f for f in files}
    for pid, pg in BOOK_PAGES.items():
        if pg.get("print"):
            chosen[pid] = SRC / pg["print"]
    for pid, pg in BOOK_PAGES.items():
        # a page on a v2 plate with no v2 print: its old print shows the old plate
        if pid in chosen and VERSION.sub("", pg["plate"]) != pg["plate"] and pg["plate"].endswith("-v2") and not pg.get("print"):
            del chosen[pid]
    for old in out_dir.glob("*.webp"):
        old.unlink()
    for pid, f in sorted(chosen.items()):
        if pid not in BOOK_PAGES:
            continue
        im = Image.open(f).convert("RGB")
        im.save(out_dir / f"{pid}.webp", "WEBP", quality=85, method=6)
        found[pid] = {"file": f"prints/{pid}.webp", "w": im.width, "h": im.height}
        print("print", pid, "<-", f.name, (out_dir / f"{pid}.webp").stat().st_size)
    man_path = SHEET_OUT / "manifest.json"
    man = json.load(open(man_path, encoding="utf-8")) if man_path.exists() else {"id": args.sheet, "poses": {}}
    man["prints"] = found
    json.dump(man, open(man_path, "w", encoding="utf-8"), indent=1)


def light_of(desc: str):
    d = (desc or "").lower()
    if "right" in d and "left" not in d:
        return {"dx": -0.6}
    return {"dx": 0.8}


def r4(v):
    return round(float(v), 4)


def geometry():
    sprite_dir = SRC / "app" / "hero-sheets" / args.sheet
    overlay_dir = SRC / "app" / "overlays"
    plates = {}
    for base, version in PLATE_VERSION.items():
        p = G["plates"].get(version, {})
        p0 = G["plates"].get(base, {})
        f = PLATES_OUT / f"{base}.webp"
        if not f.exists():
            # a version the art agent did not ship (a rejected base such as
            # PLR / PL4g): not a plate of the book
            continue
        size = Image.open(f).size
        plates[base] = {
            "size": {"w": size[0], "h": size[1]},
            "light": light_of(p.get("light", p0.get("light", ""))),
            "provenance": {"childFree": True, "textFree": True, "reviewedBy": f"art-agent QC ({version}; proof-art/david/LOG.md); Fable full-size review owed"},
            **({"variantOf": base_plate(p0["variantOf"])} if p0.get("variantOf") and (PLATES_OUT / f"{base_plate(p0['variantOf'])}.webp").exists() else {}),
        }
    master_w, master_h = G["master"]["w"], G["master"]["h"]

    def plate_tint(plate_id, box):
        f = PLATES_OUT / f"{base_plate(plate_id)}.webp"
        im = Image.open(f).convert("RGB")
        sx, sy = im.width, im.height
        x0, y0, x1, y1 = [max(0.0, min(1.0, v)) for v in box]
        crop = im.crop((int(x0 * sx), int(y0 * sy), max(int(x0 * sx) + 1, int(x1 * sx)), max(int(y0 * sy) + 1, int(y1 * sy))))
        m = np.asarray(crop).reshape(-1, 3).mean(0)
        return [int(v) for v in m]

    def slot_of(layer, plate_id, pose):
        meta = alpha_meta(sprite_dir / f"{pose}.webp")
        aspect_px = meta["aspect"] * master_h / master_w  # sprite width in plate-width fractions per unit height
        w = layer["scale"] * aspect_px
        box = (layer["x"] - meta["footX"] * w, layer["y"] - layer["scale"], layer["x"] + (1 - meta["footX"]) * w, layer["y"])
        return {
            "pose": pose,
            "x": r4(layer["x"]),
            "y": r4(layer["y"]),
            "scale": r4(layer["scale"]),
            "facing": "left" if layer.get("flip") else "right",
            "z": "fr",
            "shadow": r4(layer.get("shadow", 0.8)),
            "lightDx": r4(layer.get("light_dx", 0.8)),
            "tint": plate_tint(plate_id, box),
        }

    def overlay_of(layer, oid, extra=None):
        name = Path(layer["file"]).stem
        meta = alpha_meta(overlay_dir / f"{name}.webp")
        o = {
            "file": name,
            "x": r4(layer["x"]),
            "y": r4(layer["y"]),
            "scale": r4(layer["scale"]),
            "aspect": meta["aspect"],
            "footX": meta["footX"],
            "anchor": layer.get("anchor", "feet"),
            "z": "under" if layer.get("z", 3) < 2 else "over",
        }
        if layer.get("rotate"):
            o["rotate"] = layer["rotate"]
        if layer.get("shadow"):
            o["shadow"] = r4(layer["shadow"])
        o.update(extra or {})
        return oid, o

    pages = {}
    for pid, p in BOOK_PAGES.items():
        heroes = [l for l in p.get("layers", []) if "sprites/keyed" in l.get("file", "")]
        g = {"plate": base_plate(p["plate"]), "phoneCrop": r4(p["window_cx"])}
        if p.get("text_zone"):
            g["textRect"] = [r4(v) for v in p["text_zone"]]
        if heroes:
            g["hero"] = slot_of(heroes[0], p["plate"], p["pose"])
        occ = [l for l in p.get("layers", []) if l.get("type") == "occluder"]
        if occ:
            g["occluders"] = [{"box": [r4(v) for v in o["box"]], "opacity": r4(o.get("opacity", 0.85)), "feather": r4(o.get("feather", 0.012)), "featherTop": r4(o.get("feather_top", 0.004))} for o in occ]
        if p.get("focus_rects"):
            plates[base_plate(p["plate"])]["focus"] = {k.split("_")[0]: {"x": r4(r[0]), "y": r4(r[1]), "w": r4(r[2] - r[0]), "h": r4(r[3] - r[1])} for k, r in p["focus_rects"].items()}
        ovs = {}
        for l in p.get("layers", []):
            if "overlays/keyed" in l.get("file", ""):
                oid, o = overlay_of(l, Path(l["file"]).stem)
                ovs[oid] = o
        if ovs:
            g["overlays"] = ovs
        pages[pid] = g

    # p5 costume B (tunic) — the same slot, the other pose
    pages["p5"]["heroAlt"] = {"tunic": slot_of(G["pages"]["p5-tunic"]["layers"][0], "PL4", "worried-tunic")}

    # p7b: the plates.json page is the END state. Start = p6b's armour-stuck + its helmet/sword;
    # each tap hides the worn piece and shows it on the heap (repair_items = landing spots).
    p6b, p7b = pages["p6b"], pages["p7b"]
    end_heroes = [l for l in G["pages"]["p7b"]["layers"] if "sprites/keyed" in l["file"]]
    p7b["heroAfter"] = slot_of(end_heroes[0], "PL4e", "free-stretch")
    p7b["hero"] = dict(p6b["hero"])
    heap = p7b.pop("overlays")
    ov = {}
    ov["helmet-worn"] = {**p6b["overlays"]["helmet-worn"], "showWhen": {"item": "helmet", "done": False}}
    ov["sword-rug"] = {**p6b["overlays"]["sword"], "showWhen": {"item": "sword", "done": False}}
    ov["coat-heap"] = {**heap["coat-heap"], "showWhen": {"item": "coat", "done": True}}
    ov["sword-heap"] = {**heap["sword"], "showWhen": {"item": "sword", "done": True}}
    ov["helmet-heap"] = {**heap["helmet"], "showWhen": {"item": "helmet", "done": True}}
    p7b["overlays"] = ov
    hw = p6b["overlays"]["helmet-worn"]
    sw = p6b["overlays"]["sword"]
    hero = p6b["hero"]
    ri = G["pages"]["p7b"]["repair_items"]
    p7b["items"] = {
        # compose.py anchors y at the BOTTOM edge even for anchor "center": the tap point is the helmet dome (above the brim)
        "helmet": {"x": hw["x"], "y": r4(hw["y"] - hw["scale"] * 0.68), "to": {"x": r4(ri["helmet"][0]), "y": r4(ri["helmet"][1])}},
        "coat": {"x": hero["x"], "y": r4(hero["y"] - hero["scale"] * 0.42), "to": {"x": r4(ri["coat"][0]), "y": r4(ri["coat"][1])}},
        "sword": {"x": sw["x"], "y": r4(sw["y"] - sw["scale"] * 0.5), "to": {"x": r4(ri["sword"][0]), "y": r4(ri["sword"][1])}},
    }

    # p7c: plates.json gives the AFTER state (v2: standing tall); before = p6c's seated slot.
    p7c = pages["p7c"]
    p7c["heroAfter"] = p7c["hero"]
    p7c["hero"] = dict(pages["p6c"]["hero"])
    p7c["items"] = {"stand": {"x": p7c["hero"]["x"], "y": r4(p7c["hero"]["y"] - p7c["hero"]["scale"] * 0.6)}}

    # p9: the BOOM dust cloud (behind the hero), revealed after the narration.
    boom = [l for l in G["pages"]["p9-boom"]["layers"] if "dust-cloud" in l["file"]][0]
    oid, o = overlay_of(boom, "dust-cloud", {"reveal": "afterNarration", "z": "under"})
    pages["p9"].setdefault("overlays", {})[oid] = o
    # v2: p9's states [p9, p9-boom, p9-rise] - the rise plate is a plate of its
    # own (the book's artStates name it; the hero slot is unchanged)
    for st in G["pages"]["p9"].get("states", []):
        sp = G["pages"].get(st, {}).get("plate")
        if sp and sp != G["pages"]["p9"]["plate"] and base_plate(sp) not in plates:
            print("WARNING: p9 state plate not shipped:", sp)

    scene_choices = PLATES_OUT / "choices"
    choice_art = {f.stem: f"choices/{f.name}" for f in sorted(scene_choices.glob("*.webp"))} if scene_choices.exists() else {}
    out = {
        **({"choiceArt": choice_art} if choice_art else {}),
        "_note": "GENERATED by app/scripts/import-book-art.py from proof-art/david/app/plates.json (art agent, round 3 / manuscript v2, 6 Oct). Fractions of the 3:2 master. Schema: src/lib/library/bookGeometry.ts. Re-run the script; do not hand-edit.",
        "plates": plates,
        "pages": pages,
    }
    dest = APP / args.geometry
    json.dump(out, open(dest, "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)
    open(dest, "a", encoding="utf-8", newline="\n").write("\n")
    print("geometry ->", dest)


if args.step in ("assets", "all"):
    assets()
if args.step in ("prints", "all"):
    prints()
if args.step in ("geometry", "all"):
    geometry()
