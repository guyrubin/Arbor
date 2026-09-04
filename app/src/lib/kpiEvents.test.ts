import { describe, it, expect, beforeEach, vi } from "vitest";
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


/* ══════════════════════════════════════════════════════════════════════════
   ENG-22 (Wave E) — the three families that were MISSING, plus the retention
   arithmetic they feed. Before this wave the bell, the end of onboarding and
   the capture path emitted nothing, so D1/D7/D30 rested on `session_open`
   alone and the install → activated funnel had no middle.

   Behaviour first (the helpers are exercised against a mocked sink), source
   pins second (the call sites), each with a negative control in the shape the
   code had BEFORE the change — a scan that silently returns an empty string
   passes vacuously, which is exactly how an instrumentation regression hides.
   ══════════════════════════════════════════════════════════════════════════ */

const trackSpy = vi.hoisted(() => vi.fn());
vi.mock("./analytics", () => ({ track: trackSpy }));

import {
  KpiEvent,
  resetCaptureFunnel,
  trackBellItemTap,
  trackBellOpen,
  trackCaptureSaved,
  trackCaptureStarted,
  trackOnboardingCompleted,
  trackPushOutcome,
  trackPushPrompted,
} from "./kpiEvents";
import { RETENTION_ACTIVITY_EVENTS } from "./retention";

const lastCall = () =>
  trackSpy.mock.calls[trackSpy.mock.calls.length - 1] as [string, Record<string, unknown>?];

describe("ENG-22 helpers — behaviour, and the sink stays ids/counts only", () => {
  beforeEach(() => {
    trackSpy.mockClear();
    resetCaptureFunnel();
  });

  it("bell_open carries a COUNT of visible rows, never the rows", () => {
    trackBellOpen(3);
    expect(lastCall()).toEqual([KpiEvent.BellOpen, { visible: 3 }]);
    // A junk count degrades to 0 rather than shipping NaN to the sink.
    trackBellOpen(Number.NaN);
    expect(lastCall()[1]).toEqual({ visible: 0 });
  });

  it("bell_item_tap carries the row CLASS and the route id — never the note", () => {
    trackBellItemTap("monitoring", "development");
    expect(lastCall()).toEqual([KpiEvent.BellItemTap, { kind: "monitoring", action: "development" }]);
    const props = lastCall()[1] as Record<string, unknown>;
    expect(Object.keys(props).sort()).toEqual(["action", "kind"]);
  });

  it("onboarding_completed carries a domain COUNT and a boolean, never labels", () => {
    trackOnboardingCompleted({ domainCount: 2, hasAvatar: true });
    expect(lastCall()).toEqual([KpiEvent.OnboardingCompleted, { domain_count: 2, avatar: true }]);
  });

  it("capture_saved reports the mode the request STARTED in, then forgets it", () => {
    trackCaptureStarted("voice");
    expect(lastCall()).toEqual([KpiEvent.CaptureStarted, { mode: "voice" }]);
    trackCaptureSaved("moment");
    expect(lastCall()).toEqual([KpiEvent.CaptureSaved, { mode: "voice", source: "moment" }]);
    // Consumed: a second save is the direct-composer path, not a second voice.
    trackCaptureSaved("log");
    expect(lastCall()).toEqual([KpiEvent.CaptureSaved, { mode: "text", source: "log" }]);
  });

  it("a save with no prior request is honestly attributed to the text path", () => {
    trackCaptureSaved("moment");
    expect(lastCall()).toEqual([KpiEvent.CaptureSaved, { mode: "text", source: "moment" }]);
  });

  it("push prompt/outcome are bare events — no permission strings, no metadata", () => {
    trackPushPrompted();
    expect(lastCall()).toEqual([KpiEvent.PushPrompted]);
    trackPushOutcome(true);
    expect(lastCall()).toEqual([KpiEvent.PushGranted]);
    trackPushOutcome(false);
    expect(lastCall()).toEqual([KpiEvent.PushDenied]);
  });

  it("every emitted prop value is a primitive id/count/boolean — no objects", () => {
    trackBellOpen(1);
    trackBellItemTap("nudge", "overview");
    trackOnboardingCompleted({ domainCount: 0, hasAvatar: false });
    trackCaptureStarted("photo");
    trackCaptureSaved("log");
    for (const [, props] of trackSpy.mock.calls as [string, Record<string, unknown>?][]) {
      for (const value of Object.values(props ?? {})) {
        expect(["string", "number", "boolean"]).toContain(typeof value);
      }
    }
  });
});

