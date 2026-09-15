/**
 * N1-06 guard — the ONE delivery contract.
 *
 * Two things are being defended here, and only one of them is behaviour.
 *
 *  1. The four suppression reasons, at their boundaries. A contract whose
 *     quiet-hours edge is off by one hour is a contract that fires at 21:00.
 *  2. That `planNudge` DELEGATES rather than reimplements. The dominant failure
 *     mode in this area is not a wrong answer — it is a second, drifting copy
 *     of the quiet-hours or ceiling rule living somewhere else. The import pin
 *     below, with a locally-constant implementation as its negative control, is
 *     the assertion that matters most in this file.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { planNudge, isDeliveredNudge, NUDGE_DAILY_CEILING } from "./nudgeSchedule";
import { DEFAULT_PREFS, type JitaiPrefs } from "./jitaiPrefs";
import { NUDGE_TEMPLATES } from "./nudgeTemplates";
import type { Nudge } from "../lib/jitai";
import {
  scheduleLocalNudge,
  configureLocalNotifications,
  resetLocalNotifications,
  localNotificationsAvailable,
  LOCAL_NOTIFICATIONS_PLUGIN_ID,
} from "../lib/localNotifications";

const prefsWith = ({
  types,
  ...rest
}: Partial<Omit<JitaiPrefs, "types">> & { types?: Partial<JitaiPrefs["types"]> } = {}): JitaiPrefs => ({
  ...DEFAULT_PREFS,
  ...rest,
  types: { ...DEFAULT_PREFS.types, ...(types ?? {}) },
});

/** A candidate of a given kind. Built by hand so the contract is tested, not
 *  jitai's selection logic (which has its own suite). */
const candidateOf = (kind: Nudge["kind"]): Nudge => ({
  kind,
  headlineKey: `nudge.${kind}.headline`,
  bodyKey: `nudge.${kind}.body`,
  ctaKey: `nudge.${kind}.cta`,
  vars: { name: "Dylan" },
  action: "overview",
  tone: "mint",
});

/** 2026-06-17 at local hour h. */
const at = (h: number) => new Date(2026, 5, 17, h, 0, 0).getTime();

describe("N1-06 — quiet hours, at the boundary", () => {
  const prefs = prefsWith({ quietStart: 21, quietEnd: 8 });

  it("22:00 inside a 21→08 window suppresses with reason quiet_hours", () => {
    const plan = planNudge({
      prefs,
      shownToday: [],
      now: at(22),
      candidate: candidateOf("log"),
      channel: "bell",
    });
    expect(plan).toEqual({
      deliver: false,
      reason: "quiet_hours",
      kind: "log",
      channel: "bell",
    });
  });

  it("EXACTLY quietStart (21:00) is inside the window — the parent's boundary is inclusive", () => {
    const plan = planNudge({
      prefs,
      shownToday: [],
      now: at(21),
      candidate: candidateOf("log"),
      channel: "bell",
    });
    expect(plan.deliver).toBe(false);
    expect((plan as { reason: string }).reason).toBe("quiet_hours");
  });

  it("EXACTLY quietEnd (08:00) is OUTSIDE the window — the day has started", () => {
    const plan = planNudge({
      prefs,
      shownToday: [],
      now: at(8),
      candidate: candidateOf("log"),
      channel: "bell",
    });
    expect(plan.deliver).toBe(true);
  });

  it("07:59 is still quiet", () => {
    const plan = planNudge({
      prefs,
      shownToday: [],
      now: new Date(2026, 5, 17, 7, 59, 0).getTime(),
      candidate: candidateOf("log"),
      channel: "bell",
    });
    expect((plan as { reason: string }).reason).toBe("quiet_hours");
  });

  it("quiet hours are answered even with NO candidate — so the boundary is provable on real traffic", () => {
    const plan = planNudge({
      prefs,
      shownToday: [],
      now: at(23),
      candidate: null,
      channel: "local",
    });
    expect(plan).toEqual({
      deliver: false,
      reason: "quiet_hours",
      kind: null,
      channel: "local",
    });
  });

  it("a non-wrapping window (01→06) is handled by the same jitaiPrefs helper", () => {
    const p = prefsWith({ quietStart: 1, quietEnd: 6 });
    expect(
      planNudge({ prefs: p, shownToday: [], now: at(3), candidate: candidateOf("log"), channel: "bell" }).deliver,
    ).toBe(false);
    expect(
      planNudge({ prefs: p, shownToday: [], now: at(12), candidate: candidateOf("log"), channel: "bell" }).deliver,
    ).toBe(true);
  });
});

