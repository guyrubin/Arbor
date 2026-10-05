/**
 * DEV PLACEHOLDER hero sheet — TEMPORARY scaffolding for B-GAME-05/07.
 *
 * Simple authored SVG figures (round head, body, cape) in a clearly different
 * silhouette per pose, so the orchestrator can check foot anchoring, pose
 * swaps and the depth run before the real sprites exist. Never shown to the
 * owner; replaced by the injected proof sheet (heroSheet.ts). The raw colours
 * below exist ONLY in this placeholder art.
 */
import type { HeroPoseId, HeroSheet, HeroSprite } from "./heroSheet";

const W = 200;
const H = 320;
const FOOT = { x: 100, y: 310 };

type Seg = readonly [number, number, number, number];
interface FigureSpec {
  head: readonly [number, number];
  torso: Seg;
  arms: readonly Seg[];
  legs: readonly Seg[];
  cape: string;
  mouth: "smile" | "grin" | "puff" | "open" | "shush";
  hand?: { l?: [number, number]; r?: [number, number] };
}

const SKIN = "#f1c29c";
const SUIT = "#3c6fd6";
const PANEL = "#d8463b";
const CAPE = "#b9332a";
const BOOT = "#a42a22";
const HAIR = "#4a2c1a";
const INK = "#2a2a3a";

const seg = (s: Seg, color: string, width: number) =>
  `<line x1="${s[0]}" y1="${s[1]}" x2="${s[2]}" y2="${s[3]}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;

function mouthOf(m: FigureSpec["mouth"], x: number, y: number): string {
  switch (m) {
    case "open":
      return `<ellipse cx="${x}" cy="${y + 12}" rx="8" ry="9" fill="${INK}"/>`;
    case "puff":
      return `<circle cx="${x - 17}" cy="${y + 8}" r="7" fill="${PANEL}" opacity="0.45"/><circle cx="${x + 17}" cy="${y + 8}" r="7" fill="${PANEL}" opacity="0.45"/><path d="M${x - 5} ${y + 13} h10" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    case "grin":
      return `<path d="M${x - 13} ${y + 8} Q${x} ${y + 24} ${x + 13} ${y + 8} Z" fill="${INK}"/>`;
    case "shush":
      return `<circle cx="${x}" cy="${y + 12}" r="4" fill="${INK}"/>`;
    default:
      return `<path d="M${x - 11} ${y + 10} Q${x} ${y + 19} ${x + 11} ${y + 10}" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
}

function svgOf(f: FigureSpec): string {
  const [hx, hy] = f.head;
  const legs = f.legs.map((l) => seg(l, SUIT, 24) + `<circle cx="${l[2]}" cy="${l[3]}" r="13" fill="${BOOT}"/>`).join("");
  const arms = f.arms.map((a) => seg(a, SUIT, 20) + `<circle cx="${a[2]}" cy="${a[3]}" r="10" fill="${SKIN}"/>`).join("");
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<path d="${f.cape}" fill="${CAPE}"/>`,
    legs,
    seg(f.torso, SUIT, 50),
    `<line x1="${f.torso[0]}" y1="${f.torso[1] + 14}" x2="${f.torso[2]}" y2="${f.torso[3] - 18}" stroke="${PANEL}" stroke-width="18" stroke-linecap="round"/>`,
    arms,
    `<circle cx="${hx}" cy="${hy}" r="33" fill="${SKIN}"/>`,
    `<path d="M${hx - 34} ${hy - 4} Q${hx - 30} ${hy - 44} ${hx} ${hy - 40} Q${hx + 32} ${hy - 44} ${hx + 34} ${hy - 4} Q${hx + 20} ${hy - 22} ${hx} ${hy - 20} Q${hx - 20} ${hy - 22} ${hx - 34} ${hy - 4} Z" fill="${HAIR}"/>`,
    `<circle cx="${hx - 11}" cy="${hy - 2}" r="4.5" fill="${INK}"/><circle cx="${hx + 11}" cy="${hy - 2}" r="4.5" fill="${INK}"/>`,
    mouthOf(f.mouth, hx, hy),
    `</svg>`,
  ];
  return parts.join("");
}

