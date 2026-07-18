import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * HYG.2 source-scan guard (expert-panel action #10b, 2026-07-18).
 *
 * Functional UI must express color through the design tokens (index.css :root
 * vars via `var(--arbor-*)` / `T.*`, or the `BRAND_HEX` literals in
 * lib/tokens.ts for literal-only contexts). This guard fails the suite when a
 * NEW six-digit hex literal lands in any `src/**` .tsx file outside:
 *
 *  (a) EXEMPT_FILES — pure-SVG artwork components whose curated illustration
 *      palettes are the artwork itself, not UI chrome; and
 *  (b) ALLOWLIST — the documented leave-in-place literals below, checked
 *      per-file and per-value so an allowlisted file cannot quietly grow
 *      new literals.
 *
 * Comments are stripped before scanning (same idiom as the wave guards), so
 * prose that MENTIONS a hex value never trips the lint.
 */

const SRC_ROOT = path.resolve(__dirname, "..");

/** Pure-SVG illustration components — palettes exempt wholesale. */
const EXEMPT_FILES = new Set<string>([
  "components/ui/ArborMascot.tsx",
  "components/ui/ArborMark.tsx",
  "components/ui/ParentChildIllustration.tsx",
  "components/stories/StoryIllustration.tsx",
]);

/** Documented leave-in-place literals, per file (compared lower-cased).
 *  Every entry needs a reason; remove the entry when the literal goes. */
const ALLOWLIST: Record<string, string[]> = {
  // Google "G" sign-in logo — Google brand-mandated colors, never tokens.
  "components/auth/LoginScreen.tsx": ["#ffc107", "#ff3d00", "#4caf50", "#1976d2"],
  // Gradient white end-stops; no plain-white surface token exists
  // (--arbor-on-accent is an ink token, --arbor-paper is a gradient).
  "components/practice/EarlyReadingTrack.tsx": ["#ffffff"],
  "components/practice/SpeechCoachTab.tsx": ["#ffffff"],
  // Recharts tooltip card background — same missing-white-token case.
  "components/tabs/LanguageLabVocabView.tsx": ["#ffffff"],
  // Empty-star tint (warm light gray); no token within reasonable distance.
  "components/practice/HeroArcade.tsx": ["#cdc8bd"],
  // Tailwind arbitrary focus-ring class — static literal required for the JIT
  // scanner; value equals BRAND_HEX.green.
  "components/sections/PhysicalGrowthCard.tsx": ["#34b277"],
  // Print-export inline stylesheet — the export window is a standalone HTML
  // document where the app's CSS variables do not exist.
  "components/tabs/BehaviorsTab.tsx": ["#14160f", "#f0ece0"],
  // Deterministic initials-avatar palette — 7 distinct tints keyed by name
  // hash; an intentional palette, not themable UI chrome.
  "components/ui/Avatar.tsx": [
    "#2f6d52", "#2f5a73", "#9a5b2b", "#7a4a86", "#b3463c", "#3a7d6b", "#5b6e2f",
  ],
  // Neutral badge background (near-paper green-tinted white); the nearest
  // tokens are translucent sapphire surfaces — not a color match.
  "components/ui/Badge.tsx": ["#f4f8f5"],
};

/** Strip line comments and block comments so the lint only sees code. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
}

function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTsxFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const HEX_RE = /#[0-9a-fA-F]{6}\b/g;

function scan(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of listTsxFiles(SRC_ROOT)) {
    const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
    if (EXEMPT_FILES.has(rel)) continue;
    const code = stripComments(fs.readFileSync(file, "utf8"));
    const hits = code.match(HEX_RE);
    if (hits && hits.length) found.set(rel, hits.map((h) => h.toLowerCase()));
  }
  return found;
}

describe("HYG.2 — no raw six-digit hex literals in functional UI tsx", () => {
  it("every hex literal outside the SVG-artwork exemptions is allowlisted", () => {
    const offenders: string[] = [];
    for (const [rel, hits] of scan()) {
      const allowed = new Set(ALLOWLIST[rel] ?? []);
      for (const hit of hits) {
        if (!allowed.has(hit)) offenders.push(`${rel}: ${hit}`);
      }
    }
    expect(
      offenders,
      `New raw hex literal(s) in functional UI. Map each to a design token ` +
        `(var(--arbor-*) / T.* / BRAND_HEX in lib/tokens.ts) or document a ` +
        `leave-in-place entry in this guard's ALLOWLIST:\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("the allowlist carries no stale entries", () => {
    const found = scan();
    const stale: string[] = [];
    for (const [rel, allowed] of Object.entries(ALLOWLIST)) {
      const hits = new Set(found.get(rel) ?? []);
      for (const literal of allowed) {
        if (!hits.has(literal)) stale.push(`${rel}: ${literal}`);
      }
    }
    expect(
      stale,
      `Allowlist entries whose literal no longer exists — delete them so the ` +
        `guard stays tight:\n${stale.join("\n")}`
    ).toEqual([]);
  });

  it("exempt artwork files still exist (renames must update the guard)", () => {
    for (const rel of EXEMPT_FILES) {
      expect(fs.existsSync(path.join(SRC_ROOT, rel)), `${rel} missing`).toBe(true);
    }
  });
});
