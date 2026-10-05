/**
 * DEV PLACEHOLDER art for Sneak & Freeze — TEMPORARY scaffolding.
 *
 * Authored SVGs (courtyard plate per orientation, the cat in its states,
 * three cover objects, three prizes) so the orchestrator can check layout,
 * depth, timing and RTL before the real art exists. Never shown to the
 * owner; replaced slot by slot by injected art (sneakArt.ts). The raw colours
 * below exist ONLY in this placeholder art.
 */
import type { ArtSprite, SneakArt } from "./sneakArt";
import { DESIGN, PLATE_BLEED, sneakLayout, pointOnPath, type FieldOrientation } from "../../game/fieldLayout";

const C = {
  skyTop: "#f2b77a",
  skyLow: "#fbe3bd",
  sun: "#fff3d6",
  stone: "#e9d3a6",
  stoneLine: "#cdb07e",
  stoneShade: "#d9bd8a",
  door: "#7b4b2a",
  doorDark: "#5c3519",
  floor: "#e3c393",
  floorLine: "#cfac76",
  path: "#f4e3c3",
  pathEdge: "#c9a874",
  shade: "#6b4a2e",
  bloom: "#d9508c",
  leaf: "#4f8a3c",
  leafDark: "#3c6e2e",
  pot: "#c0653a",
  wood: "#8a5a2c",
  woodDark: "#6a4220",
  metal: "#3d3a44",
  glow: "#ffd67a",
  lemon: "#f5d43a",
  wool: "#e87aa6",
  woolLine: "#c75a86",
  bell: "#e5b23a",
  bellDark: "#b8862a",
  cat: "#e9963e",
  catDark: "#c87628",
  catLight: "#f8d9b0",
  ink: "#2a2a3a",
  white: "#ffffff",
  pink: "#f19bb0",
  shadesLens: "#1f2230",
};

const url = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
const svg = (vb: string, w: number, h: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">${body}</svg>`;

// ── the courtyard plate ────────────────────────────────────────────────────

function plateSvg(o: FieldOrientation): string {
  const d = DESIGN[o];
  const bx = d.w * PLATE_BLEED;
  const by = d.h * PLATE_BLEED;
  const W = d.w + 2 * bx;
  const H = d.h + 2 * by;
  const layout = sneakLayout(o);
  const gate = layout.heroPath[0];
  const wallTop = gate.y - gate.h * 1.9;
  const wallBase = gate.y + 6;
  const x0 = -bx;
  const x1 = d.w + bx;
  const y0 = -by;
  const y1 = d.h + by;
  const parts: string[] = [];
  parts.push(`<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="${C.skyLow}"/></linearGradient></defs>`);
  parts.push(`<rect x="${x0}" y="${y0}" width="${W}" height="${wallTop - y0 + 2}" fill="url(#sky)"/>`);
  parts.push(`<circle cx="${d.w * 0.8}" cy="${wallTop - d.h * 0.08}" r="${d.w * 0.07}" fill="${C.sun}" opacity="0.9"/>`);
  // Jerusalem-stone wall with staggered blocks.
  parts.push(`<rect x="${x0}" y="${wallTop}" width="${W}" height="${wallBase - wallTop}" fill="${C.stone}"/>`);
  const row = (wallBase - wallTop) / 7;
  for (let i = 1; i < 7; i++) {
    const y = wallTop + i * row;
    parts.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.stoneLine}" stroke-width="3"/>`);
    const blk = row * 2.2;
    for (let x = x0 + (i % 2 ? blk / 2 : 0); x < x1; x += blk) parts.push(`<line x1="${x}" y1="${y - row}" x2="${x}" y2="${y}" stroke="${C.stoneLine}" stroke-width="3"/>`);
  }
  // The arched gate the hero comes from.
  const gw = gate.h * 1.25;
  const gh = gate.h * 1.45;
  parts.push(`<path d="M${gate.x - gw / 2} ${wallBase} V${wallBase - gh + gw / 2} A${gw / 2} ${gw / 2} 0 0 1 ${gate.x + gw / 2} ${wallBase - gh + gw / 2} V${wallBase} Z" fill="${C.doorDark}"/>`);
  parts.push(`<path d="M${gate.x - gw / 2 + 8} ${wallBase} V${wallBase - gh + gw / 2} A${gw / 2 - 8} ${gw / 2 - 8} 0 0 1 ${gate.x - 4} ${wallBase - gh + 12} V${wallBase} Z" fill="${C.door}"/>`);
  // Bougainvillea over the wall.
  for (const [cx, r] of [[x0 + W * 0.12, 70], [x0 + W * 0.2, 55], [x0 + W * 0.84, 80], [x0 + W * 0.92, 60]] as [number, number][]) {
    parts.push(`<circle cx="${cx}" cy="${wallTop + 10}" r="${r}" fill="${C.leafDark}"/><circle cx="${cx + r * 0.3}" cy="${wallTop}" r="${r * 0.7}" fill="${C.bloom}"/><circle cx="${cx - r * 0.4}" cy="${wallTop + r * 0.3}" r="${r * 0.45}" fill="${C.bloom}"/>`);
  }
  // Courtyard floor, stone tiles in perspective.
  parts.push(`<rect x="${x0}" y="${wallBase}" width="${W}" height="${y1 - wallBase}" fill="${C.floor}"/>`);
  let y = wallBase;
  let step = d.h * 0.02;
  while (y < y1) {
    parts.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${C.floorLine}" stroke-width="${Math.max(2, step * 0.05)}"/>`);
    y += step;
    step *= 1.22;
  }
  const vx = d.w / 2;
  for (let i = -14; i <= 14; i++) parts.push(`<line x1="${vx + i * d.w * 0.03}" y1="${wallBase}" x2="${vx + i * d.w * 0.22}" y2="${y1}" stroke="${C.floorLine}" stroke-width="3"/>`);
  // Late-afternoon shade from the wall, on the start side.
  parts.push(`<path d="M${x0} ${wallBase} L${d.w * 0.18} ${wallBase} L${-bx * 0.2} ${y1} L${x0} ${y1} Z" fill="${C.shade}" opacity="0.16"/>`);
  // Stepping stones along the hero's path.
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const p = pointOnPath(layout.heroPath, i / N);
    const rx = p.h * 0.32;
    const ry = p.h * 0.07;
    parts.push(`<ellipse cx="${p.x}" cy="${p.y + ry * 0.2}" rx="${rx}" ry="${ry}" fill="${C.path}" stroke="${C.pathEdge}" stroke-width="${Math.max(2, ry * 0.12)}"/>`);
  }
  return svg(`${x0} ${y0} ${W} ${H}`, W, H, parts.join(""));
}

