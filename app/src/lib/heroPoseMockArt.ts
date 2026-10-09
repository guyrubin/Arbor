/**
 * heroPoseMockArt — B-GAME-13d: a deterministic synthetic pose sprite on the
 * flat chroma green, so the whole sheet pipeline (route -> device keyer -> QA
 * -> normalise -> record) runs on the sandbox with MODEL_PROVIDER=mock and no
 * spend. A drawn figure (hair, face, shirt, trousers, shoes) whose arms and
 * legs follow the eight game poses; one connected figure, >= 6 % margins, no
 * key tint — it passes the same QA gate a real render must pass.
 * K2: the book poses too (BOOK_MOCK: legs, arms and a wooden staff where the
 * pose holds one), so the sandbox runs a book pose through the same pipeline
 * with no spend; the game's eight rasters are unchanged (hash-pinned).
 * Pure: the server encodes it as PNG (server/heroPoseMock.ts); tests use it raw.
 */
import { isHeroBookPose, type HeroBookPoseId, type HeroPoseId } from "./heroSheetContract";

export interface MockRaster { width: number; height: number; data: Uint8ClampedArray }

type RGB = readonly [number, number, number];
const KEY: RGB = [0, 177, 64];
const HAIR: RGB = [70, 40, 20];
const SKIN: RGB = [225, 160, 120];
const SHIRT: RGB = [200, 60, 60];
const TROUSERS: RGB = [40, 60, 150];
const SHOES: RGB = [60, 40, 30];
const WOOD: RGB = [150, 100, 50];

export const MOCK_POSE_W = 384;
export const MOCK_POSE_H = 512;

type Pt = [number, number];
/** A book pose's synthetic body: the legs, the two hands (from the shoulders
 *  sl / sr at height sy) and, where the pose holds one, the staff (a segment
 *  through a hand). */
interface BookMock {
  legs: "stand" | "stride" | "sit" | "tip";
  arms: (sl: number, sr: number, sy: number) => [Pt, Pt];
  staff?: (sl: number, sr: number, sy: number) => [number, number, number, number];
}
export const BOOK_MOCK: Readonly<Record<HeroBookPoseId, BookMock>> = {
  "sling-swing": { legs: "stand", arms: (sl, sr) => [[sl - 50, 240], [sr + 10, 60]] },
  "sling-swing-face-right": { legs: "stride", arms: (sl, sr) => [[sl - 56, 220], [sr + 24, 62]] },
  "sling-release": { legs: "stride", arms: (sl, sr) => [[sl - 30, 290], [sr + 84, 110]] },
  "run-staff": { legs: "stride", arms: (sl, sr) => [[sl - 44, 250], [sr + 48, 286]], staff: (_sl, sr) => [sr + 48, 166, sr + 48, 400] },
  "run-staff-left": { legs: "stride", arms: (sl, sr) => [[sl - 48, 286], [sr + 44, 250]], staff: (sl) => [sl - 48, 166, sl - 48, 400] },
  "walk-bread": { legs: "stride", arms: (sl, sr) => [[sl - 40, 290], [sr + 30, 130]], staff: (sl) => [sl - 40, 170, sl - 40, 420] },
  "look-up": { legs: "stand", arms: (sl, sr) => [[sl - 20, 286], [sr + 12, 292]] },
  "look-up-unsure": { legs: "stand", arms: (sl, sr) => [[sl + 6, 236], [sr - 6, 236]] },
  "look-across": { legs: "stand", arms: (sl, sr) => [[sl - 12, 292], [sr + 20, 286]] },
  worried: { legs: "stand", arms: (sl, sr) => [[sl - 8, 294], [sr + 8, 294]] },
  "worried-tunic": { legs: "stand", arms: (sl, sr) => [[sl - 8, 294], [sr + 8, 294]] },
  "stand-tall-hand": { legs: "stand", arms: (sl, sr) => [[sl - 16, 290], [sr + 52, 150]] },
  "stand-tall": { legs: "stand", arms: (sl, sr) => [[sl - 16, 290], [sr + 16, 290]], staff: (sl) => [sl - 16, 160, sl - 16, 430] },
  "armour-stuck": { legs: "stand", arms: (sl, sr) => [[sl - 64, 246], [sr + 64, 246]] },
  "free-stretch": { legs: "tip", arms: (sl, sr) => [[sl - 72, 70], [sr + 72, 70]] },
  sit: { legs: "sit", arms: (sl, sr) => [[sl - 40, 380], [sr + 40, 380]], staff: (sl, sr) => [sl - 76, 390, sr + 76, 390] },
  "sit-hunched": { legs: "sit", arms: (sl, sr) => [[sl - 10, 360], [sr + 10, 360]] },
  "squat-stones": { legs: "sit", arms: (sl, sr) => [[sl - 30, 380], [sr + 70, 330]] },
};

