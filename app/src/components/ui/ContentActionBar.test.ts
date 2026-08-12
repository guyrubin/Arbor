/**
 * Masterplan 4.2 + 3.1 — the shared ContentActionBar.
 *
 *  1) Verb-canon behavior (pure, imported from i18nElevation/actionbar):
 *     canonical order is invariant regardless of caller prop order, optional
 *     verbs simply don't render, duplicates dedupe first-wins.
 *  2) actionbar i18n parity + firewall (no grade/efficacy language).
 *  3) Component source contracts (repo runs vitest in node, no jsdom — same
 *     style as TrustPanel.test.ts / PlanBadge.test.ts): ordering goes through
 *     the shared helper, analytics fires track("contentaction",{verb,surface}),
 *     aria-pressed on toggles, ≥44px targets, RTL-logical dividers, why-line
 *     slot with TrustLink mounted AFTER the why text, no raw hex (PLAT-6).
 *  4) LearnLibrary migration: BOTH pre-existing save shapes route through the
 *     bar, and EVERY pre-migration affordance/handler is still reachable
 *     (UC-1 zero regression), incl. the W2 continuation why-line variant.
 *  5) CourseCard migration: paired lozenges → bar (done + ask extra), same
 *     handlers.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CONTENT_ACTION_ORDER,
  orderContentActions,
  actionbarText,
  verbLabel,
  en,
  he,
  type ContentActionVerb,
} from "../../lib/i18nElevation/actionbar";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(here, ...p), "utf8");

const bar = read("ContentActionBar.tsx");
const learn = read("..", "sections", "LearnLibrary.tsx");
const course = read("..", "overview", "CourseCard.tsx");

const A = (verb: ContentActionVerb) => ({ verb, onClick: () => {} });

/* ── 1. Verb canon ─────────────────────────────────────────────────────── */

describe("verb canon — fixed set, fixed order", () => {
  it("the canonical order is done · save · rate · share · more", () => {
    expect([...CONTENT_ACTION_ORDER]).toEqual(["done", "save", "rate", "share", "more"]);
  });

  it("ORDER-INVARIANCE: any caller prop order yields canonical order", () => {
    const shuffles: ContentActionVerb[][] = [
      ["more", "share", "rate", "save", "done"],
      ["share", "done", "more", "rate", "save"],
      ["rate", "more", "done", "save", "share"],
    ];
    for (const order of shuffles) {
      expect(orderContentActions(order.map(A)).map((a) => a.verb)).toEqual([
        "done", "save", "rate", "share", "more",
      ]);
    }
  });

  it("optional verbs: unsupported verbs are simply absent, order still canonical", () => {
    expect(orderContentActions([A("share"), A("done")]).map((a) => a.verb)).toEqual(["done", "share"]);
    expect(orderContentActions([A("more")]).map((a) => a.verb)).toEqual(["more"]);
    expect(orderContentActions([])).toEqual([]);
  });

  it("duplicate verb declarations dedupe — first occurrence wins, one slot per verb", () => {
    const first = { verb: "save" as const, onClick: () => {}, tag: "first" };
    const second = { verb: "save" as const, onClick: () => {}, tag: "second" };
    const out = orderContentActions([second, A("done"), first] as const);
    // Canonical order puts done first; among the two saves, the earliest in
    // the caller array is kept.
    expect(out.map((a) => a.verb)).toEqual(["done", "save"]);
    expect((out[1] as typeof second).tag).toBe("second");
  });
});

/* ── 2. actionbar strings ──────────────────────────────────────────────── */

