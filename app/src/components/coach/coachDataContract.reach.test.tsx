/**
 * F-TALK-1 (review r1) — the weekly-context consent switch is a consent
 * control, so it stays reachable on #/memory while the approved ledger cannot
 * be read. The send path attaches the weekly counts by default (B-ASKJB-07),
 * so hiding the switch behind the ledger gate (a 429 included) would leave the
 * parent no way to turn them off. The weekly notice's "Change" lands on
 * #/memory?section=coach, which must find the switch in every ledger state.
 *
 * While the ledger is unreadable, "What the coach sees" says the approved list
 * cannot be read right now, never "none" (OWN-1). Synthetic profile only.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  error: true,
  errorKind: "rate_limited" as "rate_limited" | "network",
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "reach-child", name: "Alex Example", age: 4, languages: ["English"] },
    approvedMemoryItems: [],
    pendingMemoryItems: [],
    chatMessages: [],
    handleMemoryDecision: vi.fn(),
    isMemoryUpdating: null,
    memoryReviewError: h.error,
    memoryReviewErrorKind: h.errorKind,
    retryMemoryReview: vi.fn(),
    savedLearnIds: [],
    requestLearnRead: vi.fn(),
    setActiveTab: vi.fn(),
  }),
  useArborOptional: () => null,
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: h.lang,
    aiLang: h.lang,
    t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars),
  }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: [], loaded: true, error: false, remote: false, upsert: vi.fn(), remove: vi.fn(), replaceAll: vi.fn() }),
}));
// The weekly notice's "Change" arrives with ?section=coach.
vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams("section=coach"), goToRoute: vi.fn() }));
// Neighbours with their own tests; this file is about the contract's reach.
vi.mock("../describe/KeptDescription", () => ({ default: () => null }));
vi.mock("../sections/FirstsMoment", () => ({ default: () => null }));
vi.mock("../sections/ArborKnowsTile", () => ({ default: () => null }));
vi.mock("../loop/ThingsSaid", () => ({ default: () => null }));
vi.mock("../ui/ContentActionBar", () => ({ ContentWhyLine: () => null }));

import ChildMemory from "../sections/ChildMemory";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8").replace(/\r\n/g, "\n");
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const TOGGLE = 'data-testid="coach-weekly-context-toggle"';
/** The opening tag of the element carrying `marker`. */
const tagAt = (html: string, marker: string) => {
  const at = html.indexOf(marker);
  return html.slice(html.lastIndexOf("<", at), html.indexOf(">", at) + 1);
};

beforeEach(() => {
  h.lang = "en";
  h.error = true;
  h.errorKind = "rate_limited";
});

describe("F-TALK-1 · the weekly switch stays reachable while the ledger is unreadable", () => {
  for (const lang of ["en", "he"] as const) {
    for (const kind of ["rate_limited", "network"] as const) {
      it(`${lang} · ${kind}: the error card AND the switch render; the facts line says "can't be read", never "none"`, () => {
        h.lang = lang;
        h.errorKind = kind;
        const html = renderToStaticMarkup(<ChildMemory />);
        // The honest error card still leads (OWN-1) …
        expect(html).toContain(esc(translate(lang, "err.memory.title", { name: "Alex" })));
        // … the approved list stays suppressed …
        expect(html).not.toContain(esc(translate(lang, "elev.childmem.approved.title")));
        expect(html).not.toContain(esc(translate(lang, "elev.childmem.empty.title")));
        // … and the consent switch is there, a real switch, inside the section
        // ?section=coach scrolls to.
        expect(html).toContain('id="coach-data-contract"');
        expect(html).toContain(TOGGLE);
        const toggle = tagAt(html, TOGGLE);
        expect(toggle.startsWith("<button")).toBe(true);
        expect(toggle).toContain('role="switch"');
        expect(toggle).toContain('type="button"');
        expect(toggle).not.toContain("disabled");
        expect(html.indexOf('id="coach-data-contract"')).toBeLessThan(html.indexOf(TOGGLE));
        // The facts line: out of reach, never "none".
        expect(html).toContain(esc(translate(lang, "elev.memdisc.facts.unreadable")));
        expect(html).not.toContain(esc(translate(lang, "elev.memdisc.facts.none")));
      });
    }
  }

  it("NEGATIVE CONTROL — a readable, empty ledger says 'none' and shows the list, with the same switch", () => {
    h.error = false;
    const html = renderToStaticMarkup(<ChildMemory />);
    expect(html).toContain(TOGGLE);
    expect(html).toContain(esc(translate("en", "elev.childmem.approved.title")));
    expect(html).toContain(esc(translate("en", "elev.memdisc.facts.none")));
    expect(html).not.toContain(esc(translate("en", "elev.memdisc.facts.unreadable")));
  });

  it("the copy exists in both languages, and the Hebrew carries no Latin", () => {
    expect(translate("en", "elev.memdisc.facts.unreadable")).not.toBe("elev.memdisc.facts.unreadable");
    const he = translate("he", "elev.memdisc.facts.unreadable");
    expect(he).not.toBe("elev.memdisc.facts.unreadable");
    expect(he).not.toMatch(/[a-z]/i);
  });
});

