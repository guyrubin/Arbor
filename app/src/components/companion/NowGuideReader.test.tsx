import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Focus } from "../../hooks/useTodaysFocus";
import type { FamilyTopic } from "../../lib/familyTopics";

/**
 * FEAT-02 — Now's visual guide card and its reader (invented family only).
 *  - The reader's receipt shows only after the write resolved; a rejection
 *    keeps the button with an error line (B-STATUS-01).
 *  - "Picked because" is always visible (AI, library and no-offer; EN/HE) and
 *    quotes the family question only when the library pick builds its domains.
 *  - One primary move; no Feeds line (ENG-07 keeps routines.feeds unresolved).
 */

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] } as Record<string, unknown>,
  activeFamilyTopic: null as FamilyTopic | null,
  focus: null as Focus | null,
  acceptTodayAction: vi.fn(async () => {}),
  logPlayCompletion: vi.fn(async () => {}),
  buttons: [] as Record<string, any>[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: h.childProfile, behaviorLogs: [], playLogs: [], milestones: [], actionLoop: [],
  activeFamilyTopic: h.activeFamilyTopic, acceptTodayAction: h.acceptTodayAction, logPlayCompletion: h.logPlayCompletion, setActiveTab: vi.fn(),
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) };
});
vi.mock("../../hooks/useTodaysFocus", () => ({ useTodaysFocus: () => ({ focus: h.focus, loading: false, error: false, regenerate: vi.fn() }) }));
vi.mock("../trust/TrustLink", () => ({ TrustLink: () => null }));
vi.mock("../ui/Sheet", () => ({ Sheet: ({ title, children }: { title: string; children: React.ReactNode }) => <div data-sheet-title={title}>{children}</div> }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") h.buttons.push(props as Record<string, any>);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return {
    ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});

import NowGuideReader, { GuideReaderBody, finishGuide, guideReadMinutes, guideSteps, type GuideReaderContent, type GuideSave } from "./NowGuideReader";
import NowRecommendation from "./NowRecommendation";
import { NOW_COPY } from "./nowViewCopy";
import { dailyPlayForNow } from "./nowRecommendationModel";
import { translate } from "../../lib/i18n";
import { formatChildAge } from "../../lib/age/format";
import { GUIDE_ART, guideTopicFor } from "../../lib/guideArt";
import { localizeActivity } from "../../playbank/content";
import { daySeedFor } from "../../playbank/select";

const NOW = new Date(2026, 9, 12, 8);
const KNOWN_AGE = { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] };
const CONTENT: GuideReaderContent = {
  title: "Puddle jumping",
  how: ["Find a safe spot together.", "Take turns jumping and naming the splash."],
  words: "“Big splash or little splash?”",
  receipt: NOW_COPY.en.readerSaved,
};
const body = (save: GuideSave, content: GuideReaderContent = CONTENT, lang: "en" | "he" = "en") =>
  renderToStaticMarkup(<GuideReaderBody content={content} lang={lang} save={save} onDone={() => {}} />);
const doneTag = (html: string) => html.match(/<button[^>]*data-testid="now-guide-done"[^>]*>/)?.[0] ?? "";
const topic = (title: string): FamilyTopic => ({
  id: "topic-a", childId: "child-a", title, intent: "support", status: "active", observationIds: [],
  createdAt: "2026-10-01T08:00:00.000Z", updatedAt: "2026-10-01T08:00:00.000Z",
} as FamilyTopic);
const render = () => renderToStaticMarkup(<NowRecommendation name="Noa" onTalkOpen={() => {}} />);
/** Text as renderToStaticMarkup escapes it (a library title may carry an apostrophe). */
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const tr = (lang: "en" | "he") => (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  h.lang = "en"; h.childProfile = { ...KNOWN_AGE }; h.activeFamilyTopic = null; h.focus = null; h.buttons = [];
  h.acceptTodayAction.mockClear(); h.logPlayCompletion.mockClear();
});
afterEach(() => { vi.useRealTimers(); });