const FIGURES: Record<HeroPoseId, FigureSpec> = {
  idle: {
    head: [100, 62], torso: [100, 104, 100, 190],
    arms: [[100, 114, 72, 186], [100, 114, 128, 186]],
    legs: [[92, 192, 88, 300], [108, 192, 112, 300]],
    cape: "M78 100 L122 100 L142 236 L58 236 Z", mouth: "smile",
  },
  tiptoe: {
    head: [104, 72], torso: [102, 112, 98, 192],
    arms: [[100, 122, 92, 92], [104, 122, 146, 168]],
    legs: [[94, 194, 84, 300], [106, 194, 132, 262]],
    cape: "M80 108 L124 108 L150 230 L64 240 Z", mouth: "shush",
  },
  dash: {
    head: [96, 74], torso: [98, 112, 94, 190],
    arms: [[98, 122, 52, 156], [98, 122, 150, 92]],
    legs: [[92, 192, 50, 300], [100, 192, 158, 262]],
    cape: "M74 104 L124 104 L190 196 L12 214 Z", mouth: "grin",
  },
  "freeze-a": {
    head: [100, 62], torso: [100, 104, 100, 190],
    arms: [[100, 116, 26, 112], [100, 116, 174, 112]],
    legs: [[94, 192, 94, 300], [106, 192, 152, 232]],
    cape: "M78 100 L122 100 L136 232 L64 232 Z", mouth: "puff",
  },
  "freeze-b": {
    head: [100, 70], torso: [100, 112, 100, 196],
    arms: [[96, 120, 58, 34], [104, 120, 142, 34]],
    legs: [[94, 198, 70, 300], [106, 198, 130, 296]],
    cape: "M78 108 L122 108 L146 240 L54 240 Z", mouth: "open",
  },
  oops: {
    head: [100, 168], torso: [100, 206, 100, 268],
    arms: [[100, 218, 36, 252], [100, 218, 164, 252]],
    legs: [[92, 276, 40, 300], [108, 276, 160, 300]],
    cape: "M70 200 L130 200 L178 302 L22 302 Z", mouth: "open",
  },
  cheer: {
    head: [100, 46], torso: [100, 86, 100, 170],
    arms: [[96, 96, 40, 22], [104, 96, 160, 22]],
    legs: [[94, 172, 76, 236], [106, 172, 124, 236]],
    cape: "M76 84 L124 84 L166 200 L34 200 Z", mouth: "grin",
  },
  "hold-up": {
    head: [100, 74], torso: [100, 114, 100, 196],
    arms: [[96, 122, 84, 40], [104, 122, 116, 40]],
    legs: [[92, 198, 86, 300], [108, 198, 114, 300]],
    cape: "M78 110 L122 110 L142 240 L58 240 Z", mouth: "grin",
    hand: { l: [84, 40], r: [116, 40] },
  },
};

const toDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

let cached: HeroSheet | null = null;

/** The built-in placeholder sheet (all eight poses), source "dev-placeholder". */
export function devPlaceholderSheet(): HeroSheet {
  if (cached) return cached;
  const poses: Partial<Record<HeroPoseId, HeroSprite>> = {};
  for (const [id, f] of Object.entries(FIGURES) as [HeroPoseId, FigureSpec][]) {
    poses[id] = { url: toDataUrl(svgOf(f)), w: W, h: H, foot: { ...FOOT }, head: { x: f.head[0], y: f.head[1], r: 33 }, ...(f.hand ? { hand: f.hand } : {}) };
  }
  cached = { v: 1, heroId: "dev-placeholder", source: "dev-placeholder", theme: "film3d", poses };
  return cached;
}
