"""B-BOOK-01: DEV placeholder art for the new kid book reader.

Writes, under app/public/_dev/ (git-ignored, never shipped):
  plates/<bookId>/<plateId>.webp      1536x1024 flat gradient plates, labelled
  hero-sheets/placeholder/<pose>.webp a neutral, softly shaded child silhouette for EVERY pose id the
                                      books name (+ manifest.json); also src/lib/library/__fixtures__/
                                      placeholder-sheet.manifest.json (committed, pose ids only) for the tests
  overlays/five-smooth-stones/*.webp  flat helmet / sword / dust-cloud shapes

The mannequin is a plain shape, not anyone's likeness. Real plates go to
public/visuals/books/<bookId>/ and replace these automatically (the registry
tries the real file first). Run from app/:  python scripts/dev-book-placeholders.py
"""
import json
import re
from pathlib import Path

import numpy as np

from PIL import Image, ImageDraw, ImageFilter, ImageFont

APP = Path(__file__).resolve().parent.parent
OUT = APP / "public" / "_dev"

W, H = 1536, 1024

# (top, horizon, ground) colours per light rig — placeholders only.
RIGS = {
    "morning": ((236, 214, 170), (246, 230, 196), (196, 170, 116)),
    "day": ((150, 196, 232), (214, 232, 240), (186, 168, 104)),
    "golden": ((236, 176, 98), (250, 216, 150), (128, 150, 82)),
    "dusk": ((92, 78, 140), (232, 150, 112), (120, 92, 72)),
    "night": ((22, 30, 66), (52, 62, 112), (40, 42, 58)),
}

PLATES = {
    "abrams-long-road": {
        "P1e": ("dusk", "Haran by the well, evening"),
        "P1m": ("morning", "Haran, morning, packing"),
        "P1b": ("day", "Haran, the line waits in the sun"),
        "P1c": ("morning", "Haran, the donkey and the pile"),
        "P2": ("night", "Haran at night, the tent flap"),
        "P3": ("morning", "The road at sunrise"),
        "P4": ("day", "The great river"),
        "P5": ("golden", "The hill with the great oak"),
        "P6": ("dusk", "The new tent under the oak"),
    },
    "five-smooth-stones": {
        "PL1": ("morning", "Bethlehem hills"),
        "PL1b": ("day", "Bethlehem hills, midday, the lion fleeing"),
        "PL1d": ("dusk", "Bethlehem hills at dusk"),
        "PL3": ("morning", "The Valley of Elah"),
        "PL3w": ("day", "Elah, later, soldiers sitting"),
        "PL4": ("day", "King Saul's tent"),
        "PL4e": ("day", "Saul's tent, the stand empty"),
        "PL6": ("morning", "The brook"),
        "PL7": ("day", "The duel"),
    },
}

