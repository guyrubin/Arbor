import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../lib/i18n";
import { computeContentHash } from "./governance";
import { CHILD_NAME_TOKEN, hardMomentCards, type HardMomentCard } from "./hardMomentCards";
import {
  HARD_MOMENT_CATEGORIES,
  buildHardMomentSeedPrompt,
  escalationText,
  locText,
  recentBehaviorTypes,
  todayHardMomentOffer,
} from "./hardMomentSurface";

/**
 * CONT-2 / CODEX-5(surfaces) — acceptance tests for the AR-CONT-01 consuming
 * surfaces built dark (2026-07-23 next-level wave 3).
 *
 * Both acceptance states are asserted:
 *   1. REAL all-draft pack  → zero UI (selectors return nothing; components
 *      source-scanned to gate on the published list).
 *   2. APPROVED fixture     → the surfaces get content, escalation text
 *      byte-identical to the governed record, coach seed contract holds.
 *
 * The vitest env is node-only, so component-level assertions are SOURCE-BASED
 * structural guards in the house pattern (clinicalFirewall.wave3.test.ts):
 * they pin the code shape that makes the runtime acceptance true.
 */

const NOW = new Date("2026-07-22");
const SRC_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** The only stamp shape that publishes (mirrors content/selectCards.test.ts). */
const approve = (card: HardMomentCard): HardMomentCard => ({
  ...card,
  reviewStatus: "approved",
  reviewedBy: "Dr. Noa Levi",
  reviewedAt: "2026-07-01",
  contentHash: computeContentHash(card),
});
const find = (id: string): HardMomentCard => hardMomentCards.find((item) => item.id === id)!;

const log = (behaviorType: string, daysAgo = 1) => ({
  behaviorType,
  timestamp: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
});

// ─── State 1: the REAL all-draft pack → zero UI ────────────────────────────

describe("CONT-2 — with the real all-draft pack, every surface input is empty", () => {
  it("Today offer derivation returns null even on a strong behavior match", () => {
    expect(todayHardMomentOffer([log("Sibling Conflict"), log("Hitting")], hardMomentCards, NOW)).toBeNull();
  });

  it("the authoring pack still publishes nothing (governance is the switch)", async () => {
    const { publishedHardMomentCards } = await import("./hardMomentCards");
    expect(publishedHardMomentCards).toHaveLength(0);
  });

  it("BehaviorsTab section hides itself when the published list is empty", () => {
    const code = stripComments(read("components/behaviors/HardMomentsSection.tsx"));
    expect(code).toMatch(/if\s*\(publishedHardMomentCards\.length\s*===\s*0\)\s*return null/);
  });

  it("CoachTab chips are gated on a non-empty published list", () => {
    const code = stripComments(read("components/tabs/CoachTab.tsx"));
    expect(code).toMatch(/publishedHardMomentCards\.length\s*>\s*0\s*&&/);
  });

  it("Today offer renders nothing without a match or with an active action", () => {
    const code = stripComments(read("components/overview/HardMomentTodayOffer.tsx"));
    expect(code).toMatch(/if\s*\(activeTodayAction\s*\|\|\s*!offer\)\s*return null/);
  });
});

// ─── State 2: approved fixture → surfaces light up ─────────────────────────

describe("CONT-2 — with an approved fixture the surfaces get content", () => {
  it("Today offer matches recent behavior-log categories via selectCards", () => {
    const fixtures = [approve(find("hitting")), approve(find("bedtime")), find("tantrum")];
    const offer = todayHardMomentOffer([log("Hitting"), log("Sleep Meltdown", 3)], fixtures, NOW);
    expect(offer).not.toBeNull();
    expect(["hitting", "bedtime"]).toContain(offer!.card.id);
    // A draft never wins, regardless of match strength.
    const draftOnly = todayHardMomentOffer([log("Tantrum")], [find("tantrum")], NOW);
    expect(draftOnly).toBeNull();
  });

  it("recentBehaviorTypes windows and dedupes the log types", () => {
    const types = recentBehaviorTypes(
      [log("Hitting"), log("Hitting", 2), log("Old Thing", 40), { behaviorType: "  ", timestamp: NOW.toISOString() }],
      NOW,
    );
    expect(types).toEqual(["Hitting"]);
  });

  it("category chip order covers exactly the six governed categories", () => {
    expect(HARD_MOMENT_CATEGORIES).toEqual(["big-feelings", "limits", "relationships", "separation", "routines", "transitions"]);
    for (const card of hardMomentCards) expect(HARD_MOMENT_CATEGORIES).toContain(card.category);
  });
});

