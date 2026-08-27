import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * N8 (M0.8) — KPI instrumentation source pin. The six launch-KPI event
 * families must exist at their LIVE call sites (dashboards depend on the
 * names; a rename or a dropped call site is a silent KPI outage):
 *
 *   1. session_open           — AuthContext, at auth-ready, once per session
 *   2. sincevisit_shown/_row_tap — SinceLastVisit render + tap
 *   3. today_action_offered / _accepted / _outcome — the Today action loop
 *   4. recap_opened + share_initiated — WeeklyTab recap open + share path
 *   5. safety_helpline_tel_tap / safety_contact_tel_tap — tel: links
 *   6. error_banner_shown     — every ErrorState mount (incl. the N2 banner)
 *
 * Also pins the sink hygiene: analytics metadata is ids/counts only — no
 * child content, no free-text copy (see the negative pins at the bottom).
 */

// Strip comments so pins hit live code, not prose (useTodaysFocus.test recipe).
const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(__dirname, "..", rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const loopEvents = read("lib/loopEvents.ts");
const authCtx = read("context/AuthContext.tsx");
const sinceVisit = read("components/overview/SinceLastVisit.tsx");
const todayHero = read("components/overview/TodayRecommendation.tsx");
const arborCtx = read("context/ArborContext.tsx");
const recapCards = read("components/weekly/RecapStoryCards.tsx");
const shareLib = read("lib/share.ts");
const safetyTab = read("components/tabs/SafetyTab.tsx");
const errorState = read("components/ui/ErrorState.tsx");

describe("N8 KPI events — all six families live at their call sites", () => {
  it("1. session_open: helper emits it, AuthContext calls it at auth-ready", () => {
    expect(loopEvents).toContain('track("session_open")');
    // Once per browser session — sessionStorage-guarded inside the helper.
    expect(loopEvents).toContain("sessionStorage.getItem(SS_SESSION_OPEN)");
    expect(authCtx).toContain("trackSessionOpen()");
    // Fired only with a resolvable uid, so the event lands past track()'s gate.
    expect(authCtx).toMatch(/if \(user\?\.uid\) trackSessionOpen\(\)/);
  });

  it("2. since-strip: render + row tap instrumented in SinceLastVisit", () => {
    expect(sinceVisit).toContain('track("sincevisit_shown"');
    expect(sinceVisit).toContain('track("sincevisit_row_tap"');
  });

  it("3. action loop: offered (hero) → accepted → outcome (ArborContext)", () => {
    expect(loopEvents).toContain('track("today_action_offered"');
    expect(todayHero).toContain('trackActionOffered("today-hero")');
    expect(arborCtx).toContain('track("today_action_accepted"');
    expect(arborCtx).toContain('track("today_action_outcome"');
  });

  it("4. recap: open (RecapStoryCards) + share (ShareButton → lib/share loop events)", () => {
    expect(recapCards).toContain('track("recap_opened"');
    // The recap share path is the shared ShareButton, whose lib/share pipeline
    // fires the canonical share loop events.
    expect(recapCards).toContain("<ShareButton");
    expect(shareLib).toContain("trackShareInitiated(");
    expect(shareLib).toContain("trackShareCompleted(");
  });

  it("5. tel: taps: both safety tel link classes instrumented", () => {
    expect(safetyTab).toContain('track("safety_helpline_tel_tap"');
    expect(safetyTab).toContain('track("safety_contact_tel_tap"');
  });

  it("6. error banner: ErrorState fires on mount, N2's Today-focus banner tagged", () => {
    expect(loopEvents).toContain('track("error_banner_shown"');
    expect(errorState).toContain("trackErrorBannerShown(surface)");
    // Mount-once, not render-loop: the effect has an empty dep array.
    expect(errorState).toMatch(/useEffect\(\(\) => \{\s*trackErrorBannerShown\(surface\);/);
    expect(read("components/tabs/OverviewTab.tsx")).toContain('surface="today-focus"');
  });
});

describe("N8 KPI events — external-sink hygiene (ids/counts only)", () => {
  it("the offer event carries a surface id, never the recommendation headline", () => {
    // trackActionOffered accepts exactly one arg at the call site and it is a
    // literal surface id — headline/focus text must never reach analytics.
    expect(todayHero).not.toMatch(/trackActionOffered\([^)]*headline/);
  });

  it("the error-banner event carries the surface id, never headline/body copy", () => {
    expect(loopEvents).toMatch(/error_banner_shown",\s*surface \? \{ surface \} : \{\}/);
    expect(errorState).not.toMatch(/trackErrorBannerShown\([^)]*(headline|body)/);
  });

  it("the personal-contact tel event carries NO metadata (no phone numbers)", () => {
    expect(safetyTab).toContain('track("safety_contact_tel_tap")');
    expect(safetyTab).not.toMatch(/safety_contact_tel_tap",\s*\{/);
  });
});