describe("N1-06 — the max-2 ceiling, at the boundary", () => {
  const prefs = prefsWith({ quietStart: 21, quietEnd: 8 });

  it(`a THIRD distinct kind at exactly NUDGE_DAILY_CEILING (${NUDGE_DAILY_CEILING}) is suppressed`, () => {
    expect(NUDGE_DAILY_CEILING).toBe(2);
    const plan = planNudge({
      prefs,
      shownToday: ["log", "calm"],
      now: at(16),
      candidate: candidateOf("practice"),
      channel: "bell",
    });
    expect(plan).toEqual({
      deliver: false,
      reason: "ceiling",
      kind: "practice",
      channel: "bell",
    });
  });

  it("ABOVE the ceiling (three kinds already shown) is still suppressed", () => {
    const plan = planNudge({
      prefs,
      shownToday: ["log", "calm", "prep"],
      now: at(16),
      candidate: candidateOf("practice"),
      channel: "bell",
    });
    expect((plan as { reason: string }).reason).toBe("ceiling");
  });

  it("at exactly one BELOW the ceiling a new kind is delivered", () => {
    const plan = planNudge({
      prefs,
      shownToday: ["log"],
      now: at(16),
      candidate: candidateOf("practice"),
      channel: "bell",
    });
    expect(plan.deliver).toBe(true);
  });

  it("a kind ALREADY shown today keeps its slot even at the ceiling — re-showing costs nothing new", () => {
    const plan = planNudge({
      prefs,
      shownToday: ["log", "calm"],
      now: at(16),
      candidate: candidateOf("log"),
      channel: "bell",
    });
    expect(plan.deliver).toBe(true);
  });
});

describe("N1-06 — type_off and no_candidate", () => {
  const prefs = prefsWith({ quietStart: 21, quietEnd: 8 });

  it("a kind whose parent switch is off is suppressed as type_off, not as ceiling", () => {
    const off = prefsWith({ quietStart: 21, quietEnd: 8, types: { guidance: false } });
    const plan = planNudge({
      // At the ceiling AND switched off: the parent's explicit switch is the
      // honest explanation, so precedence is pinned here.
      prefs: off,
      shownToday: ["log", "practice"],
      now: at(16),
      candidate: candidateOf("calm"),
      channel: "bell",
    });
    expect(plan).toEqual({
      deliver: false,
      reason: "type_off",
      kind: "calm",
      channel: "bell",
    });
  });

  it("a kind with NO parent switch (log/practice/bedtime) is not type_off'd", () => {
    const off = prefsWith({ quietStart: 21, quietEnd: 8, types: { guidance: false } });
    const plan = planNudge({
      prefs: off,
      shownToday: [],
      now: at(16),
      candidate: candidateOf("log"),
      channel: "bell",
    });
    expect(plan.deliver).toBe(true);
  });

  it("DAY 0 — no candidate is `no_candidate`, and carries no kind", () => {
    const plan = planNudge({
      prefs,
      shownToday: [],
      now: at(16),
      candidate: null,
      channel: "bell",
    });
    expect(plan).toEqual({
      deliver: false,
      reason: "no_candidate",
      kind: null,
      channel: "bell",
    });
  });
});

describe("N1-06 — a delivered plan carries the name-free template alongside the in-app candidate", () => {
  it("template comes from nudgeTemplates and is the record's own object", () => {
    const plan = planNudge({
      prefs: prefsWith({ quietStart: 21, quietEnd: 8 }),
      shownToday: [],
      now: at(16),
      candidate: candidateOf("log"),
      channel: "local",
    });
    expect(plan.deliver).toBe(true);
    if (!isDeliveredNudge(plan)) return;
    expect(plan.template).toBe(NUDGE_TEMPLATES.log);
    expect("vars" in plan.template).toBe(false);
    expect(plan.channel).toBe("local");
    // The candidate is still handed back — the bell renders it, in-app, behind
    // auth. It is the thing a channel must NOT send.
    expect(plan.candidate.vars).toBeDefined();
  });
});

