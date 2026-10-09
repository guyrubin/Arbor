import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * One failed moment write, one message (release review, 9 Oct 2026).
 *
 * ArborContext's addMoment / saveMoment / handleAddLog toast "couldn't save"
 * on a failed write UNLESS the caller passes `callerShowsFailure`, because it
 * renders the failure itself beside the kept draft and its retry. Before the
 * fix QuickLogModal (inline alert), TogetherView (inline alert) and
 * KidExitRecap (re-offered toast) showed that toast AND their own message.
 *
 * Every production caller is classified here, so a new caller must choose:
 *  - OWNS_FAILURE: it renders its own failure, so every call opts the seam out;
 *  - SEAM_TOASTS:  it has no failure UI, so it never opts out (opting out
 *                  would make its failure silent).
 */
const SRC = path.resolve(__dirname, "..");

const OWNS_FAILURE = [
  "components/companion/TogetherView.tsx",
  "components/kidmode/KidExitRecap.tsx",
  "components/overview/QuickLogModal.tsx",
];
const SEAM_TOASTS = [
  // Tonight's "What happened?" on Now (parity 9 Oct): TonightFlow has no inline error.
  "components/companion/useNowLoop.ts",
  "components/kidmode/SneakHandBackCard.tsx",
  "components/practice/PracticeStudioTab.tsx",
  "components/tabs/BedtimeStoriesTab.tsx",
  "components/tabs/BehaviorsTab.tsx",
  "components/tabs/OverviewTab.tsx",
];

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Each full call expression `addMoment(…)` / `saveMoment(…)` / `handleAddLog(…)`
 *  (member calls such as the co-parent server's `source.addMoment(` excluded). */
function seamCalls(src: string): string[] {
  const out: string[] = [];
  const re = /(?<![.\w])(?:addMoment|saveMoment|handleAddLog)\(/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 1, i = re.lastIndex;
    while (depth && i < src.length) { const c = src[i++]; if (c === "(") depth++; else if (c === ")") depth--; }
    out.push(src.slice(m.index, i));
  }
  return out;
}

function productionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "server" ? [] : productionFiles(file);
    return /\.tsx?$/.test(entry.name) && !/\.(?:test|spec)\.tsx?$|\.d\.ts$/.test(entry.name) ? [file] : [];
  });
}

const callers = new Map<string, string[]>();
for (const file of productionFiles(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join("/");
  if (rel === "context/ArborContext.tsx") continue; // the seam itself
  const found = seamCalls(stripComments(readFileSync(file, "utf8")));
  if (found.length) callers.set(rel, found);
}

describe("one failed moment write, one message", () => {
  it("every caller of the moment seams is classified (a new caller must choose an owner)", () => {
    expect([...callers.keys()].sort()).toEqual([...OWNS_FAILURE, ...SEAM_TOASTS].sort());
  });

  it("a caller that shows its own failure opts the seam's toast out on EVERY call", () => {
    for (const rel of OWNS_FAILURE) {
      for (const call of callers.get(rel) ?? []) expect(call, rel).toContain("callerShowsFailure: true");
    }
  });

  it("a caller with no failure UI never opts out, so its failure is never silent", () => {
    for (const rel of SEAM_TOASTS) {
      for (const call of callers.get(rel) ?? []) expect(call, rel).not.toContain("callerShowsFailure");
    }
  });

  it("the seam stays quiet only on the caller's word, and still toasts by default", () => {
    const ctx = readFileSync(path.join(SRC, "context/ArborContext.tsx"), "utf8");
    const quiet = ctx.match(/if \(!callerShowsFailure && captureScopeRef\.current === captureScope\) toast\(t\("companion\.capture\.saveError"\), "error"\);/g) ?? [];
    expect(quiet).toHaveLength(2); // handleAddLog + addMoment (saveMoment is addMoment)
    expect(ctx).toContain("const saveMoment = addMoment;");
  });

  it("NEGATIVE CONTROL: the call scanner sees multi-line calls and the pre-fix shapes", () => {
    const fixture = [
      "const written = await addMoment(words, {",
      "  ...(shelf ? { shelf } : {}),",
      "  callerShowsFailure: true,",
      "});",
      "try { if (await saveMoment(moment)) keep(); else setSaveError(true); }",
      "await source.addMoment(grant, actor, note, id);",
    ].join("\n");
    const found = seamCalls(fixture);
    expect(found).toHaveLength(2);
    expect(found[0]).toContain("callerShowsFailure: true");
    expect(found[1]).toBe("saveMoment(moment)"); // pre-fix TogetherView: fails the owner check
  });
});