def make_overlay(path: Path, kind: str):
    """Flat alpha shapes standing in for the shared overlay objects."""
    W2, H2 = {"helmet": (440, 400), "sword": (720, 300), "dust": (960, 800)}[kind]
    img = Image.new("RGBA", (W2, H2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "helmet":
        d.pieslice((20, 40, W2 - 20, H2 * 2 - 120), 180, 360, fill=(196, 140, 64, 255))
        d.rectangle((10, H2 - 90, W2 - 10, H2 - 50), fill=(160, 110, 50, 255))
    elif kind == "sword":
        d.rectangle((140, H2 // 2 - 18, W2 - 30, H2 // 2 + 18), fill=(200, 205, 214, 255))
        d.rectangle((110, H2 // 2 - 70, 140, H2 // 2 + 70), fill=(150, 110, 60, 255))
        d.rectangle((20, H2 // 2 - 16, 110, H2 // 2 + 16), fill=(120, 80, 40, 255))
    else:
        for i, (cx, cy, r) in enumerate([(300, 520, 260), (560, 440, 300), (720, 580, 220), (420, 330, 220), (640, 260, 180)]):
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(222, 206, 176, 235))
        img = img.filter(ImageFilter.GaussianBlur(14))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=90)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def font(size):
    for name in ("seguisb.ttf", "segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_plate(path: Path, rig: str, plate_id: str, caption: str):
    top, horizon, ground = RIGS[rig]
    img = Image.new("RGB", (W, H))
    px = img.load()
    hy = int(H * 0.62)
    for y in range(H):
        if y < hy:
            c = lerp(top, horizon, y / hy)
        else:
            c = lerp(ground, lerp(ground, (0, 0, 0), 0.25), (y - hy) / (H - hy))
        for x in range(W):
            px[x, y] = c
    d = ImageDraw.Draw(img, "RGBA")
    # soft far hills on the horizon
    d.ellipse((-200, hy - 120, 700, hy + 160), fill=lerp(ground, horizon, 0.45) + (255,))
    d.ellipse((600, hy - 90, 1800, hy + 200), fill=lerp(ground, horizon, 0.3) + (255,))
    # the gutter band of a print spread (46-54 %), barely visible
    d.rectangle((int(W * 0.46), 0, int(W * 0.54), H), fill=(255, 255, 255, 10))
    label = font(150)
    small = font(40)
    ink = (255, 255, 255, 120) if rig in ("night", "dusk") else (40, 40, 40, 90)
    d.text((W * 0.06, H * 0.07), plate_id, font=label, fill=ink)
    d.text((W * 0.06, H * 0.07 + 170), caption + "  (DEV placeholder)", font=small, fill=ink)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=80)


# ---- the neutral mannequin (fix round 2, ruling 5) ----------------------------
# A neutral child silhouette with soft shading (light from the upper left, a
# darker rim, a faint ground-facing shade) — it stands in for "any child's hero"
# on every pose id a book names. Child proportions: the head ~1/4 of the height.
SW, SH = 520, 780  # sprite canvas (feet at the bottom centre)
S = 3  # supersample
SRC_DIR = APP / "src" / "lib" / "library"
FIXTURE = SRC_DIR / "__fixtures__" / "placeholder-sheet.manifest.json"


def limb(d, a, b, w):
    d.line((a[0] * S, a[1] * S, b[0] * S, b[1] * S), fill=255, width=int(w * S))
    r = w * S / 2
    for q in (a, b):
        d.ellipse((q[0] * S - r, q[1] * S - r, q[0] * S + r, q[1] * S + r), fill=255)


# base shapes: (left hand, right hand, left foot, right foot, hip y, kind)
SHAPES = {
    "stand": ((168, 515), (352, 515), (236, 772), (284, 772), 545, "stand"),
    "walk": ((160, 480), (360, 515), (205, 772), (318, 772), 545, "stand"),
    "run": ((165, 410), (365, 500), (175, 762), (352, 742), 540, "stand"),
    "wave": ((168, 515), (372, 175), (236, 772), (284, 772), 545, "stand"),
    "arms-wide": ((70, 330), (450, 330), (218, 772), (302, 772), 545, "stand"),
    "sit": ((150, 660), (370, 660), (150, 772), (370, 772), 690, "sit"),
    "squat": ((175, 690), (345, 690), (170, 772), (350, 772), 680, "squat"),
}


def shape_of(pose: str) -> str:
    p = pose.lower()
    for key, base in (("arms-wide", "arms-wide"), ("stretch", "arms-wide"), ("armour", "arms-wide"), ("sling", "wave"), ("wave", "wave"),
                      ("run", "run"), ("walk", "walk"), ("squat", "squat"), ("kneel", "squat"), ("crouch", "squat"), ("hunched", "sit"), ("sit", "sit")):
        if key in p:
            return base
    return "stand"


def make_sprite(path: Path, pose: str):
    base = shape_of(pose)
    la, ra, lf, rf, hip_y, kind = SHAPES[base]
    W2, H2 = SW * S, SH * S
    mask = Image.new("L", (W2, H2), 0)
    d = ImageDraw.Draw(mask)
    head_r = 92
    if kind == "stand":
        head_c, shoulder_y = (260, 205), 315
    else:
        head_c, shoulder_y = (260, 390), 480
    # legs
    if kind == "sit":
        limb(d, (238, hip_y), (lf[0] + 22, hip_y + 8), 50)
        limb(d, (282, hip_y), (rf[0] - 22, hip_y + 8), 50)
        limb(d, (lf[0] + 22, hip_y + 8), lf, 44)
        limb(d, (rf[0] - 22, hip_y + 8), rf, 44)
    elif kind == "squat":
        limb(d, (240, hip_y), (200, hip_y - 40), 52)
        limb(d, (280, hip_y), (320, hip_y - 40), 52)
        limb(d, (200, hip_y - 40), lf, 46)
        limb(d, (320, hip_y - 40), rf, 46)
    else:
        limb(d, (242, hip_y), lf, 52)
        limb(d, (278, hip_y), rf, 52)
    # arms
    limb(d, (206, shoulder_y + 20), la, 34)
    limb(d, (314, shoulder_y + 20), ra, 34)
    # torso (a little narrower at the hips) + neck + head
    d.polygon([(196 * S, (shoulder_y + 6) * S), (324 * S, (shoulder_y + 6) * S), (312 * S, (hip_y + 20) * S), (208 * S, (hip_y + 20) * S)], fill=255)
    d.rounded_rectangle((192 * S, (shoulder_y - 14) * S, 328 * S, (shoulder_y + 70) * S), radius=40 * S, fill=255)
    d.rounded_rectangle((204 * S, (hip_y - 30) * S, 316 * S, (hip_y + 30) * S), radius=26 * S, fill=255)
    d.rounded_rectangle((238 * S, (head_c[1] + head_r - 30) * S, 282 * S, (shoulder_y + 10) * S), radius=16 * S, fill=255)
    d.ellipse(((head_c[0] - head_r) * S, (head_c[1] - head_r) * S, (head_c[0] + head_r) * S, (head_c[1] + head_r) * S), fill=255)
    # the facing hint: a soft nose bump toward the authored facing (right)
    d.ellipse(((head_c[0] + 74) * S, (head_c[1] - 4) * S, (head_c[0] + 104) * S, (head_c[1] + 26) * S), fill=255)
    # soft shading: a diagonal light (upper left) + a darker rim inside the edge
    yy, xx = np.mgrid[0:H2, 0:W2].astype(np.float32)
    light = 1.0 - 0.28 * ((xx / W2) * 0.6 + (yy / H2) * 0.4)
    m = np.asarray(mask).astype(np.float32) / 255.0
    inner = np.asarray(mask.filter(ImageFilter.GaussianBlur(10 * S))).astype(np.float32) / 255.0
    rim = np.clip(1.0 - inner, 0, 1) * m
    base_rgb = np.array([150, 162, 178], dtype=np.float32)  # a neutral blue-grey
    rgb = base_rgb[None, None, :] * light[..., None] * (1.0 - 0.32 * rim[..., None])
    # a faint highlight on the head and shoulder (upper left)
    hl = np.exp(-(((xx - (head_c[0] - 30) * S) / (60 * S)) ** 2 + ((yy - (head_c[1] - 34) * S) / (50 * S)) ** 2))
    rgb = rgb + 40 * hl[..., None] * m[..., None]
    out = np.dstack([np.clip(rgb, 0, 255), m * 255]).astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    if pose.endswith("-left"):
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    img = img.resize((SW, SH), Image.LANCZOS)
    # crop to the opaque box (as the real sheets are), keep the feet on the bottom
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=90)
    return img


def pose_ids() -> list:
    """Every pose id the books name: the geometry files + the book sources."""
    found = set()
    for f in SRC_DIR.glob("books/*.geometry.json"):
        found |= set(re.findall(r'"pose":\s*"([A-Za-z0-9_-]+)"', f.read_text(encoding="utf-8")))
    for f in SRC_DIR.glob("books/*.ts"):
        found |= set(re.findall(r'pose:\s*"([A-Za-z0-9_-]+)"', f.read_text(encoding="utf-8")))
        found |= set(re.findall(r'heroOf\("[^"]+",\s*"([A-Za-z0-9_-]+)"\)', f.read_text(encoding="utf-8")))
        found |= set(re.findall(r'afterOf\("[^"]+",\s*"([A-Za-z0-9_-]+)"\)', f.read_text(encoding="utf-8")))
    return sorted(found)


def alpha_meta(img: Image.Image):
    a = np.asarray(img.getchannel("A"))
    rows = np.where(a.max(1) > 80)[0]
    bot = int(rows.max())
    band = a[int(bot - 0.06 * img.height): bot + 1]
    xs = np.where(band.max(0) > 80)[0]
    return {"aspect": round(img.width / img.height, 4), "footX": round(float((xs.min() + xs.max()) / 2 / img.width), 4), "footW": round(float((xs.max() - xs.min()) / img.width), 4)}


def main():
    for book_id, plates in PLATES.items():
        for plate_id, (rig, caption) in plates.items():
            make_plate(OUT / "plates" / book_id / f"{plate_id}.webp", rig, plate_id, caption)
    sheet = OUT / "hero-sheets" / "placeholder"
    poses = {}
    for pose in pose_ids():
        img = make_sprite(sheet / f"{pose}.webp", pose)
        poses[pose] = {"file": f"{pose}.webp", **alpha_meta(img)}
    manifest = {"id": "placeholder", "poses": poses, "prints": {}}
    (sheet / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    # the committed fixture (pose ids + geometry only; no image) the tests check
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    for kind in ("helmet", "sword", "dust"):
        make_overlay(OUT / "overlays" / "five-smooth-stones" / f"{kind}.webp", kind)
    print("wrote", OUT, "poses:", len(poses))


if __name__ == "__main__":
    main()
