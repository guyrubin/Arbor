/**
 * B-AI-06 — the single-offer coordinator guard.
 *
 *  · the precedence table IS the contract (one row per adjacent pair, plus the
 *    full fixture: unrated step + appointment tomorrow + rhythm cue → follow-up);
 *  · quiet hours and the 2/day ceiling bind (the jitai.test.ts clock);
 *  · Later / Not today / Undo, and three dismissals = seven days of silence;
 *  · two children: each line is built from its own state only;
 *  · Today and Ask mount at most ONE proactive frame (render + source scan).
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  appointmentInWindow,
  chooseOffer,
  decideOffer,
  dismissOfferIn,
  familyOfferLines,
  ledgerSilence,
  OFFER_PRECEDENCE,
  snoozeOfferIn,
  undoOfferIn,
  type OfferKind,
  type OfferState,
} from "./companionOffer";
import { DEFAULT_PREFS } from "../growth/jitaiPrefs";
import CompanionOfferSlot from "../components/overview/CompanionOfferSlot";
import type { Nudge } from "./jitai";

// Build an epoch ms whose LOCAL hour is `h` (same clock as jitai.test.ts).
const at = (h: number, day = 17) => new Date(2026, 5, day, h, 0, 0).getTime();
const DAY = 86_400_000;

const nudge = (kind: Nudge["kind"]): Nudge => ({
  kind,
  headlineKey: `nudge.${kind}.headline`,
  bodyKey: `nudge.${kind}.body`,
  ctaKey: `nudge.${kind}.cta`,
  vars: { name: "Noa" },
  action: kind === "bedtime" ? "bedtime-stories" : kind === "prep" ? "coach" : "overview",
  tone: "sky",
});

const empty = (over: Partial<OfferState> = {}): OfferState => ({
  nowMs: at(16),
  surface: "today",
  pendingFollowUp: null,
  whatChanged: null,
  appointment: null,
  screeningRecheckDue: false,
  nudge: null,
  groundedStep: null,
  prefs: { ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types } },
  shownToday: [],
  ledger: {},
  ...over,
});

/** A state where every candidate is in hand. */
const full = (over: Partial<OfferState> = {}): OfferState =>
  empty({
    pendingFollowUp: { id: "today.c.2026-06-16", recommendation: "Name the next transition five minutes ahead" },
    tomorrowReason: { kind: "story" },
    whatChanged: { id: "welcome-back" },
    appointment: { id: "a1", dayOffset: 1 },
    screeningRecheckDue: true,
    nudge: nudge("prep"),
    groundedStep: { id: "hitting" },
    ...over,
  });

/** Remove candidates one at a time, top down; the winner walks the table. */
const withoutTop = (n: number): OfferState => {
  const s = full();
  const strip: Record<OfferKind, () => void> = {
    "follow-up": () => { s.pendingFollowUp = null; },
    "tomorrow-reason": () => { s.tomorrowReason = null; },
    "what-changed": () => { s.whatChanged = null; },
    appointment: () => { s.appointment = null; },
    "screening-recheck": () => { s.screeningRecheckDue = false; },
    rhythm: () => { s.nudge = nudge("bedtime"); },
    "grounded-step": () => { s.groundedStep = null; },
    tonight: () => { s.nudge = nudge("log"); },
    engagement: () => { s.nudge = null; },
  };
  for (const k of OFFER_PRECEDENCE.slice(0, n)) strip[k]();
  return s;
};

