/* ════════════════════════════════════════════════════════════════════════════
   tokens.ts — the single typed TS face of the "Soft Daylight" design system.

   IMPORTANT: `src/index.css` `:root` remains the RUNTIME source of truth. It
   drives the override layer and the RTL / `html[lang="he"]` font swaps, and the
   `var()` strings below resolve against it at runtime (values are NOT inlined
   at build time, so runtime theming still works). This module is a typed
   *mirror* of that `:root` block, not a replacement — do NOT delete the CSS.

   Why this exists: the same token vocabulary was previously re-declared by hand
   in three uncoordinated places (`kit.tsx`, `playkit.tsx`, ~40 inline `var()`
   call sites). This file is the canonical map so every surface imports one typed
   accessor instead of re-inventing `style={{ color: "var(--arbor-ink)" }}`.
   ════════════════════════════════════════════════════════════════════════════ */

/* CSS_VARS — typed inventory of every :root custom property → its var() string.
   One entry per property in index.css :root (lines 16–62). Grouped to mirror
   the CSS sections. */
export const CSS_VARS = {
  // Surfaces — cool, faintly green, de-pastelled
  paper: "var(--arbor-paper)",
  paperElevated: "var(--arbor-paper-elevated)",
  paperDeep: "var(--arbor-paper-deep)",
  paperSunk: "var(--arbor-paper-sunk)",
  ink: "var(--arbor-ink)",
  inkSoft: "var(--arbor-ink-soft)",
  muted: "var(--arbor-muted)",
  faint: "var(--arbor-faint)",
  rule: "var(--arbor-rule)",
  ruleStrong: "var(--arbor-rule-strong)",

  // Primary — friendly green (repurposes the clay token name; stable values)
  clay: "var(--arbor-clay)",
  clayDeep: "var(--arbor-clay-deep)",
  clayDim: "var(--arbor-clay-dim)",
  clayBorder: "var(--arbor-clay-border)",
  gradientPrimary: "var(--arbor-gradient-primary)",
  greenSoft: "var(--arbor-green-soft)",
  greenInk: "var(--arbor-green-ink)",
  sage: "var(--arbor-sage)",

  // Pastel functional accents — soft tint bg, saturated icon/fill, AA-safe ink
  peach: "var(--arbor-peach)",
  peachSoft: "var(--arbor-peach-soft)",
  peachInk: "var(--arbor-peach-ink)",
  lav: "var(--arbor-lav)",
  lavSoft: "var(--arbor-lav-soft)",
  lavInk: "var(--arbor-lav-ink)",
  yellow: "var(--arbor-yellow)",
  yellowSoft: "var(--arbor-yellow-soft)",
  yellowInk: "var(--arbor-yellow-ink)",
  pink: "var(--arbor-pink)",
  pinkSoft: "var(--arbor-pink-soft)",
  pinkInk: "var(--arbor-pink-ink)",
  sky: "var(--arbor-sky)",
  skySoft: "var(--arbor-sky-soft)",
  skyInk: "var(--arbor-sky-ink)",
  blue: "var(--arbor-blue)",
  ochre: "var(--arbor-ochre)",
  danger: "var(--arbor-danger)",

  // m3-hex-sweep additions (m2 contract: defined in index.css :root)
  onAccent: "var(--arbor-on-accent)",
  camStage: "var(--arbor-cam-stage)",
  onDarkMuted: "var(--arbor-on-dark-muted)",
  gradientCta: "var(--gradient-cta)",

  // AP-043 design-token sweep additions (high-traffic tsx/ts literals)
  greenCtaStart: "var(--arbor-green-cta-start)",  // #3cc081 — CTA gradient start stop
  greenMid: "var(--arbor-green-mid)",              // #5fce97 — progress fills / success
  paperTinted: "var(--arbor-paper-tinted)",        // #eef6f1 — near-paper tinted well
  camFloor: "var(--arbor-cam-floor)",              // #16352a — dark cam/practice floor
  mutedAlt: "var(--arbor-muted-alt)",              // #69747f — alternate muted slate

  // Type families
  fontDisplay: "var(--font-display)",
  fontSans: "var(--font-sans)",

  // Type scale (rem, product-fixed)
  textXs: "var(--t-xs)",
  textSm: "var(--t-sm)",
  textBase: "var(--t-base)",
  textMd: "var(--t-md)",
  textLg: "var(--t-lg)",
  textXl: "var(--t-xl)",
  text2xl: "var(--t-2xl)",

  // Radii
  radiusSm: "var(--r-sm)",
  radius: "var(--r)",
  radiusLg: "var(--r-lg)",
  radiusXl: "var(--r-xl)",

  // Shadows
  shadowXs: "var(--shadow-xs)",
  shadowSm: "var(--shadow-sm)",
  shadowMd: "var(--shadow-md)",
  shadowLg: "var(--shadow-lg)",
  shadowGreen: "var(--shadow-green)",

  // Ring
  ring: "var(--ring)",
} as const;

export type TokenName = keyof typeof CSS_VARS;

/** Short alias for inline styles: `style={{ color: T.ink }}`. */
export const T = CSS_VARS;

/* Category palette — Story-pack + development-metric semantic colors, as var()
   strings (m3-hex-sweep). Render fine in inline `style`; use the color-mix
   helpers below for the tinted-background / border opacity variants. */
