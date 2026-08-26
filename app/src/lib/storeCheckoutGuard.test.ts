/**
 * STORE-2 G1 + G3 — structural guards for the native-checkout-absence rule.
 *
 * The native shells bundle the SAME `dist/` as the web app, so a web checkout
 * (Apple 3.1.1 / Play Payments auto-rejection) ships into the binaries the
 * moment any surface bypasses the platform gate. These tests make the gate
 * structural:
 *
 *   G1 — `api.billingCheckout` / `api.billingPortal` (and the raw endpoint
 *        strings) are referenced ONLY by lib/api.ts (definition) and
 *        lib/checkoutActions.ts (the ONE gate). Any new caller fails CI.
 *   G3 — no hosted-checkout hostname (pay.rev.cat / buy.stripe.com /
 *        billing.stripe.com) is hardcoded anywhere in client code; the RC SDK
 *        and Browser plugin are dynamic-import-only (web bundle stays clean);
 *        the dist-level scan script is wired into both native CI workflows.
 *
 * Plus source contracts (node-only harness — same style as PlanBadge.test.ts):
 * the Restore Purchases control is native-gated on both surfaces, billing is
 * configured in the native bootstrap, and the RC identity tracks Firebase auth.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SRC = resolve(process.cwd(), "src");
const read = (p: string) => readFileSync(p, "utf8");
const readSrc = (...parts: string[]) => read(resolve(SRC, ...parts));

/** All client-side source files: src/** minus server-side code and tests. */
const clientFiles = (() => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        // server/, routes/, config/ are server-side (env plumbing + endpoint
        // implementations) — they never execute in the shipped web/native bundle.
        if (name === "server" || name === "routes" || name === "config" || name === "node_modules") continue;
        walk(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name) || /\.test\./.test(name)) continue;
      out.push(p);
    }
  };
  walk(SRC);
  return out;
})();

const rel = (p: string) => relative(SRC, p).replace(/\\/g, "/");

describe("G1 — one structural gate for billing endpoints", () => {
  const ALLOWED = new Set(["lib/api.ts", "lib/checkoutActions.ts"]);

  it("api.billingCheckout / api.billingPortal are referenced only by the gate", () => {
    const offenders = clientFiles
      .filter((p) => /\bbillingCheckout\b|\bbillingPortal\b/.test(read(p)))
      .map(rel)
      .filter((r) => !ALLOWED.has(r));
    expect(offenders, `new billing call sites must go through useCheckout → checkoutActions; found: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the raw /api/billing endpoint strings exist only in the API client", () => {
    const offenders = clientFiles
      .filter((p) => /\/api\/billing\/(checkout|portal)/.test(read(p)))
      .map(rel)
      .filter((r) => r !== "lib/api.ts");
    expect(offenders, `raw billing endpoints outside lib/api.ts: ${offenders.join(", ")}`).toEqual([]);
  });

  it("only checkoutActions assigns window.location.href for billing (no inline redirects on purchase surfaces)", () => {
    for (const file of ["components/layout/SettingsModal.tsx", "components/billing/PaywallModal.tsx", "hooks/useCheckout.ts"]) {
      expect(readSrc(...file.split("/")), `${file} must not navigate directly`).not.toMatch(/window\.location\.href/);
    }
  });
});

describe("G3 — forbidden hosted-checkout targets + bundle hygiene", () => {
  it("no hosted-checkout hostname is hardcoded in client code", () => {
    const forbidden = /pay\.rev\.cat|buy\.stripe\.com|billing\.stripe\.com/;
    const offenders = clientFiles.filter((p) => forbidden.test(read(p))).map(rel);
    expect(offenders, `hosted-checkout URLs are server-issued, web-only: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the RC SDK and Browser plugin are dynamic-import-only (never in the web bundle's static graph)", () => {
    const staticImport = /^\s*import\s+(?!type\b)[^;]*from\s+["']@(revenuecat\/purchases-capacitor|capacitor\/browser)["']/m;
    const offenders = clientFiles.filter((p) => staticImport.test(read(p))).map(rel);
    expect(offenders, `use the native.ts dynamic-import pattern: ${offenders.join(", ")}`).toEqual([]);
  });

  it("the dist-level forbidden-URL scan is wired into both native CI workflows", () => {
    const workflows = resolve(process.cwd(), "..", ".github", "workflows");
    for (const wf of ["android.yml", "ios.yml"]) {
      const p = join(workflows, wf);
      expect(existsSync(p), `${wf} missing`).toBe(true);
      const text = read(p);
      expect(text, `${wf} must run the native-checkout scan after the web build`).toMatch(/native-checkout-scan\.mjs/);
    }
    expect(existsSync(resolve(process.cwd(), "scripts", "native-checkout-scan.mjs"))).toBe(true);
  });
});

describe("source contracts — Restore Purchases + RC identity wiring", () => {
  it("Restore Purchases renders native-only on BOTH purchase surfaces (Apple-required)", () => {
    for (const file of [["components", "layout", "SettingsModal.tsx"], ["components", "billing", "PaywallModal.tsx"]]) {
      const text = readSrc(...file);
      expect(text, `${file.join("/")} must mount the restore control`).toMatch(/set\.plan\.restore/);
      // The control (and only it, among restore mentions) sits behind the native flag.
      expect(text, `${file.join("/")} restore control must be native-gated`).toMatch(/isNative\s*&&/);
    }
  });

  it("restore copy exists EN + HE (two dictionary entries each)", () => {
    const i18n = readSrc("lib", "i18n.ts");
    expect(i18n.match(/"set\.plan\.restore":/g)?.length).toBe(2);
    expect(i18n.match(/"set\.plan\.restoreDone":/g)?.length).toBe(2);
  });

  it("native bootstrap configures billing; auth state syncs the RC App User ID to the Firebase uid", () => {
    expect(readSrc("lib", "native.ts")).toMatch(/configureNativeBilling/);
    expect(readSrc("context", "AuthContext.tsx")).toMatch(/syncNativeBillingUser/);
  });

  it("native prices come from the store product — purchase surfaces never render the EUR constants on native", () => {
    const planPrices = readSrc("components", "billing", "PlanPrices.tsx");
    expect(planPrices).toMatch(/useNativePrices/);
    // The native branch renders before (and returns instead of) the web constants.
    expect(planPrices).toMatch(/if \(isNativePlatform\)/);
  });
});
