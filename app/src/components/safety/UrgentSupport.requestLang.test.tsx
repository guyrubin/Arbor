/**
 * B-ASKJB-49 — the crisis card a parent sees when the server's crisis screen
 * answered 409. UrgentSupport with `requestLang` renders Safety's own line
 * selection for the request's language (safety/safetyLines careSafetyLines):
 * tel: links, EN and HE, the danger line, an optional lead, and the door to
 * Safety (by-country when the family's region has no talk line). Without the
 * prop the onboarding default is unchanged (its own pins live in
 * auth/onboardingReady.test.tsx). Synthetic data only.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";

const harness = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../context/LanguageContext")>()),
  useLanguage: () => ({ uiLang: harness.lang, t: (k: string, v?: Record<string, string | number>) => translate(harness.lang as UiLang, k, v) }),
}));

import { UrgentSupport } from "./UrgentSupport";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  harness.lang = "en";
  (globalThis as unknown as { localStorage: Pick<Storage, "getItem" | "setItem"> }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  };
});

const escapeHtml = (text: string) => renderToStaticMarkup(<span>{text}</span>).slice(6, -7);
const tels = (html: string) => [...html.matchAll(/href="(tel:[^"]+)"/g)].map((m) => m[1]);
const card = (lang: "en" | "he", requestLang: string, extra: Partial<React.ComponentProps<typeof UrgentSupport>> = {}) => {
  harness.lang = lang;
  return renderToStaticMarkup(<UrgentSupport testId="x-crisis" requestLang={requestLang} lead={translate(lang, "elev.safety.paused")} onSafety={() => {}} {...extra} />);
};

describe("B-ASKJB-49 — the 409 crisis card, in the request's language", () => {
  it("HE request: ERAN 1201 to talk and MDA 101 for an emergency, the lead, the danger line, the door to Safety", () => {
    const html = card("he", "he");
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-request-lang="he"');
    expect(tels(html).sort()).toEqual(["tel:101", "tel:1201"]);
    expect(html).toContain(escapeHtml(translate("he", "elev.safety.paused")));
    expect(html).toContain(escapeHtml(translate("he", "elev.safety.crisis.danger")));
    expect(html).toContain(escapeHtml(translate("he", "elev.safety.open")));
    // The developmental re-check note belongs to onboarding, not to a 409.
    expect(html).not.toContain(escapeHtml(translate("he", "screen.safetyNote")));
  });

  it("EN request, no market: the EU emergency number, never a foreign country's talk line, and the by-country door", () => {
    const html = card("en", "en");
    expect(tels(html)).toEqual(["tel:112"]);
    expect(html).not.toContain("tel:1201");
    expect(html).toContain(escapeHtml(translate("en", "elev.safety.crisis.findLine")));
  });

  it("an NL family on an English interface: 112 and 113 Suicide Prevention", () => {
    store.set("arbor.attribution", JSON.stringify({ market: "nl", source: "direct" }));
    expect(tels(card("en", "en")).sort()).toEqual(["tel:08000113", "tel:112"]);
  });

  it("every call and the door are ≥44 px targets; no microphone control", () => {
    const html = card("he", "he");
    for (const a of html.match(/<a [^>]*>/g) ?? []) expect(a).toMatch(/min-h-11/);
    expect(html).toMatch(/<button type="button" data-testid="x-crisis-safety" class="[^"]*min-h-11/);
    expect(html).not.toMatch(/\bmic\b|listen/i);
  });

  it("no verdict words, no counts, no diagnosis in the lead (EN and HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const lead = translate(lang, "elev.safety.paused");
      expect(lead.length).toBeGreaterThan(20);
      expect(lead).not.toMatch(/\d|%|high|low|risk|severe|disorder|depress|ADHD|autis|סיכון|חמור|הפרעה|דיכאון/i);
    }
  });

  it("without requestLang the onboarding default is unchanged (negative control for the old render)", () => {
    harness.lang = "en";
    const html = renderToStaticMarkup(<UrgentSupport />);
    expect(tels(html)).toEqual(["tel:1201", "tel:101", "tel:100", "tel:118"]);
    expect(html).toContain(escapeHtml(translate("en", "screen.safetyNote")));
    expect(html).not.toContain("data-request-lang");
  });
});