// ── the cat on its stool ───────────────────────────────────────────────────

type CatState = "counting" | "tell" | "looking" | "laughing" | "sunglasses" | "waiting";

function catSvg(state: CatState): string {
  const p: string[] = [];
  // Stool.
  p.push(`<rect x="88" y="300" width="14" height="96" rx="6" fill="${C.woodDark}"/><rect x="198" y="300" width="14" height="96" rx="6" fill="${C.woodDark}"/><ellipse cx="150" cy="298" rx="98" ry="20" fill="${C.wood}"/>`);
  if (state === "looking") {
    // Turned round: seen FROM BEHIND, peering into the courtyard (no face).
    p.push(`<path d="M232 270 C292 240 290 170 250 160" stroke="${C.catDark}" stroke-width="18" fill="none" stroke-linecap="round"/>`);
    p.push(`<ellipse cx="150" cy="226" rx="88" ry="78" fill="${C.cat}"/>`);
    p.push(`<path d="M110 160 C130 200 170 200 190 160" stroke="${C.catDark}" stroke-width="10" fill="none"/>`);
    p.push(`<circle cx="156" cy="124" r="62" fill="${C.cat}"/>`);
    p.push(`<path d="M104 92 L112 34 L146 74 Z" fill="${C.cat}"/><path d="M168 74 L204 36 L210 98 Z" fill="${C.cat}"/>`);
    // The back of the head, ears pricked toward the courtyard.
    p.push(`<path d="M120 96 Q156 112 192 96" stroke="${C.catDark}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M130 150 Q156 160 182 150" stroke="${C.catDark}" stroke-width="5" fill="none" stroke-linecap="round"/>`);
    return svg("0 0 300 400", 300, 400, p.join(""));
  }
  const lean = state === "tell" ? -6 : 0;
  p.push(`<path d="M60 270 C0 250 10 170 52 168" stroke="${C.catDark}" stroke-width="18" fill="none" stroke-linecap="round"/>`);
  p.push(`<ellipse cx="150" cy="228" rx="86" ry="76" fill="${C.cat}"/><ellipse cx="150" cy="246" rx="48" ry="46" fill="${C.catLight}"/>`);
  p.push(`<g transform="rotate(${lean} 150 130)">`);
  const earH = state === "tell" ? 30 : 0;
  p.push(`<path d="M98 100 L104 ${38 - earH} L140 78 Z" fill="${C.cat}"/><path d="M160 78 L196 ${38 - earH} L202 100 Z" fill="${C.cat}"/>`);
  p.push(`<path d="M106 92 L108 ${54 - earH} L132 80 Z" fill="${C.pink}"/><path d="M168 80 L192 ${54 - earH} L194 92 Z" fill="${C.pink}"/>`);
  p.push(`<circle cx="150" cy="130" r="64" fill="${C.cat}"/><ellipse cx="150" cy="152" rx="34" ry="24" fill="${C.catLight}"/>`);
  p.push(`<path d="M144 144 L156 144 L150 152 Z" fill="${C.pink}"/>`);
  for (const s of [-1, 1]) p.push(`<path d="M${150 + s * 22} 152 L${150 + s * 70} 142 M${150 + s * 22} 158 L${150 + s * 70} 162" stroke="${C.ink}" stroke-width="2.5"/>`);
  switch (state) {
    case "counting":
      // Paws over the eyes, mouth open on the count.
      p.push(`<ellipse cx="124" cy="118" rx="26" ry="20" fill="${C.catLight}" stroke="${C.catDark}" stroke-width="3"/><ellipse cx="176" cy="118" rx="26" ry="20" fill="${C.catLight}" stroke="${C.catDark}" stroke-width="3"/>`);
      p.push(`<ellipse cx="150" cy="166" rx="9" ry="10" fill="${C.ink}"/>`);
      break;
    case "tell":
      // Still facing the viewer, paws still over its eyes, ears shot up —
      // the chant has ended and it is about to turn.
      p.push(`<ellipse cx="124" cy="118" rx="26" ry="20" fill="${C.catLight}" stroke="${C.catDark}" stroke-width="3"/><ellipse cx="176" cy="118" rx="26" ry="20" fill="${C.catLight}" stroke="${C.catDark}" stroke-width="3"/>`);
      p.push(`<path d="M140 166 Q150 160 160 166" stroke="${C.ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
      break;
    case "laughing":
      p.push(`<path d="M112 122 Q126 106 140 122" stroke="${C.ink}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M160 122 Q174 106 188 122" stroke="${C.ink}" stroke-width="6" fill="none" stroke-linecap="round"/>`);
      p.push(`<path d="M126 158 Q150 196 174 158 Z" fill="${C.ink}"/><path d="M138 176 Q150 186 162 176" fill="${C.pink}"/>`);
      p.push(`<ellipse cx="118" cy="244" rx="20" ry="16" fill="${C.catLight}" stroke="${C.catDark}" stroke-width="3"/><ellipse cx="182" cy="244" rx="20" ry="16" fill="${C.catLight}" stroke="${C.catDark}" stroke-width="3"/>`);
      break;
    case "sunglasses":
      p.push(`<path d="M96 108 H204" stroke="${C.ink}" stroke-width="6"/><rect x="102" y="104" width="44" height="30" rx="10" fill="${C.shadesLens}"/><rect x="154" y="104" width="44" height="30" rx="10" fill="${C.shadesLens}"/><path d="M110 112 L124 112" stroke="${C.white}" stroke-width="4" opacity="0.6"/>`);
      p.push(`<path d="M134 162 Q150 176 168 160" stroke="${C.ink}" stroke-width="5" fill="none" stroke-linecap="round"/>`);
      break;
    case "waiting":
      p.push(`<path d="M114 124 H138 M162 124 H186" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/><path d="M142 164 Q150 170 158 164" stroke="${C.ink}" stroke-width="4" fill="none"/>`);
      break;
  }
  p.push(`</g>`);
  return svg("0 0 300 400", 300, 400, p.join(""));
}

// ── cover objects + prizes ─────────────────────────────────────────────────

function lemonTreeSvg(): string {
  const p = [
    `<path d="M80 300 H180 L166 396 H94 Z" fill="${C.pot}"/><rect x="74" y="292" width="112" height="18" rx="6" fill="${C.pot}"/>`,
    `<rect x="122" y="170" width="16" height="126" rx="6" fill="${C.woodDark}"/>`,
    `<circle cx="130" cy="140" r="96" fill="${C.leafDark}"/><circle cx="96" cy="120" r="62" fill="${C.leaf}"/><circle cx="170" cy="112" r="58" fill="${C.leaf}"/><circle cx="132" cy="70" r="52" fill="${C.leaf}"/>`,
    ...[[90, 150], [160, 90], [178, 168], [120, 56], [70, 104], [140, 190]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="10" fill="${C.lemon}"/>`),
  ];
  return svg("0 0 260 400", 260, 400, p.join(""));
}

