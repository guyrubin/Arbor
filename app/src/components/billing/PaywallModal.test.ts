/**
 * MOB-02 (wave T) — the paywall is a compliant subscription disclosure.
 *
 * Apple 3.1.2 / Play subscriptions: price + billing period + auto-renewal
 * statement visible BEFORE purchase; on native the store is the price
 * authority, so while the offering is null the CTA is DISABLED and a loading
 * line replaces it. The view-model is pure (paywallModel.ts) and tested
 * directly; the modal's wiring is pinned at source level (node-only harness).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPlanRows, paywallCta, disclosureText, storeLabelKey, paywallBody, PAYWALL_FEATURES, type Tr } from "./paywallModel";
import * as planclarity from "../../lib/i18nElevation/planclarity";
import { en as baseEn, he as baseHe } from "../../lib/i18n";
import { en as shellEn, he as shellHe } from "../../lib/i18nElevation/storeShell";
import type { NativePriceMap } from "../../lib/nativeBilling";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8");
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Key-echoing translator: vars are appended so assertions can see them. */
const t: Tr = (key, vars) => (vars ? `${key}{${Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(",")}}` : key);
const fmt = (amount: number, code: string) => `${code} ${amount.toFixed(2)}`;

const STORE_PRICES: NativePriceMap = {
  plus: { monthly: { priceString: "₪49.90", amount: 49.9, currencyCode: "ILS" }, annual: { priceString: "₪499.00", amount: 499, currencyCode: "ILS" } },
  family: { monthly: { priceString: "₪74.90", amount: 74.9, currencyCode: "ILS" } },
};

describe("native + null prices → skeleton rows, CTA disabled, loading copy", () => {
  const rows = buildPlanRows({ isNative: true, nativePrices: null, cadence: "monthly", fmtCurrency: fmt });

  it("every row has no price (skeleton), never a web EUR constant", () => {
    expect(rows.map((r) => r.plan)).toEqual(["plus", "family"]);
    expect(rows.every((r) => r.price === null && r.perMonth === null)).toBe(true);
  });

  it("the CTA is disabled and says prices are loading from the store", () => {
    const cta = paywallCta({ rows, selected: "plus", cadence: "monthly", isNative: true, platform: "ios", t });
    expect(cta.disabled).toBe(true);
    expect(cta.loading).toBe(true);
    expect(cta.label).toContain("elev.storeshell.pw.pricesLoading");
    expect(cta.label).toContain("store=elev.storeshell.store.ios");
  });

  it("a plan whose store price is missing stays disabled even when the other resolved", () => {
    const partial = buildPlanRows({ isNative: true, nativePrices: STORE_PRICES, cadence: "annual", fmtCurrency: fmt });
    expect(partial.find((r) => r.plan === "plus")?.price).toBe("₪499.00");
    expect(partial.find((r) => r.plan === "family")?.price).toBeNull();
    expect(paywallCta({ rows: partial, selected: "family", cadence: "annual", isNative: true, platform: "android", t }).disabled).toBe(true);
  });
});

