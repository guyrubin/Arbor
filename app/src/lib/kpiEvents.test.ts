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


/* ══════════════════════════════════════════════════════════════════════════
   WAVE N1 (N1-00) — the key-set table.

   Thirteen helpers, four builders, one sink. The contract every one of them
   must keep is the same and it is testable as a TABLE: the event name, and the
   EXACT set of prop keys. A helper that grows a key is a privacy change and
   fails here; a helper that is handed free text degrades it to the sentinel
   and fails nothing, which is what the negative controls at the bottom prove.

   Ids / counts / enums only. No child name, no kept line, no note, no price,
   no email, no customer id, no free text of any kind.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  UNKNOWN_ID,
  trackActivated,
  trackCheckoutStart,
  trackDigestEmailOptIn,
  trackDigestEmailSend,
  trackEntitlementActive,
  trackKeepThis,
  trackKeepUndone,
  trackKidSessionEnd,
  trackNudgeScheduled,
  trackNudgeSuppressed,
  trackPaywallView,
  trackPlanFromAnswer,
  trackPlanGenerated,
  trackSessionClose,
} from "./kpiEvents";

/** A child's first name and a verbatim kept line — the two things that must
 *  never reach the sink. Used as the negative control for every id prop. */
const CHILD_NAME = "Maya";
const KEPT_TEXT = "Maya bit her brother at the park again this afternoon";

describe("N1-00 — the thirteen wave-N1 helpers: event name + exact key set", () => {
  beforeEach(() => trackSpy.mockClear());

  const table: { name: string; fire: () => void; event: string; keys: string[] }[] = [
    {
      name: "keep_this",
      fire: () => trackKeepThis({ field: "todayPlan", surface: "coach" }),
      event: "keep_this",
      keys: ["field", "surface"],
    },
    {
      name: "keep_undone",
      fire: () => trackKeepUndone("coach"),
      event: "keep_undone",
      keys: ["surface"],
    },
    {
      name: "plan_from_answer",
      fire: () => trackPlanFromAnswer("coach"),
      event: "plan_from_answer",
      keys: ["surface"],
    },
    {
      // N1-01-R6: the pre-existing name, re-homed here so it cannot ship a
      // model-generated plan title again. A count and a surface id.
      name: "plan_generated",
      fire: () => trackPlanGenerated({ steps: 9, source: "plans" }),
      event: "plan_generated",
      keys: ["source", "steps"],
    },
    {
      name: "kid_session_end",
      fire: () => trackKidSessionEnd({ seconds: 312, activities: 3 }),
      event: "kid_session_end",
      keys: ["activities", "seconds"],
    },
    {
      name: "session_close",
      fire: () => trackSessionClose(884),
      event: "session_close",
      keys: ["seconds"],
    },
    {
      name: "paywall_view",
      fire: () => trackPaywallView({ plan: "plus", reason: "coach_limit" }),
      event: "paywall_view",
      keys: ["plan", "reason"],
    },
    {
      name: "checkout_start",
      fire: () => trackCheckoutStart({ plan: "plus", channel: "web" }),
      event: "checkout_start",
      keys: ["channel", "plan"],
    },
    {
      name: "entitlement_active",
      fire: () => trackEntitlementActive({ plan: "plus", from: "free" }),
      event: "entitlement_active",
      keys: ["from", "plan"],
    },
    {
      name: "activated",
      fire: () => trackActivated({ dayOffset: 2, via: "capture_saved" }),
      event: "activated",
      keys: ["day_offset", "via"],
    },
    {
      name: "nudge_scheduled",
      fire: () => trackNudgeScheduled({ kind: "rhythm", channel: "bell" }),
      event: "nudge_scheduled",
      keys: ["channel", "kind"],
    },
    {
      name: "nudge_suppressed",
      fire: () => trackNudgeSuppressed({ kind: "rhythm", reason: "quiet_hours" }),
      event: "nudge_suppressed",
      keys: ["kind", "reason"],
    },
    {
      name: "digest_email_optin",
      fire: () => trackDigestEmailOptIn(true),
      event: "digest_email_optin",
      keys: ["on"],
    },
    {
      name: "digest_email_send",
      fire: () => trackDigestEmailSend("provider_disabled"),
      event: "digest_email_send",
      keys: ["result"],
    },
  ];

  it("the table covers every wave-N1 name declared in KpiEvent", () => {
    const declared = [
      "keep_this",
      "keep_undone",
      "plan_from_answer",
      "plan_generated",
      "kid_session_end",
      "session_close",
      "paywall_view",
      "checkout_start",
      "entitlement_active",
      "activated",
      "nudge_scheduled",
      "nudge_suppressed",
      "digest_email_optin",
      "digest_email_send",
    ];
    for (const name of declared) {
      expect(Object.values(KpiEvent)).toContain(name);
    }
    expect(table.map((r) => r.event).sort()).toEqual([...declared].sort());
  });

  for (const row of table) {
    it(`${row.name} emits its name and EXACTLY ${JSON.stringify(row.keys)}`, () => {
      row.fire();
      const [event, props] = lastCall();
      expect(event).toBe(row.event);
      expect(Object.keys(props ?? {}).sort()).toEqual([...row.keys].sort());
      // Every value is a primitive id / count / boolean — never an object.
      for (const value of Object.values(props ?? {})) {
        expect(["string", "number", "boolean"]).toContain(typeof value);
      }
    });
  }

  it("the whole table emits exactly thirteen calls and no stray event", () => {
    for (const row of table) row.fire();
    expect(trackSpy.mock.calls).toHaveLength(table.length);
    expect(trackSpy.mock.calls.map((c) => c[0]).sort()).toEqual(table.map((r) => r.event).sort());
  });
});

