import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { translate } from "../lib/i18n";

/**
 * OWN-1 / F-05 (E6) — client wiring for server ownership provisioning + the
 * memory-review error surface (house source-guard tests, the askCapability
 * pattern; the vitest env is node-only, so surface-level acceptance is pinned
 * structurally — the server behavior itself is covered end-to-end in
 * routes/ownershipProvisioning.test.ts):
 *
 *  - ProfileContext actually calls /api/onboarding/family-child (the ONLY
 *    creator of the ownership docs requireChildOwnership authorizes against),
 *    from addChild AND as a session-guarded backfill after profiles load, and
 *    never sends a client-chosen familyId/userId.
 *  - ArborContext surfaces a failed review fetch as memoryReviewError state
 *    (never only the old console.warn swallow) and exposes retryMemoryReview,
 *    which refetches via refreshMemoryReview.
 *  - ChildMemory renders the ErrorState + retry card (TrustedSharing twin)
 *    when the ledger is unreadable, instead of a false "No memory yet".
 *  - The coach-footer review invite degrades while the ledger is unreadable.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const profile = stripComments(read("context/ProfileContext.tsx"));
const arbor = stripComments(read("context/ArborContext.tsx"));
const memory = stripComments(read("components/sections/ChildMemory.tsx"));
const cards = stripComments(read("components/coach/CoachAnswerCards.tsx"));
const coach = stripComments(read("components/tabs/CoachTab.tsx"));

describe("OWN-1 — the client provisions server ownership docs", () => {
  it("ProfileContext calls POST /api/onboarding/family-child with auth headers", () => {
    expect(profile).toContain('"/api/onboarding/family-child"');
    const call = /fetch\("\/api\/onboarding\/family-child"[\s\S]{0,300}/.exec(profile)?.[0] ?? "";
    expect(call).toContain('method: "POST"');
    expect(call).toContain("authHeaders()");
  });

  it("identity is server-derived: the body carries childId + profile, never familyId/userId", () => {
    const call = /fetch\("\/api\/onboarding\/family-child"[\s\S]{0,300}/.exec(profile)?.[0] ?? "";
    expect(call).toContain("JSON.stringify({ childId, childProfile })");
    expect(call).not.toContain("familyId");
    expect(call).not.toContain("userId");
  });

  it("provisioning runs from addChild after the child doc write AND as a backfill after profiles load", () => {
    // addChild: right after the Firestore setDoc path.
    const add = /const addChild = useCallback\([\s\S]*?\[useFirestore, profilesPath, ensureOwnership\]/.exec(profile)?.[0] ?? "";
    expect(add).not.toBe("");
    expect(add).toContain("void ensureOwnership(newChild)");
    // Load path: every loaded profile is backfilled (existing accounts heal on sign-in).
    expect(profile).toContain("for (const child of loaded) void ensureOwnership(child)");
  });

  it("the backfill is once-per-session-per-child (ref + sessionStorage guard, cleared only on success)", () => {
    expect(profile).toContain("provisionedChildren");
    expect(profile).toContain("sessionStorage.getItem(`${OWNERSHIP_GUARD_PREFIX}${child.id}`)");
    expect(profile).toContain("sessionStorage.setItem(`${OWNERSHIP_GUARD_PREFIX}${child.id}`");
  });
});

describe("OWN-1 — a failed memory review read is surfaced, retryable, honest", () => {
  it("refreshMemoryReview sets memoryReviewError on failure and clears it on success", () => {
    const refresh = /const refreshMemoryReview = async[\s\S]*?\n  \};/.exec(arbor)?.[0] ?? "";
    expect(refresh).not.toBe("");
    expect(refresh).toContain("setMemoryReviewError(false)");
    expect(refresh).toContain("setMemoryReviewError(true)");
    // The error set lives in the catch — after the warn, never instead of it.
    expect(refresh.indexOf("setMemoryReviewError(true)")).toBeGreaterThan(refresh.indexOf("catch"));
  });

  it("retryMemoryReview refetches through refreshMemoryReview and both are exposed on the context", () => {
    const retry = /const retryMemoryReview = [\s\S]*?\n  \};/.exec(arbor)?.[0] ?? "";
    expect(retry).toContain("refreshMemoryReview()");
    expect(arbor).toMatch(/memoryReviewError,\s*retryMemoryReview,/);
  });

  it("ChildMemory renders the ErrorState retry card wired to retryMemoryReview when the ledger read failed", () => {
    expect(memory).toContain('import { ErrorState } from "../ui/ErrorState"');
    const card = /\{memoryReviewError && \([\s\S]*?\/>\s*\)\}/.exec(memory)?.[0] ?? "";
    expect(card).toContain("<ErrorState");
    expect(card).toContain("onRetry={retryMemoryReview}");
    expect(card).toContain('t("err.memory.title"');
    expect(card).toContain('t("err.retry")');
  });

  it("an unreadable ledger never masquerades as an empty one — the lists are suppressed while errored", () => {
    expect(memory).toContain("{!memoryReviewError && pendingMemoryItems.length > 0 && (");
    expect(memory).toContain("{!memoryReviewError && (");
  });

  it("the coach-footer review invite degrades while the ledger is unreadable", () => {
    // CoachAnswerCards gates the chip on the new prop…
    expect(cards).toContain("reviewUnavailable?: boolean");
    expect(cards).toContain("!reviewUnavailable && (contract.memoryProposals?.length ?? 0) > 0");
    // …and CoachTab feeds it the live error state.
    expect(coach).toContain("reviewUnavailable={memoryReviewError}");
  });

  it("the error copy exists in BOTH languages (parity + Hebrew register)", () => {
    for (const key of ["err.memory.title", "err.memory.body"] as const) {
      expect(translate("en", key, { name: "Maya" }).trim(), `EN missing ${key}`).not.toBe("");
      const he = translate("he", key, { name: "מאיה" });
      expect(he.trim(), `HE missing ${key}`).not.toBe("");
      expect(he, `HE not Hebrew for ${key}`).not.toMatch(/[a-z]/i);
    }
  });
});