describe("negative controls — with a price the CTA is live and names plan + price", () => {
  it("native with store prices: enabled, store-localized price, annual carries the per-month figure", () => {
    const rows = buildPlanRows({ isNative: true, nativePrices: STORE_PRICES, cadence: "annual", fmtCurrency: fmt });
    const plus = rows.find((r) => r.plan === "plus")!;
    expect(plus.price).toBe("₪499.00");
    expect(plus.perMonth).toBe("ILS 41.58");
    const cta = paywallCta({ rows, selected: "plus", cadence: "annual", isNative: true, platform: "ios", t });
    expect(cta.disabled).toBe(false);
    expect(cta.loading).toBe(false);
    expect(cta.label).toContain("elev.storeshell.pw.cta");
    expect(cta.label).toContain("plan=set.plan.plus");
    expect(cta.label).toContain("price=₪499.00/elev.storeshell.pw.period.year");
  });

  it("web: the ONE client constant, both cadences, CTA enabled", () => {
    const monthly = buildPlanRows({ isNative: false, nativePrices: null, cadence: "monthly", fmtCurrency: fmt });
    expect(monthly.find((r) => r.plan === "plus")?.price).toBe("€12.99");
    expect(monthly.find((r) => r.plan === "family")?.price).toBe("€19.99");
    const annual = buildPlanRows({ isNative: false, nativePrices: null, cadence: "annual", fmtCurrency: fmt });
    expect(annual.find((r) => r.plan === "plus")?.perMonth).toBe("€10.83");
    const cta = paywallCta({ rows: monthly, selected: "family", cadence: "monthly", isNative: false, platform: "web", t });
    expect(cta.disabled).toBe(false);
    expect(cta.label).toContain("plan=set.plan.family");
    expect(cta.label).toContain("price=€19.99/elev.storeshell.pw.period.month");
  });
});

describe("disclosure — auto-renewal + where to cancel, per platform, EN + HE", () => {
  it("the disclosure key mentions renewal in both languages and carries the period + store slots", () => {
    const k = "elev.storeshell.pw.disclosure";
    expect(shellEn[k]).toMatch(/renews automatically/i);
    expect(shellHe[k]).toContain("מתחדש");
    for (const dict of [shellEn, shellHe]) {
      expect(dict[k]).toContain("{period}");
      expect(dict[k]).toContain("{store}");
    }
  });

  it("names the right store per platform (App Store / Google Play / Settings)", () => {
    expect(storeLabelKey("ios")).toBe("elev.storeshell.store.ios");
    expect(storeLabelKey("android")).toBe("elev.storeshell.store.android");
    expect(storeLabelKey("web")).toBe("elev.storeshell.store.web");
    expect(disclosureText(t, "android", "annual")).toContain("period=elev.storeshell.pw.period.year,store=elev.storeshell.store.android");
  });
});

