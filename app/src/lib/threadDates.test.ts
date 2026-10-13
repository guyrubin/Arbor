/**
 * F-TALK-2 — the Talk thread's date line (mock L399: "Today · 07:58").
 *
 * One line per calendar day, from the turns' own `at` stamps; a turn without
 * a stamp (saved before stamps existed) never invents a date. The CoachTab
 * mount is pinned at source level (the vitest env is node-only).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { threadDayKey, threadDayLabel, threadDayMarks } from "./threadDates";
import { appendChatUser } from "./chatStream";
import { appendVoiceUser } from "./voiceTranscript";
import { translate } from "./i18n";

const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min).toISOString();
const NOW = new Date(2026, 9, 12, 9, 30);

describe("threadDayMarks — one line per day", () => {
  it("marks the first stamped turn of each local day", () => {
    const turns = [
      { at: at(2026, 10, 11, 21, 4) },
      { at: at(2026, 10, 11, 21, 5) },
      { at: at(2026, 10, 12, 7, 58) },
      { at: at(2026, 10, 12, 8, 0) },
    ];
    expect([...threadDayMarks(turns)]).toEqual([0, 2]);
  });

  it("unstamped (legacy) turns draw no line and do not break the day run", () => {
    const turns = [{}, { at: "not a date" }, { at: at(2026, 10, 12, 7, 58) }, {}, { at: at(2026, 10, 12, 8, 1) }];
    expect([...threadDayMarks(turns)]).toEqual([2]);
    expect(threadDayMarks([{}, {}]).size).toBe(0);
  });
});

describe("threadDayLabel — Today / Yesterday / a dated day, with the time", () => {
  for (const lang of ["en", "he"] as const) {
    it(`[${lang}] today and yesterday use the keyed words; the time is 24 h`, () => {
      expect(threadDayLabel(at(2026, 10, 12, 7, 58), NOW, lang)).toBe(`${translate(lang, "companion.thread.today")} · 07:58`);
      expect(threadDayLabel(at(2026, 10, 11, 21, 4), NOW, lang)).toBe(`${translate(lang, "companion.thread.yesterday")} · 21:04`);
      const older = threadDayLabel(at(2026, 10, 9, 18, 30), NOW, lang);
      expect(older.endsWith(" · 18:30")).toBe(true);
      expect(older).not.toContain(translate(lang, "companion.thread.today"));
      expect(older).not.toContain(translate(lang, "companion.thread.yesterday"));
    });
  }

  it("the HE day words carry no Latin", () => {
    for (const key of ["companion.thread.today", "companion.thread.yesterday"]) {
      expect(translate("en", key)).not.toBe(key);
      expect(translate("he", key)).not.toMatch(/[A-Za-z]/);
    }
  });

  it("an invalid stamp renders nothing", () => {
    expect(threadDayLabel("never", NOW, "en")).toBe("");
  });

  it("threadDayKey is local time", () => {
    expect(threadDayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("turns are stamped when appended", () => {
  it("appendChatUser stamps `at`; a retry keeps the original turn and its stamp", () => {
    const typed = appendChatUser([], "Bedtime is hard.", "Integrated Balanced");
    expect(Number.isNaN(new Date(typed[0].at!).getTime())).toBe(false);
    const fixed = appendChatUser([], "Bedtime is hard.", "Integrated Balanced", undefined, undefined, at(2026, 10, 12, 7, 58));
    expect(fixed[0].at).toBe(at(2026, 10, 12, 7, 58));
    expect(appendChatUser(fixed, "Bedtime is hard.", "Integrated Balanced")).toBe(fixed);
  });

  it("appendVoiceUser stamps `at` when given, and the context gives it", () => {
    const spoken = appendVoiceUser([], "Mornings are hard.", "Integrated Balanced", at(2026, 10, 12, 7, 58));
    expect(spoken[0].at).toBe(at(2026, 10, 12, 7, 58));
    expect("at" in appendVoiceUser([], "Mornings are hard.")[0]).toBe(false);
    const context = readFileSync(path.resolve(__dirname, "..", "context", "ArborContext.tsx"), "utf8");
    expect(context).toContain("appendVoiceUser(prev, text, selectedLens, new Date().toISOString())");
  });

  it("CoachTab renders one coach-thread-date line before the first turn of each day", () => {
    const coach = readFileSync(path.resolve(__dirname, "..", "components", "tabs", "CoachTab.tsx"), "utf8");
    expect(coach).toContain("const dayMarks = useMemo(() => threadDayMarks(chatMessages), [chatMessages]);");
    expect(coach).toContain("{dayMarks.has(idx) && (");
    expect(coach).toContain('data-testid="coach-thread-date"');
    expect(coach).toContain('{threadDayLabel(msg.at!, threadNow, uiLang === "he" ? "he" : "en")}');
  });
});
