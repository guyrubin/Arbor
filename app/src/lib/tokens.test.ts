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
  "components/practice/MemoryMatch.tsx": ["#fff"],
  "components/practice/MimicMatch.tsx": ["#1c222b", "#5fce97", "#a8a093"], // game canvas art
  "components/practice/SpeechCoachTab.tsx": ["#fff", "#ffffff"],
  "components/practice/WordWorldTab.tsx": ["#fff"],
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
  "components/tabs/MilestonesTab.tsx": ["#fff"], // Wave T: confetti brand literals moved to lib/celebrate (BRAND_CONFETTI)
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

/* ═══════════════════════════════════════════════════════════════════════════
   W4.1 — flat-register token-leak freeze (provisional-pending-GD-2).
   :root declares the glass/2035 palette; the flat clinical block
   (.arbor-app,.arbor-parent) historically re-declared only a subset, so the
   remaining :root tokens LEAKED glass values into the flat register. The
   freeze byte-copies today's resolved values into the flat block so rendering
   is unchanged and a future GD-2 retint edits ONE block. This suite pins that
   contract: every :root custom property must be re-declared in the flat
   block, and the frozen values must equal the :root ones — except the
   documented exception sets below.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The 24 tokens the flat block ALREADY overrode by design (the clinical
    re-skin). Their values intentionally differ from :root — GD-1/GD-2 own any
    change to this set. */
const FLAT_INTENTIONAL_OVERRIDES = new Set([
  "--arbor-paper", "--arbor-paper-elevated", "--arbor-paper-deep", "--arbor-paper-sunk",
  "--arbor-paper-tinted",
  "--shadow-xs", "--shadow-sm", "--shadow-md", "--shadow-lg", "--shadow-xl",
  "--glass-blur", "--glass-border",
  "--arbor-rule", "--arbor-rule-strong",
  "--arbor-ink", "--arbor-ink-soft", "--arbor-muted", "--arbor-faint",
  "--arbor-clay", "--arbor-clay-deep", "--arbor-clay-dim", "--arbor-clay-border",
  "--arbor-green-soft", "--arbor-green-ink",
]);

/** Tokens whose :root value contains var(--arbor-clay*)/var(--arbor-green-cta-start)
    references that the flat block overrides. A verbatim copy would re-resolve
    them against the flat clay (#2b7fff) and CHANGE rendering, because custom
    properties substitute var() at the scope where they are declared (the flat
    register inherited these already substituted at :root). They are frozen at
    today's :root-RESOLVED literals instead. */
const FLAT_RESOLVED_INLINE: Record<string, string> = {
  "--arbor-gradient-primary": "linear-gradient(135deg, #58a6ff, #58a6ff 60%, #1f6feb)",
  "--arbor-gradient-progress": "linear-gradient(90deg, #58a6ff, #1f6feb)",
  "--gradient-cta": "linear-gradient(135deg, #58a6ff, #58a6ff 60%, #1f6feb)",
};