describe("FEAT-02 — the reader's one write", () => {
  it("shows no receipt before the write resolved; the button is disabled with the saving label meanwhile", async () => {
    const states: GuideSave[] = [];
    let resolve!: () => void;
    const run = finishGuide(() => new Promise<void>((done) => { resolve = done; }), (save) => states.push(save));
    await Promise.resolve();
    expect(states).toEqual(["saving"]);
    const pending = body("saving");
    expect(pending).not.toContain('data-testid="now-guide-receipt"');
    expect(doneTag(pending)).toContain('disabled=""');
    expect(pending).toContain(NOW_COPY.en.saving);
    resolve();
    await run;
    expect(states).toEqual(["saving", "saved"]);
    const saved = body("saved");
    expect(saved).toContain('data-testid="now-guide-receipt"');
    expect(saved).toContain(NOW_COPY.en.readerSaved);
    expect(saved).not.toContain('data-testid="now-guide-done"');
  });

  it("a failed write shows the error line and keeps the button, never the receipt", async () => {
    const states: GuideSave[] = [];
    await finishGuide(() => Promise.reject(new Error("offline")), (save) => states.push(save));
    expect(states).toEqual(["saving", "failed"]);
    const html = body("failed");
    expect(html).toContain('role="alert"');
    expect(html).toContain(NOW_COPY.en.saveError);
    expect(html).toContain(NOW_COPY.en.readerDone);
    expect(doneTag(html)).not.toContain("disabled");
    expect(html).not.toContain('data-testid="now-guide-receipt"');
  });

  it("the sheet carries How to begin, the words and We did this; tapping writes once", () => {
    const onDone = vi.fn(async () => {});
    const html = renderToStaticMarkup(<NowGuideReader content={CONTENT} lang="en" onClose={() => {}} onDone={onDone} />);
    expect(html).toContain(`data-sheet-title="${CONTENT.title}"`);
    expect(html).toContain(`<h3>${NOW_COPY.en.readerHow}</h3>`);
    expect(html).toContain(`<h3>${NOW_COPY.en.readerWords}</h3>`);
    expect(html).toContain(CONTENT.how[1]);
    expect(html.indexOf(NOW_COPY.en.readerHow)).toBeLessThan(html.indexOf(NOW_COPY.en.readerWords));
    const done = h.buttons.find((item) => item["data-testid"] === "now-guide-done");
    expect(done).toBeDefined();
    done!.onClick();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(html).not.toContain("data-primary-move");
  });

  it("omits the words section when the guide has no screened words", () => {
    const html = body("idle", { ...CONTENT, words: null });
    expect(html).not.toContain(NOW_COPY.en.readerWords);
    expect(html).not.toContain('data-testid="now-guide-words"');
  });

  it("he: the reader's labels are Hebrew, and every FEAT-02 Hebrew value is free of Latin words", () => {
    h.lang = "he";
    const html = body("idle", { ...CONTENT, title: "קפיצה בשלוליות", how: ["מוצאים מקום בטוח."], words: "״התזה גדולה?״", receipt: NOW_COPY.he.readerSaved }, "he");
    for (const key of ["readerHow", "readerWords", "readerDone"] as const) expect(html).toContain(NOW_COPY.he[key]);
    expect(body("saved", { ...CONTENT, receipt: NOW_COPY.he.readerSaved }, "he")).toContain(NOW_COPY.he.readerSaved);
    expect(body("failed", CONTENT, "he")).toContain(NOW_COPY.he.saveError);
    const he = NOW_COPY.he;
    const values = [he.pickedBecause, he.pickedLibrary, he.pickedStart, he.oneAction, he.readerHow, he.readerWords, he.readerDone, he.readerSaved,
      he.pickedQuestion("״בקרים רגועים״"), he.pickedAge("נועה", "4 שנים"), he.readMinutes(2)];
    for (const value of values) expect(value, value).not.toMatch(/[A-Za-z]/);
  });

  it("splits a screened step into at most three sentences and reads it in whole minutes", () => {
    expect(guideSteps("One. Two! Three? Four. Five.")).toEqual(["One.", "Two!", "Three? Four. Five."]);
    expect(guideSteps("A single long sentence without a stop")).toEqual(["A single long sentence without a stop"]);
    expect(guideReadMinutes(["a few words", null])).toBe(1);
    expect(guideReadMinutes([Array.from({ length: 401 }, () => "word").join(" ")])).toBe(3);
  });
});

