import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toObservations, type ObservationSources } from "../../lib/observations";
import { EMOTIONS } from "../../practice/playContent";
import type { AdventureResult, MimicSession, MissionRecord, PracticeEvent } from "../../types";

/**
 * v3 FEAT-04 — "From {name}'s world today" on Now. Today's Kid Mode records
 * only, each with its time and, where one exists, a line of NAMES beneath the
 * title (the feeling the child chose, the pack, the skill, the mission). Never
 * a score, a round count, a level or a percentage; nothing at all when Kid
 * Mode was not used today. v3 F-NOW-2: no note line under the strip (the mock
 * has none), and the week card carries "Since you were last here".
 * Invented examples only.
 */
const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", childName: "Noa", events: [] as unknown[] }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "child-a", name: state.childName, age: 4 }, actionLoop: [] }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (_id: string, name: string) => ({ items: name === "practiceEvents" ? state.events : [], loaded: true }) }));
import { NowKidWorld, NowWeekSoFar } from "./NowDayPanels";
import { NOW_COPY } from "./nowViewCopy";
import { KID_FEELING_WORDS, portraitEvidenceLines } from "./portraitEvidence";

const NOW = new Date(2026, 9, 12, 17, 0);
const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).toISOString();
const timeOf = (iso: string, he = false) => new Date(iso).toLocaleTimeString(he ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit" });
const child = { id: "child-a", name: "Noa", age: 4, languages: [] };

const MOOD: PracticeEvent = { id: "mood-checkin-a", kind: "mood-checkin", domain: "emotional", emotion: "happy", timestamp: at(12, 7, 52) };
const MEMORY: PracticeEvent = { id: "memory-a", kind: "memory", domain: "cognition", score: 12, correct: false, meta: "raw grades must not appear", timestamp: at(12, 16, 25) };
const SNEAK: PracticeEvent = { id: "stop-a", kind: "stop-signal", domain: "cognition", game: "stop-signal", rounds: 4, timestamp: at(12, 15, 10) };
const MIMIC: MimicSession = { id: "mimic-a", packId: "animal-sounds", promptId: "lion", rating: 3, timestamp: at(12, 10, 5) };
const ADVENTURE: AdventureResult = { id: "adventure-a", scenarioId: "forest", sceneId: "bridge", skill: "logic", correct: true, timestamp: at(12, 12, 40) };
const MISSION: MissionRecord = { id: "2026-10-12-emotion-spotting", date: "2026-10-12", missionId: "emotion-spotting", domain: "emotional", completed: true, timestamp: at(12, 8, 30) };

function render(sources: ObservationSources, name = state.childName) {
  state.events = sources.practiceEvents ?? [];
  const observations = toObservations(sources, child);
  return renderToStaticMarkup(<NowKidWorld observations={observations} now={NOW} name={name} onAll={() => {}} />);
}
/** What a parent reads: decorative (aria-hidden) glyph text, tags and entities out, whitespace collapsed. */
const visible = (html: string) => html.replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[#\w]+;/g, " ").replace(/\s+/g, " ").trim();
const subs = (html: string) => [...html.matchAll(/<span class="now-world-sub" dir="auto">([^<]*)<\/span>/g)].map(match => match[1]);

beforeEach(() => { state.lang = "en"; state.childName = "Noa"; state.events = []; });

describe("NowKidWorld (v3 FEAT-04)", () => {
  it("a mood check-in today shows its time, 'A feeling the child chose' and, beneath it, the feeling word only", () => {
    const html = render({ practiceEvents: [MOOD] });
    expect(html).toContain('data-testid="now-kid-world"');
    expect(html).toContain(NOW_COPY.en.worldTitle("Noa"));
    expect(html).toMatch(new RegExp(`<time datetime="${MOOD.timestamp}">${timeOf(MOOD.timestamp)}</time><b>A feeling the child chose</b>`, "i"));
    expect(subs(html)).toEqual(["“Happy”"]);
    expect(html).toContain(NOW_COPY.en.worldLatest(timeOf(MOOD.timestamp)));
  });

  // v3 F-NOW-2 re-pin (now-world-note): the strip ends at "All moments"; where items are kept is said on Moments.
  it("has no note line; the same item still carries its 'Activity record' label in the portrait", () => {
    const html = render({ practiceEvents: [MOOD] });
    expect(html).not.toContain("now-kid-world-note");
    expect(html).not.toContain("now-world-note");
    expect(html).not.toContain("Activity record");
    const [item] = toObservations({ practiceEvents: [MOOD] }, child);
    expect(item.source).toBe("kid_practice");
    expect(portraitEvidenceLines(item, { practiceEvents: [MOOD] }, false)).toContainEqual({ label: "Observation", text: "Happy" });
    expect(portraitEvidenceLines(item, { practiceEvents: [MOOD] }, true)).toContainEqual({ label: "תצפית", text: "שמחה" });
  });

  it("is absent when Kid Mode was not used today: no heading, no empty card", () => {
    const yesterday = { ...MOOD, id: "mood-yesterday", timestamp: at(11, 18, 0) };
    const later = { ...MOOD, id: "mood-later", timestamp: at(12, 19, 0) };
    expect(render({})).toBe("");
    expect(render({ practiceEvents: [yesterday, later] })).toBe("");
    const parentOnly = render({ behaviorLogs: [{ id: "moment-a", timestamp: at(12, 9, 0), behaviorType: "Moment", trigger: "Built a tower", notes: "", context: "Home", durationMinutes: 0 }] });
    expect(parentOnly).toBe("");
  });

  it("never shows yesterday, and 'Latest activity' matches the newest tile", () => {
    const yesterday: PracticeEvent = { id: "calm-yesterday", kind: "calm", domain: "emotional", timestamp: at(11, 18, 0) };
    const html = render({ practiceEvents: [yesterday, MOOD, MEMORY] });
    expect(html.match(/<li /g)).toHaveLength(2);
    expect(html).not.toContain(yesterday.timestamp);
    expect(html).not.toContain("Calm breathing");
    expect(html).toContain(NOW_COPY.en.worldLatest(timeOf(MEMORY.timestamp)));
    expect([...html.matchAll(/<time datetime="([^"]+)"/gi)].map(match => match[1]).at(-1)).toBe(MEMORY.timestamp);
  });

  it("names only: no digit other than the times, no score, %, level or verdict, even from scored rows", () => {
    const html = render({ practiceEvents: [MEMORY, SNEAK], mimicSessions: [MIMIC], adventureResults: [ADVENTURE] });
    expect(subs(html)).toEqual(["Animal Sounds", "Logic"]);
    let text = visible(html);
    for (const iso of [MEMORY.timestamp, SNEAK.timestamp, MIMIC.timestamp, ADVENTURE.timestamp]) text = text.split(timeOf(iso)).join(" ");
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/%|score|level|accura|correct|nailed|stars|raw grades|\bLow\b|\bMed\b|\bHigh\b/i);
  });

  it("the tiles stay non-interactive: one button (All moments), no module and no primary move of its own", () => {
    const html = render({ practiceEvents: [MOOD, MEMORY], mimicSessions: [MIMIC] });
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('class="now-world-all"');
    expect(html).not.toContain("data-module");
    expect(html).not.toContain("data-primary-move");
  });

  it("a parent-ticked mission keeps its name, and nothing calls it an Activity record", () => {
    const html = render({ practiceEvents: [MOOD], missionRecords: [MISSION] });
    expect(subs(html)).toEqual(["“Happy”", "Emotion detective"]);
    expect(html).not.toContain("now-kid-world-note");
    expect(html).not.toContain("Activity record");
  });

  it("HE: mirrors in Hebrew only, he-IL times, the feeling word with dir=auto", () => {
    state.lang = "he"; state.childName = "נועה";
    const html = render({ practiceEvents: [MOOD], mimicSessions: [MIMIC], adventureResults: [ADVENTURE], missionRecords: [MISSION] }, "נועה");
    expect(html).toContain(NOW_COPY.he.worldTitle("נועה"));
    expect(subs(html)).toEqual(["„שמחה”", "בלשי רגשות", "קולות של חיות", "היגיון"]);
    expect(html).toContain(timeOf(ADVENTURE.timestamp, true));
    expect(visible(html)).not.toMatch(/[A-Za-z]/);
    const moodOnly = render({ practiceEvents: [MOOD] }, "נועה");
    expect(moodOnly).not.toContain("now-kid-world-note");
    expect(visible(moodOnly)).not.toMatch(/[A-Za-z]/);
  });

  it("every Kid Mode feeling has a parent word in both languages (HE in Hebrew only)", () => {
    for (const emotion of EMOTIONS) {
      const [en, he] = KID_FEELING_WORDS[emotion.id] ?? [];
      expect(en, emotion.id).toBeTruthy();
      expect(he, emotion.id).toMatch(/^[֐-׿ ]+$/);
    }
  });

  it("CSS: 40 px glyph circles, the 44 px floor on All moments, logical properties only", () => {
    const css = readFileSync(new URL("./nowView.css", import.meta.url), "utf8");
    const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.>]/g, m => `\\${m}`)}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
    expect(rule(".now-world-glyph")).toMatch(/inline-size: 40px; block-size: 40px/);
    expect(rule(".now-world-all")).toContain("min-block-size: 44px");
    expect(css).not.toContain(".now-world-note");
    for (const selector of [".now-world-sub", ".now-week-changed", ".now-week-line", ".now-reminder-chip", ".now-reminders-all"]) {
      expect(rule(selector), selector).not.toBe("");
      expect(rule(selector), selector).not.toMatch(/(?:^|[\s;-])(?:left|right)\s*:|margin-(?:left|right)|padding-(?:left|right)|text-align:\s*(?:left|right)/);
    }
    // v3 F-NOW-2: every changed line, chip and link keeps the 44 px floor.
    for (const selector of [".now-week-line", ".now-reminder-chip", ".now-reminders-all"]) expect(rule(selector), selector).toContain("min-block-size: 44px");
    expect(rule(".now-week-changed")).toContain("border-block-start: 1px solid var(--arbor-rule)");
    expect(css).toContain(".now-week-changed:empty { display: none; }");
  });
});