describe("W4.1 token-leak freeze — flat block mirrors :root byte-for-byte", () => {
  /** Extract `sel { ... }` body (first block whose header line matches). */
  const blockBody = (css: string, header: RegExp): string => {
    const m = header.exec(css);
    if (!m) return "";
    const open = css.indexOf("{", m.index);
    const close = css.indexOf("\n}", open); // top-level blocks in index.css close at col 0
    return css.slice(open + 1, close);
  };

  /** name → last-declared value (later duplicate wins, matching the cascade). */
  const declsOf = (body: string): Map<string, string> => {
    const out = new Map<string, string>();
    // strip comments so commented-out decls don't count
    const clean = body.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of clean.matchAll(/(?:^|[;{\s])(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
      out.set(m[1], m[2].replace(/\s+/g, " ").trim());
    }
    return out;
  };

  const rootDecls = declsOf(blockBody(indexCss, /^:root\s*$|^:root\s*\{/m));
  const flatDecls = declsOf(blockBody(indexCss, /^\.arbor-app,\s*\n\.arbor-parent/m));

  it("parses both blocks (sanity)", () => {
    expect(rootDecls.size).toBeGreaterThanOrEqual(95);
    expect(flatDecls.size).toBeGreaterThanOrEqual(95); // 95 mirrored + flat-only tokens
  });

  it("every :root custom property is re-declared in the flat block (no leak)", () => {
    const missing = [...rootDecls.keys()].filter((k) => !flatDecls.has(k));
    expect(
      missing,
      `:root tokens leaking glass values into the flat register — add a byte-copied ` +
        `declaration to the W4.1 freeze block in index.css:\n${missing.join("\n")}`,
    ).toEqual([]);
    const overlap = [...rootDecls.keys()].filter((k) => flatDecls.has(k)).length;
    expect(overlap).toBeGreaterThanOrEqual(95);
  });

  it("frozen values are string-equal to :root (outside the two exception sets)", () => {
    const drift: string[] = [];
    for (const [name, rootVal] of rootDecls) {
      if (FLAT_INTENTIONAL_OVERRIDES.has(name)) continue;
      if (name in FLAT_RESOLVED_INLINE) continue;
      const flatVal = flatDecls.get(name);
      if (flatVal !== rootVal) drift.push(`${name}: root=[${rootVal}] flat=[${flatVal}]`);
    }
    expect(
      drift,
      `W4.1 freeze drift — the flat block must byte-copy :root until GD-2 rules:\n${drift.join("\n")}`,
    ).toEqual([]);
  });

  it("resolved-inline exceptions carry today's :root-resolved literals", () => {
    for (const [name, expected] of Object.entries(FLAT_RESOLVED_INLINE)) {
      // the :root source must still be var()-based (else fold back to byte-copy)
      expect(rootDecls.get(name), `${name} in :root should still reference var()`).toContain("var(");
      expect(flatDecls.get(name), `${name} frozen literal drifted`).toBe(expected);
    }
  });

  it("intentional-override allowlist is exactly the pre-freeze 24 and all present", () => {
    expect(FLAT_INTENTIONAL_OVERRIDES.size).toBe(24);
    for (const name of FLAT_INTENTIONAL_OVERRIDES) {
      expect(rootDecls.has(name), `${name} gone from :root — update the allowlist`).toBe(true);
      expect(flatDecls.has(name), `${name} gone from the flat block — update the allowlist`).toBe(true);
    }
  });

  it("Hebrew font swap survives the freeze (html[lang=he] mirror present)", () => {
    // The flat block re-declares --font-sans/--font-display at .arbor-app scope,
    // which beats the inherited html[lang="he"] values; the mirror restores them.
    expect(indexCss).toMatch(/html\[lang="he"\]\s+\.arbor-app,\s*\n\s*html\[lang="he"\]\s+\.arbor-parent\s*\{[^}]*--font-sans:\s*"Heebo"/);
  });

  it("W4.5: the CSS nth-child entrance stagger stays removed (Shell owns entrance)", () => {
    expect(indexCss).not.toContain("arbor-fade-up");
    expect(indexCss).not.toMatch(/main\s*>\s*div\s*>\s*\*:nth-child/);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   W4.4a — rgba()-creep ratchet over ALL of src/ (ts, tsx, css; test files
   excluded — allowlists live in them). rgba literals evade the hex guard on a
   technicality. GD-1 blocks deleting the existing ones (some may still
   render), so this is growth-prevention only: any INCREASE per file fails;
   decreases and file removals are auto-tolerated (no stale-baseline failure);
   a file not listed here must not introduce rgba at all.
   Baseline snapshot: 2026-08-11 (post-W4.1 freeze — index.css includes the 21
   rgba occurrences byte-copied from :root by the freeze block).
   ═══════════════════════════════════════════════════════════════════════════ */
const RGBA_BASELINE: Record<string, number> = {
  "components/auth/LoginScreen.tsx": 1,
  "components/auth/OnboardingFlow.tsx": 9,
  "components/coach/ArborVision.tsx": 1,
  "components/ErrorBoundary.tsx": 2,
  "components/kidmode/ParentChallenge.tsx": 1,
  "components/layout/MobileNav.tsx": 2,
  "components/layout/SettingsModal.tsx": 1,
  "components/layout/TopbarBell.tsx": 1,
  "components/overview/CourseCard.tsx": 1,
  "components/overview/DailyCheckinCard.tsx": 2,
  "components/plans/PlanKanban.tsx": 2,
  "components/plans/RoutinesCard.tsx": 1,
  "components/practice/AdventuresTab.tsx": 1,
  "components/practice/EarlyReadingTrack.tsx": 2,
  "components/practice/FeelingsLabTab.tsx": 1,
  "components/practice/HeroArcade.tsx": 1,
  "components/practice/JourneyTab.tsx": 1,
  "components/practice/MemoryMatch.tsx": 1,
  "components/practice/MimicMatch.tsx": 5,
  "components/practice/MimicStudioTab.tsx": 1,
  "components/practice/SpeechCoachTab.tsx": 2,
  "components/profile/AddChildModal.tsx": 2,
  "components/profile/AvatarCreator.tsx": 6,
  "components/profile/ProfileEditDrawer.tsx": 1,
  "components/profile/ProfileSwitcher.tsx": 1,
  "components/profile/RewardsCard.tsx": 1,
  "components/search/TopbarSearch.tsx": 1,
  "components/sections/AcademyForYou.tsx": 1,
  "components/sections/AskSpecialist.tsx": 2,
  "components/sections/DevScoreCard.tsx": 1,
  "components/sections/FindProfessional.tsx": 3,
  "components/sections/Masterclasses.tsx": 3,
  "components/sections/Screening.tsx": 3,
  "components/sections/ScreeningSheet.tsx": 1,
  "components/sections/SmartRemindersPanel.tsx": 1,
  "components/stories/ComicReader.tsx": 1,
  "components/tabs/BedtimeStoriesTab.tsx": 3,
  "components/tabs/BehaviorsTab.tsx": 3,
  "components/tabs/CoachTab.tsx": 3,
  "components/tabs/ComicsTab.tsx": 1,
  "components/tabs/HeroJourneyTab.tsx": 5,
  "components/tabs/LanguageLabVocabView.tsx": 2,
  "components/tabs/MilestonesTab.tsx": 4,
  "components/tabs/PlansTab.tsx": 1,
  "components/tabs/SciencePage.tsx": 1,
  "components/tabs/StoryTimelineTab.tsx": 2,
  "components/ui/Avatar.tsx": 1,
  "components/ui/Button.tsx": 2,
  "components/ui/EmotionAvatar.tsx": 1,
  "components/ui/HeroAvatar.tsx": 2,
  "components/ui/Modal.tsx": 1,
  "components/ui/playkit.tsx": 8,
  "components/ui/ProgressRing.tsx": 1,
  "components/ui/ProvenanceBadge.tsx": 1,
  "context/ToastContext.tsx": 3,
  "index.css": 76,
  "lib/shareCard.ts": 2,
};

const srcRoot = path.join(here, "..");

const walkSrc = (dir: string, exts: readonly string[]): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walkSrc(p, exts);
    return exts.some((x) => e.name.endsWith(x)) ? [p] : [];
  });

const relOf = (abs: string): string => path.relative(srcRoot, abs).split(path.sep).join("/");
const isTestFile = (rel: string): boolean => /\.test\.(ts|tsx)$/.test(rel);

describe("rgba-creep ratchet — src/**/*.{ts,tsx,css} may only shrink", () => {
  const counts = new Map<string, number>();
  for (const abs of walkSrc(srcRoot, [".ts", ".tsx", ".css"])) {
    const rel = relOf(abs);
    if (isTestFile(rel)) continue; // ratchet baselines live in test files
    const n = (readFileSync(abs, "utf8").match(/rgba\(/g) ?? []).length;
    if (n > 0) counts.set(rel, n);
  }

  it("scans a non-trivial set (sanity)", () => {
    expect(counts.size).toBeGreaterThan(20);
  });

  it("no file grows its rgba() count; unlisted files introduce none", () => {
    const growth: string[] = [];
    for (const [rel, n] of counts) {
      const allowed = RGBA_BASELINE[rel] ?? 0;
      if (n > allowed) growth.push(`${rel}: ${n} > baseline ${allowed}`);
    }
    expect(
      growth,
      `rgba() creep — use a var(--arbor-*) token instead (GD-1 blocks deleting old ` +
        `literals, but nothing may add new ones). If a decrease landed, ratchet the ` +
        `RGBA_BASELINE down in a reviewed commit:\n${growth.join("\n")}`,
    ).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   W4.4b — hex-creep guard extension: src/lib/ + src/practice/ (.ts/.tsx,
   test files excluded — fixtures/allowlists live there). Same ratchet rules
   as the components guard above. GD-1 blocks the stale-green cleanup, so the
   values below (incl. legacy greens like #3cc081/#34b277) stay listed until
   that gate opens — the guard only prevents growth.
   ═══════════════════════════════════════════════════════════════════════════ */
const LIB_PRACTICE_HEX_ALLOWLIST: Record<string, readonly string[]> = {
  "lib/behaviorUtils.ts": ["#6f9e6f", "#9bbf5a", "#d7aa55", "#e08a3c", "#e2562d"],
  "lib/native.ts": ["#eef2ef"],
  "lib/reportExport.ts": ["#1f8a5a", "#29333f", "#2a9c66", "#69747f", "#9aa0a8", "#e4f4ec", "#e8edea", "#fff"], // print-report CSS template
  "lib/shareCard.ts": ["#1f8a5a", "#29333f", "#34b277", "#3a4651", "#5f6b75", "#d6ebde", "#e4f4ec", "#eef6f0", "#fff", "#ffffff"], // share-card canvas art
  "lib/tokens.ts": ["#16352a", "#2a9c66", "#34b277", "#3cc081", "#3f8cc9", "#5fce97", "#69747f", "#7a6bd8", "#c2882a", "#d65f87", "#d9763f", "#eef6f1"], // legacy brand literals (GD-1)
  "practice/content.ts": ["#1f8a5a", "#2f7bbf", "#6354c4", "#a9780f", "#bd4f74", "#e4f4ec", "#e5f0fb", "#ece9fb", "#fbf1d4", "#fce2ec"],
  "practice/goalBuilder.ts": ["#34b277", "#3cc081", "#3f8cc9", "#7a6bd8", "#c2882a", "#d9763f", "#e07b5a"],
  "practice/playContent.ts": ["#1f8a5a", "#2f7bbf", "#6354c4", "#a9780f", "#bd4f74", "#cf6f37"],
};

describe("hex-creep guard — src/lib + src/practice stay on the token allowlist", () => {
  const found = new Map<string, string[]>();
  for (const dir of ["lib", "practice"]) {
    for (const abs of walkSrc(path.join(srcRoot, dir), [".ts", ".tsx"])) {
      const rel = relOf(abs);
      if (isTestFile(rel)) continue;
      const hexes = [...new Set((readFileSync(abs, "utf8").match(HEX_RE) ?? []).map((h) => h.toLowerCase()))].sort();
      if (hexes.length > 0) found.set(rel, hexes);
    }
  }

  it("scans both directories (sanity)", () => {
    expect([...found.keys()].some((r) => r.startsWith("lib/"))).toBe(true);
    expect([...found.keys()].some((r) => r.startsWith("practice/"))).toBe(true);
  });

  it("no hex literals outside the allowlist (new file or new value = creep)", () => {
    const violations: string[] = [];
    for (const [rel, hexes] of found) {
      const allowed = new Set(LIB_PRACTICE_HEX_ALLOWLIST[rel] ?? []);
      for (const h of hexes) {
        if (!allowed.has(h)) violations.push(`${rel}: ${h}`);
      }
    }
    expect(
      violations,
      `Hex creep in lib/practice — use a var(--arbor-*) token instead:\n${violations.join("\n")}`,
    ).toEqual([]);
  });

  it("allowlist carries no stale entries (ratchet down when hex is removed)", () => {
    const stale: string[] = [];
    for (const [rel, allowed] of Object.entries(LIB_PRACTICE_HEX_ALLOWLIST)) {
      const present = new Set(found.get(rel) ?? []);
      for (const h of allowed) {
        if (!present.has(h)) stale.push(`${rel}: ${h}`);
      }
    }
    expect(
      stale,
      `LIB_PRACTICE_HEX_ALLOWLIST entries no longer present — delete them so the ratchet only tightens:\n${stale.join("\n")}`,
    ).toEqual([]);
  });
});
