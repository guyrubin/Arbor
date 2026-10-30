import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { translate } from "./i18n";
import { companionEn, companionHe } from "./i18nCompanion";
import {
  isArborPaused,
  parsePause,
  pauseRecordFor,
  pauseRequested,
  pauseStillOn,
  weekendEnd,
  weekLater,
  PAUSE_KEY,
} from "./pauseArbor";
import { PauseArborView } from "../components/trust/PauseArborControl";

const en = companionEn as Record<string, string>;
const he = companionHe as Record<string, string>;
const KEYS = [
  "companion.pause.title",
  "companion.pause.sub",
  "companion.pause.weekend",
  "companion.pause.week",
  "companion.pause.untilResume",
  "companion.pause.hint.weekend",
  "companion.pause.hint.week",
  "companion.pause.hint.open",
  "companion.pause.resume",
  "companion.pause.on",
  "companion.pause.until",
  "companion.pause.untilYou",
  "companion.pause.kept",
  "companion.pause.notebook",
  "companion.pause.more",
  "companion.pause.moreOn",
  "companion.pause.now",
  "companion.pause.care",
] as const;

describe("Pause Arbor — when a stretch ends", () => {
  const fridayEvening = new Date(2026, 9, 30, 18, 0, 0);

  it("English weekend ends Monday morning; Hebrew weekend ends Sunday morning", () => {
    const enEnd = weekendEnd(fridayEvening, "en");
    const heEnd = weekendEnd(fridayEvening, "he");
    expect(enEnd.getFullYear()).toBe(2026);
    expect(enEnd.getMonth()).toBe(10);
    expect(enEnd.getDate()).toBe(2);
    expect(enEnd.getHours()).toBe(0);
    expect(heEnd.getDate()).toBe(1);
    expect(heEnd.getDay()).toBe(0);
    expect(enEnd.getDay()).toBe(1);
  });

  it("the morning the weekend ends waits for the next one", () => {
    const sunday = new Date(2026, 10, 1, 9, 0, 0);
    const monday = new Date(2026, 10, 2, 9, 0, 0);
    expect(weekendEnd(sunday, "he").getDate()).toBe(8);
    expect(weekendEnd(monday, "en").getDate()).toBe(9);
  });

  it("a week is seven calendar days, and until-resume has no instant", () => {
    const later = weekLater(fridayEvening);
    expect(later.getDate()).toBe(6);
    expect(later.getHours()).toBe(18);
    const open = pauseRecordFor("until-resume", fridayEvening, "en");
    expect(open.until).toBeNull();
    expect(pauseStillOn(open, new Date(2030, 0, 1))).toBe(true);
    const week = pauseRecordFor("seven-days", fridayEvening, "he");
    expect(pauseStillOn(week, fridayEvening)).toBe(true);
    expect(pauseStillOn(week, later)).toBe(false);
  });

  it("a stored instant does not move when the language would", () => {
    const record = pauseRecordFor("this-weekend", fridayEvening, "he");
    expect(new Date(record.until!).getDay()).toBe(0);
    expect(pauseStillOn(record, new Date(2026, 9, 31, 23, 0, 0))).toBe(true);
    expect(pauseStillOn(record, new Date(2026, 10, 1, 0, 0, 0))).toBe(false);
  });
});

describe("Pause Arbor — the stored flag", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a record that is not one of the three stretches", () => {
    expect(parsePause(null)).toBeNull();
    expect(parsePause("not json")).toBeNull();
    expect(parsePause(JSON.stringify({ stretch: "weekend", until: null }))).toBeNull();
    expect(parsePause(JSON.stringify({ stretch: "until-resume", until: "2026-11-01T00:00:00.000Z" }))).toBeNull();
    expect(parsePause(JSON.stringify({ stretch: "seven-days", until: "soon" }))).toBeNull();
  });

  it("reads this device only, and only an exact paused flag", () => {
    expect(pauseRequested(undefined)).toBe(false);
    expect(pauseRequested({})).toBe(false);
    expect(pauseRequested({ paused: "true" })).toBe(false);
    expect(pauseRequested({ paused: true })).toBe(true);
    const bag = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => bag.get(key) ?? null,
      setItem: (key: string, value: string) => { bag.set(key, value); },
      removeItem: (key: string) => { bag.delete(key); },
    });
    expect(isArborPaused(new Date(2026, 9, 30, 18))).toBe(false);
    bag.set(PAUSE_KEY, JSON.stringify(pauseRecordFor("until-resume", new Date(), "en")));
    expect(isArborPaused()).toBe(true);
    bag.set(PAUSE_KEY, JSON.stringify(pauseRecordFor("seven-days", new Date(2020, 0, 1), "en")));
    expect(isArborPaused(new Date())).toBe(false);
  });
});

