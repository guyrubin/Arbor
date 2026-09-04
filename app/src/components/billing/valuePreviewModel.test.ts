/**
 * ENG-21 — the in-context value preview.
 *
 * Two things are being guarded here, and only one of them is arithmetic.
 *
 *  1. WHO CAN SEE IT. A subscriber, an unverified entitlement, an unmetered
 *     plan, a parent already at the wall, a busy or offline surface, a thread
 *     with any turn in it, and a same-day dismissal must each, on their own,
 *     be enough to render nothing. Every one of those has a negative control
 *     that flips the single field and gets the card back — otherwise a gate
 *     that always returns false would pass this file.
 *
 *  2. WHAT IT SAYS. This is a monetisation surface in a parenting app, so the
 *     copy rules are the hard part: no invented commercial claim, nothing
 *     about the child, and no bare text in the JSX at all. Those are proved by
 *     parsing the shipped component — comments stripped first, so the key
 *     names written in its doc block cannot be mistaken for calls, and the
 *     stripped text asserted real and non-empty so a scan that reads nothing
 *     cannot pass.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { EntitlementInfo } from "../../lib/api";
import { isChildScopedKey } from "../../lib/childLocalState";
import { en as baseEn, he as baseHe, translate } from "../../lib/i18n";
import * as planclarity from "../../lib/i18nElevation/planclarity";
import {
  coachRemaining,
  decideValuePreview,
  localDayKey,
  readValuePreviewDismissal,
  writeValuePreviewDismissal,
  VALUE_PREVIEW_DISMISS_KEY,
  VALUE_PREVIEW_NEAR_LIMIT,
  VALUE_PREVIEW_SURFACE,
  type ValuePreviewInput,
} from "./valuePreviewModel";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "..");
const COMPONENT = path.join(here, "ValuePreview.tsx");
const componentSource = readFileSync(COMPONENT, "utf8").replace(/\r\n/g, "\n");

/** Block comments, then `//` to end of line — but never a `//` that follows a
 *  colon, so a URL inside a string survives. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const componentCode = stripComments(componentSource);

const freeEntitlement = (over: Partial<EntitlementInfo> = {}): EntitlementInfo => ({
  plan: "free",
  limits: { coachMessagesPerDay: 10, maxChildren: 1, professionalReports: false, advancedPlans: false, coParentSeats: 0 },
  source: "default",
  enforced: true,
  usage: { coachMessagesToday: 8 },
  status: "active",
  ...over,
});

/** A parent who SHOULD see it: verified free, 2 of 10 left, calm empty thread. */
const showing = (over: Partial<ValuePreviewInput> = {}): ValuePreviewInput => ({
  entitlement: freeEntitlement(),
  entitlementLoading: false,
  threadEmpty: true,
  surfaceIdle: true,
  online: true,
  dismissedOn: null,
  today: "2026-09-04",
  ...over,
});

describe("the baseline actually shows — nothing below is vacuously true", () => {
  it("a verified free parent, near the limit, on a calm empty thread", () => {
    const decision = decideValuePreview(showing());
    expect(decision).toEqual({ show: true, reason: "shown", used: 8, limit: 10, remaining: 2 });
  });

  it("the threshold is the near-limit constant, not an accident", () => {
    const atThreshold = freeEntitlement({ usage: { coachMessagesToday: 10 - VALUE_PREVIEW_NEAR_LIMIT } });
    const justOver = freeEntitlement({ usage: { coachMessagesToday: 10 - VALUE_PREVIEW_NEAR_LIMIT - 1 } });
    expect(decideValuePreview(showing({ entitlement: atThreshold })).show).toBe(true);
    expect(decideValuePreview(showing({ entitlement: justOver }))).toEqual({ show: false, reason: "not-near-limit" });
  });
});

