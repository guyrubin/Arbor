import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { readTimeline } from "../../lib/timelineFold";
import { buildBehaviorExportHtml } from "../../lib/behaviorExport";
import { translate } from "../../lib/i18n";
import { matchesJournalFilter } from "../../lib/journalFilters";
const root = resolve(process.cwd(), "src");
const context = ts.createSourceFile("context.tsx", readFileSync(resolve(root, "context/ArborContext.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function bind(name: string, env: Record<string, unknown>) {
  let declaration = "";
  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name)) declaration = node.getText(context);
    ts.forEachChild(node, visit);
  }
  visit(context); expect(declaration).not.toBe("");
  const code = ts.transpileModule(`${declaration}; exports.fn = ${name};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  new Function("exports", ...Object.keys(env), code)(exports, ...Object.values(env));
  return exports.fn;
}
const first = { id: "first", timestamp: "2026-10-10T10:00:10Z", behaviorType: "Transition Refusal", trigger: "Shoes", response: "Offered choices", notes: "By the door", intensity: 3, durationMinutes: 5, resolved: false };
const second = { ...first, id: "second", timestamp: "2026-10-10T10:00:20Z", response: "Waited", notes: "At school", photoAttachment: "second-photo", resolved: true };

describe("B-ASKJB-23 independent review corrections", () => {
  it("negative control: the story read collapses distinct editable log identities", () => {
    expect(readTimeline({ behaviorLogs: [first, second] }).filter((s) => s.kind === "moment")).toHaveLength(1);
  });
  it("the Journal record retains every identity, filter field and PDF row", async () => {
    expect(existsSync(resolve(root, "lib/journalRecordSignals.ts"))).toBe(true);
    const { journalRecordSignals } = await import("../../lib/journalRecordSignals");
    const folded = readTimeline({ behaviorLogs: [first, second] });
    const signals = journalRecordSignals(folded, [first, second]);
    expect(signals.map((s) => s.id)).toEqual(["moment-second", "moment-first"]);
    const logsById = new Map([[first.id, first], [second.id, second]]);
    const visible = signals.filter((s) => matchesJournalFilter(s, { filter: "hard", query: "At school", logsById, keptIds: new Set(), labelOf: () => "Refusal" }));
    expect(visible.map((s) => s.id)).toEqual(["moment-second"]);
    expect(signals[0]).toMatchObject({ photo: "second-photo", resolved: true });
    const exported = signals.map((signal) => logsById.get(signal.id.slice("moment-".length))!);
    const html = buildBehaviorExportHtml(exported, { t: (key, vars) => translate("en", key, vars), lang: "en" });
    expect(html).toContain("Offered choices"); expect(html).toContain("Waited");
    const play = { id: "child-day-2026-10-10", kind: "practice", at: null, tone: "sky", folded: [] } as any;
    const words = { id: "words-en-day", kind: "moment", at: null, tone: "lav", wordsLanguage: "English" } as any;
    expect(journalRecordSignals([play, words, ...folded], [first, second])).toEqual(expect.arrayContaining([play, words]));
    expect(journalRecordSignals(signals, [first])).toHaveLength(1); // deletion cannot retain a folded ghost
    expect(readFileSync(resolve(root, "components/tabs/JournalTab.tsx"), "utf8")).toContain("journalRecordSignals(timeline, behaviorLogs)");
  });
  it("dismissal retires provider-owned echo identity across navigation without clearing a newer save", () => {
    let saved: { childId: string; id: string } | null = { childId: "a", id: "one" };
    const dismiss = bind("dismissBehaviorEcho", { childProfile: { id: "a" }, setLastSavedBehavior: (update: any) => { saved = update(saved); } });
    dismiss("one"); expect(saved).toBeNull();
    saved = { childId: "a", id: "two" }; dismiss("one"); expect(saved.id).toBe("two");
    saved = { childId: "b", id: "one" }; dismiss("one"); expect(saved.childId).toBe("b");
    const behaviors = readFileSync(resolve(root, "components/tabs/BehaviorsTab.tsx"), "utf8");
    expect(behaviors).not.toContain("useState");
    expect(behaviors.match(/dismissBehaviorEcho\(echoLog\?\.id \?\? ""\)/g)).toHaveLength(2);
  });
  it("situation starters never invent event words, notes, intensity or duration", () => {
    const setters = Object.fromEntries(["Type", "Intensity", "Duration", "Trigger", "Response", "Notes"].map((name) => [`setNewLog${name}`, vi.fn()]));
    const start = bind("autofillLogTemplate", setters);
    for (const name of ["morning", "screen", "sibling"]) start(name);
    expect(setters.setNewLogType.mock.calls.map(([type]) => type)).toEqual(["Transition Refusal", "Screentime Dispute", "Sibling Conflict"]);
    for (const name of ["Intensity", "Duration", "Trigger", "Response", "Notes"]) expect(setters[`setNewLog${name}`], name).not.toHaveBeenCalled();
    const modal = readFileSync(resolve(root, "components/overview/QuickLogModal.tsx"), "utf8");
    expect(modal).toContain('data-testid="quicklog-starters"');
    expect(modal).toContain('autofillLogTemplate(starter)');
  });
});