describe("B-AI-06 — precedence table", () => {
  it("the table is the 23 Sep order", () => {
    expect([...OFFER_PRECEDENCE]).toEqual([
      "follow-up", "tomorrow-reason", "what-changed", "appointment", "screening-recheck", "rhythm", "grounded-step", "tonight", "engagement",
    ]);
  });

  it("each row wins over every row below it", () => {
    OFFER_PRECEDENCE.forEach((kind, i) => {
      expect(chooseOffer(withoutTop(i))?.kind, `row ${i}`).toBe(kind);
    });
    expect(chooseOffer(withoutTop(OFFER_PRECEDENCE.length))).toBeNull();
  });

  it("fixture: an unrated step + an appointment tomorrow + a rhythm cue → ONE offer, the follow-up, whose reason names the step", () => {
    const decision = decideOffer(empty({
      pendingFollowUp: { id: "today.c.2026-06-16", recommendation: "Name the next transition five minutes ahead" },
      appointment: { id: "a1", dayOffset: 1 },
      nudge: nudge("prep"),
    }));
    expect(decision.offer?.kind).toBe("follow-up");
    expect(decision.offer?.reasonKey).toBe("elev.offer.reason.followUp");
    expect(decision.offer?.reasonVars?.step).toBe("Name the next transition five minutes ahead");
    // Arbitration is not suppression: losing candidates emit nothing.
    expect(decision.suppressed).toEqual([]);
  });

  it("what-changed is a Today-only kind (Ask has no renderer for it)", () => {
    expect(chooseOffer(empty({ whatChanged: { id: "birthday" }, surface: "today" }))?.kind).toBe("what-changed");
    expect(chooseOffer(empty({ whatChanged: { id: "birthday" }, surface: "coach" }))).toBeNull();
  });

  it("appointment reason keys: today / tomorrow / in N days / yesterday", () => {
    const key = (dayOffset: number) => chooseOffer(empty({ appointment: { id: "a", dayOffset } }))?.reasonKey;
    expect([key(0), key(1), key(2), key(-1)]).toEqual([
      "elev.offer.reason.apptToday", "elev.offer.reason.apptTomorrow", "elev.offer.reason.apptSoon", "elev.offer.reason.apptYesterday",
    ]);
  });
});

describe("B-AI-06 — quiet hours and the 2/day ceiling (jitai clock)", () => {
  it("quiet hours silence the whole slot and say why", () => {
    const d = decideOffer(full({ nowMs: at(22) }));
    expect(d.offer).toBeNull();
    expect(d.suppressed.every((s) => s.reason === "quiet_hours")).toBe(true);
    expect(d.suppressed.length).toBeGreaterThan(0);
    // Negative control: the same state at 16:00 speaks.
    expect(chooseOffer(full({ nowMs: at(16) }))).not.toBeNull();
  });

  it("two distinct kinds shown today → a third new kind stays silent; a shown kind keeps its slot", () => {
    const capped = decideOffer(empty({ appointment: { id: "a", dayOffset: 0 }, shownToday: ["follow-up", "prep"] }));
    expect(capped.offer).toBeNull();
    expect(capped.suppressed).toEqual([{ kind: "appointment", reason: "ceiling" }]);
    const kept = chooseOffer(empty({ appointment: { id: "a", dayOffset: 0 }, shownToday: ["appointment", "prep"] }));
    expect(kept?.kind).toBe("appointment");
  });

  it("a ceiling-blocked top candidate does not starve an already-shown lower one", () => {
    const d = decideOffer(empty({
      appointment: { id: "a", dayOffset: 1 },
      nudge: nudge("prep"),
      shownToday: ["follow-up", "prep"],
    }));
    expect(d.offer?.kind).toBe("rhythm");
    expect(d.suppressed).toEqual([{ kind: "appointment", reason: "ceiling" }]);
  });
});

