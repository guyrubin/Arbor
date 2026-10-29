import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* B-GROWTH-43 — the typed-code path is reachable: the field sits inside the
   Plan card of Settings (no new object), posts `via: "typed"`, and every
   server answer has its own plain line in EN and HE. */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v), uiLang: state.lang }) };
});
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "u1" }, firebaseEnabled: true }) }));
const posted = vi.hoisted(() => [] as unknown[][]);
vi.mock("../../lib/api", () => ({ api: { referralCode: () => Promise.resolve({ code: null }), referralActivate: (...args: unknown[]) => { posted.push(args); return Promise.resolve({ ok: true, status: "granted" }); } } }));
vi.mock("../../lib/loopEvents", () => ({ trackInviteActivated: vi.fn(), hasTrackedFirstPlan: () => false }));

import OfferCodeField, { offerCodeOutcome, offerCodeRoute } from "./OfferCodeField";
import { translate } from "../../lib/i18n";

describe("B-GROWTH-43 · the typed code field", () => {
  it("maps every server answer, and a refused or failed request, to its own line", () => {
    expect(offerCodeOutcome({ ok: true, status: "granted", earnedMonths: 1, periodEnd: "x" })).toBe("granted");
    expect(offerCodeOutcome({ ok: true, status: "maxed", earnedMonths: 5 })).toBe("granted");
    expect(offerCodeOutcome({ ok: true, status: "already_activated" })).toBe("already");
    expect(offerCodeOutcome({ ok: false, status: "unknown_code" })).toBe("unknown");
    expect(offerCodeOutcome({ ok: false, status: "self_referral" })).toBe("self");
    expect(offerCodeOutcome(Object.assign(new Error("Sign in required"), { status: 401 }))).toBe("signin");
    expect(offerCodeOutcome(new Error("network"))).toBe("failed");
  });

  it("routes a code: not a code is refused, no plan holds it, a plan redeems it now", () => {
    expect(offerCodeRoute("hello", true)).toEqual({ route: "refuse", normalized: "HELLO" });
    expect(offerCodeRoute(" arbor-abcd efgh ", false)).toEqual({ route: "hold", normalized: "ARBOR-ABCDEFGH" });
    expect(offerCodeRoute("ABCDEFGH", true)).toEqual({ route: "redeem", normalized: "ARBOR-ABCDEFGH" });
  });

  it("the held receipt says when the code counts, and the button reads the same in HE as the card", () => {
    // Round 4: a promise the code can keep — it is checked at the first plan, not counted.
    expect(translate("en", "set.referral.code.held")).toBe("Code saved. We'll check it when you start your first plan.");
    expect(translate("he", "set.referral.code.held")).toBe("הקוד נשמר. נבדוק אותו כשתתחילו את התוכנית הראשונה שלכם.");
    for (const lang of ["en", "he"] as const) expect(translate(lang, "set.referral.code.held")).not.toMatch(/counts|ייכנס לתוקף/);
    expect(translate("he", "set.referral.code.apply")).toBe("הפעלת הקוד");
    expect(translate("he", "set.referral.code.sub")).toContain("חודש פלוס");
    expect(translate("he", "set.referral.code.granted")).toContain("חודש פלוס");
  });

  it("every line exists in EN and HE, and they differ", () => {
    for (const key of ["label", "sub", "input", "apply", "applying", "granted", "held", "linkSaved", "heldRefused", "already", "unknown", "self", "failed", "signin"]) {
      const k = `set.referral.code.${key}`;
      expect(translate("en", k), k).not.toBe(k);
      expect(translate("he", k), k).not.toBe(k);
      expect(translate("he", k), k).not.toBe(translate("en", k));
    }
  });

  it("renders a labelled 44 px input and button, LTR code in both languages, tokens only", () => {
    for (const lang of ["en", "he"] as const) {
      state.lang = lang;
      const html = renderToStaticMarkup(<OfferCodeField />);
      expect(html).toContain(translate(lang, "set.referral.code.label"));
      expect(html).toMatch(/<input[^>]*min-h-11[^>]*dir="ltr"|<input[^>]*dir="ltr"[^>]*min-h-11/);
      expect(html).toMatch(/<button[^>]*type="submit"[^>]*min-h-11/);
      expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    }
  });

  it("is mounted inside the Plan card, posts via typed, and is hidden from paying families", () => {
    const settings = readFileSync(path.resolve(__dirname, "../layout/SettingsModal.tsx"), "utf8");
    expect(settings).toMatch(/!isPaid && !entitlementLoading && !entitlementUnverified && !codeGranted && \(\s*<OfferCodeField onGranted=\{\(\) => \{ setCodeGranted\(true\); void retryEntitlement\(\); \}\}/);
    expect(settings).toMatch(/codeGranted && \([\s\S]{0,200}t\("set\.referral\.code\.granted"\)/);
    const field = readFileSync(path.resolve(__dirname, "OfferCodeField.tsx"), "utf8");
    // Round 4: "has a plan" is the link path's own test, the device's first generated plan.
    expect(field).toContain("hasPlan: hasTrackedFirstPlan(),");
    expect(field).toContain("ownCode: async () => (await api.referralCode()).code,");
    expect(field).toContain("activate: (c, via) => api.referralActivate(c, via),");
    const api = readFileSync(path.resolve(__dirname, "../../lib/api.ts"), "utf8");
    expect(api).toContain('via ? { code, via } : { code }');
  });
});