describe("N1-00 — NEGATIVE CONTROLS: free text cannot reach the sink", () => {
  beforeEach(() => trackSpy.mockClear());

  /* Every one of these passes a child's name or a verbatim kept line where an
     id belongs. Before the sanitiser existed they would have been emitted
     as-is (a raw `{ field, surface }` projection) — that is the pre-fix shape
     and it is what these cases fail against. */
  const smuggles: { name: string; fire: () => void }[] = [
    { name: "keep_this.field", fire: () => trackKeepThis({ field: KEPT_TEXT, surface: "coach" }) },
    { name: "keep_this.surface", fire: () => trackKeepThis({ field: "journal", surface: KEPT_TEXT }) },
    { name: "keep_undone.surface", fire: () => trackKeepUndone(CHILD_NAME) },
    { name: "plan_from_answer.surface", fire: () => trackPlanFromAnswer(KEPT_TEXT) },
    { name: "paywall_view.reason", fire: () => trackPaywallView({ plan: "plus", reason: KEPT_TEXT }) },
    { name: "checkout_start.plan", fire: () => trackCheckoutStart({ plan: CHILD_NAME, channel: "web" }) },
    { name: "entitlement_active.from", fire: () => trackEntitlementActive({ plan: "plus", from: KEPT_TEXT }) },
    { name: "activated.via", fire: () => trackActivated({ dayOffset: 1, via: CHILD_NAME }) },
    { name: "nudge_scheduled.kind", fire: () => trackNudgeScheduled({ kind: KEPT_TEXT, channel: "bell" }) },
    { name: "nudge_suppressed.kind", fire: () => trackNudgeSuppressed({ kind: CHILD_NAME, reason: "ceiling" }) },
  ];

  for (const smuggle of smuggles) {
    it(`${smuggle.name}: free text degrades to "${UNKNOWN_ID}", never emitted verbatim`, () => {
      smuggle.fire();
      const serialized = JSON.stringify(lastCall()[1] ?? {});
      expect(serialized).not.toContain(CHILD_NAME);
      expect(serialized).not.toContain(KEPT_TEXT);
      // ...and it did not just vanish: the key is still there, as the sentinel.
      expect(serialized).toContain(UNKNOWN_ID);
    });
  }

  it("an enum prop outside its allow-list never reaches the sink verbatim", () => {
    trackCheckoutStart({ plan: "plus", channel: "carrier_billing" });
    expect(lastCall()[1]).toEqual({ plan: "plus", channel: UNKNOWN_ID });
    trackNudgeSuppressed({ kind: "rhythm", reason: "because the child was asleep" });
    expect(lastCall()[1]).toEqual({ kind: "rhythm", reason: UNKNOWN_ID });
    trackDigestEmailSend("sent_to_grandma@example.com");
    expect(lastCall()[1]).toEqual({ result: UNKNOWN_ID });
  });

  it("counts are non-negative integers — junk degrades to 0, never NaN", () => {
    trackKidSessionEnd({ seconds: Number.NaN, activities: -4 });
    expect(lastCall()[1]).toEqual({ seconds: 0, activities: 0 });
    trackSessionClose(884.7);
    expect(lastCall()[1]).toEqual({ seconds: 884 });
    trackActivated({ dayOffset: Number.POSITIVE_INFINITY, via: "keep_this" });
    expect(lastCall()[1]).toEqual({ day_offset: 0, via: "keep_this" });
  });

  it("the sentinel is not a usable id, so a degraded prop is visible in the data", () => {
    // If UNKNOWN_ID were "" or undefined the degradation would be silent and a
    // dashboard would read a sanitiser failure as an absent event.
    expect(UNKNOWN_ID).toBe("other");
  });
});


