"""B-BOOK-01: DEV placeholder art for the new kid book reader.

Writes, under app/public/_dev/ (git-ignored, never shipped):
  plates/<bookId>/<plateId>.webp      1536x1024 flat gradient plates, labelled
  hero-sheets/placeholder/<pose>.webp a neutral mannequin per pose (alpha),
                                      feet at the bottom centre, facing right

The mannequin is a plain shape, not anyone's likeness. Real plates go to
public/visuals/books/<bookId>/ and replace these automatically (the registry
tries the real file first). Run from app/:  python scripts/dev-book-placeholders.py
"""
from pathlib import Path

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
    }
}


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


# ---- the neutral mannequin ---------------------------------------------------
SW, SH = 520, 780  # sprite canvas (feet at the bottom centre)
S = 2  # supersample


def limb(d, a, b, w, fill):
    d.line((a[0] * S, a[1] * S, b[0] * S, b[1] * S), fill=fill, width=w * S)
    r = w * S / 2
    for p in (a, b):
        d.ellipse((p[0] * S - r, p[1] * S - r, p[0] * S + r, p[1] * S + r), fill=fill)


POSES = {
    # (left arm end, right arm end, left foot, right foot, hip y, sitting?)
    "stand": ((200, 470), (320, 470), (232, 770), (288, 770), 520, False),
    "walk": ((180, 440), (330, 470), (200, 770), (320, 770), 520, False),
    "run": ((160, 380), (360, 470), (170, 760), (350, 740), 515, False),
    "wave": ((205, 470), (380, 150), (232, 770), (288, 770), 520, False),
    "arms-wide": ((60, 300), (460, 300), (215, 770), (305, 770), 520, False),
    "sit": ((200, 600), (320, 600), (170, 770), (350, 770), 700, True),
}


def make_sprite(path: Path, pose: str):
    la, ra, lf, rf, hip_y, sitting = POSES[pose]
    img = Image.new("RGBA", (SW * S, SH * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    body = (226, 132, 86, 255)
    limbc = (196, 108, 70, 255)
    head = (247, 214, 176, 255)
    shoulder_y = 330 if not sitting else 500
    head_c = (260, 220 if not sitting else 395)
    hip = (260, hip_y)
    # legs
    if sitting:
        limb(d, (235, hip_y), (lf[0] + 20, hip_y + 10), 46, limbc)
        limb(d, (285, hip_y), (rf[0] - 20, hip_y + 10), 46, limbc)
        limb(d, (lf[0] + 20, hip_y + 10), lf, 42, limbc)
        limb(d, (rf[0] - 20, hip_y + 10), rf, 42, limbc)
    else:
        limb(d, (240, hip_y), lf, 48, limbc)
        limb(d, (280, hip_y), rf, 48, limbc)
    # arms
    limb(d, (205, shoulder_y + 20), la, 36, limbc)
    limb(d, (315, shoulder_y + 20), ra, 36, limbc)
    # torso
    d.rounded_rectangle((185 * S, (shoulder_y - 10) * S, 335 * S, (hip_y + 30) * S), radius=60 * S, fill=body)
    # head
    r = 95
    d.ellipse(((head_c[0] - r) * S, (head_c[1] - r) * S, (head_c[0] + r) * S, (head_c[1] + r) * S), fill=head)
    # a nose bump toward the right (the authored facing)
    d.ellipse(((head_c[0] + 70) * S, (head_c[1] - 5) * S, (head_c[0] + 105) * S, (head_c[1] + 30) * S), fill=head)
    img = img.resize((SW, SH), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=90)


def main():
    for book_id, plates in PLATES.items():
        for plate_id, (rig, caption) in plates.items():
            make_plate(OUT / "plates" / book_id / f"{plate_id}.webp", rig, plate_id, caption)
    for pose in POSES:
        make_sprite(OUT / "hero-sheets" / "placeholder" / f"{pose}.webp", pose)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
