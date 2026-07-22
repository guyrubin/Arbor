import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_CONFETTI,
  BRAND_HEX,
  cardCls,
  CSS_VARS,
  PASTEL,
  T,
  TONE_INK,
  TONE_SOFT,
  TONES,
} from "./tokens";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(path.join(here, "..", "index.css"), "utf8");

/* Snapshot of the exact pre-refactor literals from kit.tsx / playkit.tsx.
   These are the contract: tokens.ts must reproduce them byte-for-byte so the
   refactor ships zero visual change. */
const KIT_PASTEL = {
  mint: { soft: "var(--arbor-green-soft)", ink: "var(--arbor-green-ink)" },
  coral: { soft: "var(--arbor-peach-soft)", ink: "var(--arbor-peach-ink)" },
  lav: { soft: "var(--arbor-lav-soft)", ink: "var(--arbor-lav-ink)" },
  yellow: { soft: "var(--arbor-yellow-soft)", ink: "var(--arbor-yellow-ink)" },
  pink: { soft: "var(--arbor-pink-soft)", ink: "var(--arbor-pink-ink)" },
  sky: { soft: "var(--arbor-sky-soft)", ink: "var(--arbor-sky-ink)" },
} as const;

const PLAYKIT_TONE_INK: Record<string, string> = {
  clay: "var(--arbor-clay-deep)",
  lav: "var(--arbor-lav-ink)",
  sky: "var(--arbor-sky-ink)",
  yellow: "var(--arbor-yellow-ink)",
  pink: "var(--arbor-pink-ink)",
  peach: "var(--arbor-peach-ink)",
};
const PLAYKIT_TONE_SOFT: Record<string, string> = {
  clay: "var(--arbor-green-soft)",
  lav: "var(--arbor-lav-soft)",
  sky: "var(--arbor-sky-soft)",
  yellow: "var(--arbor-yellow-soft)",
  pink: "var(--arbor-pink-soft)",
  peach: "var(--arbor-peach-soft)",
};

const PLAYKIT_BRAND_CONFETTI = ["#34b277", "#5fce97", "#d9763f", "#3f8cc9", "#7a6bd8", "#c2882a"];

const KIT_CARD_CLS =
  "bg-white rounded-[18px] border border-[var(--arbor-rule)] shadow-[var(--shadow-xs)]";

describe("tokens — no value drift vs pre-refactor literals", () => {
  it("PASTEL keys and {soft, ink} values are byte-identical to kit.tsx", () => {
    expect(PASTEL).toEqual(KIT_PASTEL);
  });

  it("TONE_INK is byte-identical to playkit.tsx", () => {
    expect(TONE_INK).toEqual(PLAYKIT_TONE_INK);
  });

  it("TONE_SOFT is byte-identical to playkit.tsx", () => {
    expect(TONE_SOFT).toEqual(PLAYKIT_TONE_SOFT);
  });

  it("BRAND_CONFETTI is byte-identical to playkit.tsx (order + values)", () => {
    expect([...BRAND_CONFETTI]).toEqual(PLAYKIT_BRAND_CONFETTI);
  });

  it("cardCls is byte-identical to kit.tsx", () => {
    expect(cardCls).toBe(KIT_CARD_CLS);
  });
});

describe("tokens — TONES superset stays consistent with derived maps", () => {
  it("derived PASTEL values come straight from TONES", () => {
    for (const k of Object.keys(PASTEL) as (keyof typeof PASTEL)[]) {
      expect(PASTEL[k].soft).toBe(TONES[k].soft);
      expect(PASTEL[k].ink).toBe(TONES[k].ink);
    }
  });

  it("derived TONE_INK / TONE_SOFT come straight from TONES", () => {
    for (const k of Object.keys(TONE_INK)) {
      expect(TONE_INK[k]).toBe(TONES[k as keyof typeof TONES].ink);
      expect(TONE_SOFT[k]).toBe(TONES[k as keyof typeof TONES].soft);
    }
  });

  it("BRAND_HEX matches the hex literals carried on TONES", () => {
    expect(BRAND_HEX.green).toBe("#34b277");
    expect(TONES.mint.hex).toBe(BRAND_HEX.green);
    expect(TONES.coral.hex).toBe(BRAND_HEX.peach);
    expect(TONES.lav.hex).toBe(BRAND_HEX.lav);
    expect(TONES.yellow.hex).toBe(BRAND_HEX.ochre);
    expect(TONES.sky.hex).toBe(BRAND_HEX.sky);
  });
});

describe("tokens — no CSS drift vs index.css :root", () => {
  // Collect every custom property declared in any :root-style block.
  const declared = new Set<string>();
  for (const m of indexCss.matchAll(/(--arbor-[a-z0-9-]+|--gradient-[a-z0-9-]+|--font-[a-z-]+|--t-[a-z0-9]+|--r(?:-[a-z]+)?|--shadow-[a-z]+|--ring|--play-[a-z-]+)\s*:/gi)) {
    declared.add(m[1]);
  }

  const referencedVar = (s: string): string | null => {
    const m = s.match(/^var\((--[a-z0-9-]+)\)$/i);
    return m ? m[1] : null;
  };

  it("declared at least the core token set (sanity on the parser)", () => {
    expect(declared.has("--arbor-paper")).toBe(true);
    expect(declared.has("--arbor-ink")).toBe(true);
    expect(declared.has("--ring")).toBe(true);
  });

  it("every CSS_VARS var() resolves to a declared :root custom property", () => {
    for (const [name, value] of Object.entries(CSS_VARS)) {
      const ref = referencedVar(value);
      expect(ref, `${name} → ${value} should be a var() string`).not.toBeNull();
      expect(declared.has(ref!), `${ref} (from CSS_VARS.${name}) must be declared in index.css`).toBe(true);
    }
  });

  it("every TONES var() resolves to a declared :root custom property", () => {
    for (const [tone, t] of Object.entries(TONES)) {
      for (const field of ["soft", "ink", "solid"] as const) {
        const ref = referencedVar(t[field]);
        expect(ref, `TONES.${tone}.${field} should be a var() string`).not.toBeNull();
        expect(declared.has(ref!), `${ref} (from TONES.${tone}.${field}) must be declared in index.css`).toBe(true);
      }
    }
  });

  it("T is the CSS_VARS alias", () => {
    expect(T).toBe(CSS_VARS);
  });
});