describe("it can never render for someone who is already paying", () => {
  it.each(["plus", "family"] as const)("plan %s renders nothing", (plan) => {
    const entitlement = freeEntitlement({ plan, limits: { coachMessagesPerDay: null, maxChildren: 6, professionalReports: true, advancedPlans: true, coParentSeats: plan === "family" ? 1 : 0 } });
    expect(decideValuePreview(showing({ entitlement }))).toEqual({ show: false, reason: "already-subscribed" });
  });

  it("an unmetered plan renders nothing even if the plan string still says free", () => {
    const entitlement = freeEntitlement({ limits: { ...freeEntitlement().limits, coachMessagesPerDay: null } });
    expect(decideValuePreview(showing({ entitlement }))).toEqual({ show: false, reason: "not-metered" });
  });

  it("unenforced (beta full access) meets no wall, so there is nothing to preview", () => {
    const entitlement = freeEntitlement({ enforced: false });
    expect(decideValuePreview(showing({ entitlement }))).toEqual({ show: false, reason: "not-enforced" });
  });

  it("the subscriber check runs BEFORE any surface condition", () => {
    // A Plus parent on a busy, offline, active thread must be refused for
    // being a subscriber — not incidentally, by one of the later gates.
    const entitlement = freeEntitlement({ plan: "plus", limits: { ...freeEntitlement().limits, coachMessagesPerDay: null } });
    const decision = decideValuePreview(showing({ entitlement, threadEmpty: false, surfaceIdle: false, online: false }));
    expect(decision).toEqual({ show: false, reason: "already-subscribed" });
  });
});

describe("it can never render on an unverified entitlement", () => {
  it("the client fallback (we could not ask) renders nothing", () => {
    // MOB-08: a Plus family on a flaky connection reads as Free here.
    const entitlement = freeEntitlement({ source: "client_fallback" });
    expect(decideValuePreview(showing({ entitlement }))).toEqual({ show: false, reason: "entitlement-unverified" });
  });

  it("still loading renders nothing", () => {
    expect(decideValuePreview(showing({ entitlementLoading: true }))).toEqual({ show: false, reason: "entitlement-loading" });
  });

  it("negative control — the SAME entitlement from the server does show", () => {
    expect(decideValuePreview(showing({ entitlement: freeEntitlement({ source: "store" }) })).show).toBe(true);
  });
});

describe("it never appears mid-task, mid-crisis, or after the wall", () => {
  it("a thread with any turn in it renders nothing", () => {
    expect(decideValuePreview(showing({ threadEmpty: false }))).toEqual({ show: false, reason: "thread-in-use" });
  });

  it("a busy surface renders nothing", () => {
    // CoachTab passes surfaceIdle=false while a request is streaming, while a
    // failure card is up, while voice is live and while the camera sheet is open.
    expect(decideValuePreview(showing({ surfaceIdle: false }))).toEqual({ show: false, reason: "surface-busy" });
  });

  it("offline renders nothing", () => {
    expect(decideValuePreview(showing({ online: false }))).toEqual({ show: false, reason: "offline" });
  });

  it("at zero remaining the paywall owns the moment, not this card", () => {
    const spent = freeEntitlement({ usage: { coachMessagesToday: 10 } });
    expect(decideValuePreview(showing({ entitlement: spent }))).toEqual({ show: false, reason: "already-at-limit" });
    const over = freeEntitlement({ usage: { coachMessagesToday: 14 } });
    expect(decideValuePreview(showing({ entitlement: over }))).toEqual({ show: false, reason: "already-at-limit" });
  });

  it("negative control — one message left is BEFORE the wall and does show", () => {
    const one = freeEntitlement({ usage: { coachMessagesToday: 9 } });
    expect(decideValuePreview(showing({ entitlement: one }))).toEqual({ show: true, reason: "shown", used: 9, limit: 10, remaining: 1 });
  });
});

describe("it never nags", () => {
  it("a dismissal silences it for the rest of that day", () => {
    expect(decideValuePreview(showing({ dismissedOn: "2026-09-04" }))).toEqual({ show: false, reason: "dismissed-today" });
  });

  it("negative control — yesterday's dismissal does not silence today", () => {
    expect(decideValuePreview(showing({ dismissedOn: "2026-09-03" })).show).toBe(true);
  });
});

