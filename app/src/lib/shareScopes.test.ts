/**
 * CARE-3 — Trusted Sharing localization + stable scope IDs.
 *
 * Covers:
 *  - normalization contract: stable IDs pass through, the exact legacy English
 *    UI labels migrate, EVERYTHING else fails closed (null / dropped)
 *  - preset coupling: every professional consult preset has a scope ID and
 *    every scope ID label exists in BOTH language dictionaries (EN + HE parity)
 *  - display contract: recognized scopes render localized labels; unknown
 *    legacy strings still render raw (visible) while granting nothing
 *  - source contract ("grep check"): TrustedSharing.tsx carries zero hardcoded
 *    user-facing English — every removed literal stays removed
 *
 * Node harness (vitest environment: "node") — no DOM, no React rendering.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SHARE_SCOPE_IDS,
  REPORT_SCOPE_BY_TYPE,
  isShareScopeId,
  normalizeScope,
  normalizeScopes,
  shareScopeLabelKey,
  scopeDisplayLabels,
} from "./shareScopes";
import { en, he, translate } from "./i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string): string => readFileSync(path.join(__dirname, "..", rel), "utf8");

// ── Normalization: stable IDs + legacy migration, fail-closed ───────────────
describe("share scope normalization (CARE-3)", () => {
  it("stable IDs pass through unchanged", () => {
    for (const id of SHARE_SCOPE_IDS) {
      expect(normalizeScope(id)).toBe(id);
      expect(isShareScopeId(id)).toBe(true);
    }
  });

  it("the exact legacy English UI labels migrate to their stable IDs", () => {
    expect(normalizeScope("Story timeline")).toBe("story_timeline");
    expect(normalizeScope("Weekly Insight")).toBe("weekly_insight");
    expect(normalizeScope("Behavior patterns")).toBe("behavior_patterns");
    expect(normalizeScope("Milestones")).toBe("milestones");
    expect(normalizeScope("Teacher Handoff")).toBe("report_teacher");
    expect(normalizeScope("Therapist Summary")).toBe("report_therapist");
    expect(normalizeScope("Pediatrician Summary")).toBe("report_pediatrician");
    // The pre-CARE-3 server default scope.
    expect(normalizeScope("timeline")).toBe("story_timeline");
    // Whitespace/case tolerant for the known labels only.
    expect(normalizeScope("  Story Timeline ")).toBe("story_timeline");
  });

  it("FIREWALL: unrecognized strings map to NO access — null, never a default", () => {
    for (const raw of ["Everything", "full_access", "memory", "reports", "story timeline extra", "story_timeline2", "", "   "]) {
      expect(normalizeScope(raw), `"${raw}" must fail closed`).toBeNull();
    }
  });

  it("normalizeScopes drops unknowns and dedupes — an all-unknown list grants NOTHING", () => {
    expect(normalizeScopes(["Everything", "memory"])).toEqual([]);
    expect(normalizeScopes(["timeline", "Story timeline", "story_timeline"])).toEqual(["story_timeline"]);
    expect(normalizeScopes(["Weekly Insight", "bogus", "report_teacher"])).toEqual(["weekly_insight", "report_teacher"]);
    expect(normalizeScopes(undefined)).toEqual([]);
    expect(normalizeScopes(null)).toEqual([]);
  });

  it("every professional consult preset type has a stable scope ID", () => {
    expect(Object.keys(REPORT_SCOPE_BY_TYPE).sort()).toEqual(["pediatrician", "teacher", "therapist"]);
    for (const id of Object.values(REPORT_SCOPE_BY_TYPE)) expect(isShareScopeId(id)).toBe(true);
  });
});

// ── Labels: resolved at render, EN + HE parity, unknown legacy still renders ─
describe("share scope display labels (CARE-3)", () => {
  it("every scope ID has a label key in BOTH dictionaries (HE/EN parity)", () => {
    for (const id of SHARE_SCOPE_IDS) {
      const key = shareScopeLabelKey(id);
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
      expect(he[key], `he not translated for ${key}`).not.toBe(en[key]);
    }
  });

  it("EN labels reproduce the pre-CARE-3 display strings (no visible copy change)", () => {
    expect(en["share.scope.story_timeline"]).toBe("Story timeline");
    expect(en["share.scope.weekly_insight"]).toBe("Weekly Insight");
    expect(en["share.scope.report_teacher"]).toBe("Teacher Handoff");
  });

  it("resolves localized labels per language and renders unknown legacy strings raw", () => {
    const tEn = (k: string) => translate("en", k);
    const tHe = (k: string) => translate("he", k);
    expect(scopeDisplayLabels(["story_timeline", "Teacher Handoff"], tEn)).toEqual(["Story timeline", "Teacher Handoff"]);
    // HE flow: chips resolve to Hebrew — no English leaks from stored IDs.
    const heLabels = scopeDisplayLabels(["story_timeline", "report_teacher"], tHe);
    expect(heLabels).toEqual([he["share.scope.story_timeline"], he["share.scope.report_teacher"]]);
    for (const l of heLabels) expect(/[a-zA-Z]/.test(l)).toBe(false);
    // Unknown legacy string: still RENDERS (parent must see the old claim)…
    expect(scopeDisplayLabels(["Some old scope"], tEn)).toEqual(["Some old scope"]);
    // …but grants nothing (enforcement goes through normalizeScopes).
    expect(normalizeScopes(["Some old scope"])).toEqual([]);
  });

  it("duration and role keys exist in both dictionaries", () => {
    for (const key of [
      "share.duration.30d", "share.duration.60d", "share.duration.term", "share.duration.until_revoked",
      "share.role.co_parent", "share.role.viewer", "share.role.professional",
    ]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
      expect(he[key], `he not translated for ${key}`).not.toBe(en[key]);
    }
  });
});

// ── Source contract — zero hardcoded user-facing English (the grep check) ────
describe("TrustedSharing.tsx localization source contract (CARE-3)", () => {
  const src = readSrc("components/sections/TrustedSharing.tsx");
  // The check targets USER-FACING code — comments may still name canon
  // ("Care Network › Trusted Sharing") without leaking into the UI.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("none of the removed English literals survive in the source", () => {
    const REMOVED = [
      "New share",
      "Find a professional",
      "Their role",
      "What to share",
      "Access duration",
      "Review before sharing",
      "Approve & share",
      "Back and edit",
      "They can see",
      ">Recipient<",
      "Active shares",
      "Loading shares",
      "Nothing is shared right now",
      "Nothing is selected by default",
      "Revoke access",
      "Shared with you",
      "Your data",
      "Export all data",
      "This session",
      "Coordinating around",
      "Every share is parent-approved",
      "Arbor will share only this summary",
      "Recipient email (they sign in",
      "No scopes",
      "A child",
      "Until revoked",
      "30 days",
      "60 days",
      "End of term",
      "Story timeline",
      "Weekly Insight",
      "Behavior patterns",
      "Co-parent",
      "just now",
      "Could not create share",
      "Could not revoke",
      "You exported all of",
      "Sharing…",
      "Care Network",
      "Expires ",
      "Parent-initiated export",
    ];
    for (const literal of REMOVED) {
      expect(code, `hardcoded English literal survived: "${literal}"`).not.toContain(literal);
    }
  });

  it("scope chips are driven by stable IDs with labels resolved through t()", () => {
    expect(src).toContain("shareScopeLabelKey");
    expect(src).toContain("scopeDisplayLabels");
    expect(src).toContain("ShareScopeId");
    // The grant payload sends draft.scopes (stable IDs), never display labels.
    expect(src).toMatch(/scopes:\s*draft\.scopes/);
  });

  it("durations are stable IDs localized via share.duration.* keys", () => {
    expect(src).toContain('["30d", "60d", "term", "until_revoked"]');
    expect(src).toContain("share.duration.${d}");
  });

  it("tokens only — no raw hex literals anywhere in the file", () => {
    expect(src.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toEqual([]);
  });

  it("ChildProfile's family roster resolves scope labels through the same seam", () => {
    const cp = readSrc("components/sections/ChildProfile.tsx");
    expect(cp).toContain("scopeDisplayLabels(s.scopes, t)");
  });
});