// ─── Escalation: byte-identical to the governed record ─────────────────────

describe("CONT-2 firewall — escalation rendered VERBATIM, never paraphrased", () => {
  it("escalationText is byte-identical to the governed record in both locales", () => {
    for (const card of hardMomentCards.map(approve)) {
      expect(escalationText(card, "en")).toBe(card.escalation.en);
      expect(escalationText(card, "he")).toBe(card.escalation.he);
    }
  });

  it("the safety band reads through escalationText with zero transformation", () => {
    const code = stripComments(read("components/behaviors/HardMomentsSection.tsx"));
    expect(code).toContain("{escalationText(openCard, locale)}");
    // No string surgery anywhere near the escalation read path.
    expect(code).not.toMatch(/escalationText\([^)]*\)\s*\.\s*(replace|slice|trim|toLowerCase|toUpperCase|split|concat)/);
  });

  it("locText is a bare locale pick (display, never a rewrite)", () => {
    const card = find("hitting");
    expect(locText(card.doNow, "en")).toBe(card.doNow.en);
    expect(locText(card.doNow, "he")).toBe(card.doNow.he);
  });
});

// ─── Coach seed contract (evals/coach-hardmoment-seed-v1 offline gate) ──────

describe("coach-hardmoment-seed-v1 — deterministic seed contract on the fixture", () => {
  const SUITE_PATH = path.join(REPO_ROOT, "evals", "coach-hardmoment-seed-v1.eval.json");
  const suite = JSON.parse(fs.readFileSync(SUITE_PATH, "utf8"));

  it("suite is authored and version-pinned (judge model, version, rubric, pass bar)", () => {
    expect(suite.judgeModel).toBe("claude-opus-4-8"); // pinned — never "latest"
    expect(suite.version).toBe("1.0.0");
    expect(suite.rubric.dimensions.cardScope).toBeTruthy();
    expect(suite.rubric.dimensions.noDiagnosis).toBeTruthy();
    expect(suite.rubric.dimensions.escalationVerbatim).toBeTruthy();
    expect(suite.rubric.passBar.escalationVerbatim).toBe(1.0); // 100% escalation preservation
    expect(suite.scenarios.length).toBeGreaterThanOrEqual(5);
    expect(suite.scenarios.some((s: { id: string }) => s.id.startsWith("safety-trip"))).toBe(true);
    for (const scenario of suite.scenarios) {
      expect(scenario.safetyMustHold, `${scenario.id} must carry the hard safety gate`).toBe(true);
    }
  });

  it("every scenario references a real governed card and locale", () => {
    for (const scenario of suite.scenarios) {
      const card = hardMomentCards.find((item) => item.id === scenario.cardId);
      expect(card, `${scenario.id} references unknown card "${scenario.cardId}"`).toBeTruthy();
      expect(["en", "he"]).toContain(scenario.locale);
    }
  });

  it("the seed embeds the governed escalation byte-identical for every scenario", () => {
    for (const scenario of suite.scenarios) {
      const card = approve(find(scenario.cardId));
      const seed = buildHardMomentSeedPrompt(card, scenario.locale, "Noa");
      const escalation = scenario.locale === "he" ? card.escalation.he : card.escalation.en;
      expect(seed.includes(escalation), `${scenario.id}: escalation not byte-identical in seed`).toBe(true);
      expect(seed).toContain("never paraphrased");
      expect(seed).toContain("Do not diagnose, label, score, or give any verdict");
      expect(seed).not.toContain(CHILD_NAME_TOKEN); // renderSayThis resolved the token
    }
  });

  it("the seed carries the card scope (all four coaching sections)", () => {
    const card = approve(find("hitting"));
    const seed = buildHardMomentSeedPrompt(card, "en");
    for (const text of [card.doNow.en, card.avoid.en, card.observe.en]) expect(seed).toContain(text);
    expect(seed).toContain(card.title.en);
    expect(seed).toContain("within the scope of this guide");
  });
});

// ─── Structural guards: fail-closed wiring + existing seams only ────────────

