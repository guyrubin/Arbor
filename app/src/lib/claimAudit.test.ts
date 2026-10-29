/**
 * BD-13 — the shipped copy against the offer. See lib/claimAudit.ts.
 *
 *  1. Every claim string (offer, trial, price, free, guarantee, unlimited; EN
 *     or HE) is registered with a basis, in both languages; no registry entry
 *     is stale.
 *  2. Each basis is checked against the code that grants it: the trial length,
 *     the referral offer, the store price, free sharing, the free plan's
 *     limits, Plus's coach limit.
 *  3. No string in either language makes a claim BD-13 forbids, except the
 *     shrink-only KNOWN_FALSE_CLAIMS awaiting Guy's copy, each still false.
 */
import { describe, expect, it } from "vitest";
import { en as baseEn, he as baseHe } from "./i18n";
import { elevationEn, elevationHe } from "./i18nElevation";
import { CLAIM_REGISTRY, KNOWN_FALSE_CLAIMS, auditClaimCopy, claimTopicsOf, deniedClaimsIn } from "./claimAudit";
import { OFFERS } from "./offers";
import { PLAN_LIMITS, TRIAL_DAYS } from "../server/entitlements";
import { IMAGE_ALLOWANCE } from "../server/imageQuota";

// The merged dictionaries exactly as translate() resolves them (base keys win).
const EN: Record<string, string> = { ...elevationEn, ...baseEn };
const HE: Record<string, string> = { ...elevationHe, ...baseHe };
const rows = auditClaimCopy(EN, HE);
const keysOf = (kind: string) => Object.entries(CLAIM_REGISTRY).filter(([, b]) => b.kind === kind).map(([k]) => k);
const both = (key: string) => [EN[key], HE[key]] as const;

describe("BD-13 · 1 · every claim is registered, in both languages", () => {
  it("the audit finds the offer, trial and price copy (non-vacuity)", () => {
    expect(rows.length).toBeGreaterThanOrEqual(50);
    for (const k of ["set.plan.trialDesc", "set.referral.title", "elev.storeshell.pw.disclosure", "pw.body.coParentSeats"]) {
      expect(rows.some((r) => r.key === k), k).toBe(true);
    }
  });

  it("no claim ships without a basis or a known-false entry", () => {
    const unregistered = rows.filter((r) => r.topics.length > 0 && !r.basis && !r.knownFalse).map((r) => `${r.key} [${r.topics.join(",")}] ${r.en}`);
    expect(unregistered, "register each in lib/claimAudit.ts CLAIM_REGISTRY with the basis that makes it true").toEqual([]);
  });

  it("no registry entry is stale: each key ships in EN and HE and still makes a claim", () => {
    for (const key of Object.keys(CLAIM_REGISTRY)) {
      expect(EN[key], `${key} EN`).toBeTruthy();
      expect(HE[key], `${key} HE`).toBeTruthy();
      expect(HE[key], `${key} HE is the English`).not.toBe(EN[key]);
      expect(rows.find((r) => r.key === key)?.topics.length ?? 0, `${key} no longer makes a claim — remove it`).toBeGreaterThan(0);
    }
    for (const key of Object.keys(KNOWN_FALSE_CLAIMS)) expect(CLAIM_REGISTRY[key], key).toBeUndefined();
  });
});