describe("B-AI-06 — Later, Not today, Undo, and the 7-day suppression", () => {
  const now = at(10);
  it("Later snoozes for a few hours without a strike", () => {
    const l = snoozeOfferIn({}, "appointment", now);
    expect(ledgerSilence(l, "appointment", now + 3_600_000)).toBe("snoozed");
    expect(ledgerSilence(l, "appointment", now + 4 * 3_600_000)).toBeNull();
    expect(l.appointment?.strikes ?? []).toEqual([]);
  });

  it("Not today hides the kind for the rest of the day; tomorrow it may speak", () => {
    const l = dismissOfferIn({}, "screening-recheck", now);
    expect(ledgerSilence(l, "screening-recheck", at(20))).toBe("dismissed");
    expect(ledgerSilence(l, "screening-recheck", at(10, 18))).toBeNull();
  });

  it("three dismissals of a kind within a week = seven days of silence", () => {
    let l = dismissOfferIn({}, "rhythm", at(10, 1));
    l = dismissOfferIn(l, "rhythm", at(10, 2));
    expect(ledgerSilence(l, "rhythm", at(10, 3))).toBeNull();
    l = dismissOfferIn(l, "rhythm", at(10, 3));
    expect(ledgerSilence(l, "rhythm", at(10, 9))).toBe("suppressed_7d");
    expect(ledgerSilence(l, "rhythm", at(11, 10))).toBeNull();
    const d = decideOffer(empty({ nowMs: at(16, 5), nudge: nudge("prep"), ledger: l }));
    expect(d.offer).toBeNull();
    expect(d.suppressed).toEqual([{ kind: "rhythm", reason: "suppressed_7d" }]);
  });

  it("strikes older than the window do not count", () => {
    let l = dismissOfferIn({}, "rhythm", at(10, 1));
    l = dismissOfferIn(l, "rhythm", at(10, 2));
    l = dismissOfferIn(l, "rhythm", at(10, 12));
    expect(ledgerSilence(l, "rhythm", at(10, 13))).toBeNull();
  });

  it("Undo restores the entry before the last action", () => {
    const l = dismissOfferIn({}, "appointment", now);
    const u = undoOfferIn(l, "appointment");
    expect(ledgerSilence(u, "appointment", now)).toBeNull();
    expect(u.appointment).toBeUndefined();
  });
});

describe("B-AI-06 — multi-child isolation", () => {
  it("each family line is built from that child's own state only", () => {
    const a = empty({ pendingFollowUp: { id: "today.a.2026-06-16", recommendation: "A_STEP warm bath first" } });
    const b = empty({ appointment: { id: "b-appt", dayOffset: 2 }, ledger: dismissOfferIn({}, "follow-up", at(10)) });
    const lines = familyOfferLines([{ childId: "a", state: a }, { childId: "b", state: b }]);
    expect(lines.map((l) => [l.childId, l.offer?.kind])).toEqual([["a", "follow-up"], ["b", "appointment"]]);
    expect(JSON.stringify(lines[1])).not.toContain("A_STEP");
    // B's dismissal of follow-up never silences A.
    expect(lines[0].offer?.reasonVars?.step).toBe("A_STEP warm bath first");
  });
});

describe("B-AI-06 — appointment window", () => {
  const now = at(10);
  it("upcoming within two days beats yesterday; done and far ones are ignored", () => {
    const iso = (d: number) => new Date(now + d * DAY).toISOString();
    expect(appointmentInWindow([{ id: "y", whenIso: iso(-1) }, { id: "t", whenIso: iso(1) }], now)).toEqual({ id: "t", dayOffset: 1 });
    expect(appointmentInWindow([{ id: "y", whenIso: iso(-1) }], now)).toEqual({ id: "y", dayOffset: -1 });
    expect(appointmentInWindow([{ id: "f", whenIso: iso(5) }, { id: "d", whenIso: iso(1), status: "done" }, { id: "x" }], now)).toBeNull();
  });
});

/* ── Render: at most ONE data-proactive frame per surface ─────────────────── */

const arbor = vi.hoisted(() => ({
  value: {
    actionLoop: [] as unknown[],
    recordTodayOutcome: () => {},
    childProfile: { id: "c", name: "Noa" },
    setActiveTab: () => {},
    requestCapture: () => {},
  },
}));
vi.mock("../context/ArborContext", () => ({ useArbor: () => arbor.value }));
vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: "en",
    t: (key: string, vars?: Record<string, string | number>) => (vars?.step ? `${key}::${vars.step}` : key),
  }),
}));
vi.mock("../context/ToastContext", () => ({ useToastOptional: () => null }));