export function mockHeroPoseRaster(pose: HeroPoseId): MockRaster {
  const book = isHeroBookPose(pose) ? BOOK_MOCK[pose] : null;
  const W = MOCK_POSE_W, H = MOCK_POSE_H, cx = W / 2;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let p = 0; p < W * H; p++) { data[p * 4] = KEY[0]; data[p * 4 + 1] = KEY[1]; data[p * 4 + 2] = KEY[2]; data[p * 4 + 3] = 255; }
  const fill = (inside: (x: number, y: number) => boolean, c: RGB, box: [number, number, number, number] = [0, 0, W, H]) => {
    for (let y = Math.max(0, box[1]); y < Math.min(H, box[3]); y++) for (let x = Math.max(0, box[0]); x < Math.min(W, box[2]); x++) {
      if (!inside(x, y)) continue;
      const i = (y * W + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
    }
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: RGB) => fill(() => true, c, [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)]);
  /** A limb: a thick segment (radius r) from a to b. */
  const limb = (ax: number, ay: number, bx: number, by: number, r: number, c: RGB) => {
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    fill((x, y) => {
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      return (x - (ax + t * dx)) ** 2 + (y - (ay + t * dy)) ** 2 <= r * r;
    }, c, [Math.floor(Math.min(ax, bx) - r), Math.floor(Math.min(ay, by) - r), Math.ceil(Math.max(ax, bx) + r + 1), Math.ceil(Math.max(ay, by) + r + 1)]);
  };
  const sitting = book ? book.legs === "sit" : pose === "oops";
  const dy = sitting ? 120 : 0; // the whole upper body drops when seated
  const headY = 120 + dy, headR = 40;
  // Legs first (the torso overlaps their tops).
  if (sitting) {
    limb(cx - 20, 290 + dy - 10, cx - 120, 400, 13, TROUSERS);
    limb(cx + 20, 290 + dy - 10, cx + 120, 400, 13, TROUSERS);
    limb(cx - 120, 400, cx - 132, 400, 14, SHOES);
    limb(cx + 120, 400, cx + 132, 400, 14, SHOES);
  } else if (book ? book.legs === "stride" : pose === "dash" || pose === "freeze-a") {
    limb(cx - 18, 300, cx - 18, 440, 12, TROUSERS);
    rect(cx - 34, 436, cx - 2, 452, SHOES);
    limb(cx + 18, 300, cx + 46, 360, 12, TROUSERS); // the knee lifted
    limb(cx + 46, 360, cx + 40, 410, 12, TROUSERS);
    rect(cx + 26, 406, cx + 58, 420, SHOES);
  } else if (!book && pose === "freeze-b") {
    limb(cx - 18, 300, cx - 18, 440, 12, TROUSERS);
    rect(cx - 34, 436, cx - 2, 452, SHOES);
    limb(cx + 18, 300, cx + 62, 350, 12, TROUSERS); // the tree leg, knee out
    limb(cx + 62, 350, cx - 4, 380, 12, TROUSERS);
  } else {
    const lift = (book ? book.legs === "tip" : pose === "tiptoe" || pose === "cheer") ? 10 : 0;
    limb(cx - 18, 300, cx - 22, 440 - lift, 12, TROUSERS);
    limb(cx + 18, 300, cx + 22, 440 - lift, 12, TROUSERS);
    rect(cx - 40, 436 - lift, cx - 6, 452 - lift, SHOES);
    rect(cx + 6, 436 - lift, cx + 40, 452 - lift, SHOES);
  }
  // Torso, neck, head (hair on the top half).
  rect(cx - 34, 160 + dy, cx + 34, 300 + dy - (sitting ? 10 : 0), SHIRT);
  rect(cx - 10, 150 + dy, cx + 10, 165 + dy, SKIN);
  fill((x, y) => (x - cx) ** 2 + (y - headY) ** 2 < headR ** 2, SKIN, [cx - headR, headY - headR, cx + headR + 1, headY + headR + 1]);
  fill((x, y) => (x - cx) ** 2 + (y - headY) ** 2 < headR ** 2 && y < headY - 8, HAIR, [cx - headR, headY - headR, cx + headR + 1, headY]);
  // Arms (shoulders at the torso's top corners).
  const sy = 172 + dy, sl = cx - 34, sr = cx + 34;
  const arm = (ax: number, ay: number, bx: number, by: number) => { limb(ax, ay, bx, by, 10, SHIRT); limb(bx, by, bx, by, 11, SKIN); };
  if (book) {
    const [[lx, ly], [rx, ry]] = book.arms(sl, sr, sy);
    arm(sl, sy, lx, ly);
    arm(sr, sy, rx, ry);
    if (book.staff) { const [x0, y0, x1, y1] = book.staff(sl, sr, sy); limb(x0, y0, x1, y1, 5, WOOD); }
  } else switch (pose) {
    case "idle": arm(sl, sy, sl - 16, 290); arm(sr, sy, sr + 16, 290); break;
    case "tiptoe": arm(sr, sy, cx + 8, 132); arm(sl, sy, sl - 60, 280); break;
    case "dash": arm(sl, sy, sl - 48, 120); arm(sr, sy, sr + 52, 250); break;
    case "freeze-a": arm(sl, sy, 40, sy); arm(sr, sy, W - 40, sy); break;
    case "freeze-b": arm(sl, sy, sl - 40, 225); limb(sl - 40, 225, sl + 2, 280, 10, SHIRT); arm(sr, sy, sr + 40, 225); limb(sr + 40, 225, sr - 2, 280, 10, SHIRT); break;
    case "oops": arm(sl, sy, sl - 40, 380); arm(sr, sy, sr + 40, 380); break;
    case "cheer": arm(sl, sy, sl - 60, 64); arm(sr, sy, sr + 60, 64); break;
    case "hold-up": arm(sl, sy, sl - 12, 56); arm(sr, sy, sr + 12, 56); break;
  }
  return { width: W, height: H, data };
}
