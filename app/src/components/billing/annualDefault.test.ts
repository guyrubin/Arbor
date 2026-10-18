/**
 * B-GA-12 — the paywall and the Settings plan panel default to the ACCEPTED
 * annual choice and quote the same approved annual total; an explicit tap wins
 * thereafter; a failed/missing store offering is a named state, not a
 * perpetual skeleton. Pure model + source-level pins (node-only harness).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_CADENCE, buildPlanRows, paywallCta, offeringGate, disclosureText, type Tr } from "./paywallModel";
import { PLAN_PRICES, formatEur, effectiveMonthlyEur } from "../../lib/pricing";
import { en as baseEn, he as baseHe } from "../../lib/i18n";
import { en as shellEn, he as shellHe } from "../../lib/i18nElevation/storeShell";
import type { NativePriceMap } from "../../lib/nativeBilling";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8");
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const t: Tr = (key, vars) => (vars ? `${key}{${Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(",")}}` : key);
const fmt = (amount: number, code: string) => `${code} ${amount.toFixed(2)}`;
const fill = (raw: string, vars: Record<string, string | number>) => raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

describe("B-GA-12 · annual is the initial cadence on BOTH surfaces", () => {
  const paywall = strip(read("PaywallModal.tsx"));
  const settings = strip(read("../layout/SettingsModal.tsx"));

  it("the ONE default constant is annual", () => {
    expect(DEFAULT_CADENCE).toBe("annual");
  });

  it("PaywallModal and SettingsModal seed cadence from DEFAULT_CADENCE — never a literal", () => {
    for (const [name, src] of [["PaywallModal", paywall], ["SettingsModal", settings]] as const) {
      expect(src, name).toMatch(/useState<Cadence>\(DEFAULT_CADENCE\)/);
      expect(src, name).not.toMatch(/useState<[^>]*>\("monthly"\)/);
      expect(src, name).not.toMatch(/useState<[^>]*>\("annual"\)/);
    }
  });

  it("explicit user choice wins: nothing resets cadence on open or on a store answer", () => {
    // setCadence is called from the toggle buttons only (one template per surface).
    for (const [name, src] of [["PaywallModal", paywall], ["SettingsModal", settings]] as const) {
      const calls = src.match(/setCadence\(/g) ?? [];
      expect(calls.length, `${name} setCadence call sites`).toBe(1);
      expect(src, name).toMatch(/onClick=\{\(\) => setCadence\(c\)\}/);
    }
  });

  it("NEGATIVE CONTROL: the pre-fix seed is what the pin rejects", () => {
    expect('useState<Cadence>("monthly")').toMatch(/useState<[^>]*>\("monthly"\)/);
  });
});

describe("B-GA-12 · both surfaces quote the same approved annual total (web)", () => {
  it("Plus annual is €129.90, shown as €10.83/month on both surfaces", () => {
    expect(PLAN_PRICES.plus.annualEur).toBe(129.9);
    expect(formatEur(PLAN_PRICES.plus.annualEur)).toBe("€129.90");
    expect(formatEur(effectiveMonthlyEur("plus"))).toBe("€10.83");
    // Paywall row (paywallModel over lib/pricing)
    const row = buildPlanRows({ isNative: false, nativePrices: null, cadence: DEFAULT_CADENCE, fmtCurrency: fmt }).find((r) => r.plan === "plus")!;
    expect(row.price).toBe("€129.90");
    expect(row.perMonth).toBe("€10.83");
    // Settings line (PlanPrices over the same constant), EN + HE
    const vars = { plan: "Plus", price: "€10.83", total: "€129.90" };
    expect(fill(baseEn["set.plan.price.perMonthAnnual"], vars)).toBe("Plus — €10.83/month, billed yearly (€129.90)");
    expect(fill(baseHe["set.plan.price.perMonthAnnual"], vars)).toContain("€129.90");
    expect(fill(baseHe["set.plan.price.perMonthAnnual"], vars)).toContain("€10.83");
  });

  it("the paywall CTA and renewal disclosure both say yearly for the default cadence", () => {
    const rows = buildPlanRows({ isNative: false, nativePrices: null, cadence: DEFAULT_CADENCE, fmtCurrency: fmt });
    const cta = paywallCta({ rows, selected: "plus", cadence: DEFAULT_CADENCE, isNative: false, platform: "web", t });
    expect(cta.disabled).toBe(false);
    expect(cta.label).toContain("price=€129.90/elev.storeshell.pw.period.year");
    expect(disclosureText(t, "web", DEFAULT_CADENCE)).toContain("period=elev.storeshell.pw.period.year");
  });

  it("no trial length is stated on either upgrade surface (open decision — not this row's)", () => {
    for (const k of ["set.plan.price.perMonthAnnual", "set.plan.price.perMonth", "set.plan.cancelAnytime", "set.plan.plusPitch"]) {
      expect(baseEn[k]).not.toMatch(/\b\d+[- ]day\b/i);
    }
    for (const k of ["elev.storeshell.pw.cta", "elev.storeshell.pw.disclosure"]) expect(shellEn[k]).not.toMatch(/\b\d+[- ]day\b/i);
  });
});

describe("B-GA-12 · failed / missing offering is a named state, EN + HE", () => {
  const STORE: NativePriceMap = { plus: { annual: { priceString: "₪499.00", amount: 499, currencyCode: "ILS" } }, family: {} };

  it("the pricesUnavailable key exists in both languages and names the store", () => {
    for (const dict of [shellEn, shellHe]) {
      expect(dict["elev.storeshell.pw.pricesUnavailable"]).toBeTruthy();
      expect(dict["elev.storeshell.pw.pricesUnavailable"]).toContain("{store}");
    }
    expect(shellHe["elev.storeshell.pw.pricesUnavailable"]).toMatch(/[֐-׿]/);
  });

  it("paywall CTA: loading → pricesLoading (aria-busy); unavailable → pricesUnavailable (not busy); both disabled", () => {
    const rows = buildPlanRows({ isNative: true, nativePrices: null, cadence: DEFAULT_CADENCE, fmtCurrency: fmt });
    const loading = paywallCta({ rows, selected: "plus", cadence: DEFAULT_CADENCE, isNative: true, platform: "ios", t, status: "loading" });
    expect(loading).toMatchObject({ disabled: true, loading: true });
    expect(loading.label).toContain("elev.storeshell.pw.pricesLoading");
    const gone = paywallCta({ rows, selected: "plus", cadence: DEFAULT_CADENCE, isNative: true, platform: "android", t, status: "unavailable" });
    expect(gone).toMatchObject({ disabled: true, loading: false });
    expect(gone.label).toContain("elev.storeshell.pw.pricesUnavailable{store=elev.storeshell.store.android}");
    // with a price the status is irrelevant
    const ready = buildPlanRows({ isNative: true, nativePrices: STORE, cadence: DEFAULT_CADENCE, fmtCurrency: fmt });
    expect(paywallCta({ rows: ready, selected: "plus", cadence: DEFAULT_CADENCE, isNative: true, platform: "ios", t, status: "ready" }).disabled).toBe(false);
  });

  it("settings gate: web never blocks; native blocks without a price for THIS cadence and names loading vs unavailable", () => {
    expect(offeringGate({ isNative: false, status: "web", nativePrices: null, plan: "plus", cadence: "annual", platform: "web", t })).toEqual({ blocked: false, notice: null });
    expect(offeringGate({ isNative: true, status: "ready", nativePrices: STORE, plan: "plus", cadence: "annual", platform: "ios", t })).toEqual({ blocked: false, notice: null });
    const monthlyMissing = offeringGate({ isNative: true, status: "ready", nativePrices: STORE, plan: "plus", cadence: "monthly", platform: "ios", t });
    expect(monthlyMissing.blocked).toBe(true);
    expect(monthlyMissing.notice).toContain("pricesLoading");
    const gone = offeringGate({ isNative: true, status: "unavailable", nativePrices: null, plan: "plus", cadence: "annual", platform: "ios", t });
    expect(gone.blocked).toBe(true);
    expect(gone.notice).toContain("elev.storeshell.pw.pricesUnavailable{store=elev.storeshell.store.ios}");
  });

  it("SettingsModal wires the gate to the upgrade button and the notice; the hook resolves a status", () => {
    const settings = strip(read("../layout/SettingsModal.tsx"));
    expect(settings).toMatch(/const offer = offeringGate\(\{[^}]*cadence/);
    expect(settings).toMatch(/disabled=\{busy \|\| offer\.blocked\}/);
    expect(settings).toContain('data-testid="offering-notice"');
    const hook = strip(read("../../hooks/useNativePrices.ts"));
    expect(hook).toContain('status: "unavailable"');
    expect(hook).toContain('status: "loading"');
    const paywall = strip(read("PaywallModal.tsx"));
    expect(paywall).toMatch(/status: offeringStatus/);
  });
});