/* ══════════════════════════════════════════════════════════════════════════
   N1-01 — the two COMMIT-side loop events, at their seams.

   keep_this and plan_from_answer are the two the vision's §6 table cares about
   and the two that are easiest to fake: both have an obvious button nearby and
   firing on the button would be free. The tests below are written so that a
   press-shaped implementation FAILS — a draft proposal, a proposal with no
   commitRef, and a plan generated with no answer behind it all emit nothing.

   The closing pair (session_close, kid_session_end) is proven in
   lib/loopClose.test.ts, which can drive a fake window and a fake storage.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  KEEP_FIELD_BY_TARGET,
  noteKeepCommitted,
} from "./conversationProposals";
import {
  COACH_KEEP_SURFACE,
  markPlanSeededFromAnswer,
  noteTypedKeepCommitted,
  notePlanCreatedFromAnswer,
  resetPlanFromAnswer,
} from "./captureProposals";

/** The shape ArborContext.commitConversationProposal returns, minimally. */
const committed = (target: "journal" | "milestone" | "observation" | "report_fact" = "journal") => ({
  status: "committed" as const,
  target,
  commitRef: { collection: "behaviorLogs" as const, id: "typed-abc-0" },
});

const KEPT_LINE = "Maya settles faster when the light is low";

describe("N1-01 — keep_this fires at the COMMIT, never at the press (critic C8)", () => {
  beforeEach(() => trackSpy.mockClear());

  it("a committed journal keep emits one keep_this with its field + surface", () => {
    expect(noteKeepCommitted(committed("journal"), "capture-tray")).toBe(true);
    expect(lastCall()).toEqual(["keep_this", { field: "journal", surface: "capture-tray" }]);
  });

  it("every proposal target maps to a keep field — no target is unmeasured", () => {
    expect(Object.keys(KEEP_FIELD_BY_TARGET).sort()).toEqual([
      "journal",
      "milestone",
      "observation",
      "report_fact",
    ]);
    for (const target of Object.keys(KEEP_FIELD_BY_TARGET) as (keyof typeof KEEP_FIELD_BY_TARGET)[]) {
      trackSpy.mockClear();
      noteKeepCommitted(committed(target), "capture-tray");
      expect(lastCall()[1]).toEqual({ field: KEEP_FIELD_BY_TARGET[target], surface: "capture-tray" });
    }
  });

  it("the typed coach path reports the CONTRACT line, not the journal target", () => {
    expect(noteTypedKeepCommitted(committed("journal"), { field: "parentScript" })).toBe(true);
    expect(lastCall()).toEqual([
      "keep_this",
      { field: "parentScript", surface: COACH_KEEP_SURFACE },
    ]);
  });

  it("NEGATIVE CONTROL: a DRAFT proposal — the press, not the commit — emits nothing", () => {
    const draft = { ...committed(), status: "draft" as unknown as "committed" };
    expect(noteKeepCommitted(draft, "capture-tray")).toBe(false);
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: a discarded or undone record emits nothing", () => {
    for (const status of ["discarded", "undone"] as unknown as "committed"[]) {
      expect(noteKeepCommitted({ ...committed(), status }, "capture-tray")).toBe(false);
    }
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: committed with NO commitRef (no row written) emits nothing", () => {
    expect(
      noteKeepCommitted({ status: "committed", target: "journal", commitRef: undefined }, "capture-tray"),
    ).toBe(false);
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: the kept TEXT cannot ride along even if a caller tries", () => {
    // The summary is on the record in front of the reporter and is never read;
    // a caller passing it as the surface gets the sentinel, not the line.
    noteKeepCommitted(committed("journal"), KEPT_LINE);
    const serialized = JSON.stringify(lastCall()[1]);
    expect(serialized).not.toContain("Maya");
    expect(serialized).toContain("other");
  });
});

