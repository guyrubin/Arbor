/**
 * V77 shell slots on the My child routes (N-Moments-D, N-Hard-D, N-Said-D,
 * N-SaidHe-D): each route fills the pill row's end, and Things said names the
 * picked language as the crumb's last level. Source pins read the real files;
 * each has a negative control that removes the wiring and must fail the same check.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MOMENTS_V10_COPY } from "./momentsV10Copy";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, "..", "..", rel), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const MOMENTS = strip(read("components/moments/MomentsBody.tsx"));
const HARD = strip(read("components/tabs/BehaviorsTab.tsx"));
const SAID = strip(read("components/tabs/LanguageLabTab.tsx"));

const momentsLink = (src: string) =>
  /useShellRowEnd\(\{ link: \{ label: t\("elev\.shelfJournal\.flip"\), onClick: \(\) => goToRoute\("journal", \{ view: "pro" \}\)/.test(src);
const hardSince = (src: string) =>
  src.includes("hardLogs[hardLogs.length - 1].timestamp") &&
  /useShellRowEnd\(firstLogged \? \{ suffix: v\.hard\.sinceStarted\(fmtDayMonthLongV10\(firstLogged, uiLang\)\) \} : null\)/.test(src);
const saidSlots = (src: string) =>
  src.includes("useShellRowEnd({ dateOnly: true });") && src.includes("useShellCrumb(langFilter ? ln(langFilter) : null);");

describe("My child routes fill the shell's slots as the boards draw them", () => {
  it("Moments: the row ends with Professional view, the same view the rail's door opens", () => {
    expect(momentsLink(MOMENTS)).toBe(true);
    expect(MOMENTS).toContain('["moments-pro-door", "swap_horiz", t("elev.shelfJournal.flip"), () => goToRoute("journal", { view: "pro" })]');
    // NEGATIVE CONTROL: without the hook the check fails.
    expect(momentsLink(MOMENTS.replace(/useShellRowEnd\(/, "noop("))).toBe(false);
  });

  it("Hard moments: the day, then since the FIRST hard moment logged (oldest; none logged → no suffix)", () => {
    expect(hardSince(HARD)).toBe(true);
    // hardLogs is newest first, so the first one logged is the last entry.
    expect(HARD).toMatch(/hardLogs = useMemo\(\(\) => \[\.\.\.behaviorLogs\]\.filter\(\(l\) => isIncidentType\(l\.behaviorType\)\)\s*\.sort\(\(a, b\) => new Date\(b\.timestamp\)\.getTime\(\) - new Date\(a\.timestamp\)\.getTime\(\)\)/);
    // NEGATIVE CONTROL: reading the newest log instead fails.
    expect(hardSince(HARD.replace("hardLogs[hardLogs.length - 1].timestamp", "hardLogs[0].timestamp"))).toBe(false);
  });

  it("Things said: the day alone; a picked language is the crumb's last level", () => {
    expect(saidSlots(SAID)).toBe(true);
    // The hooks run before the month page's early return (a hook never sits behind a branch).
    expect(SAID.indexOf("useShellCrumb(")).toBeLessThan(SAID.indexOf('if (view === "said") return <SaidPage />;'));
    // NEGATIVE CONTROL: without the crumb the check fails.
    expect(saidSlots(SAID.replace("useShellCrumb(langFilter ? ln(langFilter) : null);", ""))).toBe(false);
  });

  it("the suffix reads in both languages, with the date the caller formats", () => {
    expect(MOMENTS_V10_COPY.en.hard.sinceStarted("8 October")).toBe("since you started on 8 October");
    expect(MOMENTS_V10_COPY.he.hard.sinceStarted("8 באוקטובר")).toBe("מאז שהתחלתם ב־8 באוקטובר");
  });
});
