import { readFileSync, readdirSync } from "node:fs";
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

/* TODAY-7 — parent Today surfaces must draw card backgrounds from the paper
   tokens (var(--arbor-paper-elevated) / var(--arbor-paper)), never Tailwind's
   bg-white or a bare "white" style literal: those evade the hex guard on a
   technicality, split Today across two surface colors, and break any future
   paper-tone/dark shift. Source-scan every component in components/overview so
   the regression cannot recur. (kit.tsx's legacy cardCls keeps its own
   byte-identity contract above — it is not an overview file.) */
describe("parent surfaces (components/overview) — no bg-white / \"white\" literals", () => {
  const overviewDir = path.join(here, "..", "components", "overview");
  const files = readdirSync(overviewDir).filter((f) => f.endsWith(".tsx"));

  it("scans a non-empty overview component set (sanity)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const f of files) {
    it(`${f} uses paper tokens, not white literals`, () => {
      const code = readFileSync(path.join(overviewDir, f), "utf8");
      expect(code, `${f} uses Tailwind bg-white — use var(--arbor-paper-elevated)`).not.toMatch(/\bbg-white\b/);
      expect(code, `${f} uses a bare "white" literal — use var(--arbor-paper)`).not.toMatch(/["']white["']/);
    });
  }
});

/* PLAT-6 — repo-wide hex-creep guard. The design constraint is tokens
   (--arbor-*) only; raw hex literals in component code drift the palette and
   evade the token↔CSS consistency checks above. Some hex is legitimate —
   SVG artwork (ArborMark, ArborMascot, StoryIllustration, Avatar palettes),
   confetti/brand literals, print-CSS template strings — so the guard is a
   RATCHET: every hex value currently present in any .tsx file under
   src/components is snapshotted below per file, and the suite fails when
     (a) a hex literal appears in a file not listed here,
     (b) a NEW hex value appears in a listed file, or
     (c) a listed value disappears (stale allowlist — ratchet it down).
   To fix a failure: use a var(--arbor-*) token. Only extend the allowlist for
   genuine SVG-art / print-CSS / brand-literal cases, in a reviewed commit. */
const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

/** file (POSIX path relative to src/) → sorted unique lowercased hex literals allowed there */
const HEX_ALLOWLIST: Record<string, readonly string[]> = {
  "components/auth/LoginScreen.tsx": ["#1976d2", "#4caf50", "#ff3d00", "#ffc107"], // Google logo SVG
  "components/billing/PaywallModal.tsx": ["#fff"],
  "components/kidmode/KidDashboard.tsx": ["#58a6ff"],
  "components/layout/AdminDashboard.tsx": ["#fff"],
  "components/layout/AiRail.tsx": ["#fff"],
  "components/layout/SettingsModal.tsx": ["#eef6f1"],
  "components/layout/Shell.tsx": ["#8a5326"],
  "components/layout/Sidebar.tsx": ["#fff"],
  "components/overview/CourseCard.tsx": ["#fff"],
  "components/overview/DailyPlanCard.tsx": ["#fff"],
  "components/overview/DailyPlayCard.tsx": ["#fff"],
  "components/plans/PlanKanban.tsx": ["#69747f", "#fff"],
  "components/practice/DevelopmentCopilot.tsx": ["#fff"],
  "components/practice/EarlyReadingTrack.tsx": ["#fff", "#ffffff"],
  "components/practice/FeelingsLabTab.tsx": ["#fff"],
  "components/practice/GoalBuilderModal.tsx": ["#7a6bd8", "#d6566f", "#ece9f9", "#fff"],
  "components/practice/HeroArcade.tsx": ["#cdc8bd", "#fff"],
  "components/practice/MemoryMatch.tsx": ["#fff"],
  "components/practice/MimicMatch.tsx": ["#1c222b", "#5fce97", "#a8a093"], // game canvas art
  "components/practice/SpeechCoachTab.tsx": ["#fff", "#ffffff"],
  "components/practice/WordWorldTab.tsx": ["#fff"],
  "components/profile/AddChildModal.tsx": ["#eef6f1", "#fff"],
  "components/profile/AvatarCreator.tsx": ["#fff"],
  "components/sections/AskSpecialist.tsx": ["#fff"],
  "components/sections/FindProfessional.tsx": ["#fff"],
  "components/sections/PhysicalGrowthCard.tsx": ["#2a9c66", "#34b277", "#d9763f", "#fff"], // growth-chart SVG marks
  "components/sections/Strengths.tsx": ["#eef6f1"],
  "components/stories/StoryIllustration.tsx": [
    // SVG illustration palette — allowlisted art file
    "#5fae86", "#6f9e6f", "#7a6bd8", "#8fc3a3", "#9bbf8f", "#a89cda", "#bcd9c6", "#c2785f",
    "#c7c0e8", "#cfe0c2", "#cfe6f6", "#d79f86", "#dcd6f4", "#e4f0fa", "#e7c6b6", "#ece9fb",
    "#f3b24d", "#f4d991", "#f6b27a", "#f6cdd9", "#f6d9b8", "#fbe1ea", "#fbeede", "#fce39a",
  ],
  "components/tabs/BehaviorsTab.tsx": ["#14160f", "#ccc", "#f0ece0"], // print-CSS template string
  "components/tabs/ComicsTab.tsx": ["#fff"],
  "components/tabs/DailyPlayTab.tsx": ["#fff"],
  "components/tabs/HeroJourneyTab.tsx": ["#fff"],
  "components/tabs/LanguageLabVocabView.tsx": ["#ffffff"],
  "components/tabs/MilestonesTab.tsx": ["#34b277", "#3f8cc9", "#5fce97", "#d9763f", "#fff"], // confetti brand literals
  "components/tabs/StoryTimelineTab.tsx": ["#fff"],
  "components/ui/ArborMark.tsx": [
    // brand-mark SVG gradient stops — allowlisted art file
    "#18f0d2", "#1b2898", "#38c8f0", "#68b4ff", "#a07af8", "#cca8ff", "#ff5822", "#ffc07a",
  ],
  "components/ui/ArborMascot.tsx": ["#16352a", "#5fce97", "#ef8a52", "#f3a886", "#fff", "#ffffff"], // mascot SVG
  "components/ui/Avatar.tsx": ["#2f5a73", "#2f6d52", "#3a7d6b", "#5b6e2f", "#7a4a86", "#9a5b2b", "#b3463c"], // avatar palette
  "components/ui/HeroAvatar.tsx": ["#fff"],
  "components/ui/HeroCrest.tsx": ["#fff"],
  "components/ui/ProvenanceBadge.tsx": ["#fff"],
  "components/ui/ShareButton.tsx": ["#fff"],
};

describe("hex-creep guard — src/components/**/*.tsx stays on the token allowlist", () => {
  const componentsDir = path.join(here, "..", "components");

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      return e.name.endsWith(".tsx") ? [p] : [];
    });

  const found = new Map<string, string[]>(); // rel path → sorted unique lowercased hexes
  for (const abs of walk(componentsDir)) {
    const rel = path.relative(path.join(here, ".."), abs).split(path.sep).join("/");
    const hexes = [...new Set((readFileSync(abs, "utf8").match(HEX_RE) ?? []).map((h) => h.toLowerCase()))].sort();
    if (hexes.length > 0) found.set(rel, hexes);
  }

  it("scans a non-trivial component set (sanity)", () => {
    expect(found.size).toBeGreaterThan(10);
  });

  it("no hex literals outside the allowlist (new file or new value = creep)", () => {
    const violations: string[] = [];
    for (const [rel, hexes] of found) {
      const allowed = new Set(HEX_ALLOWLIST[rel] ?? []);
      for (const h of hexes) {
        if (!allowed.has(h)) violations.push(`${rel}: ${h}`);
      }
    }
    expect(
      violations,
      `Hex creep detected — use a var(--arbor-*) token instead (or, for genuine ` +
        `SVG art / print-CSS, extend HEX_ALLOWLIST in a reviewed commit):\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("allowlist carries no stale entries (ratchet down when hex is removed)", () => {
    const stale: string[] = [];
    for (const [rel, allowed] of Object.entries(HEX_ALLOWLIST)) {
      const present = new Set(found.get(rel) ?? []);
      for (const h of allowed) {
        if (!present.has(h)) stale.push(`${rel}: ${h}`);
      }
    }
    expect(
      stale,
      `HEX_ALLOWLIST entries no longer present in source — delete them so the ratchet only tightens:\n${stale.join("\n")}`,
    ).toEqual([]);
  });
});
