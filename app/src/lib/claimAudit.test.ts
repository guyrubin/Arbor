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
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en as baseEn, he as baseHe } from "./i18n";
import { elevationEn, elevationHe } from "./i18nElevation";
import { CLAIM_REGISTRY, KNOWN_FALSE_CLAIMS, KNOWN_PRICE_DISCREPANCIES, auditClaimCopy, auditMarketingPage, claimTopicsOf, deniedClaimsIn, marketingPrices } from "./claimAudit";
import { effectiveMonthly, planPrice } from "./pricing";
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

  it("unlimitedCoaching: Plus and Family have no daily coach number, and the copy never says unlimited", () => {
    expect(PLAN_LIMITS.plus.coachMessagesPerDay).toBeNull();
    expect(PLAN_LIMITS.family.coachMessagesPerDay).toBeNull();
    for (const key of keysOf("unlimitedCoaching")) {
      const [e, h] = both(key);
      expect(e, `${key} EN`).not.toMatch(/\bunlimited\b/i);
      expect(h, `${key} HE`).not.toMatch(/ללא הגבלה|בלי הגבלה/);
      expect(e, `${key} names the daily message limit`).toMatch(/no daily message limit/);
    }
    for (const key of ["set.plan.plusDesc", "set.plan.plusPitch", "pw.body", "pw.bodyCoach"]) {
      expect(EN[key], key).toContain("fair-use hourly limit");
      expect(HE[key], key).toContain("מגבלת שימוש הוגן לשעה");
    }
  });

  it("imageAllowance: Plus draws more than Free each day and each month, and the copy promises no unlimited drawing", () => {
    expect(IMAGE_ALLOWANCE.plus.perDay).toBeGreaterThan(IMAGE_ALLOWANCE.free.perDay);
    expect(IMAGE_ALLOWANCE.plus.perMonth).toBeGreaterThan(IMAGE_ALLOWANCE.free.perMonth);
    expect(IMAGE_ALLOWANCE.plus.heroPer30Days).toBeGreaterThan(IMAGE_ALLOWANCE.free.heroPer30Days);
    for (const key of keysOf("imageAllowance")) {
      const [e, h] = both(key);
      expect(deniedClaimsIn(e, "en"), key).toEqual([]);
      expect(deniedClaimsIn(h, "he"), key).toEqual([]);
      expect(e, key).toMatch(/daily allowance of new pictures|more hero drawings each month/);
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

  it("the known-false list is empty and stays empty (shrink-only, round 2 fixed all three)", () => {
    expect(Object.keys(KNOWN_FALSE_CLAIMS)).toEqual([]);
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
    expect(deniedClaimsIn("Unlimited coaching, professional reports", "en")).toContain("unlimited-coaching");
    expect(deniedClaimsIn("אימון ללא הגבלה", "he")).toContain("unlimited-coaching");
    expect(claimTopicsOf("Your free trial ends today", "en")).toEqual(expect.arrayContaining(["trial", "free"]));
    expect(claimTopicsOf("שיפור מיומנויות חברתיות", "he")).toEqual([]); // "מנוי" inside a word is not a subscription
  });
});

/* ── round 2: the shipped marketing pages ──────────────────────────────── */

const MARKETING = path.resolve(__dirname, "..", "..", "public", "marketing");
const listPages = (dir: string, prefix = ""): string[] =>
  readdirSync(dir).flatMap((n) => {
    const full = path.join(dir, n);
    const rel = prefix ? `${prefix}/${n}` : n;
    return statSync(full).isDirectory() ? listPages(full, rel) : /\.(html|md)$/.test(n) ? [rel] : [];
  });
const pages = listPages(MARKETING);
const ALLOWED_PRICES = new Set(
  (["EUR", "ILS"] as const).flatMap((cur) =>
    [planPrice("plus", "monthly", cur), planPrice("plus", "annual", cur), effectiveMonthly("plus", cur)]
      .filter((n): n is number => n !== null)
      .map((n) => `${cur === "EUR" ? "€" : "₪"}${n.toFixed(2)}`)),
);

describe("BD-13 · 4 · the shipped marketing pages", () => {
  it("finds the pages (non-vacuity)", () => {
    expect(pages).toEqual(expect.arrayContaining(["arbor-il.html", "index.html", "arbor-marketing-landing-page-he.html", "en/ai-parenting-app-with-memory.html"]));
  });

  it("no page sells a plan that is not sold, a standing free tier, 'unlimited', or a forbidden claim", () => {
    const offenders = pages.flatMap((rel) => auditMarketingPage(readFileSync(path.join(MARKETING, rel), "utf8")).map((h) => `${rel}: ${h}`));
    expect(offenders).toEqual([]);
  });

  it("every price on a page is lib/pricing.ts's, except the pinned discrepancies awaiting Guy", () => {
    const off: string[] = [];
    for (const rel of pages) {
      const pinned = new Set(KNOWN_PRICE_DISCREPANCIES[rel]?.prices ?? []);
      for (const p of marketingPrices(readFileSync(path.join(MARKETING, rel), "utf8"))) if (!ALLOWED_PRICES.has(p) && !pinned.has(p)) off.push(`${rel}: ${p}`);
    }
    expect(off).toEqual([]);
    expect(ALLOWED_PRICES).toEqual(new Set(["€12.99", "€129.90", "€10.83", "₪69.90", "₪549.00", "₪45.75"]));
  });

  it("each pinned discrepancy is still on its page (shrink-only) and names Guy", () => {
    for (const [rel, d] of Object.entries(KNOWN_PRICE_DISCREPANCIES)) {
      const shown = new Set(marketingPrices(readFileSync(path.join(MARKETING, rel), "utf8")));
      for (const p of d.prices) expect(shown.has(p), `${rel} no longer shows ${p} — delete it from KNOWN_PRICE_DISCREPANCIES`).toBe(true);
      expect(d.guy).toMatch(/^Guy: /);
    }
    expect(Object.keys(KNOWN_PRICE_DISCREPANCIES).length).toBeLessThanOrEqual(1);
  });

  it("negative controls: the IL page's old tiers are caught", () => {
    const old = `<div class="tier"><div class="tname">התחלה</div><div class="price"><b>חינם</b></div></div>
      <li>משחק יומי, תרגול ואקדמיה ללא הגבלה</li><div class="tname">Arbor משפחתי</div><div class="price"><b>₪79</b></div>
      <p>יש מסלול חינמי להתחלה, בלי כרטיס אשראי.</p>`;
    const hits = auditMarketingPage(old).join("\n");
    for (const id of ["plan-not-sold", "standing-free-tier", "unlimited"]) expect(hits).toContain(id);
    expect(marketingPrices(old)).toEqual(["₪79.00"]);
    expect(marketingPrices("12,99 € and € 129,90 and ₪549")).toEqual(["€12.99", "€129.90", "₪549.00"]);
  });
});