describe("NowWeekSoFar · Since you were last here (v3 F-NOW-2)", () => {
  const week = (props: Partial<React.ComponentProps<typeof NowWeekSoFar>> = {}) =>
    renderToStaticMarkup(<NowWeekSoFar observations={[]} now={NOW} onReport={() => {}} {...props} />);
  const LINES = [
    { id: "lifecycle", icon: "auto_awesome", text: "A first week together" },
    { id: "moments.0", icon: "edit_note", text: "2 new moments kept", onOpen: () => {} },
    { id: "milestone.1", icon: "workspace_premium", text: "Milestone: waves bye-bye", onOpen: () => {} },
    { id: "notice", icon: "visibility", text: "Worth noticing · stacks two blocks", onOpen: () => {} },
  ];

  it.each(["en", "he"] as const)("%s: below a rule, the title and at most three lines; a line with no destination is not a button", lang => {
    state.lang = lang;
    const html = week({ changedLines: LINES });
    const changed = html.slice(html.indexOf('data-testid="now-week-changed"'));
    expect(changed).toContain(`<h3 id="`);
    expect(changed).toContain(NOW_COPY[lang].changedTitle);
    expect(changed.match(/data-testid="now-week-line"/g)).toHaveLength(3);
    expect(changed).toMatch(/<p class="now-week-line" data-testid="now-week-line" data-line="lifecycle">/);
    expect(changed.match(/<button type="button" class="now-week-line"/g)).toHaveLength(2);
    expect(changed).not.toContain("stacks two blocks");
    // Events and counts only: no ratio, no percentage, no bar.
    expect(changed).not.toMatch(/\d\s*\/\s*\d|\d\s*%|role="progressbar"|<progress/);
  });

  // v3 F-NOW-2 r2: the week card takes no caller line (the say-back left Now).
  it("the cold-start line follows the changed lines; nothing renders inside when empty", () => {
    const html = week({ changedLines: LINES.slice(1, 2), coldStart: "Two more days and the rhythm shows" });
    const changed = html.slice(html.indexOf('data-testid="now-week-changed"'));
    expect(changed.indexOf("now-week-line")).toBeLessThan(changed.indexOf('data-testid="today-coldstart-line"'));
    expect(changed).not.toContain("today-door-saidback");
    expect(week()).toContain('<div class="now-week-changed" data-testid="now-week-changed"></div>');
    expect(week()).not.toContain("<h3");
  });
});