describe("N1-01 — plan_from_answer measures the CONVERSION, not every plan", () => {
  beforeEach(() => {
    trackSpy.mockClear();
    resetPlanFromAnswer();
  });

  it("an answer-seeded plan emits exactly one plan_from_answer", () => {
    markPlanSeededFromAnswer("coach");
    expect(notePlanCreatedFromAnswer()).toBe(true);
    expect(lastCall()).toEqual(["plan_from_answer", { surface: "coach" }]);
  });

  it("NEGATIVE CONTROL: a plan typed from scratch (no answer) emits nothing", () => {
    expect(notePlanCreatedFromAnswer()).toBe(false);
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: a second plan does not re-use the first answer's latch", () => {
    markPlanSeededFromAnswer("coach");
    notePlanCreatedFromAnswer();
    trackSpy.mockClear();
    expect(notePlanCreatedFromAnswer()).toBe(false);
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("NEGATIVE CONTROL: an abandoned answer (armed, never generated) emits nothing", () => {
    markPlanSeededFromAnswer("coach");
    resetPlanFromAnswer(); // the tab died / the parent moved on
    expect(notePlanCreatedFromAnswer()).toBe(false);
    expect(trackSpy).not.toHaveBeenCalled();
  });
});

describe("N1-01 — the seams are LIVE (source pins + pre-fix negative controls)", () => {
  const gate = read("lib/kidModeGate.ts");
  const loop = read("lib/loopEvents.ts");
  const convo = read("lib/conversationProposals.ts");
  const capture = read("lib/captureProposals.ts");

  it("the scanned files are non-empty (a vacuous pass is not a pass)", () => {
    for (const src of [gate, loop, convo, capture]) {
      expect(src).toBeTruthy();
      expect(src.length).toBeGreaterThan(200);
    }
  });

  it("kid gate: the exit emits kid_session_end BEFORE the gate flips", () => {
    expect(gate).toContain("trackKidSessionEnd({ seconds, activities:");
    // Order pin: the emit call must come before `active = next` in the setter.
    const setter = gate.slice(gate.indexOf("export function setKidModeActive"));
    expect(setter.indexOf("endKidSession(deps)")).toBeGreaterThan(-1);
    expect(setter.indexOf("endKidSession(deps)")).toBeLessThan(setter.indexOf("active = next"));
    // NEGATIVE CONTROL — the pre-fix setter body had no session boundary at all.
    const preFix = [
      "export function setKidModeActive(next: boolean): void {",
      "  if (next === active) return;",
      "  active = next;",
    ].join("\n");
    expect(gate).not.toContain(preFix);
  });

  it("kid gate: the session stamp lives BESIDE the persisted state, not in it", () => {
    expect(gate).toContain('export const KIDMODE_SESSION_SS_KEY = "arbor.kidmode.session"');
    // KidModeState is the persisted shape — it must not have grown a timestamp.
    const state = gate.slice(gate.indexOf("export interface KidModeState"), gate.indexOf("export interface KidModeStorage"));
    expect(state).not.toMatch(/at\??:|startedAt|timestamp|seconds/);
  });

  it("session close: bound from app start, fires once, reads the open stamp", () => {
    expect(loop).toContain("bindSessionClose();");
    expect(loop).toContain("trackSessionClose(");
    expect(loop).toContain("sessionStorage.getItem(SS_SESSION_OPEN)");
    expect(loop).toMatch(/win\.addEventListener\("pagehide"/);
    expect(loop).toMatch(/win\.addEventListener\("visibilitychange"/);
    // NEGATIVE CONTROL — the pre-fix trackAppStart bound nothing.
    const preFix = [
      "export function trackAppStart(): void {",
      "  if (once(LS_INSTALLED)) track(LoopEvent.Install);",
      "  track(LoopEvent.AppOpen);",
      "}",
    ].join("\n");
    expect(loop).not.toContain(preFix);
  });

  it("keep_this: emitted from the record's status, never from a handler", () => {
    expect(convo).toContain("trackKeepThis({");
    expect(convo).toMatch(/if \(record\.status !== "committed" \|\| !record\.commitRef\) return false;/);
    // NEGATIVE CONTROL — a file with no commit guard must fail the pin above.
    const preFix = 'export function noteKeepCommitted(record, surface) {\n  trackKeepThis({ field: record.target, surface });\n}';
    expect(convo).not.toContain(preFix);
    // The reporter must never read the kept text off the record.
    const fn = convo.slice(convo.indexOf("export function noteKeepCommitted"));
    expect(fn.slice(0, fn.indexOf("\n}"))).not.toMatch(/summary|sourceExcerpt/);
  });

  it("plan_from_answer: a latch consumed by the write, not a button handler", () => {
    expect(capture).toContain("trackPlanFromAnswer(surface)");
    expect(capture).toContain("export function markPlanSeededFromAnswer");
    expect(capture).toContain("export function notePlanCreatedFromAnswer");
    // The emit is guarded by the latch: no arm, no event.
    const fn = capture.slice(capture.indexOf("export function notePlanCreatedFromAnswer"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toContain("if (!surface) return false;");
  });

  /* ── N1-01-R2 / R3: the three call sites that were left unwired ──────────
     The helpers above shipped with no callers, so keep_this had zero docs on
     the voice keep path and plan_from_answer had zero docs anywhere. These
     pins fail if a caller is removed OR if it reverts to the pre-fix shape. */

  const coachTab = read("components/tabs/CoachTab.tsx");

  /* The pins are written as PREDICATES so the negative control is a real
     red→green: each predicate is asserted true against the live file and false
     against the verbatim pre-fix block. A bare `not.toContain(preFix)` would
     pass vacuously the moment the pre-fix snippet's indentation drifted. */

  /** R2 — the commit's RECORD is captured and reported. */
  const wiresVoiceKeep = (src: string): boolean =>
    /const record = await commitConversationProposal\(proposal\);/.test(src) &&
    /noteKeepCommitted\(record, "coach-voice"\);/.test(src) &&
    src.indexOf("await commitConversationProposal(proposal);") <
      src.indexOf('noteKeepCommitted(record, "coach-voice");');

  /** R3 step one — the answer arms the latch beside the topic it seeds. */
  const armsPlanLatch = (src: string): boolean =>
    /setPlanChallengeTopic\(/.test(src) && /markPlanSeededFromAnswer\("coach"\);/.test(src);

  /** R3 step two — the actionPlans WRITE consumes it. */
  const consumesPlanLatch = (src: string): boolean =>
    /await plansCol\.upsert\(planData\);/.test(src) &&
    /notePlanCreatedFromAnswer\(\);/.test(src) &&
    src.indexOf("await plansCol.upsert(planData);") < src.indexOf("notePlanCreatedFromAnswer();");

  const PRE_FIX_VOICE_KEEP = [
    "onConfirm={async (proposal) => {",
    "  setProposalBusyId(proposal.id);",
    "  try {",
    "    await commitConversationProposal(proposal);",
    "    setConversationProposals((items) => items.filter((item) => item.id !== proposal.id));",
  ].join("\n");

  const PRE_FIX_PLAN_SEED = [
    "onSaveToPlan={(topic) => {",
    '  setPlanChallengeTopic((topic || msg.text).replace(/[#*]/g, "").slice(0, 140));',
    '  setActiveTab("plans");',
  ].join("\n");

  const PRE_FIX_PLAN_WRITE = [
    "await plansCol.upsert(planData);",
    'track("plan_generated", { title: planData.title });',
  ].join("\n");

  it("R2 — the voice tray keeps the RECORD and reports it (coach-voice)", () => {
    expect(wiresVoiceKeep(coachTab)).toBe(true);
    expect(coachTab).toMatch(
      /import \{[^}]*noteKeepCommitted[^}]*\} from "\.\.\/\.\.\/lib\/conversationProposals"/,
    );
    // NEGATIVE CONTROL — the pre-fix handler discarded the record entirely.
    expect(wiresVoiceKeep(PRE_FIX_VOICE_KEEP)).toBe(false);
  });

  it("R3 — both ends of the two-step conversion are wired", () => {
    expect(armsPlanLatch(coachTab)).toBe(true);
    expect(coachTab).toContain('from "../../lib/captureProposals"');
    expect(consumesPlanLatch(arborCtx)).toBe(true);
    expect(arborCtx).toContain('from "../lib/captureProposals"');
    // NEGATIVE CONTROLS — the pre-fix seed armed nothing; the pre-fix write
    // emitted plan_generated (with the title) and consumed no latch.
    expect(armsPlanLatch(PRE_FIX_PLAN_SEED)).toBe(false);
    expect(consumesPlanLatch(PRE_FIX_PLAN_WRITE)).toBe(false);
  });

  it("no second analytics logger was introduced: all four go through kpiEvents", () => {
    for (const src of [gate, convo, capture]) {
      expect(src).not.toMatch(/from "\.\/analytics"/);
    }
    // loopEvents legitimately uses track() for its own families and the new
    // helper for this one — but it must not open-code the close event's name.
    expect(loop).not.toContain('track("session_close"');
  });
});
