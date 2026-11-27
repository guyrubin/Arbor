/**
 * B-STATUS-01 — toasts are for ERRORS and UNDO only; everything else answers
 * where it happened (components/ui/Receipt.tsx: the one Receipt line, the one
 * PendingLine for AI work).
 *
 * This guard parses every runtime .ts/.tsx under src/ with the TypeScript
 * parser (comments and strings can never count), finds each `toast(` call —
 * bare, `ctx.toast(` or `ctx?.toast(` — and sorts it by kind:
 *
 *   error    the type argument is "error"                     allowed
 *   action   it carries an action (Undo, Retry, Not today)    allowed
 *   success  the type argument is "success"                   ratcheted
 *   info     "info", or no type (the provider's default)      ratcheted
 *   dynamic  the type is computed (a forwarding wrapper)      ratcheted
 *
 * The ratcheted kinds are held, per file, to `toastRatchet.baseline.json`,
 * which may only SHRINK: a file may lose call sites, never gain one; a file
 * absent from the baseline may hold none; a file that lost one must lower its
 * line (so the room cannot be refilled); and the baseline's totals may never
 * exceed the counts frozen below on the day the guard landed. Regenerate the
 * baseline ONLY after removing call sites:
 *   TOAST_BASELINE_WRITE=1 npx vitest run src/lib/toastRatchet.guard.test.ts
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const BASELINE = path.join(here, "toastRatchet.baseline.json");

export type ToastKind = "error" | "action" | "success" | "info" | "dynamic";
const RATCHETED = ["success", "info", "dynamic"] as const;
type RatchetedKind = (typeof RATCHETED)[number];
type Counts = Partial<Record<RatchetedKind, number>>;

/** FROZEN 2026-10-09 (B-STATUS-01): the ratcheted totals the day the guard
 *  landed. The baseline's totals may only ever be at or below these. */
const FROZEN_TOTALS: Readonly<Record<RatchetedKind, number>> = { success: 38, info: 20, dynamic: 5 };

/** Does an action argument really carry an action (an object or a call)? */
function carriesAction(node: ts.Expression | undefined): boolean {
  if (!node) return false;
  let n: ts.Expression = node;
  while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n)) n = n.expression;
  if (ts.isConditionalExpression(n)) return carriesAction(n.whenTrue) || carriesAction(n.whenFalse);
  return ts.isObjectLiteralExpression(n) || ts.isCallExpression(n);
}

function kindOf(call: ts.CallExpression): ToastKind {
  const [, type, action] = call.arguments;
  const literal = type && (ts.isStringLiteral(type) || ts.isNoSubstitutionTemplateLiteral(type)) ? type.text : null;
  if (literal === "error") return "error";
  if (carriesAction(action)) return "action";
  if (!type) return "info";
  if (literal === "success" || literal === "info") return literal;
  return "dynamic";
}

const isToastCallee = (callee: ts.Expression): boolean =>
  (ts.isIdentifier(callee) && callee.text === "toast") ||
  (ts.isPropertyAccessExpression(callee) && callee.name.text === "toast");