describe("ENG-22 — retention reads the names the helpers actually emit", () => {
  it("the activity allow-list references live event names, not invented ones", () => {
    const emitted = new Set<string>(Object.values(KpiEvent));
    // These two are owned by loopEvents / the KPI six above; the rest are new.
    const elsewhere = new Set(["session_open", "app_open"]);
    for (const name of RETENTION_ACTIVITY_EVENTS) {
      expect(emitted.has(name) || elsewhere.has(name)).toBe(true);
    }
    // Negative control: a name nobody emits must not be silently accepted.
    expect((RETENTION_ACTIVITY_EVENTS as readonly string[]).includes("session_opened")).toBe(false);
  });

  it("session_open (the retention spine) is still emitted by loopEvents", () => {
    expect(loopEvents).toContain('track("session_open")');
  });
});

describe("ENG-22 — the new call sites are LIVE (source pins + negative controls)", () => {
  const bell = read("components/layout/TopbarBell.tsx");
  const onboarding = read("components/auth/OnboardingFlow.tsx");
  const arbor = read("context/ArborContext.tsx");
  const push = read("lib/push.ts");

  it("the scanned files are non-empty (a vacuous pass is not a pass)", () => {
    for (const src of [bell, onboarding, arbor, push]) {
      expect(src).toBeTruthy();
      expect(src.length).toBeGreaterThan(200);
    }
  });

  it("bell: open + row tap instrumented at the two choke points", () => {
    expect(bell).toContain("trackBellOpen(items.length)");
    expect(bell).toContain("trackBellItemTap(item.kind, item.action)");
    // Negative control — the pre-change file had NO bell telemetry at all.
    expect(bell).not.toMatch(/trackBellOpen\(\s*items\s*\)/);
  });

  it("onboarding: completion fires on the real submit path", () => {
    const call = onboarding.match(/trackOnboardingCompleted\(\{[^}]*\}\)/)?.[0];
    expect(call).toBeTruthy();
    expect(call).toContain("domainCount: selectedDomains.length");
    expect(call).toContain("hasAvatar: !!avatarResult");
    // Free text must never ride along: no name/age/domain labels in the props.
    expect(call).not.toMatch(/name|ageYears|challenges|domainLabels/);
  });

  it("capture: started at the ONE request seam, saved on genuinely new rows", () => {
    expect(arbor).toMatch(/const requestCapture = \(mode: CaptureMode\) => \{\s*trackCaptureStarted\(mode\);/);
    expect(arbor).toContain('trackCaptureSaved("moment")');
    expect(arbor).toContain('trackCaptureSaved("log")');
    // Negative control: the pre-change one-liner shape must be gone, otherwise
    // capture_started is never emitted no matter what the helper does.
    expect(arbor).not.toContain("const requestCapture = (mode: CaptureMode) => setPendingCaptureMode(mode);");
  });

  it("push: prompted precedes the OS call; the outcome is recorded both ways", () => {
    const idxPrompted = push.indexOf("trackPushPrompted()");
    const idxRequest = push.indexOf("Notification.requestPermission()");
    expect(idxPrompted).toBeGreaterThan(-1);
    expect(idxRequest).toBeGreaterThan(-1);
    expect(idxPrompted).toBeLessThan(idxRequest);
    expect(push).toContain("trackPushOutcome(false)");
    expect(push).toContain("trackPushOutcome(true)");
  });
});