function benchSvg(): string {
  const p = [
    `<rect x="40" y="120" width="20" height="76" rx="5" fill="${C.woodDark}"/><rect x="300" y="120" width="20" height="76" rx="5" fill="${C.woodDark}"/>`,
    `<rect x="16" y="104" width="328" height="26" rx="8" fill="${C.wood}"/>`,
    `<rect x="24" y="20" width="312" height="22" rx="8" fill="${C.wood}"/><rect x="24" y="56" width="312" height="22" rx="8" fill="${C.wood}"/>`,
    `<rect x="44" y="20" width="14" height="90" fill="${C.woodDark}"/><rect x="302" y="20" width="14" height="90" fill="${C.woodDark}"/>`,
  ];
  return svg("0 0 360 200", 360, 200, p.join(""));
}

function lanternSvg(): string {
  const p = [
    `<rect x="52" y="120" width="16" height="292" rx="5" fill="${C.metal}"/><rect x="34" y="400" width="52" height="16" rx="6" fill="${C.metal}"/>`,
    `<path d="M30 112 H90 L80 40 H40 Z" fill="${C.glow}" stroke="${C.metal}" stroke-width="6"/><path d="M26 40 H94 L60 8 Z" fill="${C.metal}"/>`,
    `<circle cx="60" cy="80" r="40" fill="${C.glow}" opacity="0.35"/>`,
  ];
  return svg("0 0 120 420", 120, 420, p.join(""));
}

