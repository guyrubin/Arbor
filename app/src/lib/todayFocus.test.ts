import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { focusHeadlineFrom, focusHeadlineFor, focusBodyFor, whyLineFor, whyLineParts } from "./todayFocus";
import { en, he, translate } from "./i18n";

/**
 * Next-level Wave-1 (TODAY hub) pins — TODAY-1, CODEX-2, CODEX-3, TODAY-4.
 *
 * TODAY-1  — the ov.recoEmpty marketing fallback can never be persisted via
 *            acceptTodayAction (unreachable when focus is null) nor injected
 *            into the next focus prompt.
 * CODEX-2  — no keyword-override branch: the headline ALWAYS derives from
 *            focus.text; greeting is time-of-day aware via i18n. Firewall
 *            CONDITION: useTodaysFocus's verdict-strip (no avg-intensity /
 *            milestone-% fed to the model) stays pinned, and the format scrub
 *            provably applies to the rendered headline.
 * CODEX-3  — the 2.6MB Today hero PNG is gone; a <=120KB WebP replaces it.
 * TODAY-4  — the documented mobile sticky capture bar actually exists.
 *
 * Source-based (like clinicalFirewall.wave3.test.ts) so re-wiring is caught
 * at CI time; the scrub itself is a pure function unit-tested directly.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");

describe("focusHeadlineFrom — pure scrub (CODEX-2 firewall condition)", () => {
  it("returns null when there is no real AI focus (day-0 / failed fetch)", () => {
    expect(focusHeadlineFrom(undefined)).toBeNull();
    expect(focusHeadlineFrom(null)).toBeNull();
    expect(focusHeadlineFrom("")).toBeNull();
    expect(focusHeadlineFrom("   ")).toBeNull();
  });

  it("keeps only the first sentence of the model text", () => {
    expect(focusHeadlineFrom("Try a two-minute warning before leaving the park. It gives Mia time to finish."))
      .toBe("Try a two-minute warning before leaving the park.");
  });

  it("scrubs the numbered-heading prefix and severity markers", () => {
    expect(focusHeadlineFrom("1. What May Be Happening - (high): Name the feeling before the request."))
      .toBe("Name the feeling before the request.");
  });

  it("scrubs evidence tails", () => {
    expect(focusHeadlineFrom("Offer a choice at bedtime Evidence: parent logged 4 bedtime moments"))
      .toBe("Offer a choice at bedtime");
  });

  it("clamps to 150 chars with an ellipsis", () => {
    const long = `Try ${"a very ".repeat(40)}long focus without sentence punctuation`;
    const out = focusHeadlineFrom(long)!;
    expect(out.length).toBeLessThanOrEqual(150);
    expect(out.endsWith("…")).toBe(true);
  });

  // TODAY-5/PLAT-4 — the artifact scrub is language-aware: Hebrew model output
  // gets the SAME strip + clamp as English (no canned override may return).
  it("scrubs the Hebrew numbered-heading prefix and severity markers", () => {
    expect(focusHeadlineFrom("1. מה אולי קורה - (גבוה): קראו לרגש לפני הבקשה."))
      .toBe("קראו לרגש לפני הבקשה.");
  });

  it("scrubs Hebrew evidence tails", () => {
    expect(focusHeadlineFrom("הציעו בחירה בשעת השינה מבוסס על 4 רגעים שתועדו"))
      .toBe("הציעו בחירה בשעת השינה");
    expect(focusHeadlineFrom("נסו אזהרת מעבר של שתי דקות ראיות: ההורה תיעד 3 מעברים"))
      .toBe("נסו אזהרת מעבר של שתי דקות");
  });

  it("clamps a Hebrew hero headline to 150 chars with an ellipsis", () => {
    const long = `נסו ${"רגע רגוע מאוד ".repeat(30)}בלי סימני פיסוק בסוף`;
    const out = focusHeadlineFrom(long)!;
    expect(out.length).toBeLessThanOrEqual(150);
    expect(out.endsWith("…")).toBe(true);
  });

  it("keeps clean Hebrew guidance untouched (no canned override)", () => {
    const real = "תנו התראה של חמש דקות לפני כל מעבר ממסך היום.";
    expect(focusHeadlineFrom(real)).toBe(real);
  });

  it("NEVER replaces transition/screen-time/dysregulation guidance with canned copy", () => {
    const real = "Give a five-minute heads-up before every screen time transition today.";
    expect(focusHeadlineFrom(real)).toBe(real);
    const real2 = "When dysregulation peaks, narrate the feeling calmly before problem-solving.";
    expect(focusHeadlineFrom(real2)).toBe(real2);
  });
});

describe("OverviewTab wiring (TODAY-1 + CODEX-2)", () => {
  const src = read("components/tabs/OverviewTab.tsx");

  it("derives the rendered headline through the pure scrub (TJB-02: the structured-aware entry point)", () => {
    // Was `focusHeadlineFrom(focus?.text)` — the observation sentence. The
    // hero now reads the whole record so the model's ONE step is the headline
    // and legacy text-only records still resolve through focusHeadlineFrom.
    expect(src).toContain("focusHeadlineFor(focus)");
    expect(src).toContain('headline={focusHeadline ?? t("ov.recoEmpty"');
    expect(src).toContain("body={focusHeadline ? focusBody : undefined}");
  });

  it("has no keyword-override branch (canned copy never replaces live guidance)", () => {
    expect(src).not.toMatch(/transition\|screen/);
    expect(src).not.toContain("today.focus.transition");
  });

  it("never feeds the marketing fallback into the action loop", () => {
    // TODAY-2/CODEX-1: the accept CTA moved into the hero; the guard moved
    // with it — the accept prop is offered ONLY from a real focus headline.
    expect(src).toMatch(/accept=\{focusHeadline\s*\?/);
    expect(src).toContain("acceptTodayAction(focusHeadline");
    expect(src).not.toMatch(/acceptTodayAction\([^)]*recoEmpty/);
    expect(src).not.toMatch(/focus\?\.text\?\.trim\(\)\s*\|\|\s*t\("ov\.recoEmpty"/);
  });

  it("greets by local time of day via i18n keys (no hardcoded Good morning)", () => {
    expect(src).toContain('"today.greeting.morning"');
    expect(src).toContain('"today.greeting.afternoon"');
    expect(src).toContain('"today.greeting.evening"');
    expect(src).toContain("getHours()");
    expect(src).not.toContain("Good morning");
    expect(src).not.toContain("בוקר טוב");
  });
});

/* ── TJB-02 — the STEP is the headline + what accept persists ─────────────── */
describe("TJB-02 — focusHeadlineFor prefers the model's tryToday step", () => {
  const fixture = {
    text: "Maya's mornings have been busy with transitions this week. Try a two-minute warning before leaving the park.",
    focus: "Maya's mornings have been busy with transitions this week.",
    tryToday: "Try a two-minute warning before leaving the park.",
  };

  it("NEGATIVE CONTROL — the legacy rule alone returns the OBSERVATION (the bug)", () => {
    expect(focusHeadlineFrom(fixture.text)).toBe(fixture.focus);
  });

  it("the headline (= what acceptTodayAction receives) is tryToday; the observation is the body", () => {
    expect(focusHeadlineFor(fixture)).toBe(fixture.tryToday);
    expect(focusBodyFor(fixture)).toBe(fixture.focus);
  });

  it("a legacy cached record (text only) still resolves through the first-sentence rule, with no body", () => {
    expect(focusHeadlineFor({ text: fixture.text })).toBe(fixture.focus);
    expect(focusBodyFor({ text: fixture.text })).toBeUndefined();
    expect(focusHeadlineFor(null)).toBeNull();
    expect(focusHeadlineFor({ text: "", tryToday: "  " })).toBeNull();
  });

  it("the step gets the SAME scrub + clamp (never a canned override)", () => {
    expect(focusHeadlineFor({ tryToday: "1. What May Be Happening - (high): Name the feeling before the request." })).toBe("Name the feeling before the request.");
    const long = `Try ${"a very ".repeat(40)}long step`;
    const out = focusHeadlineFor({ tryToday: long })!;
    expect(out.length).toBeLessThanOrEqual(150);
    expect(out.endsWith("…")).toBe(true);
  });

  it("OverviewTab persists the headline (the step) through acceptTodayAction", () => {
    const src = read("components/tabs/OverviewTab.tsx");
    expect(src).toContain("acceptTodayAction(focusHeadline");
  });

  it("useTodaysFocus stores the structured fields (reads data.tryToday, data.focus, data.inputsUsed)", () => {
    const hook = read("hooks/useTodaysFocus.ts");
    expect(hook).toContain("data.tryToday");
    expect(hook).toContain("data.focus");
    expect(hook).toContain("data.inputsUsed");
    expect(hook).toMatch(/export type Focus = \{[\s\S]*?tryToday\?: string;[\s\S]*?\}/);
  });
});