describe("BD-13 · 2 · each basis is true in the code", () => {
  it("trial: every day count in the copy is the trial every account gets, and no card is asked", () => {
    expect(TRIAL_DAYS).toBe(14);
    for (const key of keysOf("trial")) {
      const [e, h] = both(key);
      for (const m of e.matchAll(/(\d+) days\b/g)) expect(Number(m[1]), `${key} EN`).toBe(TRIAL_DAYS);
      for (const m of h.matchAll(/(\d+) (ה)?ימים/g)) expect(Number(m[1]), `${key} HE`).toBe(TRIAL_DAYS);
    }
    expect(EN["set.plan.trialDesc"]).toMatch(/no card/);
    expect(HE["set.plan.trialDesc"]).toMatch(/בלי כרטיס|ללא כרטיס/);
  });

  it("offer: the referral month is the approved 30-day offer, granted to both families as the copy says", () => {
    const offer = OFFERS.referral_month;
    expect(offer).toMatchObject({ approved: true, grantDays: 30, grantsReferrer: true });
    for (const key of keysOf("offer")) {
      const [e, h] = both(key);
      expect(e, key).toMatch(/month/i);
      expect(h, key).toMatch(/חודש/);
      if (/\bboth\b|\beach\b|you get one too/i.test(e)) expect(offer.grantsReferrer, key).toBe(true);
      expect(e, `${key} names no other length`).not.toMatch(/\b\d+ (days|weeks)\b|\b(two|three|six) months\b/i);
    }
  });

  it("storePrice: the amount is never written into the copy — the store's figure fills the placeholder", () => {
    for (const key of keysOf("storePrice")) {
      for (const s of both(key)) expect(s, key).not.toMatch(/[€₪$]\s?\d|\d\s?[€₪]/);
    }
    expect(EN["set.plan.price.perMonth"]).toContain("{price}");
    expect(HE["set.plan.price.perMonth"]).toContain("{price}");
  });

  it("freeSharing: co-parent sharing is the same on every plan", () => {
    const seats = Object.values(PLAN_LIMITS).map((l) => l.coParentSeats);
    expect(new Set(seats).size).toBe(1);
    expect(seats[0]).toBeGreaterThanOrEqual(1);
    for (const key of keysOf("freeSharing")) {
      const [e, h] = both(key);
      expect(e, key).toMatch(/free on every plan/i);
      expect(h, key).toMatch(/ללא תשלום בכל מסלול/);
    }
  });

  it("freeLimits: the free plan keeps one child and a daily coach number; Plus keeps six", () => {
    expect(PLAN_LIMITS.free.maxChildren).toBe(1);
    expect(typeof PLAN_LIMITS.free.coachMessagesPerDay).toBe("number");
    expect(PLAN_LIMITS.plus.maxChildren).toBe(6);
    expect(EN["pw.body.maxChildren"]).toMatch(/one child[\s\S]*up to six/);
    expect(HE["pw.body.maxChildren"]).toMatch(/ילד אחד[\s\S]*עד שישה/);
  });

  it("unlimitedCoaching: Plus and Family have no daily coach number", () => {
    expect(PLAN_LIMITS.plus.coachMessagesPerDay).toBeNull();
    expect(PLAN_LIMITS.family.coachMessagesPerDay).toBeNull();
    for (const key of keysOf("unlimitedCoaching")) {
      const [e] = both(key);
      expect(e, `${key} may claim coaching, never generation`).not.toMatch(/unlimited (images?|stories|comics?|heroes|adventures?)/i);
    }
  });

  it("every fact names its source", () => {
    for (const [key, b] of Object.entries(CLAIM_REGISTRY)) if (b.kind === "fact") expect(b.note.length, key).toBeGreaterThan(5);
  });
});

describe("BD-13 · 3 · the forbidden claims", () => {
  it("no string in either language makes one, outside the shrink-only known-false list", () => {
    const offenders = rows.filter((r) => r.denied.length > 0 && !r.knownFalse).map((r) => `${r.key} [${r.denied.join(",")}] ${r.en}`);
    expect(offenders).toEqual([]);
  });

  it("each known-false claim is still shipped, still forbidden and still contradicted by the allowance (shrink-only)", () => {
    for (const key of Object.keys(KNOWN_FALSE_CLAIMS)) {
      const row = rows.find((r) => r.key === key);
      expect(row?.denied, `${key} was fixed — delete its KNOWN_FALSE_CLAIMS line`).toContain("unlimited-generation");
    }
    expect(Number.isFinite(IMAGE_ALLOWANCE.plus.perDay)).toBe(true);
    expect(IMAGE_ALLOWANCE.plus.perDay).toBeGreaterThan(0);
    expect(Object.keys(KNOWN_FALSE_CLAIMS).length).toBeLessThanOrEqual(3);
  });

  it("negative controls: each forbidden claim is caught in both languages, and a negation passes", () => {
    expect(deniedClaimsIn("Arbor is clinically proven to help", "en")).toContain("clinical-proof");
    expect(deniedClaimsIn("Arbor is not clinically validated", "en")).toEqual([]);
    expect(deniedClaimsIn("Arbor improves your child's speech", "en")).toContain("outcome-promise");
    expect(deniedClaimsIn("Results guaranteed", "en")).toContain("guarantee");
    expect(deniedClaimsIn("Like having a therapist in your pocket", "en")).toContain("professional-equivalence");
    expect(deniedClaimsIn("Recommended by paediatricians", "en")).toContain("endorsement");
    expect(deniedClaimsIn("Arbor detects autism early", "en")).toContain("diagnosis");
    expect(deniedClaimsIn("With Plus there is no daily limit on stories", "en")).toContain("unlimited-generation");
    expect(deniedClaimsIn("ארבור מוכח קלינית", "he")).toContain("clinical-proof");
    expect(deniedClaimsIn("ארבור אינו מאומת קלינית", "he")).toEqual([]);
    expect(deniedClaimsIn("ארבור משפר את ההתפתחות", "he")).toContain("outcome-promise");
    expect(deniedClaimsIn("בארבור פלוס אין מכסה יומית", "he")).toContain("unlimited-generation");
    expect(deniedClaimsIn("במקום קלינאי תקשורת", "he")).toContain("professional-equivalence");
    expect(claimTopicsOf("Your free trial ends today", "en")).toEqual(expect.arrayContaining(["trial", "free"]));
    expect(claimTopicsOf("שיפור מיומנויות חברתיות", "he")).toEqual([]); // "מנוי" inside a word is not a subscription
  });
});