describe("PaywallModal.tsx wiring (source contract)", () => {
  const modal = stripComments(read("PaywallModal.tsx"));

  it("renders selectable plan rows + ONE primary CTA driven by the pure model", () => {
    expect(modal).toContain('role="radiogroup"');
    expect((modal.match(/role="radio"/g) ?? []).length).toBe(1); // one row template, mapped
    expect(modal).toMatch(/paywallCta\(\{/);
    expect(modal).toMatch(/disabled=\{busy \|\| cta\.disabled\}/);
    expect(modal).toContain("{cta.label}");
    expect(modal).toMatch(/startCheckout\(selected, cadence, "paywall"\)/);
    // exactly one purchase button (the old two competing CTAs are gone)
    expect((modal.match(/startCheckout\(/g) ?? []).length).toBe(1);
  });

  it("shows the disclosure + legal links, and a skeleton while a store price is null", () => {
    expect(modal).toMatch(/disclosureText\(t, nativePlatform, cadence\)/);
    expect(modal).toContain("<LegalLinks");
    expect(modal).toMatch(/row\.price === null \? \(\s*<Skeleton/);
  });

  it("tokens only — no #fff / hex literals (the old CTAs carried color: '#fff')", () => {
    expect(modal.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toEqual([]);
    expect(modal).toContain("var(--arbor-on-accent)");
  });

  it("negative control: the pre-fix pattern is what the hex scan catches", () => {
    expect('style={{ background: "var(--arbor-clay)", color: "#fff" }}'.match(/#[0-9a-fA-F]{3,6}\b/g)).toEqual(["#fff"]);
  });
});

/**
 * B-SHELL-11 — the paywall sells understanding, per trigger. Each of the eight
 * PaywallFeature ids resolves to its OWN body (never the generic `pw.body`),
 * in EN and HE; the Plus list leads with what Arbor remembers; the kept-count
 * line is a plain count, absent at 0.
 */
describe("B-SHELL-11 · one body per trigger, a plain kept count", () => {
  const fill = (raw: string, vars: Record<string, string | number>) =>
    raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  const bodyText = (lang: "en" | "he", feature: string) => {
    const ref = paywallBody(feature);
    const dict = ref.source === "planclarity"
      ? (lang === "he" ? planclarity.he : planclarity.en)[`elev.plan.${ref.key}`]
      : (lang === "he" ? baseHe : baseEn)[ref.key];
    return fill(dict ?? "", { name: lang === "he" ? "מיה" : "Mia" });
  };

  it("enumerates exactly the eight trigger ids", () => {
    expect([...PAYWALL_FEATURES].sort()).toEqual([
      "advancedPlans", "adventureGenerate", "avatarGenerate", "coParentSeats",
      "coach_unlimited", "heroComic", "maxChildren", "professionalReports",
    ]);
  });

  it("every trigger has a non-generic body key; unknown falls back to pw.body", () => {
    for (const f of PAYWALL_FEATURES) expect(paywallBody(f).key, f).not.toBe("pw.body");
    expect(paywallBody(undefined).key).toBe("pw.body");
    expect(paywallBody("somethingNew").key).toBe("pw.body");
    expect(paywallBody("professionalReports")).toEqual({ key: "pw.bodySchoolNotes", source: "planclarity" });
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the eight bodies are present and pairwise distinct, with no % and no stray placeholder`, () => {
      const bodies = PAYWALL_FEATURES.map((f) => bodyText(lang, f));
      for (const [i, b] of bodies.entries()) {
        expect(b.length, PAYWALL_FEATURES[i]).toBeGreaterThan(20);
        expect(b, PAYWALL_FEATURES[i]).not.toMatch(/%|\{\w+\}/);
        if (lang === "he") expect(b).toMatch(/[֐-׿]/);
      }
      expect(new Set(bodies).size).toBe(8);
    });
  }

  it("claim gate: co-parent sharing is free; the child body names six", () => {
    expect(bodyText("en", "coParentSeats")).toMatch(/free on every plan/);
    expect(bodyText("en", "maxChildren")).toMatch(/six/);
    for (const f of PAYWALL_FEATURES) expect(bodyText("en", f)).not.toMatch(/what changed|snapshot/i);
  });

  it("the Plus lead line is plus.1's claim (the daily limit), named through the child", () => {
    expect(baseEn["pw.plusLead"]).toMatch(/remember \{name\}/);
    expect(baseEn["pw.plusLead"]).toMatch(/daily limit/);
    expect(baseHe["pw.plusLead"]).toContain("המכסה היומית");
  });

  const modal = stripComments(read("PaywallModal.tsx"));

  it("the modal renders the per-trigger body through paywallBody", () => {
    expect(modal).toContain("const bodyRef = paywallBody(paywall.feature);");
    expect(modal).not.toMatch(/paywall\.feature === "advancedPlans"/);
  });

  it("Plus lines lead with the remember line, then reports, plans, children", () => {
    const lead = modal.indexOf('t("pw.plusLead", { name })');
    expect(lead).toBeGreaterThan(-1);
    expect(lead).toBeLessThan(modal.indexOf('(["plus.2", "plus.3", "plus.4"] as const)'));
  });

  it("the kept-count line is a plain count of approved memory, hidden at 0", () => {
    expect(modal).toContain("const keptCount = approvedMemoryItems?.length ?? 0;");
    expect(modal).toMatch(/\{keptCount > 0 && \(/);
    for (const dict of [baseEn, baseHe]) {
      for (const k of ["pw.kept.one", "pw.kept.many"]) {
        expect(dict[k]).toBeTruthy();
        expect(dict[k]).not.toMatch(/%|of \{|מתוך/);
      }
    }
    expect(fill(baseEn["pw.kept.many"], { n: 7, name: "Mia" })).toBe("Arbor has kept 7 things about Mia");
  });
});
