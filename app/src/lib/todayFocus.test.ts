import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { focusHeadlineFrom, focusHeadlineFor, focusBodyFor, whyLineFor, whyLineParts } from "./todayFocus";
import { en, he, translate } from "./i18n";
import { todayFile, todayLiveSource } from "../testTodaySource";

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
  const src = todayLiveSource();

  // B-LOOP-07 re-pin: Today renders no focus headline (the practice leads);
  // the scrub stays the one path for any surface that renders the focus.
  it("the loop renders no focus headline (only the fallback recommendation lead does); the focus names a practice only from the candidates", () => {
    // Parity 9 Oct: Codex's recommendation lead shows the AI step when no practice,
    // notice or program leads; the loop's own blocks never render a headline.
    expect(todayFile("NowView.tsx")).not.toContain("focusHeadlineFor(");
    expect(todayFile("NowLoopBlocks.tsx")).not.toContain("focusHeadlineFor(");
    expect(src).toContain("aiPracticeId");
  });

  it("has no keyword-override branch (canned copy never replaces live guidance)", () => {
    expect(src).not.toMatch(/transition\|screen/);
    expect(src).not.toContain("today.focus.transition");
  });

  it("never feeds the marketing fallback into the action loop", () => {
    // Parity 9 Oct: the ONE accept is the recommendation lead's, for a screened model step only.
    expect(src.match(/acceptTodayAction\(/g)).toHaveLength(1);
    expect(src).toContain("if (!useAi || !aiStep || saving) return;");
    expect(src).not.toMatch(/t\("ov\.recoEmpty"/);
  });

  it("names the day through the locale's calendar (no hardcoded Good morning)", () => {
    // Parity 9 Oct: Now's eyebrow is the local date (he-IL / en-GB) · the child's
    // identity line (B-TODAY-28); CODEX-2's local-time rule stands.
    expect(src).toContain('new Date().toLocaleDateString(he ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "long" })');
    expect(src).toContain('"elev.loop.today.identity"');
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

  it("OverviewTab persists no focus headline (B-LOOP-07: the practice's dose row is the write)", () => {
    const src = todayLiveSource();
    expect(src).not.toContain("acceptTodayAction(focusHeadline");
    expect(src).toContain("recordPracticeDose(");
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
    expect(todayLiveSource()).not.toContain("today.intent.whyRhythm");
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

  it("every real input is named when present — rhythm is not one (B-TODAY-04)", () => {
    const line = whyLineFor({ name: "Maya", recentCount: 9, confidence: "high", goals: 2, interests: 3 }, tEn);
    expect(line).toBe("Chosen from recent moments, age, your goals, interests.");
  });

  it("B-TODAY-04 — with rhythm confidence high, no rhythm key and no 'today's rhythm' / 'קצב היום' (EN + HE)", () => {
    for (const confidence of ["medium", "high"]) {
      const inp = { name: "Maya", recentCount: 9, confidence, goals: 2, interests: 3 };
      expect(String(whyLineParts(inp).vars.list ?? "")).not.toContain("today.intent.why.rhythm");
      expect(whyLineFor(inp, tEn)).not.toContain("today's rhythm");
      expect(whyLineFor(inp, tHe)).not.toContain("קצב היום");
    }
  });

  it("B-TODAY-04 — the prompt card's why-line is its own key and names no goals, interests or moments", () => {
    expect(translate("en", "today.intent.why.prompt", { age: 4 })).toBe("A new question each day for 4-year-olds");
    expect(translate("he", "today.intent.why.prompt", { age: 4 })).toBe("שאלה חדשה בכל יום לגיל 4");
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "today.intent.why.prompt", { age: 4 })).not.toMatch(/goal|interest|moment|מטרות|תחומי עניין|רגע/i);
    }
    for (const lang of ["en", "he"] as const) {
      const line = translate(lang, "elev.ages.today.whyPrompt", { name: "Leni", age: lang === "en" ? "22 months" : "22 חודשים" });
      expect(line).toContain("Leni");
      expect(line).toMatch(/22/);
      expect(line).not.toMatch(/year-olds|goal|interest|moment|מטרות|תחומי עניין|רגע/i);
    }
  });

  it("server-reported inputsUsed refines the count, but the LIVE ledger decides day-0 (OBJ-TODAY-02)", () => {
    // A report of zero still demotes a client estimate — the model looked and
    // found nothing usable.
    expect(whyLineParts({ name: "Maya", recentCount: 5, confidence: "none", goals: 0, interests: 0, inputsUsed: { momentCount: 0 } }).key).toBe("today.intent.why.day0");
    // …but the reverse no longer holds. This case used to expect the list line:
    // a cached report (another day, another language) claimed 4 moments while
    // the live ledger held none, and Today then said "chosen from recent
    // moments" over an empty feed. Provenance describes; it never outranks.
    expect(whyLineParts({ name: "Maya", recentCount: 0, confidence: "none", goals: 0, interests: 0, inputsUsed: { momentCount: 4 } }).key).toBe("today.intent.why.day0");
  });

  it("renders in Hebrew through the same keys (no English leak)", () => {
    const line = whyLineFor({ name: "מאיה", recentCount: 0, confidence: "none", goals: 0, interests: 0 }, tHe);
    expect(line).toContain("מאיה");
    expect(line).not.toMatch(/[A-Za-z]/);
    for (const key of ["today.intent.why.list", "today.intent.why.day0", "today.intent.why.recent", "today.intent.why.prompt", "today.intent.why.age", "today.intent.why.goals", "today.intent.why.interests", "today.intent.why.sep"]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
  });

  // P5 r1 pass A3 re-pin: the line states the chooser's REASON for the shelf
  // (empty this month / the fewest notes) and names the child — never the
  // catalogue label; the plain shelf line when neither is true.
  it("Today's why-line is the practice's own (the shelf and the chooser's reason), never a fixed generic key", () => {
    const card = read("components/loop/PracticeCard.tsx");
    // P5-LOOP c2 r1: "since" needs its date, else the plain shelf line
    expect(card).toContain('t(whyReason && (whyReason !== "since" || whyDate) ? WHY_KEY[whyReason] : "elev.loop.practice.whyShelf"');
    expect(card).not.toContain('"elev.loop.practice.why"');
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
    // B-AI-01: the template moved to ai/prompts.ts buildTodaysFocusPrompt;
    // the route passes the flat inputs and the builder interpolates them.
    expect(focusRoute).toMatch(/buildTodaysFocusPrompt\(\{[\s\S]*?\bcount,[\s\S]*?\btriggerSent,/);
    const prompts = fs.readFileSync(path.join(__dirname, "..", "ai", "prompts.ts"), "utf8");
    const builder = prompts.slice(prompts.indexOf("export const buildTodaysFocusPrompt"), prompts.indexOf("// ── Fingerprints"));
    expect(builder).not.toMatch(/average intensity|milestone readiness/i);
    // The allowed flat inputs are still what the prompt uses.
    expect(builder).toContain("${count}");
    // B-AI-03 renamed the interpolated trigger to `triggerSent` (only a
    // trigger that is really sent is named); the flat-input rule is unchanged.
    expect(builder).toContain("${triggerSent");
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

  it("TJB-29: the hero fronts THIS child, not the stock photo", () => {
    const src = read("components/overview/TodayRecommendation.tsx");
    // The asset stays shipped (CODEX-3's size budget above still applies to
    // it), but the hero no longer renders it: the same picture of somebody
    // else's child sat on every account, every day, above a step written for
    // this one. The shared HeroAvatar engine owns identity resolution and the
    // Sprout fallback, so there is nothing to re-composite here.
    expect(src).not.toContain("/assets/today/calm-transition-activity.webp");
    expect(src).not.toContain("calm-transition-activity.png");
    expect(src).toContain('import { HeroAvatar } from "../ui/HeroAvatar"');
    expect(src).toMatch(/<HeroAvatar[^>]*decorative/);
    // Parent register: no idle bob on this surface.
    expect(src).toMatch(/<HeroAvatar[^>]*animate=\{false\}/);
  });

  it("negative control: the shipped background-image markup fails the new check", () => {
    const shipped = `<div aria-hidden="true" className="min-h-[132px] bg-cover bg-center" style={{ backgroundImage: "url('/assets/today/calm-transition-activity.webp')" }} />`;
    expect(shipped).toContain("/assets/today/calm-transition-activity.webp");
    expect(/<HeroAvatar/.test(shipped)).toBe(false);
  });
});

describe("mobile pinned capture bar exists as documented (TODAY-4)", () => {
  it("Now docks nothing over the MobileNav: capture is the side column's card (no fixed bar to reserve)", () => {
    // Parity 9 Oct: the pinned QuickCaptureBar left with the Today hub.
    const src = todayLiveSource();
    expect(src).not.toMatch(/max-md:fixed|max-md:sticky/);
    expect(src).toContain('<section className="now-capture"');
    expect(src).not.toContain("order-last");
    expect(read("components/companion/nowView.css")).not.toMatch(/position:\s*(fixed|sticky)/);
  });

  it("--mobile-nav-h is declared in index.css", () => {
    const css = read("index.css");
    expect(css).toContain("--mobile-nav-h:");
  });
});

describe("B-TODAY-24 — the why-line names approved facts only when the server used them", () => {
  const dict: Record<string, string> = {
    "today.intent.why.list": "Chosen from {list}.",
    "today.intent.why.recent": "recent moments",
    "today.intent.why.age": "age",
    "today.intent.why.sep": ", ",
    "elev.brief.why.facts": "{n} things you told Arbor",
    "elev.brief.why.facts.one": "1 thing you told Arbor",
  };
  const t = (k: string, v?: Record<string, string | number>) =>
    (dict[k] ?? k).replace(/\{(\w+)\}/g, (_m, name: string) => String(v?.[name] ?? `{${name}}`));
  const base = { name: "Maya", recentCount: 3, confidence: "none", goals: 0, interests: 0 };

  it("factCount > 0 → '{n} things you told Arbor' (singular at 1)", () => {
    expect(whyLineFor({ ...base, inputsUsed: { momentCount: 3, factCount: 2 } }, t)).toBe("Chosen from recent moments, age, 2 things you told Arbor.");
    expect(whyLineFor({ ...base, inputsUsed: { momentCount: 3, factCount: 1 } }, t)).toBe("Chosen from recent moments, age, 1 thing you told Arbor.");
  });

  it("factCount 0 or absent → never named (the line names only inputsUsed)", () => {
    expect(whyLineFor({ ...base, inputsUsed: { momentCount: 3, factCount: 0 } }, t)).toBe("Chosen from recent moments, age.");
    expect(whyLineFor({ ...base, inputsUsed: { momentCount: 3 } }, t)).toBe("Chosen from recent moments, age.");
    expect(whyLineParts({ ...base, inputsUsed: { momentCount: 3 } }).vars).toEqual({ list: "today.intent.why.recent|today.intent.why.age" });
  });

  it("EN + HE strings exist", async () => {
    const { translate } = await import("./i18n");
    expect(translate("en", "elev.brief.why.facts", { n: 3 })).toBe("3 things you told Arbor");
    expect(translate("he", "elev.brief.why.facts", { n: 3 })).toBe("3 דברים שסיפרתם לארבור");
    expect(translate("he", "elev.brief.why.facts.one")).toBe("דבר אחד שסיפרתם לארבור");
  });
});