describe("Pause Arbor — words, both languages", () => {
  it("every pause line exists in English and Hebrew, with no verdict and no Latin in Hebrew", () => {
    for (const key of KEYS) {
      expect(en[key], key).toBeTruthy();
      expect(he[key], key).toBeTruthy();
      expect(he[key]).not.toBe(en[key]);
      expect(en[key]).not.toMatch(/%|diagnos|percentile|score|disorder/i);
      expect(he[key].replace(/\{[a-z]+\}/g, "")).not.toMatch(/[A-Za-z%]/);
    }
    expect(en["companion.pause.hint.weekend"]).toBe("Until Monday morning");
    expect(he["companion.pause.hint.weekend"]).toBe("עד יום ראשון בבוקר");
  });

  it("the settings control offers three stretches, or one resume", () => {
    const t = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
    const idle = renderToStaticMarkup(
      <PauseArborView t={t} paused={false} untilLine="" onStart={() => {}} onResume={() => {}} />,
    );
    expect(idle).toContain('data-testid="pause-weekend"');
    expect(idle).toContain('data-testid="pause-week"');
    expect(idle).toContain('data-testid="pause-until-resume"');
    expect(idle).toContain("Until Monday morning");
    expect(idle).not.toContain('data-testid="pause-resume"');
    const on = renderToStaticMarkup(
      <PauseArborView t={t} paused untilLine="Until Nov 2, 2026" onStart={() => {}} onResume={() => {}} />,
    );
    expect(on).toContain("Arbor is paused");
    expect(on).toContain("Until Nov 2, 2026");
    expect(on).toContain("What you already kept is still here.");
    expect(on).toContain('data-testid="pause-resume"');
    expect(on).not.toContain('data-testid="pause-weekend"');
    const heHtml = renderToStaticMarkup(
      <PauseArborView t={(key, vars) => translate("he", key, vars)} paused={false} untilLine="" onStart={() => {}} onResume={() => {}} />,
    );
    expect(heHtml).toContain("להשהות את ארבור");
    expect(heHtml).toContain("עד יום ראשון בבוקר");
  });
});

describe("Pause Arbor — the wires stay the ones that already exist", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("chat still has one scrubbed append, and proposals stay behind the crisis check", () => {
    const api = read("src/routes/api.ts");
    expect(api.match(/appendMemoryProposals\(memoryStore, childId, scrubMemoryProposals\(/g) ?? []).toHaveLength(1);
    expect(api).toContain("structured.memoryProposals = [];");
    const proposals = api.slice(api.indexOf('router.post("/conversation/proposals"'));
    const escalation = proposals.indexOf("screenForImmediateEscalation");
    const pause = proposals.indexOf("pauseRequested(req.body)");
    const model = proposals.indexOf("modelProvider.generateJson");
    expect(escalation).toBeGreaterThan(-1);
    expect(pause).toBeGreaterThan(escalation);
    expect(model).toBeGreaterThan(pause);
  });

  it("Now keeps its practice and recommendation pins, and the pause card is the recommendation lead only", () => {
    const now = read("src/components/companion/NowView.tsx");
    expect(now).toContain('{lead === "practice" && <PracticeFocus now={now} journal={loop.journal} onFocus={setFocus} onPending={setFocusPending} />}');
    expect(now).toContain(": <NowRecommendation name={name} onTalkOpen={talk} journal={loop.journal} />}");
    expect(now.indexOf("<NowRecommendation")).toBeLessThan(now.indexOf("<NowWhatChangedLines"));
    expect(now).toContain('data-testid="now-pause"');
    expect(now).toContain('data-primary-move');
  });

  it("More and Care open the same settings focus and do not call it Resume", () => {
    const more = read("src/components/layout/MobileNav.tsx");
    const care = read("src/components/care/CareAside.tsx");
    expect(more).toContain('data-testid="more-pause"');
    expect(more).toContain('requestOpenSettings({ focus: "pause-arbor" })');
    expect(more).not.toContain("companion.pause.resume");
    const pauseButton = more.slice(more.indexOf('data-testid="more-pause"') - 80, more.indexOf('data-testid="more-records-group"'));
    expect(pauseButton).not.toContain("chevron_right");
    expect(care).toContain('data-testid="care-pause-open"');
    expect(care).toContain('requestOpenSettings({ focus: "pause-arbor" })');
    expect(care).not.toContain("data-primary-move");
    expect(care).not.toContain("companion.pause.resume");
  });
});