describe("F-TALK-1 · ?section=coach focuses the switch, and Change goes there", () => {
  const contract = read("components/coach/CoachDataContract.tsx");
  const memory = read("components/sections/ChildMemory.tsx");
  const coach = read("components/tabs/CoachTab.tsx");

  it("the section param scrolls the section into view and focuses the switch itself", () => {
    expect(contract).toContain('const arrivedForSwitch = useHashQuery().get("section") === "coach";');
    expect(contract).toMatch(/if \(!arrivedForSwitch\) return;\s*sectionRef\.current\?\.scrollIntoView\(\{ block: "start" \}\);\s*switchRef\.current\?\.focus\(\{ preventScroll: true \}\);/);
    const at = contract.indexOf(TOGGLE);
    const button = contract.slice(contract.lastIndexOf("<button", at), at);
    expect(button).toContain("ref={switchRef}");
  });

  it("ChildMemory mounts the contract after the ledger gate closes, inside the approved module", () => {
    const approvedModule = memory.indexOf('<div data-module="memory-approved"');
    const gate = memory.indexOf("{!memoryReviewError && (", approvedModule);
    const mount = memory.indexOf("<CoachDataContract ledgerUnreadable={memoryReviewError} />");
    expect(approvedModule).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(approvedModule);
    expect(mount).toBeGreaterThan(gate);
    // The gate's fragment closes before the mount; the module closes after it.
    expect(memory.lastIndexOf("</>", mount)).toBeGreaterThan(gate);
    expect(memory.indexOf("</div>", mount)).toBeGreaterThan(mount);
  });

  it("the weekly notice's Change lands on #/memory?section=coach", () => {
    expect(coach).toContain('goToRoute("memory", { section: "coach" });');
  });

  it("the Talk panel re-reads the flag when it shows again and whenever the switch writes (this tab or another)", () => {
    const effect = /useEffect\(\(\) => \{\s*const reread = \(\) => \{\s*setWeeklyOn\(readWeeklyContextConsent\(childProfile\.id\)\);\s*setWeeklyNotice\(shouldShowWeeklyContextNotice\(childProfile\.id\)\);\s*\};([\s\S]*?)\}, \[childProfile\.id, visible\]\);/.exec(coach);
    expect(effect, "the weekly re-read effect in CoachTab").toBeTruthy();
    expect(effect![1]).toContain("window.addEventListener(WEEKLY_CONTEXT_CONSENT_EVENT, onConsent);");
    expect(effect![1]).toContain('window.addEventListener("storage", reread);');
    expect(effect![1]).toContain("window.removeEventListener(WEEKLY_CONTEXT_CONSENT_EVENT, onConsent);");
    expect(effect![1]).toContain('window.removeEventListener("storage", reread);');
    // The switch announces its own writes; the panel listens for that name.
    expect(read("ai/chatContext.ts")).toMatch(/window\.dispatchEvent\(new CustomEvent\(WEEKLY_CONTEXT_CONSENT_EVENT, \{ detail: \{ childId \} \}\)\)/);
    // The child-only re-read (stale while the panel stayed mounted) is gone.
    expect(coach).not.toContain("useEffect(() => { setWeeklyOn(readWeeklyContextConsent(childProfile.id)); }, [childProfile.id]);");
  });
});