describe("coachRemaining mirrors the server's own arithmetic", () => {
  it("limit minus used, floored at zero", () => {
    expect(coachRemaining(freeEntitlement({ usage: { coachMessagesToday: 0 } }))).toBe(10);
    expect(coachRemaining(freeEntitlement({ usage: { coachMessagesToday: 10 } }))).toBe(0);
    expect(coachRemaining(freeEntitlement({ usage: { coachMessagesToday: 99 } }))).toBe(0);
  });

  it("a null limit is 'not metered', never 'zero left'", () => {
    const unmetered = freeEntitlement({ limits: { ...freeEntitlement().limits, coachMessagesPerDay: null } });
    expect(coachRemaining(unmetered)).toBeNull();
  });

  it("the server 402s at count > limit, so remaining 0 is the wall", () => {
    const server = readFileSync(path.join(SRC, "server", "aiQuota.ts"), "utf8");
    expect(server).toContain("X-Coach-Remaining");
    expect(server).toContain("Math.max(0, limit - count)");
    expect(server).toContain('feature: "coach_unlimited"');
  });
});

describe("the dismissal marker is per-ACCOUNT and sweepable", () => {
  const fakeStore = () => {
    const map = new Map<string, string>();
    return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
  };

  it("round-trips the day", () => {
    const store = fakeStore();
    expect(readValuePreviewDismissal(store)).toBeNull();
    writeValuePreviewDismissal("2026-09-04", store);
    expect(store.map.get(VALUE_PREVIEW_DISMISS_KEY)).toBe("2026-09-04");
    expect(readValuePreviewDismissal(store)).toBe("2026-09-04");
  });

  it("a missing store never throws — it only means the card may reappear", () => {
    expect(() => writeValuePreviewDismissal("2026-09-04", null)).not.toThrow();
    expect(readValuePreviewDismissal(null)).toBeNull();
  });

  it("is arbor-namespaced, so ACCOUNT deletion removes it", () => {
    expect(VALUE_PREVIEW_DISMISS_KEY.startsWith("arbor.")).toBe(true);
    // The exact predicate DeleteAccountModal sweeps with.
    const accountSweep = (key: string) => key.startsWith("arbor");
    expect(accountSweep(VALUE_PREVIEW_DISMISS_KEY)).toBe(true);
    // …and that predicate really is what ships.
    const modal = stripComments(readFileSync(path.join(SRC, "components", "layout", "DeleteAccountModal.tsx"), "utf8"));
    expect(modal.length).toBeGreaterThan(500);
    expect(modal).toContain('key.startsWith("arbor")');
    expect(modal).toContain("localStorage.removeItem(key)");
    // Negative control for the predicate itself.
    expect(accountSweep("vendor.plan.previewDismissed")).toBe(false);
  });

  it("is deliberately NOT child-scoped — deleting one child must not resurrect an upsell", () => {
    expect(isChildScopedKey(VALUE_PREVIEW_DISMISS_KEY, "kid-1")).toBe(false);
    // Negative control: the matcher does still recognise a real per-child key,
    // so the assertion above is about THIS key, not a broken matcher.
    expect(isChildScopedKey("arbor.plan.previewDismissed.kid-1", "kid-1")).toBe(true);
  });

  it("is ONE key holding a day, not one key per day (no orphan row per day)", () => {
    const store = fakeStore();
    writeValuePreviewDismissal("2026-09-04", store);
    writeValuePreviewDismissal("2026-09-05", store);
    writeValuePreviewDismissal("2026-09-06", store);
    expect([...store.map.keys()]).toEqual([VALUE_PREVIEW_DISMISS_KEY]);
  });

  it("localDayKey is a local calendar day, zero-padded", () => {
    expect(localDayKey(new Date(2026, 0, 3, 23, 59))).toBe("2026-01-03");
    expect(localDayKey(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
    expect(localDayKey(new Date(2026, 8, 4))).not.toBe(localDayKey(new Date(2026, 8, 5)));
  });
});

// ── The copy rules ──────────────────────────────────────────────────────────

/** Every `t("…")` and `pc("…")` lookup in the shipped component. */
function harvestKeys(code: string) {
  const t = [...code.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]);
  const pc = [...code.matchAll(/\bpc\(\s*"([^"]+)"/g)].map((m) => m[1]);
  return { t: [...new Set(t)].sort(), pc: [...new Set(pc)].sort() };
}

describe("the component scan is real, not vacuous", () => {
  it("read the shipped file and stripped its comments", () => {
    expect(componentSource.length).toBeGreaterThan(2000);
    expect(componentCode.length).toBeGreaterThan(1000);
    // Prose that exists ONLY in the doc comment must be gone…
    expect(componentSource).toContain("no urgency, no discount");
    expect(componentCode).not.toContain("no urgency, no discount");
    // …while real code survives.
    expect(componentCode).toContain('t("set.plan.coachToday"');
  });

  it("the harvest finds the real lookups and rejects one that is only mentioned", () => {
    const { t, pc } = harvestKeys(componentCode);
    expect(t.length).toBeGreaterThan(0);
    expect(pc.length).toBeGreaterThan(0);
    expect(t).toContain("set.plan.coachToday");
    // pw.bodyCoach ("You've reached today's free coaching") is the paywall's
    // AFTER-the-wall line. It must never be reachable from this card.
    expect(t).not.toContain("pw.bodyCoach");
    expect(componentCode).not.toContain("pw.bodyCoach");
  });
});

describe("no new commercial claim was invented", () => {
  const APPROVED_T = [
    "pw.maybeLater",
    "set.plan.coachToday",
    "set.plan.free",
    "set.plan.upgradePlus",
    "set.plan.your",
  ];
  const APPROVED_PC = ["free.2", "freeTitle", "plus.1", "plusTitle"];

  it("every t() key is one of the already-shipping approved keys", () => {
    expect(harvestKeys(componentCode).t).toEqual(APPROVED_T);
  });

  it("every plan-clarity key is one of the already-shipping approved keys", () => {
    expect(harvestKeys(componentCode).pc).toEqual(APPROVED_PC);
  });

  it("each of those keys already exists in BOTH shipped dictionaries", () => {
    for (const key of APPROVED_T) {
      expect(baseEn[key], `${key} missing from the EN dictionary`).toBeTruthy();
      expect(baseHe[key], `${key} missing from the HE dictionary`).toBeTruthy();
      expect(translate("en", key).length).toBeGreaterThan(0);
      expect(translate("he", key).length).toBeGreaterThan(0);
    }
    for (const key of APPROVED_PC) {
      expect(planclarity.en[`elev.plan.${key}`], `elev.plan.${key} missing from EN`).toBeTruthy();
      expect(planclarity.he[`elev.plan.${key}`], `elev.plan.${key} missing from HE`).toBeTruthy();
    }
  });

  it("negative control — an invented key would NOT resolve, so the check above has teeth", () => {
    expect(baseEn["set.plan.limitedTimeOffer"]).toBeUndefined();
    expect(baseHe["set.plan.limitedTimeOffer"]).toBeUndefined();
    expect(planclarity.en["elev.plan.trialDays"]).toBeUndefined();
    expect(translate("en", "set.plan.limitedTimeOffer")).toBe("set.plan.limitedTimeOffer");
  });

  it("this feature added no string module of its own", () => {
    const modules = readdirSync(path.join(SRC, "lib", "i18nElevation"));
    expect(modules.length).toBeGreaterThan(20);
    expect(modules.some((f) => /valuepreview/i.test(f))).toBe(false);
    const merged = { ...baseEn, ...baseHe } as Record<string, string>;
    expect(Object.keys(merged).some((k) => /valuepreview/i.test(k))).toBe(false);
  });

  it("no price, period, trial, discount or urgency literal lives in the component", () => {
    // Prices come from the store via paywallModel.buildPlanRows and are shown
    // in the paywall only. Nothing price-shaped may be typed here.
    expect(componentCode).not.toMatch(/[€$₪]\s*\d/);
    expect(componentCode).not.toMatch(/\b\d+(\.\d+)?\s*(eur|usd|ils)\b/i);
    expect(componentCode).not.toMatch(/\b(trial|discount|save \d|% ?off|limited time|expires|hurry|only today)\b/i);
    // Negative control: the matcher does catch those shapes.
    expect("€12.99/month").toMatch(/[€$₪]\s*\d/);
    expect("7-day free trial").toMatch(/\b(trial|discount|save \d|% ?off|limited time|expires|hurry|only today)\b/i);
  });

  it("every visible word comes from a lookup — the JSX has no bare text at all", () => {
    const source = ts.createSourceFile("ValuePreview.tsx", componentSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const bare: string[] = [];
    let elements = 0;
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) elements++;
      if (ts.isJsxText(node) && node.text.trim()) bare.push(node.text.trim());
      ts.forEachChild(node, visit);
    };
    visit(source);
    // The walk really parsed JSX (negative control against an empty scan).
    expect(elements).toBeGreaterThan(5);
    expect(bare, "hard-coded copy in ValuePreview.tsx — every string must come from t()/pc()").toEqual([]);
  });
});

describe("the clinical firewall — a monetisation surface says nothing about the child", () => {
  it("the component reads no child data and names no child field", () => {
    expect(componentCode).not.toMatch(/\bchildProfile\b|\bchildId\b|\bchildren\b\s*:|\bmilestone|\bbehavior|\bscore\b|\bdiagnos/i);
    // Negative control: the matcher would catch the real identifiers.
    expect("const { childProfile } = useArbor();").toMatch(/\bchildProfile\b/);
  });

  it("makes no claim that a paid plan changes an outcome for the child", () => {
    const plusLine = planclarity.en["elev.plan.plus.1"];
    expect(plusLine).toBeTruthy();
    // The one Plus line this card renders is about the METER, not the child.
    expect(plusLine).toMatch(/limit/i);
    expect(plusLine).not.toMatch(/\b(child|development|outcome|better|faster|smarter|progress)\b/i);
  });

  it("states what the free plan gives, not only what Plus adds", () => {
    const { pc } = harvestKeys(componentCode);
    expect(pc).toContain("freeTitle");
    expect(pc).toContain("free.2");
    // The free half is rendered BEFORE the paid half in the source order.
    expect(componentCode.indexOf('pc("freeTitle")')).toBeLessThan(componentCode.indexOf('pc("plusTitle")'));
  });
});

// ── Placement ───────────────────────────────────────────────────────────────

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

describe("placement — exactly one mount, on the calm coach surface", () => {
  const files = tsxFiles(SRC);
  const mounts = files.filter((f) => /from\s+"[^"]*\/ValuePreview"/.test(readFileSync(f, "utf8")));

  it("the tree walk is real", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("ONE file imports it, and it is the coach tab", () => {
    expect(mounts.map((f) => path.relative(SRC, f).replace(/\\/g, "/"))).toEqual(["components/tabs/CoachTab.tsx"]);
  });

  it("it is mounted on an EMPTY thread and an idle surface", () => {
    const coach = stripComments(readFileSync(path.join(SRC, "components", "tabs", "CoachTab.tsx"), "utf8").replace(/\r\n/g, "\n"));
    expect(coach.length).toBeGreaterThan(20_000);
    expect(coach).toContain("<ValuePreview");
    expect(coach).toContain("threadEmpty={chatMessages.length === 0}");
    expect(coach).toContain('surfaceIdle={!isChatLoading && !failureCopy && voicePhase === "off" && !visionMode}');
    expect(coach).toContain("online={online}");
    // Exactly one mount, so a second copy cannot creep onto a busier spot.
    expect(coach.match(/<ValuePreview/g)).toHaveLength(1);
  });

  it("no crisis, escalation, safety, screening or consult surface mounts it", () => {
    const forbidden = files.filter((f) => /escalat|crisis|safety|screen|consult|hardmoment|hard-moment/i.test(path.relative(SRC, f)));
    // The negative control that matters: those files really do exist, so an
    // empty list below would not be proof of anything.
    expect(forbidden.length).toBeGreaterThan(3);
    expect(forbidden.filter((f) => mounts.includes(f))).toEqual([]);
  });

  it("the surface constant names the placement, so moving it is one line", () => {
    expect(VALUE_PREVIEW_SURFACE).toBe("coach/empty-thread");
    expect(componentCode).toContain("VALUE_PREVIEW_SURFACE");
  });
});