/** Every `toast(` call site in one source, with its kind and line. */
export function toastCallSites(source: string, fileName = "x.tsx"): { kind: ToastKind; line: number }[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { kind: ToastKind; line: number }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && isToastCallee(node.expression)) {
      out.push({ kind: kindOf(node), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function runtimeFiles(dir = SRC, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) runtimeFiles(p, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");

function scan(): { all: { file: string; kind: ToastKind; line: number }[]; ratcheted: Record<string, Counts> } {
  const all: { file: string; kind: ToastKind; line: number }[] = [];
  for (const f of runtimeFiles()) {
    const src = readFileSync(f, "utf8");
    if (!/\btoast\s*\(/.test(src)) continue;
    for (const site of toastCallSites(src, f)) all.push({ file: rel(f), ...site });
  }
  return { all, ratcheted: ratchetedCounts(all) };
}

function ratchetedCounts(sites: { file: string; kind: ToastKind }[]): Record<string, Counts> {
  const out: Record<string, Counts> = {};
  for (const s of sites) {
    if (!(RATCHETED as readonly string[]).includes(s.kind)) continue;
    const k = s.kind as RatchetedKind;
    const counts = (out[s.file] ??= {});
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

function totals(byFile: Record<string, Counts>): Record<RatchetedKind, number> {
  const t: Record<RatchetedKind, number> = { success: 0, info: 0, dynamic: 0 };
  for (const counts of Object.values(byFile)) for (const k of RATCHETED) t[k] += counts[k] ?? 0;
  return t;
}

/** The rule itself: what a current scan may hold against a baseline. */
export function ratchetViolations(current: Record<string, Counts>, baseline: Record<string, Counts>): { grew: string[]; stale: string[] } {
  const grew: string[] = [];
  const stale: string[] = [];
  for (const [file, counts] of Object.entries(current)) {
    for (const k of RATCHETED) {
      const now = counts[k] ?? 0;
      const allowed = baseline[file]?.[k] ?? 0;
      if (now > allowed) grew.push(`${file}: ${now} ${k} toast(s), baseline ${allowed}`);
    }
  }
  for (const [file, counts] of Object.entries(baseline)) {
    for (const k of RATCHETED) {
      const allowed = counts[k] ?? 0;
      const now = current[file]?.[k] ?? 0;
      if (now < allowed) stale.push(`${file}: ${now} ${k} toast(s), baseline still ${allowed}`);
    }
  }
  return { grew, stale };
}

const readBaseline = (): Record<string, Counts> => {
  const raw = JSON.parse(readFileSync(BASELINE, "utf8")) as { files?: Record<string, Counts> };
  return raw.files ?? {};
};

const { all: SITES, ratcheted: CURRENT } = scan();

if (process.env.TOAST_BASELINE_WRITE === "1") {
  const t = totals(CURRENT);
  const over = RATCHETED.filter((k) => t[k] > FROZEN_TOTALS[k]);
  if (over.length) throw new Error(`refusing to write a baseline above the frozen totals: ${over.join(", ")}`);
  writeFileSync(
    BASELINE,
    JSON.stringify({
      $comment: "B-STATUS-01 — toast( call sites per file by ratcheted kind (success / info / dynamic). Shrink-only: see src/lib/toastRatchet.guard.test.ts. Errors and toasts carrying an action (Undo) are not counted.",
      files: CURRENT,
    }, null, 2) + "\n",
  );
}

describe("B-STATUS-01 · toasts are for errors and undo — the rest is a shrink-only ratchet", () => {
  it("the scan reads the real corpus (non-vacuity)", () => {
    // B-STATUS-01 wave 3 turned 24 success toasts into receipt lines (80 call
    // sites left); wave 4 turned the last 8 (81 → 73, each named in the wave-4
    // block below). The floor moves only by those named removals: 73.
    expect(SITES.length).toBeGreaterThanOrEqual(73);
    const kinds = new Set(SITES.map((s) => s.kind));
    for (const k of ["error", "action", "info", "dynamic"] as const) expect(kinds.has(k), k).toBe(true);
    // the done bar: no success toast anywhere in the corpus (the counter still
    // sees one — the negative controls below put one back into real source)
    expect(kinds.has("success")).toBe(false);
    // a known file, counted by hand: ArborContext keeps its forwarding wrapper
    // (dynamic) and the "link moved" notice (info); its two success toasts went
    expect(CURRENT["context/ArborContext.tsx"]).toEqual({ dynamic: 1, info: 1 });
    // the capture tray's keep toast carries its Undo: an action, never a success
    expect(SITES.filter((s) => s.file === "components/capture/CaptureProposalsTray.tsx" && s.kind === "action")).toHaveLength(1);
  });

  it("no file holds more success / info / computed toasts than its baseline", () => {
    const { grew } = ratchetViolations(CURRENT, readBaseline());
    expect(grew, `a new non-error toast — answer with the Receipt line (components/ui/Receipt.tsx) instead:\n${grew.join("\n")}`).toEqual([]);
  });

  it("the baseline is tight — a file that lost a toast lowers its line, so the room cannot be refilled", () => {
    const { stale } = ratchetViolations(CURRENT, readBaseline());
    expect(stale, `lower the baseline (TOAST_BASELINE_WRITE=1):\n${stale.join("\n")}\ncurrent:\n${JSON.stringify(CURRENT, null, 2)}`).toEqual([]);
    for (const file of Object.keys(readBaseline())) expect(existsSync(path.join(SRC, file)), `${file} no longer exists`).toBe(true);
  });

  it("the baseline only shrinks: its totals never exceed the frozen 9 Oct counts", () => {
    const t = totals(readBaseline());
    for (const k of RATCHETED) expect(t[k], k).toBeLessThanOrEqual(FROZEN_TOTALS[k]);
  });

  it("the loop cards, the capture confirm row and Now answer with receipts, not success toasts", () => {
    const LOOP = [
      "components/loop/PracticeCard.tsx",
      "components/loop/NoticeCard.tsx",
      "components/loop/TonightFlow.tsx",
      "components/loop/MilestoneProposalRow.tsx",
      "components/companion/NowView.tsx",
      "components/companion/NowLoopBlocks.tsx",
      "components/companion/NowRecommendation.tsx",
      "components/companion/useNowLoop.ts",
    ];
    for (const f of LOOP) {
      expect(existsSync(path.join(SRC, f)), f).toBe(true);
      expect(CURRENT[f], f).toBeUndefined();
    }
  });
});

describe("B-STATUS-01 · wave 3: the success toasts of these surfaces became receipt lines", () => {
  /* Each file answered a save, a share, a copy or a finish with a vanishing
     success toast (baseline 9 Oct). Each now draws the ONE Receipt line where
     the action happened (components/ui/Receipt.tsx: Receipt, or the host slot
     useReceiptNote + ReceiptNoteLine), Undo where the write can be reversed. */
  const RECEIPTED = [
    "components/sections/TrustedSharing.tsx",
    "components/sections/Screening.tsx",
    "components/sections/AskSpecialist.tsx",
    "components/sections/Appointments.tsx",
    "components/sections/SchoolBrief.tsx",
    "components/tabs/ConsultTab.tsx",
    "components/tabs/CoachTab.tsx",
    "components/tabs/BedtimeStoriesTab.tsx",
    "components/tabs/DailyPlayTab.tsx",
    "components/tabs/HeroJourneyTab.tsx",
    "components/layout/SettingsModal.tsx",
    "components/layout/ParentalGatePanel.tsx",
  ];
  it("none of them holds a success toast, and each draws a receipt line", () => {
    for (const f of RECEIPTED) {
      expect(CURRENT[f]?.success, f).toBeUndefined();
      const src = readFileSync(path.join(SRC, f), "utf8");
      expect(src, f).toMatch(/<Receipt\b|<ReceiptNoteLine\b/);
    }
  });
  it("RoutinesTab (redirected to Plans, never seen) holds neither a success toast nor a dead receipt (critic r1)", () => {
    expect(CURRENT["components/tabs/RoutinesTab.tsx"]?.success).toBeUndefined();
    expect(readFileSync(path.join(SRC, "components/tabs/RoutinesTab.tsx"), "utf8")).not.toMatch(/<Receipt\b|<ReceiptNoteLine\b/);
  });
  it("NEGATIVE CONTROL: the pre-change Consult save is a ratcheted success toast", () => {
    const pre = 'setOutcome("");\n    toast(t("elev.learnCare.appt.followUp.saved"), "success");';
    expect(toastCallSites(pre, "x.tsx").map((s) => s.kind)).toEqual(["success"]);
  });
});

describe("B-STATUS-01 · wave 4: zero success toasts — the last eight became receipt lines", () => {
  /* Each site closed the surface it answered from (a sheet, a dialog, the
     paywall, a sign-out) or lived in a context with no surface. Each now
     answers with the ONE Receipt line: under the thing it changed (host slot),
     or carried to the place the thing went (carryReceipt → CarriedReceiptLine
     in Shell / on the sign-in screen). Undo where the write can be reversed. */
  const CONVERTED: [file: string, answer: RegExp][] = [
    ["components/layout/DeleteAccountModal.tsx", /carryReceipt\(\{ text: t\("elev\.loop\.receipt\.accountDeleted"\) \}, "signed-out"\)/],
    ["components/milestones/FirstKeepsakeSheet.tsx", /if \(onSaved\) onSaved\(draft, keepsake\);\s*else carryReceipt\(/],
    ["components/overview/QuickLogModal.tsx", /carryReceipt\(\{\s*text: t\("elev\.loop\.receipt\.momentEdited"\)/],
    ["components/profile/AddChildModal.tsx", /carryReceipt\(\{ text: t\("elev\.loop\.receipt\.childAdded"/],
    ["context/ArborContext.tsx", /return row\.id;/],
    ["hooks/useCheckout.ts", /if \(fx\.tone === "success"\) \{[\s\S]{0,240}carryReceipt\([\s\S]{0,80}receiptNote\.show\(/],
    ["hooks/useEntitlement.ts", /deps\.answer\(deps\.t\("pw\.activated"\)\)/],
  ];
  const src = (f: string) => readFileSync(path.join(SRC, f), "utf8");

  it("the baseline holds no success line at all, and no file holds a success toast", () => {
    expect(totals(readBaseline()).success).toBe(0);
    for (const [file, counts] of Object.entries(readBaseline())) expect(counts.success, file).toBeUndefined();
    expect(Object.entries(CURRENT).filter(([, c]) => c.success)).toEqual([]);
  });

  it("each former success toast answers with the receipt grammar", () => {
    for (const [file, answer] of CONVERTED) expect(src(file), file).toMatch(answer);
    // the hosts draw them: the carried slots, the keepsake/explain/kept lines,
    // the plan's started line (now with Undo), the Plan row
    expect(src("components/layout/Shell.tsx")).toMatch(/<CarriedReceiptLine place="app" childId=\{childProfile\.id\}/);
    expect(src("components/auth/LoginScreen.tsx")).toMatch(/<CarriedReceiptLine place="signed-out"/);
    expect(src("components/tabs/MilestonesTab.tsx")).toMatch(/onSaved=\{keepsakeSaved\}/);
    expect(src("components/companion/NoticeObjectDetail.tsx")).toMatch(/onSaved=\{evidenceSaved\}/);
    expect(src("components/tabs/BehaviorsTab.tsx")).toMatch(/answerKept\(keepBehaviorInsight\(behaviorAnalysis\.actionPlanSuggestion\)\)/);
    expect(src("components/tabs/PlansTab.tsx")).toMatch(/testId: "plans-started-undo"/);
    expect(src("components/layout/SettingsModal.tsx")).toMatch(/<ReceiptNoteLine note=\{planReceipt\} testId="plan-receipt"/);
    expect(src("components/billing/PaywallModal.tsx")).toMatch(/useCheckout\(\{ answer: "carry" \}\)/);
    expect(src("hooks/useBillingReturn.ts")).toMatch(/answer: \(message\) => carryReceipt\(/);
  });

  it("no forwarding wrapper can carry a success: their type stops it", () => {
    for (const f of ["context/ArborContext.tsx", "components/milestones/FirstKeepsakeSheet.tsx"]) {
      expect(src(f), f).toMatch(/const toast = \(message: string, type\?: "error" \| "info"\) => toastCtx\?\.toast\(message, type\);/);
    }
    expect(src("hooks/useEntitlement.ts")).toMatch(/toast: \(message: string, type\?: "info" \| "error"\) => void;/);
  });

  it("NEGATIVE CONTROL: the old Add-child toast put back into the real file is caught against the real baseline", () => {
    const real = src("components/profile/AddChildModal.tsx");
    const reverted = real.replace(/carryReceipt\(\{ text: t\("elev\.loop\.receipt\.childAdded"[^\n]*\n/, 'toast(t("ac.addedToast", { name: childName }), "success", undefined, { outlivesVisit: true });\n');
    expect(reverted).not.toBe(real);
    const file = "components/profile/AddChildModal.tsx";
    const counts = ratchetedCounts(toastCallSites(reverted, file).map((s) => ({ ...s, file })));
    expect(ratchetViolations({ ...CURRENT, ...counts }, readBaseline()).grew).toEqual([`${file}: 1 success toast(s), baseline 0`]);
  });

  it("NEGATIVE CONTROL: the keepsake success toast put back through the sheet's wrapper is caught", () => {
    const real = src("components/milestones/FirstKeepsakeSheet.tsx");
    const reverted = real.replace(/if \(onSaved\) onSaved\(draft, keepsake\);/, 'toast(t("elev.waveR.keepsake.saved"), "success");');
    expect(reverted).not.toBe(real);
    const file = "components/milestones/FirstKeepsakeSheet.tsx";
    const counts = ratchetedCounts(toastCallSites(reverted, file).map((s) => ({ ...s, file })));
    expect(counts[file]?.success).toBe(1);
    expect(ratchetViolations({ ...CURRENT, ...counts }, readBaseline()).grew).toEqual([`${file}: 1 success toast(s), baseline 0`]);
  });
});

describe("B-STATUS-01 · the counter itself (negative controls)", () => {
  it("NEGATIVE CONTROL: a new success toast in a file outside the baseline is caught", () => {
    const src = 'export function Save() { const { toast } = useToast(); return <button onClick={() => toast(t("x.saved"), "success")} />; }';
    const sites = toastCallSites(src);
    expect(sites.map((s) => s.kind)).toEqual(["success"]);
    const { grew } = ratchetViolations(ratchetedCounts(sites.map((s) => ({ ...s, file: "components/new/Save.tsx" }))), {});
    expect(grew).toEqual(["components/new/Save.tsx: 1 success toast(s), baseline 0"]);
  });

  it("NEGATIVE CONTROL: one more toast in a baselined file is caught; one fewer must lower the line", () => {
    const base = { "a.tsx": { info: 2 } };
    expect(ratchetViolations({ "a.tsx": { info: 3 } }, base).grew).toHaveLength(1);
    expect(ratchetViolations({ "a.tsx": { info: 1 } }, base).stale).toHaveLength(1);
    expect(ratchetViolations({ "a.tsx": { info: 2 } }, base)).toEqual({ grew: [], stale: [] });
  });

  it("reads every call shape: multi-line, member and optional calls, the default type, a forwarding wrapper", () => {
    const src = [
      "toast(",
      '  t("a"),',
      '  "success",',
      ");",
      'ctx.toast(t("b"));',
      'toastCtx?.toast(t("c"), "info");',
      "const toast = (m: string, type?: Kind, action?: ToastAction) => toastCtx?.toast(m, type, action);",
    ].join("\n");
    expect(toastCallSites(src, "x.ts").map((s) => s.kind)).toEqual(["success", "info", "info", "dynamic"]);
  });

  it("errors and toasts that carry an action (Undo) are allowed and never ratcheted", () => {
    const src = [
      'toast(t("x.failed"), "error");',
      'toast(t("x.kept"), "success", { label: t("undo"), onClick: undo });',
      'toast(t("x.kept"), "success", milestone ? undefined : undoActionFor(id));',
      'toast?.toast(t("later"), "info", { label: t("undo"), onClick: back });',
    ].join("\n");
    const sites = toastCallSites(src, "x.ts");
    expect(sites.map((s) => s.kind)).toEqual(["error", "action", "action", "action"]);
    expect(ratchetedCounts(sites.map((s) => ({ ...s, file: "x.ts" })))).toEqual({});
  });

  it("prose and look-alikes never count: comments, strings, useToast(), showToast()", () => {
    const src = [
      '// toast(t("x"), "success") in a comment',
      '/* toast("y", "info") */',
      'const s = "toast(\\"z\\", \\"success\\")";',
      "const { toast } = useToast();",
      'showToast("w");',
    ].join("\n");
    expect(toastCallSites(src, "x.ts")).toEqual([]);
  });
});
