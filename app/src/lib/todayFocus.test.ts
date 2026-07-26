import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { focusHeadlineFrom } from "./todayFocus";
import { en, he } from "./i18n";

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

  it("derives the rendered headline through the pure scrub", () => {
    expect(src).toContain("focusHeadlineFrom(focus?.text)");
    expect(src).toContain('headline={focusHeadline ?? t("ov.recoEmpty"');
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