describe("i18nElevation/actionbar — parity + firewall", () => {
  it("EN and HE expose identical key sets, all elev.actionbar.*, non-empty", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
    for (const [key, value] of [...Object.entries(en), ...Object.entries(he)]) {
      expect(key.startsWith("elev.actionbar."), key).toBe(true);
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("HE values are real Hebrew (transcreated, never copied EN)", () => {
    for (const [k, v] of Object.entries(he)) {
      expect(/[א-ת]/.test(v), `HE value for "${k}" has no Hebrew: "${v}"`).toBe(true);
    }
  });

  it("every canonical verb has a default label in both languages", () => {
    for (const verb of CONTENT_ACTION_ORDER) {
      expect(en[`elev.actionbar.${verb}`], verb).toBeTruthy();
      expect(he[`elev.actionbar.${verb}`], verb).toBeTruthy();
    }
  });

  it("FIREWALL: no grade/verdict/efficacy language in any label", () => {
    for (const value of [...Object.values(en), ...Object.values(he)]) {
      expect(value).not.toMatch(/%|\bscore\b|\bgrade\b|\bimproved\b|\bproven\b|\beffective\b|\bon track\b/i);
      expect(value).not.toMatch(/ציון|השתפר|הוכח|יעיל/);
    }
  });

  it("verbLabel: save flips to Saved when active; other verbs are state-stable", () => {
    expect(verbLabel("save", false, false)).toBe(en["elev.actionbar.save"]);
    expect(verbLabel("save", false, true)).toBe(en["elev.actionbar.saved"]);
    expect(verbLabel("save", true, true)).toBe(he["elev.actionbar.saved"]);
    expect(verbLabel("done", false, true)).toBe(en["elev.actionbar.done"]);
  });

  it("actionbarText: missing key resolves to the key itself (app convention)", () => {
    expect(actionbarText("elev.actionbar.nope", false)).toBe("elev.actionbar.nope");
    expect(actionbarText("elev.actionbar.share", true)).toBe(he["elev.actionbar.share"]);
  });
});

/* ── 3. Component source contracts ─────────────────────────────────────── */

describe("ContentActionBar.tsx — source contracts (node env, no DOM)", () => {
  it("renders via the shared ordering helper — caller prop order can never leak", () => {
    expect(bar).toContain("orderContentActions(actions)");
    // No local re-sort that could drift from the canon.
    expect(bar).not.toMatch(/\.sort\(/);
  });

  it('fires track("contentaction", { verb, surface }) on every press, extras included', () => {
    expect(bar).toContain('track("contentaction", { verb: item.verb, surface })');
    // One shared press path for canonical verbs AND extras (both map into items).
    expect(bar.indexOf("...orderContentActions(actions)")).toBeGreaterThan(-1);
    expect(bar.indexOf("...extras.map")).toBeGreaterThan(bar.indexOf("orderContentActions(actions)"));
  });

  it("extras render AFTER the canonical verbs (canon never re-orders around them)", () => {
    const items = bar.slice(bar.indexOf("const items: Item[]"));
    expect(items.indexOf("...extras.map")).toBeGreaterThan(items.indexOf("orderContentActions(actions)"));
  });

  it("aria-pressed on toggles: any action declaring `active` reports pressed state", () => {
    expect(bar).toContain("aria-pressed={item.active === undefined ? undefined : item.active}");
  });

  it("targets ≥44px in both variants (inline 44px round, bar ≥60px segments)", () => {
    expect(bar).toContain("w-11 h-11");
    expect(bar).toContain("min-h-[60px]");
  });

  it("RTL-safe: logical divider property, no physical left/right border", () => {
    expect(bar).toContain("borderInlineStart");
    expect(bar).not.toMatch(/border-l-|border-r-|borderLeft|borderRight/);
  });

  it("why-line slot: ContentWhyLine exported, TrustLink mounts AFTER the why text, surface passed through", () => {
    expect(bar).toContain("export function ContentWhyLine");
    const whySlot = bar.slice(bar.indexOf("export function ContentWhyLine"));
    const whySpan = whySlot.indexOf('<span dir="auto">{why}</span>');
    const trust = whySlot.indexOf("<TrustLink surface={surface} />");
    expect(whySpan).toBeGreaterThan(-1);
    expect(trust).toBeGreaterThan(whySpan);
    // TrustLink is opt-in per surface.
    expect(whySlot).toContain("{trustLink && <TrustLink");
  });

  it("motion-reduce guards on the press micro-interaction", () => {
    expect(bar).toContain("motion-reduce:transform-none");
  });

  it("kit tokens only — no raw hex literal (holds the PLAT-6 ratchet)", () => {
    expect(bar.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g) ?? []).toEqual([]);
    expect(bar).toContain("var(--arbor-");
  });
});

/* ── 4. LearnLibrary migration — UC-1 zero regression ──────────────────── */

describe("LearnLibrary — both save shapes route through the shared bar", () => {
  it("imports the shared bar + why-line slot", () => {
    expect(learn).toContain('from "../ui/ContentActionBar"');
  });

  it("card-level save = the bar's compact variant; reader = the segmented bar", () => {
    expect(learn).toContain('variant="inline"');
    expect(learn).toContain('surface="learn-card"');
    expect(learn).toContain('variant="bar"');
    expect(learn).toContain('surface="learn-reader"');
  });

  it("the two old incompatible save shapes are gone (no hand-rolled ReaderAction, no bespoke bookmark button)", () => {
    expect(learn).not.toContain("function ReaderAction");
    expect(learn).not.toContain("grid-cols-4");
    // The bookmark toggle no longer hand-rolls its own <button aria-pressed>.
    expect(learn).not.toMatch(/aria-pressed=\{saved\}/);
  });

  it("AFFORDANCE PRESERVATION: every pre-migration handler is still reachable", () => {
    // Grid card: open + save toggle.
    expect(learn).toContain('track("learn_open_card"');
    expect(learn).toContain("onToggleSave");
    expect(learn).toContain("toggleSavedLearn");
    // Reader: back · save · listen · share · ask · add-to-today · pulse ±1.
    expect(learn).toContain("onBack");
    expect(learn).toContain("voice.toggle(listenText)");
    expect(learn).toContain('track("learn_listen"');
    expect(learn).toContain("navigator.share");
    expect(learn).toContain('track("learn_share"');
    expect(learn).toContain("seedCoach");
    expect(learn).toContain("onAddToday");
    expect(learn).toContain("acceptTodayAction");
    expect(learn).toContain('track("learn_add_today"');
    expect(learn).toContain("onPulse(1)");
    expect(learn).toContain("onPulse(-1)");
    expect(learn).toContain('track("learn_pulse"');
    // Listen stays gated on voice support; share keeps the copied fallback.
    expect(learn).toContain("voice.supported");
    expect(learn).toContain('t("learn.copied")');
    // In-context "add to today" CTA retained in the try-today section.
    expect(learn).toContain("disabled={todayTaken}");
  });

  it("why-lines moved into the shared slot with TrustLink ON (masterplan 3.1)", () => {
    expect(learn).toContain("<ContentWhyLine");
    expect(learn).toContain('surface="learn-rail"');
    expect(learn).toContain("trustLink");
    // The honest why-line variants all survive…
    for (const key of ["learn.whyFullLogs", "learn.whyFull", "learn.whyAgeLogs", "learn.whyAge"]) {
      expect(learn).toContain(key);
    }
    // …and the W2 continuation variant keeps working (also pinned by
    // learnLibrary.test.ts).
    expect(learn).toContain('continueText("elev.continue.learn.why"');
    expect(learn).toContain("savedBoosted");
    expect(learn).toContain("continuesSaved");
  });
});

/* ── 5. CourseCard migration ───────────────────────────────────────────── */

describe("CourseCard — paired lozenges → shared bar", () => {
  it("mounts the bar with the done verb + ask extra, same handlers", () => {
    expect(course).toContain('from "../ui/ContentActionBar"');
    expect(course).toContain('surface="course-activity"');
    expect(course).toContain('verb: "done"');
    expect(course).toContain("onToggle(a.id)");
    expect(course).toContain("onCoach(a)");
  });

  it("copy is unchanged (play.did / play.added / play.coach)", () => {
    expect(course).toContain('t("play.did")');
    expect(course).toContain('t("play.added", { name: childName })');
    expect(course).toContain('t("play.coach")');
  });

  it("the old bespoke lozenge chrome is gone; the row checkbox toggle survives", () => {
    expect(course).not.toContain("var(--arbor-gradient-primary)");
    expect(course).not.toContain("var(--arbor-clay-glow)");
    // The per-row done circle (aria-pressed) is a separate, preserved affordance.
    expect(course).toContain("aria-pressed={done}");
  });
});
