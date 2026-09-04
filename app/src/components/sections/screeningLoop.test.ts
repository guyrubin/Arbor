/* GP-11 / GP-12 / GP-34 — the Development Check, from the parent's side.
 *
 * Renders the REAL ScreeningFlow (static markup, node env) with the app
 * contexts stubbed, and asserts on what a parent would see:
 *
 *  GP-11 · a calm result offers somewhere to go (it used to end at
 *          "remind me" / "Retake"), the intro no longer says "flagged", and a
 *          restored draft announces itself.
 *  GP-12 · the answer chips are 44px (they were px-3 py-1.5, ~30px).
 *  GP-34 · an uncertain answer becomes one concrete thing to watch for.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AGE_BANDS } from "../../lib/screening";
import { screeningDraftKey } from "../../lib/screeningDraft";
import type { Milestone } from "../../types";

const band = AGE_BANDS.find((b) => b.id === "1-2")!;
const langItem = band.items.find((i) => i.domain === "language_communication")!;

const milestone = {
  id: "lang-1", domain: "language_communication", title: "Says two words together",
  description: "d", checked: false, ageMonths: 18,
} as Milestone;

const state = {
  childProfile: { id: "c1", name: "Noa Levi", age: 1, birthDate: "2025-03-01", ageMonths: 18 },
  milestones: [milestone] as Milestone[],
  behaviorLogs: [] as unknown[],
  setActiveTab: vi.fn(),
  items: [] as Record<string, unknown>[],
};

vi.mock("../../context/ArborContext", () => ({ useArbor: () => state }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    // Interpolating shim: the real translate() substitutes {vars}, and the
    // "flagged" wording this test is about arrives as a {status} var.
    t: (k: string, vars?: Record<string, unknown>) => (vars ? `${k}|${Object.values(vars).join("|")}` : k),
    uiLang: "en",
  }),
}));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: () => ({ items: state.items, upsert: vi.fn(), remove: vi.fn(), loading: false }),
}));
vi.mock("../../hooks/useMonitoring", () => ({
  useMonitoring: () => ({ elevated: false, watchAreas: [], domains: [] }),
}));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  motion: new Proxy({}, {
    get: (_t, tag: string) => ({ children, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => {
      const { initial, animate, exit, transition, whileTap, whileHover, layout, ...safe } = rest as Record<string, unknown>;
      void initial; void animate; void exit; void transition; void whileTap; void whileHover; void layout;
      return React.createElement(tag, safe, children);
    },
  }),
}));

/** In-memory sessionStorage/localStorage for the node env. */
function installStorage() {
  const make = () => {
    const map = new Map<string, string>();
    return {
      get length() { return map.size; },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    } as Storage;
  };
  vi.stubGlobal("sessionStorage", make());
  vi.stubGlobal("localStorage", make());
}

const render = async () => {
  const { ScreeningFlow } = await import("./Screening");
  return renderToStaticMarkup(React.createElement(ScreeningFlow));
};

beforeEach(() => {
  installStorage();
  state.items = [];
  state.milestones = [{ ...milestone }];
});

describe("GP-12 — the answer chips are tappable", () => {
  it("the questions phase renders 44px controls, not ~30px chips", async () => {
    // The intro renders first; the chips live behind the start button, so scan
    // the source of truth the same way the shipped guard tests do — plus a
    // negative control proving the old shape would have been caught.
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("./Screening.tsx", import.meta.url), "utf8");
    const chipBlock = src.slice(src.indexOf("ANSWERS.map"), src.indexOf("ANSWERS.map") + 900);
    expect(chipBlock).toContain("min-h-11");
    expect(chipBlock).not.toContain("py-1.5");
    // NEGATIVE CONTROL: the pre-change className would fail both assertions.
    const before = 'className="px-3 py-1.5 rounded-full text-xs font-bold transition"';
    expect(before).not.toContain("min-h-11");
    expect(before).toContain("py-1.5");
  });
});

describe("GP-11 — the intro no longer grades the last check", () => {
  it("a previous elevated check reads 'worth a conversation', never 'flagged'", async () => {
    state.items = [{
      id: "s1", answeredAt: "2026-08-20T10:00:00.000Z", elevated: true,
      watchAreas: [{ domain: "language_communication" }], domains: [],
    }];
    const html = await render();
    expect(html).toContain("1 area worth a conversation");
    expect(html).not.toContain("screen.last.flagged");
  });

  it("NEGATIVE CONTROL: the calm branch is untouched", async () => {
    state.items = [{ id: "s1", answeredAt: "2026-08-20T10:00:00.000Z", elevated: false, watchAreas: [], domains: [] }];
    const html = await render();
    expect(html).toContain("screen.last.calm");
  });
});