function prizeSvg(id: "lemon" | "wool" | "bell"): string {
  if (id === "lemon") return svg("0 0 160 160", 160, 160, `<ellipse cx="80" cy="88" rx="58" ry="46" fill="${C.lemon}"/><ellipse cx="62" cy="72" rx="16" ry="9" fill="${C.white}" opacity="0.5"/><path d="M80 44 Q96 18 124 26 Q108 48 80 44 Z" fill="${C.leaf}"/>`);
  if (id === "wool") return svg("0 0 160 160", 160, 160, `<circle cx="80" cy="84" r="56" fill="${C.wool}"/><path d="M34 70 Q80 40 126 76 M30 96 Q80 66 132 102 M48 126 Q86 96 128 120" stroke="${C.woolLine}" stroke-width="6" fill="none"/><path d="M126 110 Q150 130 140 150" stroke="${C.wool}" stroke-width="6" fill="none"/>`);
  return svg("0 0 160 160", 160, 160, `<path d="M80 22 C40 22 36 70 32 110 H128 C124 70 120 22 80 22 Z" fill="${C.bell}"/><rect x="24" y="106" width="112" height="16" rx="8" fill="${C.bellDark}"/><circle cx="80" cy="134" r="12" fill="${C.bellDark}"/><circle cx="80" cy="16" r="9" fill="${C.bellDark}"/>`);
}

let cached: SneakArt | null = null;

export function devPlaceholderArt(): SneakArt {
  if (cached) return cached;
  const cat = (s: CatState): ArtSprite => ({ url: url(catSvg(s)), w: 300, h: 400, anchor: { x: 150, y: 396 } });
  const prize = (id: "lemon" | "wool" | "bell"): ArtSprite => ({ url: url(prizeSvg(id)), w: 160, h: 160, anchor: { x: 80, y: 80 } });
  cached = {
    source: "dev-placeholder",
    plate: { landscape: url(plateSvg("landscape")), portrait: url(plateSvg("portrait")) },
    watcher: { counting: cat("counting"), tell: cat("tell"), looking: cat("looking"), laughing: cat("laughing"), sunglasses: cat("sunglasses"), waiting: cat("waiting") },
    covers: {
      "lemon-tree": { url: url(lemonTreeSvg()), w: 260, h: 400, anchor: { x: 130, y: 396 } },
      bench: { url: url(benchSvg()), w: 360, h: 200, anchor: { x: 180, y: 196 } },
      lantern: { url: url(lanternSvg()), w: 120, h: 420, anchor: { x: 60, y: 416 } },
    },
    prizes: { lemon: prize("lemon"), wool: prize("wool"), bell: prize("bell") },
  };
  return cached;
}