describe("CONT-2/CODEX-5 — surfaces consume ONLY the published export and existing seams", () => {
  const SURFACES = [
    "components/behaviors/HardMomentsSection.tsx",
    "components/overview/HardMomentTodayOffer.tsx",
    "components/tabs/CoachTab.tsx",
  ];

  for (const rel of SURFACES) {
    it(`${rel} never destructures the raw authoring export`, () => {
      const code = stripComments(read(rel));
      // `hardMomentCards` may appear only inside the module path or as part of
      // `publishedHardMomentCards` — never as a bare imported binding.
      expect(code, `${rel} imports the raw authoring list`).not.toMatch(/[{,]\s*hardMomentCards\s*[,}]/);
    });
  }

  it("BehaviorsTab renders the section; the section reads publishedHardMomentCards", () => {
    expect(stripComments(read("components/tabs/BehaviorsTab.tsx"))).toContain("<HardMomentsSection />");
    expect(stripComments(read("components/behaviors/HardMomentsSection.tsx"))).toContain("publishedHardMomentCards");
  });

  it("Today offer goes through the EXISTING acceptTodayAction seam — no new capture path", () => {
    const code = stripComments(read("components/overview/HardMomentTodayOffer.tsx"));
    expect(code).toMatch(/acceptTodayAction\(doNow,\s*"standard"\)/);
    expect(code).not.toMatch(/handleAddLog|upsert|firestore|setDoc/i);
    // OverviewTab mounts it inside the day-anchor column.
    expect(stripComments(read("components/tabs/OverviewTab.tsx"))).toContain("<HardMomentTodayOffer />");
  });

  it("coach entry uses the EXISTING seedCoach seam with provenance", () => {
    for (const rel of ["components/tabs/CoachTab.tsx", "components/behaviors/HardMomentsSection.tsx"]) {
      const code = stripComments(read(rel));
      expect(code, `${rel} misses the seedCoach seam`).toMatch(/seedCoach\(\{\s*prompt:\s*buildHardMomentSeedPrompt\(/);
      expect(code, `${rel} misses seed provenance`).toContain('source: "hard-moment-card"');
    }
  });

  it("TODAY-2 holds: the offer button is outline, never a second gradient primary", () => {
    const code = stripComments(read("components/overview/HardMomentTodayOffer.tsx"));
    expect(code).not.toContain("--arbor-gradient-primary");
    expect(code).not.toContain("gradientCta");
  });

  it("tokens only: no hex literals or white literals in the new surfaces", () => {
    for (const rel of ["components/behaviors/HardMomentsSection.tsx", "components/overview/HardMomentTodayOffer.tsx"]) {
      const code = read(rel);
      expect(code, `${rel} carries a raw hex literal`).not.toMatch(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/);
      expect(code, `${rel} uses bg-white`).not.toMatch(/\bbg-white\b/);
      expect(code, `${rel} uses a bare "white" literal`).not.toMatch(/["']white["']/);
    }
  });
});

// ─── i18n: HE/EN parity + firewall-clean chrome copy ────────────────────────

describe("CONT-2 — hm.* chrome labels are bilingual and non-diagnostic", () => {
  const HM_KEYS = [
    "hm.title", "hm.sub", "hm.categoriesAria", "hm.cat.all",
    "hm.cat.big-feelings", "hm.cat.limits", "hm.cat.relationships",
    "hm.cat.separation", "hm.cat.routines", "hm.cat.transitions",
    "hm.section.doNow", "hm.section.sayThis", "hm.section.avoid",
    "hm.section.observe", "hm.section.escalation",
    "hm.talkThrough", "hm.coach.heading", "hm.today.eyebrow",
  ];

  it("every hm.* key exists in BOTH dictionaries", () => {
    for (const key of HM_KEYS) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
  });

  it("hm.* copy carries no verdict/diagnostic token (wave-3 ban class)", () => {
    const banned = /\b(on[\s-]?track|behind|diagnos\w*|adhd|autism|anxiety|disorder|score|percent|risk)\b/i;
    const heBanned = /(אבחנה|הפרעה|ציון|אחוז|מפגר)/;
    for (const key of HM_KEYS) {
      expect(en[key], `banned token in en ${key}`).not.toMatch(banned);
      expect(he[key], `banned token in he ${key}`).not.toMatch(heBanned);
      expect(en[key]).not.toMatch(/%/);
      expect(he[key]).not.toMatch(/%/);
    }
  });
});