describe("GP-11 — a restored draft announces itself", () => {
  it("answers written before a reload come back, selected, with a way to start over", async () => {
    sessionStorage.setItem(
      screeningDraftKey("c1", band.id),
      JSON.stringify({ answers: { [langItem.id]: "sometimes" }, savedAt: "2026-09-04T00:00:00.000Z" }),
    );
    const html = await render();
    // The parent lands back ON the questions, not on the intro with a hidden draft.
    expect(html).toContain("screen.item." + langItem.id);
    expect(html).toContain('data-testid="screen-draft-restored"');
    expect(html).toContain("Your answers from earlier are still here.");
    // …and the answer is really re-selected: the "sometimes" chip carries the
    // selected fill, the "yes" chip does not.
    const row = html.slice(html.indexOf("screen.item." + langItem.id));
    const sometimes = row.slice(0, row.indexOf("screen.answer.not_yet"));
    const selectedFill = "var(--arbor-green-soft)";
    expect(sometimes.slice(sometimes.indexOf("screen.answer.sometimes") - 300, sometimes.indexOf("screen.answer.sometimes"))).toContain(selectedFill);
    expect(sometimes.slice(sometimes.indexOf("screen.answer.yes") - 300, sometimes.indexOf("screen.answer.yes"))).not.toContain(selectedFill);
  });

  it("NEGATIVE CONTROL: no draft, no notice — and the flow starts at the intro", async () => {
    const html = await render();
    expect(html).not.toContain('data-testid="screen-draft-restored"');
    expect(html).toContain("screen.introTitle");
  });

  it("NEGATIVE CONTROL: another child's draft is not restored", async () => {
    sessionStorage.setItem(
      screeningDraftKey("someone-else", band.id),
      JSON.stringify({ answers: { [langItem.id]: "sometimes" }, savedAt: "x" }),
    );
    const html = await render();
    expect(html).not.toContain('data-testid="screen-draft-restored"');
  });
});

describe("GP-11 / GP-34 — the result screen has somewhere to go", () => {
  it("the uncertain answer the parent gave maps to a real, named thing to watch for", async () => {
    // The result phase is entered by a tap, which static markup cannot do; the
    // OFFER derivation the branch renders is asserted directly, against the
    // same band and the same live record the component passes it.
    const { watchOffersForScreening } = await import("../../lib/screeningWatch");
    const answers = Object.fromEntries(
      band.items.map((i) => [i.id, i.id === langItem.id ? "sometimes" : "yes"]),
    ) as never;
    const offers = watchOffersForScreening(band.items, answers, state.milestones, 18);
    expect(offers).toHaveLength(1);
    expect(offers[0].milestone.title).toBe("Says two words together");
    expect(offers[0].item.id).toBe(langItem.id);

    // NEGATIVE CONTROL: all-yes answers offer nothing, so the block is not a
    // permanent fixture on every result screen.
    const allYes = Object.fromEntries(band.items.map((i) => [i.id, "yes"])) as never;
    expect(watchOffersForScreening(band.items, allYes, state.milestones, 18)).toHaveLength(0);
  });

  it("the calm branch and the watch offers are wired to the result phase, not dead code", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("./Screening.tsx", import.meta.url), "utf8");
    const resultBranch = src.slice(src.indexOf('phase === "result"'));
    // GP-11: a calm result now offers a next move.
    expect(resultBranch).toContain("!result.elevated");
    expect(resultBranch).toContain('data-testid="screen-calm-next"');
    // GP-34: the watch offers render, and choosing one books the re-check.
    expect(resultBranch).toContain('data-testid="screen-watch-offers"');
    expect(src).toContain("if (!reminderDueAt) remind();");
    // NEGATIVE CONTROL: before the change the result branch had neither.
    const before = `{result.elevated && (<><button onClick={() => routeTo("reports")}/></>)}`;
    expect(before).not.toContain("!result.elevated");
    expect(before).not.toContain("screen-watch-offers");
  });
});