/* ── ENG-07 / AI-19 — the why-line names only inputs that exist ───────────── */
describe("ENG-07 — whyLineFor is built from real inputs", () => {
  const tEn = (k: string, v?: Record<string, string | number>) => translate("en", k, v);
  const tHe = (k: string, v?: Record<string, string | number>) => translate("he", k, v);

  it("NEGATIVE CONTROL — the retired static line asserted every input; it is gone from both dictionaries", () => {
    const retired = "Chosen from today's rhythm, recent moments, age, goals, and interests.";
    expect(/rhythm|goals|interests/.test(retired)).toBe(true);
    expect(en["today.intent.whyRhythm"]).toBeUndefined();
    expect(he["today.intent.whyRhythm"]).toBeUndefined();
    expect(read("components/tabs/OverviewTab.tsx")).not.toContain("today.intent.whyRhythm");
  });

  it("cold start (no moments) → the honest day-0 line with the child's name, no rhythm/goals/interests", () => {
    const line = whyLineFor({ name: "Maya", recentCount: 0, confidence: "none", goals: 0, interests: 0 }, tEn);
    expect(line).toBe("Chosen from Maya's age — add a moment and it gets sharper.");
    expect(line).not.toMatch(/rhythm|goals|interests/);
  });

  it("moments but no rhythm read / goals / interests → recent moments + age only", () => {
    const line = whyLineFor({ name: "Maya", recentCount: 3, confidence: "none", goals: 0, interests: 0 }, tEn);
    expect(line).toBe("Chosen from recent moments, age.");
    expect(line).not.toMatch(/rhythm|goals|interests/);
  });

  it("every real input is named when present", () => {
    const line = whyLineFor({ name: "Maya", recentCount: 9, confidence: "high", goals: 2, interests: 3 }, tEn);
    expect(line).toBe("Chosen from recent moments, today's rhythm, age, your goals, interests.");
  });

  it("server-reported inputsUsed wins over the client estimate", () => {
    expect(whyLineParts({ name: "Maya", recentCount: 5, confidence: "none", goals: 0, interests: 0, inputsUsed: { momentCount: 0 } }).key).toBe("today.intent.why.day0");
    expect(whyLineParts({ name: "Maya", recentCount: 0, confidence: "none", goals: 0, interests: 0, inputsUsed: { momentCount: 4 } }).key).toBe("today.intent.why.list");
  });

  it("renders in Hebrew through the same keys (no English leak)", () => {
    const line = whyLineFor({ name: "מאיה", recentCount: 0, confidence: "none", goals: 0, interests: 0 }, tHe);
    expect(line).toContain("מאיה");
    expect(line).not.toMatch(/[A-Za-z]/);
    for (const key of ["today.intent.why.list", "today.intent.why.day0", "today.intent.why.recent", "today.intent.why.rhythm", "today.intent.why.age", "today.intent.why.goals", "today.intent.why.interests", "today.intent.why.sep"]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
  });

  it("OverviewTab feeds the hero why-line from whyLineFor, never a fixed key", () => {
    const src = read("components/tabs/OverviewTab.tsx");
    expect(src).toContain("why={focusWhy}");
    expect(src).toMatch(/whyLineFor\(\s*\{\s*name: firstName,\s*recentCount,\s*confidence: rhythm\.confidence,\s*goals: activeGoals\.length,\s*interests: childProfile\.interests\?\.length \?\? 0,\s*inputsUsed: focus\?\.inputsUsed,\s*\},\s*t,\s*\)/);
  });
});

describe("TodayActionLoop guard (TODAY-1: acceptTodayAction unreachable when focus is null)", () => {
  const src = read("components/overview/TodayActionLoop.tsx");

  it("holds no accept path at all after the TODAY-2/CODEX-1 merge", () => {
    // The pre-accept state (and with it acceptTodayAction) moved into the
    // TodayRecommendation hero behind the focusHeadline guard; the card is
    // accepted/completed-only and cannot persist anything into actionLoops.
    expect(src).not.toContain("acceptTodayAction");
    expect(src).toMatch(/if\s*\(!activeTodayAction\)\s*return null/);
  });
});

describe("useTodaysFocus verdict-strip stays pinned (CODEX-2 firewall condition)", () => {
  const src = read("hooks/useTodaysFocus.ts");
  // AIR-5: the prompt moved server-side (/api/todays-focus) — the verdict-strip
  // condition now pins BOTH seams: the hook's payload and the server prompt.
  const apiSrc = read("routes/api.ts");

  it("the hook never sends intensity averages or milestone percentages to the server", () => {
    expect(src).not.toContain("signals.avg");
    expect(src).not.toContain("signals.milestonesPercent");
    // The allowed flat inputs are what the payload carries.
    expect(src).toContain("count: signals.count");
    expect(src).toContain("topTrigger: signals.topTrigger");
    // The heavy coach route is gone from the ambient card (AIR-5).
    expect(src).not.toContain('fetch("/api/chat"');
    expect(src).toContain('fetch("/api/todays-focus"');
  });

  it("the server focus prompt never interpolates avg intensity or milestone readiness", () => {
    const focusRoute = apiSrc.slice(apiSrc.indexOf('router.post("/todays-focus"'), apiSrc.indexOf('router.post("/vision"'));
    expect(focusRoute.length).toBeGreaterThan(0);
    expect(focusRoute).not.toMatch(/average intensity/i);
    expect(focusRoute).not.toMatch(/milestone readiness/i);
    expect(focusRoute).not.toContain("signals?.avg");
    expect(focusRoute).not.toContain("signals?.milestonesPercent");
    // The allowed flat inputs are still what the prompt uses.
    expect(focusRoute).toContain("${count}");
    expect(focusRoute).toContain("${topTrigger");
  });
});

describe("i18n keys (CODEX-2 greeting + TODAY-1 empty state)", () => {
  it("ships the new keys in BOTH languages and drops the canned focus", () => {
    for (const dict of [en, he] as Record<string, string>[]) {
      expect(dict["today.greeting.morning"]).toContain("{name}");
      expect(dict["today.greeting.afternoon"]).toContain("{name}");
      expect(dict["today.greeting.evening"]).toContain("{name}");
      expect(dict["today.header.prompt"]).toBeTruthy();
      expect(dict["today.header.sub"]).toBeTruthy();
      expect(dict["today.loop.empty"]).toBeTruthy();
      expect(dict["today.loop.emptySub"]).toBeTruthy();
      expect(dict["today.focus.transition"]).toBeUndefined();
    }
  });
});

describe("Today hero asset budget (CODEX-3)", () => {
  const ASSETS = path.resolve(SRC_ROOT, "../public/assets/today");

  it("ships the <=120KB WebP and NOT the 2.6MB PNG", () => {
    expect(fs.existsSync(path.join(ASSETS, "calm-transition-activity.png"))).toBe(false);
    const webp = path.join(ASSETS, "calm-transition-activity.webp");
    expect(fs.existsSync(webp)).toBe(true);
    expect(fs.statSync(webp).size).toBeLessThanOrEqual(120 * 1024);
  });

  it("is what TodayRecommendation references", () => {
    const src = read("components/overview/TodayRecommendation.tsx");
    expect(src).toContain("/assets/today/calm-transition-activity.webp");
    expect(src).not.toContain("calm-transition-activity.png");
  });
});

describe("mobile pinned capture bar exists as documented (TODAY-4)", () => {
  it("OverviewTab pins the bar above the MobileNav on phones and reserves its slot", () => {
    const src = read("components/tabs/OverviewTab.tsx");
    expect(src).toContain("max-md:fixed");
    expect(src).toMatch(/max-md:bottom-\[calc\(var\(--mobile-nav-h\)\+env\(safe-area-inset-bottom\)/);
    // Fixed is out of flow — the column must reserve the floating slot.
    expect(src).toContain("max-md:pb-20");
    // No stale sticky/order-last comments or classes (the pin is fixed).
    expect(src).not.toContain("max-md:sticky");
    expect(src).not.toContain("order-last");
  });

  it("--mobile-nav-h is declared in index.css", () => {
    const css = read("index.css");
    expect(css).toContain("--mobile-nav-h:");
  });
});