export const PACK_VARS = {
  courage: "var(--arbor-pack-courage)",
  responsibility: "var(--arbor-pack-responsibility)",
  growth: "var(--arbor-pack-growth)",
  wisdom: "var(--arbor-pack-wisdom)",
  truth: "var(--arbor-pack-truth)",
} as const;

export const METRIC_VARS = {
  courage: "var(--arbor-pack-courage)",
  responsibility: "var(--arbor-pack-responsibility)",
  resilience: "var(--arbor-metric-resilience)",
  empathy: "var(--arbor-metric-empathy)",
  wisdom: "var(--arbor-pack-wisdom)",
  truth: "var(--arbor-metric-truth)",
} as const;

/** A translucent tint of a category var() — replaces the old `${hex}22`/`55`
    alpha-suffix concat. `13%` ≈ hex `22`, `33%` ≈ hex `55`. */
export const tintVar = (varStr: string, pct: number): string =>
  `color-mix(in oklab, ${varStr} ${pct}%, transparent)`;

/* TONES — the single shared tone table. Each tone declares its `soft`, `ink`,
   and (where the accent has a saturated fill) `solid` var() string, plus its
   raw `hex` for literal-only contexts (confetti canvas, PDF/image export, SVG
   fill). `kit.PASTEL` uses the mint/coral/lav/yellow/pink/sky key set;
   `playkit.TONE_*` uses clay/lav/sky/yellow/pink/peach. TONES is the superset
   so both derive without changing any consumer's tone string. */
export const TONES = {
  mint: { soft: T.greenSoft, ink: T.greenInk, solid: T.clay, hex: "#34b277" },
  coral: { soft: T.peachSoft, ink: T.peachInk, solid: T.peach, hex: "#d9763f" },
  lav: { soft: T.lavSoft, ink: T.lavInk, solid: T.lav, hex: "#7a6bd8" },
  yellow: { soft: T.yellowSoft, ink: T.yellowInk, solid: T.yellow, hex: "#c2882a" },
  pink: { soft: T.pinkSoft, ink: T.pinkInk, solid: T.pink, hex: "#d65f87" },
  sky: { soft: T.skySoft, ink: T.skyInk, solid: T.sky, hex: "#3f8cc9" },
  clay: { soft: T.greenSoft, ink: T.clayDeep, solid: T.clay, hex: "#2a9c66" },
  peach: { soft: T.peachSoft, ink: T.peachInk, solid: T.peach, hex: "#d9763f" },
} as const;

export type Tone = keyof typeof TONES;

/* ─── Back-compat derived re-exports ─────────────────────────────────────────
   These keep every existing consumer's import shape unchanged. Values are
   byte-identical to the pre-refactor literals in kit.tsx / playkit.tsx. */

/** `{ soft, ink }` map with the exact key set kit.tsx exported. */
export const PASTEL = {
  mint: { soft: TONES.mint.soft, ink: TONES.mint.ink },
  coral: { soft: TONES.coral.soft, ink: TONES.coral.ink },
  lav: { soft: TONES.lav.soft, ink: TONES.lav.ink },
  yellow: { soft: TONES.yellow.soft, ink: TONES.yellow.ink },
  pink: { soft: TONES.pink.soft, ink: TONES.pink.ink },
  sky: { soft: TONES.sky.soft, ink: TONES.sky.ink },
} as const;
export type PastelKey = keyof typeof PASTEL;

/** PlayKit ink map — exact key set + values from playkit.tsx. */
export const TONE_INK: Record<string, string> = {
  clay: TONES.clay.ink,
  lav: TONES.lav.ink,
  sky: TONES.sky.ink,
  yellow: TONES.yellow.ink,
  pink: TONES.pink.ink,
  peach: TONES.peach.ink,
};
/** PlayKit soft map — exact key set + values from playkit.tsx. */
export const TONE_SOFT: Record<string, string> = {
  clay: TONES.clay.soft,
  lav: TONES.lav.soft,
  sky: TONES.sky.soft,
  yellow: TONES.yellow.soft,
  pink: TONES.pink.soft,
  peach: TONES.peach.soft,
};
export type PlayTone = keyof typeof TONE_INK;

/** Raw brand hex values — for the few literal-only contexts (confetti canvas,
    PDF/image export, SVG fill) where a `var()` string cannot be used. */
export const BRAND_HEX = {
  green: "#34b277",
  greenCtaStart: "#3cc081",  // AP-043: CTA gradient lighter start stop
  greenLight: "#5fce97",     // AP-043: mid-green highlight / progress fills
  peach: "#d9763f",
  sky: "#3f8cc9",
  lav: "#7a6bd8",
  ochre: "#c2882a",
  paperTinted: "#eef6f1",    // AP-043: near-paper tinted well background
  camFloor: "#16352a",       // AP-043: dark cam/practice floor
  mutedAlt: "#69747f",       // AP-043: alternate muted slate
} as const;

/** Brand-colored confetti palette (canvas-confetti needs literals, not var()). */
export const BRAND_CONFETTI: readonly string[] = [
  BRAND_HEX.green,
  BRAND_HEX.greenLight,
  BRAND_HEX.peach,
  BRAND_HEX.sky,
  BRAND_HEX.lav,
  BRAND_HEX.ochre,
];

/** Standard card chrome shared by the calm parent-facing surfaces. */
export const cardCls =
  "bg-white rounded-[22px] border border-[rgba(41,51,63,0.06)] shadow-[0_2px_10px_rgba(41,51,63,0.05)]";