describe("FEAT-02 — Picked because, always visible", () => {
  const picked = (html: string) => html.match(/<p class="now-picked" data-testid="now-picked-because">[\s\S]*?<\/p>/)?.[0] ?? "";

  it.each(["en", "he"] as const)("%s library: the line shows the age and the library reason without a tap", (lang) => {
    h.lang = lang;
    const html = render();
    const line = picked(html);
    expect(html).toContain('data-recommendation-source="library"');
    expect(line).toContain(NOW_COPY[lang].pickedBecause);
    expect(line).toContain(NOW_COPY[lang].pickedAge("Noa", formatChildAge(KNOWN_AGE, tr(lang), NOW)));
    expect(line).toContain(NOW_COPY[lang].curatedWhy);
    expect(html).not.toContain("<details");
    expect(html).toContain('data-testid="now-guide-meta"');
    expect(html).toContain(NOW_COPY[lang].oneAction);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).toContain(NOW_COPY[lang].begin);
    expect(html).not.toContain(NOW_COPY[lang].choose);
  });

  it.each(["en", "he"] as const)("%s question: a domain-matching library pick leads and the line quotes the question", (lang) => {
    h.lang = lang;
    const title = lang === "he" ? "מילים חדשות בבית" : "More words at home";
    h.activeFamilyTopic = topic(title);
    const guide = guideTopicFor({ title });
    expect(guide).toBe("new-words");
    const expected = dailyPlayForNow({ ageYears: 4, concernDomains: [], goalDomains: [], interests: [], recentlyDoneIds: [], daySeed: daySeedFor(NOW.getTime()), topicDomains: GUIDE_ART[guide!].domains })[0];
    expect(expected.topicMatch).toBe(true);
    expect(expected.activity.domain).toBe("language");
    const html = render();
    expect(html).toContain(esc(localizeActivity(expected.activity, lang).title));
    const line = picked(html);
    expect(line).toContain(NOW_COPY[lang].pickedQuestion(translate(lang, "elev.loop.ms.quoted", { text: title })));
    expect(line).toContain(NOW_COPY[lang].pickedLibrary);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    // No shipped illustration yet: the shapes stay (graceful fallback).
    expect(html).not.toContain("now-plan-img");
  });

  it.each(["en", "he"] as const)("%s AI: the line names the real inputs, never the question the model did not see", (lang) => {
    h.lang = lang;
    const question = lang === "he" ? "מילים חדשות בבית" : "More words at home";
    h.activeFamilyTopic = topic(question);
    const step = lang === "he" ? "לפני היציאה עוצרים יחד ומציעים בחירה בין שתי נעליים." : "Before leaving, pause together and offer a choice between two pairs of shoes.";
    h.focus = { text: step, tryToday: step, focus: "Mornings have been busy.", dateKey: "2026-10-12", generatedAt: "2026-10-12T07:00:00Z", lang } as Focus;
    const html = render();
    const line = picked(html);
    expect(html).toContain('data-recommendation-source="ai"');
    expect(line).toContain(NOW_COPY[lang].pickedBecause);
    expect(line).toContain(NOW_COPY[lang].pickedAge("Noa", formatChildAge(KNOWN_AGE, tr(lang), NOW)));
    expect(line).not.toContain(question);
    expect(html.split(step)).toHaveLength(2);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).toContain(NOW_COPY[lang].begin);
    expect(html).toContain(NOW_COPY[lang].readMinutes(1));
    const choose = h.buttons.find((item) => React.Children.toArray(item.children).includes(NOW_COPY[lang].choose));
    expect(choose, "the AI step keeps its screened accept").toBeDefined();
  });

  it.each(["en", "he"] as const)("%s no offer: the line still shows, with no age claim", (lang) => {
    h.lang = lang;
    h.childProfile = { id: "child-a", name: "Noa", interests: [], activeGoals: [] };
    const html = render();
    const line = picked(html);
    expect(line).toContain(NOW_COPY[lang].pickedBecause);
    expect(line).toContain(NOW_COPY[lang].pickedStart);
    expect(html).toContain(NOW_COPY[lang].togetherTitle);
    expect(html).not.toContain('data-testid="now-guide-meta"');
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });
});

describe("FEAT-02 — source pins", () => {
  const SRC = path.dirname(fileURLToPath(import.meta.url));
  const rec = readFileSync(path.join(SRC, "NowRecommendation.tsx"), "utf8").replace(/\r\n/g, "\n");
  it("the reader mounts only while open, and its writes are the existing seams", () => {
    expect(rec).toContain("{guide && <NowGuideReader ");
    expect(rec.match(/acceptTodayAction\(/g)).toHaveLength(1);
    expect(rec).toContain('if (guide.kind === "library") return logPlayCompletion(guide.pick, "today");');
    expect(rec).toContain("await accept();");
  });
  it("drops the Feeds line and the inline steps toggle", () => {
    expect(rec).not.toContain("routines.feeds");
    expect(rec).not.toContain("<details");
    expect(rec).not.toContain("stepsOpen");
  });
});