describe("B-AI-06 — render: exactly one proactive module", () => {
  it("the fixture renders one data-proactive frame, the follow-up, reason naming the step", () => {
    const pendingAt = new Date(Date.now() - 30 * 3_600_000);
    const id = `today.c.${pendingAt.getFullYear()}-${String(pendingAt.getMonth() + 1).padStart(2, "0")}-${String(pendingAt.getDate()).padStart(2, "0")}`;
    arbor.value.actionLoop = [{ id, status: "accepted", acceptedAt: pendingAt.toISOString(), recommendation: "Name the next transition five minutes ahead", source: "coach", capacity: "standard" }];
    const offer = chooseOffer(empty({
      nowMs: at(16),
      pendingFollowUp: { id, recommendation: "Name the next transition five minutes ahead" },
      appointment: { id: "a1", dayOffset: 1 },
      nudge: nudge("prep"),
    }));
    const controls = { snooze: () => {}, dismiss: () => {}, undo: () => {}, refresh: () => {} };
    const html = renderToStaticMarkup(createElement(CompanionOfferSlot, { surface: "today", offer, controls }));
    expect(html.match(/data-proactive=/g) ?? []).toHaveLength(1);
    expect(html).toContain('data-offer-kind="follow-up"');
    expect(html).toContain("elev.offer.reason.followUp::Name the next transition five minutes ahead");
    expect(html).toContain('data-testid="carry-over-action"');
    // Negative control: no offer → nothing at all.
    expect(renderToStaticMarkup(createElement(CompanionOfferSlot, { surface: "today", offer: null, controls }))).toBe("");
  });

  it("Today and Ask mount no proactive renderer outside the coordinator (source scan)", () => {
    const strip = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const read = (rel: string) => strip(readFileSync(path.join(__dirname, "..", rel), "utf8"));
    const overview = read("components/tabs/OverviewTab.tsx");
    const coach = read("components/tabs/CoachTab.tsx");
    for (const src of [overview, coach]) {
      expect(src).not.toMatch(/<CarryOverActionAsk\b/);
      expect(src).not.toMatch(/<RhythmCue\b/);
      expect(src).not.toMatch(/<HardMomentTodayOffer\b/);
      expect((src.match(/<CompanionOfferSlot\b/g) ?? []).length).toBe(1);
    }
    // Today's only other proactive stamp is the lifecycle card, and it renders
    // only when the coordinator chose "what-changed" — which the slot skips.
    expect((overview.match(/data-proactive=/g) ?? []).length).toBe(1);
    expect(overview).toMatch(/todayOffer\.offer\?\.kind === "what-changed" && \(\s*<div data-module="today-lifecycle" data-proactive=""/);
    const slot = read("components/overview/CompanionOfferSlot.tsx");
    expect(slot).toMatch(/if \(!offer \|\| offer\.kind === "what-changed"\) return null;/);
  });
});

describe("B-TODAY-18 — tomorrow's reason is a coordinator candidate", () => {
  it("ranks right after the carry-over question, with its own reason line, on Today and Ask", () => {
    expect(chooseOffer(empty({ tomorrowReason: { kind: "ritual" }, appointment: { id: "a", dayOffset: 0 } }))?.kind).toBe("tomorrow-reason");
    expect(chooseOffer(empty({ tomorrowReason: { kind: "ritual" }, pendingFollowUp: { id: "x", recommendation: "Step" } }))?.kind).toBe("follow-up");
    expect(chooseOffer(empty({ tomorrowReason: { kind: "moment" }, surface: "coach" }))?.reasonKey).toBe("elev.offer.reason.tomorrow");
  });

  it("the slot renders TomorrowReasonCard; Growth no longer mounts the card but keeps the close-of-day write", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
    const slot = read("../components/overview/CompanionOfferSlot.tsx");
    expect(slot).toContain('case "tomorrow-reason":');
    expect(slot).toContain("<TomorrowReasonCard onResolved={controls.refresh} />");
    const growth = read("../components/tabs/DevelopmentTab.tsx");
    expect(growth).not.toContain("<TomorrowReasonCard");
    expect(growth).toContain("closeDay(childProfile.id, Date.now(), returnSignals);");
    const hook = read("../components/overview/useCompanionOffer.ts");
    expect(hook).toContain("reasonForThisOpen(childId, now)");
  });
});