describe("N1-06 — planNudge DELEGATES; it does not reimplement the contract", () => {
  const src = readFileSync(path.join(process.cwd(), "src/growth/nudgeSchedule.ts"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("imports isInQuietHours, isUnderDailyCeiling and NUDGE_DAILY_CEILING from growth/jitaiPrefs", () => {
    expect(code).toMatch(/import \{[\s\S]*?\bisInQuietHours\b[\s\S]*?\} from "\.\/jitaiPrefs"/);
    expect(code).toMatch(/import \{[\s\S]*?\bisUnderDailyCeiling\b[\s\S]*?\} from "\.\/jitaiPrefs"/);
    expect(code).toMatch(/import \{[\s\S]*?\bNUDGE_DAILY_CEILING\b[\s\S]*?\} from "\.\/jitaiPrefs"/);
    expect(code).toMatch(/isInQuietHours\(prefs, now\)/);
    expect(code).toMatch(/isUnderDailyCeiling\(shownToday\.length\)/);
  });

  it("holds NO local quiet-hours or ceiling constant of its own", () => {
    // No literal hour arithmetic, no locally-declared cap.
    expect(code).not.toMatch(/getHours\(\)/);
    expect(code).not.toMatch(/const\s+\w*(QUIET|CEILING|MAX_?NUDGE)\w*\s*=/i);
    expect(code).not.toMatch(/shownToday\.length\s*[<>]=?\s*\d/);
  });

  it("NEGATIVE CONTROL — a planNudge that inlines its own quiet hours fails both pins", () => {
    const badImplementation = `
      const QUIET_START = 21;
      const QUIET_END = 8;
      export function planNudge(input) {
        const hour = new Date(input.now).getHours();
        if (hour >= QUIET_START || hour < QUIET_END) {
          return { deliver: false, reason: "quiet_hours" };
        }
        if (input.shownToday.length >= 2) {
          return { deliver: false, reason: "ceiling" };
        }
        return { deliver: true };
      }`;
    // It would pass every behaviour case above — and fail the pins that matter.
    expect(badImplementation).not.toMatch(
      /import \{[\s\S]*?\bisInQuietHours\b[\s\S]*?\} from "\.\/jitaiPrefs"/,
    );
    expect(badImplementation).toMatch(/getHours\(\)/);
    expect(badImplementation).toMatch(/const\s+\w*(QUIET|CEILING|MAX_?NUDGE)\w*\s*=/i);
    expect(badImplementation).toMatch(/shownToday\.length\s*[<>]=?\s*\d/);
  });

  it("is pure — no analytics call, no ledger write, no send", () => {
    expect(code).not.toMatch(/recordNudgeShown|trackNudge|localStorage|fetch\(/);
  });
});

describe("N1-06 — the local-notification adapter fails closed and imports nothing on web", () => {
  beforeEach(() => resetLocalNotifications());

  it("IMPORT SPY — on web, schedule() resolves unsupported and the loader is never reached", async () => {
    const loader = vi.fn(async () => {
      throw new Error("the plugin must not be loaded on web");
    });
    configureLocalNotifications({ loader, isNative: () => false });

    const result = await scheduleLocalNudge({ title: "t", body: "b" });

    expect(result).toEqual({ scheduled: false, reason: "unsupported" });
    expect(loader).not.toHaveBeenCalled();
    expect(localNotificationsAvailable()).toBe(false);
  });

  it("SOURCE PIN — the module contains no import of the plugin, static or dynamic", () => {
    const adapter = readFileSync(path.join(process.cwd(), "src/lib/localNotifications.ts"), "utf8");
    const adapterCode = adapter.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // The id exists as DATA (the follow-up's breadcrumb) …
    expect(adapterCode).toContain(LOCAL_NOTIFICATIONS_PLUGIN_ID);
    // … but never as a module specifier. `@capacitor/local-notifications` is
    // absent from node_modules (junctioned worktree), so a real import would
    // break `tsc --noEmit` and `vite build`. See FOLLOW-UPS-N1.md N1-06-F1.
    expect(adapterCode).not.toMatch(/import\s*\(\s*["']@capacitor\/local-notifications["']/);
    expect(adapterCode).not.toMatch(/from\s*["']@capacitor\/local-notifications["']/);
  });

  it("native WITHOUT a registered loader fails closed as plugin_unavailable — never a silent success", async () => {
    configureLocalNotifications({ isNative: () => true });
    const result = await scheduleLocalNudge({ title: "t", body: "b" });
    expect(result).toEqual({ scheduled: false, reason: "plugin_unavailable" });
  });

  it("native WITH a loader schedules exactly the strings it was handed — and nothing else", async () => {
    const schedule = vi.fn(async (_options: { notifications: Array<Record<string, unknown>> }) => undefined);
    configureLocalNotifications({
      isNative: () => true,
      loader: async () => ({
        requestPermissions: async () => ({ display: "granted" }),
        schedule,
      }),
    });

    const result = await scheduleLocalNudge({ title: "There's a moment", body: "One line." });

    expect(result.scheduled).toBe(true);
    expect(schedule).toHaveBeenCalledTimes(1);
    const payload = schedule.mock.calls[0][0] as unknown as {
      notifications: Array<Record<string, unknown>>;
    };
    expect(Object.keys(payload.notifications[0]).sort()).toEqual(["body", "id", "title"]);
    expect(JSON.stringify(payload)).not.toMatch(/\{name\}|\$\{|\{\{/);
  });

  it("a denied permission does not schedule, and a throwing plugin is caught", async () => {
    const schedule = vi.fn(async (_options: { notifications: Array<Record<string, unknown>> }) => undefined);
    configureLocalNotifications({
      isNative: () => true,
      loader: async () => ({
        requestPermissions: async () => ({ display: "denied" }),
        schedule,
      }),
    });
    expect(await scheduleLocalNudge({ title: "t", body: "b" })).toEqual({
      scheduled: false,
      reason: "permission_denied",
    });
    expect(schedule).not.toHaveBeenCalled();

    configureLocalNotifications({
      isNative: () => true,
      loader: async () => {
        throw new Error("plugin blew up");
      },
    });
    expect(await scheduleLocalNudge({ title: "t", body: "b" })).toEqual({
      scheduled: false,
      reason: "error",
    });
  });

  it("the adapter cannot be handed a Nudge — its payload type admits resolved strings only", () => {
    const adapter = readFileSync(path.join(process.cwd(), "src/lib/localNotifications.ts"), "utf8");
    // No route for `vars` to enter a lock-screen payload.
    expect(adapter).not.toMatch(/\bvars\b\s*[:?]/);
    expect(adapter).not.toMatch(/childName|firstName|childProfile/);
  });
});
