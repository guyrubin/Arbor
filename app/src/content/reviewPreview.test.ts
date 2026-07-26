import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../lib/i18n";
import { hardMomentCards, previewHardMomentCards, publishedHardMomentCards } from "./hardMomentCards";
import { isPublishableContent } from "./governance";
import { previewTodayOffer, reviewQueueEntries, surfaceHardMomentCards } from "./reviewPreview";
import { VOICE_SAFETY_FALLBACKS } from "../safety/voiceSafetyFallbacks";
import { escalationCategories, CRITICAL_HELPLINE_LITERALS } from "../safety/escalation";

/**
 * GD-1 reviewer-preview — render-guard tests for the in-prod draft-review
 * seam. The vitest env is node-only, so component-level assertions are
 * SOURCE-BASED structural guards in the house pattern
 * (hardMomentSurfaces.test.ts): they pin the code shape that makes the
 * runtime acceptance true.
 *
 * Invariants:
 *  - non-reviewers keep the EXACT published view (empty with the all-draft
 *    pack — surfaces render nothing);
 *  - the reviewer sees ALL draft cards, ALWAYS flagged draftPreview so the
 *    persistent DRAFT banner renders on every surface + card;
 *  - the publication predicate and its consumers are untouched.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const NOW = new Date("2026-07-27");

// ─── The banner strings are pinned EXACTLY (EN + HE) ────────────────────────

describe("GD-1 — the DRAFT banner strings are pinned in both locales", () => {
  it("EN banner is exact", () => {
    expect(en["review.draftBanner"]).toBe("DRAFT — under clinical review, not published");
  });
  it("HE banner is exact", () => {
    expect(he["review.draftBanner"]).toBe("טיוטה — בבדיקה קלינית, לא פורסם");
  });
  it("every review.* key exists in BOTH dictionaries", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("review."));
    expect(keys.length).toBeGreaterThanOrEqual(10);
    for (const key of keys) expect(he[key], `he missing ${key}`).toBeTruthy();
  });
});

// ─── Selector: fail-closed for everyone except the reviewer ────────────────

describe("previewHardMomentCards — reviewer-only, next to the published selector", () => {
  it("returns [] for non-reviewers (fail-closed)", () => {
    expect(previewHardMomentCards(false)).toEqual([]);
    // Truthy-but-not-true never opens the preview.
    expect(previewHardMomentCards("yes" as unknown as boolean)).toEqual([]);
    expect(previewHardMomentCards(1 as unknown as boolean)).toEqual([]);
  });

  it("returns the FULL authored pack (drafts, EN+HE) for the reviewer", () => {
    const preview = previewHardMomentCards(true);
    expect(preview).toHaveLength(hardMomentCards.length);
    expect(preview.map((c) => c.id)).toEqual(hardMomentCards.map((c) => c.id));
    for (const card of preview) {
      expect(card.title.en.trim()).toBeTruthy();
      expect(card.title.he.trim()).toBeTruthy();
    }
  });

  it("does NOT touch the published predicate: the real pack still publishes nothing", () => {
    expect(publishedHardMomentCards).toHaveLength(0);
    for (const card of hardMomentCards) expect(isPublishableContent(card, NOW)).toBe(false);
  });
});

// ─── The surface seam: EMPTY for non-reviewers, banner-flagged for reviewer ─

describe("surfaceHardMomentCards — the single seam the surfaces consume", () => {
  it("non-reviewer: exactly the published view (EMPTY with the all-draft pack), no banner flag", () => {
    const { cards, draftPreview } = surfaceHardMomentCards(false);
    expect(cards).toBe(publishedHardMomentCards);
    expect(cards).toHaveLength(0); // surfaces render nothing
    expect(draftPreview).toBe(false);
  });

  it("reviewer: all draft cards WITH draftPreview:true (the banner obligation)", () => {
    const { cards, draftPreview } = surfaceHardMomentCards(true);
    expect(cards).toHaveLength(hardMomentCards.length);
    expect(draftPreview).toBe(true);
  });
});

describe("previewTodayOffer — Today surface stays dark for non-reviewers", () => {
  const log = (behaviorType: string) => ({ behaviorType, timestamp: NOW.toISOString() });

  it("non-reviewer: null even on a strong behavior match (all-draft pack)", () => {
    expect(previewTodayOffer([log("Tantrum"), log("Hitting")], false, NOW)).toBeNull();
  });

  it("reviewer: a draft card renders, flagged draftPreview for the banner", () => {
    const offer = previewTodayOffer([], true, NOW);
    expect(offer).not.toBeNull();
    expect(offer!.draftPreview).toBe(true);
    expect(isPublishableContent(offer!.card, NOW)).toBe(false); // it IS a draft
  });
});

// ─── Review queue: cards + voice fallbacks + escalation resources ──────────

describe("reviewQueueEntries — the reviewer's full reviewable slate", () => {
  const entries = reviewQueueEntries();

  it("lists every authored card (both locales) with its governance review status", () => {
    const cards = entries.filter((e) => e.kind === "hard-moment-card");
    expect(cards).toHaveLength(hardMomentCards.length);
    for (const [i, entry] of cards.entries()) {
      expect(entry.status).toBe(hardMomentCards[i].reviewStatus); // "draft" today
      expect(entry.titleEn).toBe(hardMomentCards[i].title.en);
      expect(entry.titleHe).toBe(hardMomentCards[i].title.he);
      for (const field of entry.fields) {
        expect(field.en.trim()).toBeTruthy();
        expect(field.he.trim()).toBeTruthy();
      }
    }
  });

  it("lists BOTH VC-6 voice-safety fallback strings verbatim (HE queued for GG-4)", () => {
    const voice = entries.filter((e) => e.kind === "voice-safety-fallback");
    expect(voice).toHaveLength(2);
    const texts = voice.flatMap((e) => e.fields.map((f) => f.he));
    expect(texts).toContain(VOICE_SAFETY_FALLBACKS.he.escalation);
    expect(texts).toContain(VOICE_SAFETY_FALLBACKS.he.blocked);
    for (const entry of voice) expect(entry.status).toBe("queued-signoff");
  });

  it("lists the escalation-resource copy per category, crisis numbers intact", () => {
    const resources = entries.filter((e) => e.kind === "escalation-resource");
    expect(resources).toHaveLength(escalationCategories.length);
    const all = resources.flatMap((e) => e.fields.map((f) => f.en)).join("\n");
    for (const literal of CRITICAL_HELPLINE_LITERALS) expect(all).toContain(literal);
  });
});

// ─── Structural guards: the surfaces render the banner + use ONLY the seam ─

describe("GD-1 — surface components carry the banner and consume only the gated seam", () => {
  const SURFACES = [
    "components/behaviors/HardMomentsSection.tsx",
    "components/overview/HardMomentTodayOffer.tsx",
    "components/tabs/CoachTab.tsx",
  ];

  for (const rel of SURFACES) {
    it(`${rel} mounts DraftReviewBanner + ReviewQueuePanel behind the reviewer flag`, () => {
      const code = stripComments(read(rel));
      expect(code).toContain("DraftReviewBanner");
      expect(code).toContain("ReviewQueuePanel");
      // The flag is the server bootstrap only — strict === true, never a
      // content-state or truthy shortcut.
      expect(code).toContain("entitlement.clinicalReviewer === true");
    });

    it(`${rel} never imports the raw draft selector directly (seam only)`, () => {
      const code = stripComments(read(rel));
      expect(code).not.toMatch(/[{,]\s*previewHardMomentCards\s*[,}]/);
    });
  }

  it("the banner component renders the pinned i18n string with peach tokens, hex-free", () => {
    const code = read("components/review/DraftReviewBanner.tsx");
    expect(code).toContain('t("review.draftBanner")');
    expect(code).toContain("--arbor-peach-soft");
    expect(code).toContain("--arbor-peach-ink");
    expect(code).not.toMatch(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/);
  });

  it("the review queue panel is read-only: no capture/persistence paths", () => {
    const code = stripComments(read("components/review/ReviewQueuePanel.tsx"));
    expect(code).not.toMatch(/handleAddLog|acceptTodayAction|upsert|firestore|setDoc|api\.(post|put)/i);
  });

  it("reviewer preview stays out of the KID register (no kidmode import)", () => {
    for (const rel of ["components/review/DraftReviewBanner.tsx", "components/review/ReviewQueuePanel.tsx"]) {
      expect(read(rel)).not.toMatch(/kidmode|KidDashboard/);
    }
  });
});
