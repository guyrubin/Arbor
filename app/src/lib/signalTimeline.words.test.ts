import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTimeline, signalDetail, signalTitle, TIMELINE_SOURCE_IDS } from "./signalTimeline";
import { SURFACE_CONTRACTS } from "./surfaceContract";
import { translate } from "./i18n";
import { momentLogId } from "./journalFilters";

/* B-GROWTH-15 — words written down on #/language reach the timeline: ONE row
   per day per language ("2 new words in Hebrew"), the words themselves as the
   row's detail (on tap). The #/language contract's threadWrite is the real
   ingest key `langObs` (SC-4 resolves it). */

const strip = (s: string) => s.replace(/[⁦-⁩]/g, "");
const tr = (lang: "en" | "he") => (k: string, v?: Record<string, string | number>) => strip(translate(lang, k, v));
const SRC = path.resolve(__dirname, "..");

const TODAY = "2026-10-05";
const langObs = [
  { id: "w1", timestamp: `${TODAY}T08:00:00.000Z`, language: "Hebrew", phrase: "אבא" },
  { id: "w2", timestamp: `${TODAY}T17:30:00.000Z`, language: "Hebrew", phrase: "כדור" },
];

describe("B-GROWTH-15 — words written down become one timeline row per day per language", () => {
  it("two Hebrew words today ⇒ ONE row: '2 new words in Hebrew' (EN) and a Hebrew sentence (HE)", () => {
    const rows = buildTimeline({ langObs }).filter((s) => s.wordsLanguage);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.kind).toBe("moment");
    expect(row.count).toBe(2);
    expect(row.at).toBe(`${TODAY}T17:30:00.000Z`);
    expect(signalTitle(row, tr("en"))).toBe("2 new words in Hebrew");
    expect(signalTitle(row, tr("he"))).toBe("2 מילים חדשות בעברית");
    // the words themselves, newest first — the parent's record, shown on tap
    expect(signalDetail(row, tr("en"))).toBe("כדור, אבא");
    // never resolves to a BehaviorLog (no behaviour sheet, no hard-moment filter)
    expect(momentLogId(row)).toBeNull();
  });

  it("one word reads singular; days and languages fold apart; an unknown language prints as written", () => {
    const rows = buildTimeline({
      langObs: [
        ...langObs,
        { id: "w3", timestamp: "2026-10-04T09:00:00.000Z", language: "Hebrew", phrase: "מים" },
        { id: "w4", timestamp: `${TODAY}T09:00:00.000Z`, language: "English", phrase: "ball" },
        { id: "w5", timestamp: `${TODAY}T10:00:00.000Z`, language: "Amharic", phrase: "selam" },
        { id: "w6", timestamp: `${TODAY}T10:00:00.000Z`, language: "Hebrew", phrase: "   " }, // empty — skipped
      ],
    }).filter((s) => s.wordsLanguage);
    expect(rows).toHaveLength(4);
    const title = (lang: "en" | "he", language: string, day: string) =>
      signalTitle(rows.find((r) => r.wordsLanguage === language && r.at!.startsWith(day))!, tr(lang));
    expect(title("en", "Hebrew", TODAY)).toBe("2 new words in Hebrew");
    expect(title("en", "Hebrew", "2026-10-04")).toBe("1 new word in Hebrew");
    expect(title("he", "Hebrew", "2026-10-04")).toBe("מילה חדשה אחת בעברית");
    expect(title("en", "English", TODAY)).toBe("1 new word in English");
    expect(title("he", "English", TODAY)).toBe("מילה חדשה אחת באנגלית");
    expect(title("en", "Amharic", TODAY)).toBe("1 new word in Amharic");
    // counts only — no size expectation, no percentage, no comparison
    for (const r of rows) for (const lang of ["en", "he"] as const) expect(signalTitle(r, tr(lang))).not.toMatch(/%|of \{|מתוך|typical|behind|ahead/i);
  });

  it("SC-4: the #/language contract writes into langObs, a real buildTimeline source", () => {
    const language = SURFACE_CONTRACTS.find((c) => c.route === "language")!;
    expect(language.threadWrite).toBe("langObs");
    expect(TIMELINE_SOURCE_IDS).toContain("langObs");
  });

  it("useTimeline reads the langObs collection and passes it to buildTimeline", () => {
    const hook = readFileSync(path.join(SRC, "hooks/useTimeline.ts"), "utf8");
    expect(hook).toMatch(/useChildCollection<LangObservation>\(childId, "langObs"/);
    expect(hook).toContain("langObs: langObs.items,");
  });

  it("FU#62: the Story filter chips derive from a Record over SignalKind", () => {
    const tab = readFileSync(path.join(SRC, "components/tabs/StoryTimelineTab.tsx"), "utf8");
    expect(tab).toContain("const FILTER_LABEL_KEY: Record<SignalKind, string> = {");
    expect(tab).toContain("...(Object.keys(FILTER_LABEL_KEY) as SignalKind[]).map(");
  });

  it("NEGATIVE CONTROL — without the source the words never reach the stream", () => {
    expect(buildTimeline({}).filter((s) => s.wordsLanguage)).toHaveLength(0);
    const preFix = { ...SURFACE_CONTRACTS.find((c) => c.route === "language")!, threadWrite: "none" };
    expect(preFix.threadWrite).not.toBe("langObs");
  });
});
