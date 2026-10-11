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
 *    keeps the button with an error line (B-STATUS-01). Its state lives in a
 *    store above Now's lead switch, so an AI guide that becomes the chosen step
 *    keeps its sheet, receipt and error after the card unmounts.
 *  - The library write waits for the server's acknowledgement (offline or
 *    unconfirmed it rejects); the AI write is the one screened accept (TODAY-1).
 *  - "Picked because" is always visible (AI, library and no-offer; EN/HE),
 *    takes the page's direction with the name isolated, and quotes the family
 *    question only when the library pick builds its domains.
 *  - One primary move; no Feeds line (ENG-07 keeps routines.feeds unresolved).
 */

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  childProfile: { id: "child-a", name: "Noa", age: 4, interests: [], activeGoals: [] } as Record<string, unknown>,
  activeFamilyTopic: null as FamilyTopic | null,
  focus: null as Focus | null,
  acceptTodayAction: vi.fn(async (..._args: unknown[]) => {}),
  logPlayCompletion: vi.fn(async (..._args: unknown[]) => {}),
  logPlayCompletionAcknowledged: vi.fn(async (..._args: unknown[]) => {}),
  buttons: [] as Record<string, any>[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: h.childProfile, behaviorLogs: [], playLogs: [], milestones: [], actionLoop: [],
  activeFamilyTopic: h.activeFamilyTopic, acceptTodayAction: h.acceptTodayAction, logPlayCompletion: h.logPlayCompletion,
  logPlayCompletionAcknowledged: h.logPlayCompletionAcknowledged, setActiveTab: vi.fn(),
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

import NowGuideReader, {
  GuideReaderBody, NowGuideHost, NowGuideSheet, createGuideStore, finishGuide, guideReadMinutes, guideSteps, useNowGuideHost,
  type GuideReaderContent, type GuideSave, type GuideStore,
} from "./NowGuideReader";
import NowRecommendation from "./NowRecommendation";
import NowPlanFrame from "./NowPlanFrame";
import { NOW_COPY } from "./nowViewCopy";
import { dailyPlayForNow } from "./nowRecommendationModel";
import { translate } from "../../lib/i18n";
import { isolate } from "../../lib/bidi";
import { formatChildAge } from "../../lib/age/format";
import { GUIDE_ART, guideArtFor, guideTopicFor, type GuideTopic } from "../../lib/guideArt";
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
const STEP = { en: "Before leaving, pause together and offer a choice between two pairs of shoes.", he: "לפני היציאה עוצרים יחד ומציעים בחירה בין שתי נעליים." } as const;
const body = (save: GuideSave, content: GuideReaderContent = CONTENT, lang: "en" | "he" = "en") =>
  renderToStaticMarkup(<GuideReaderBody content={content} lang={lang} save={save} onDone={() => {}} />);
const doneTag = (html: string) => html.match(/<button[^>]*data-testid="now-guide-done"[^>]*>/)?.[0] ?? "";
const topic = (title: string): FamilyTopic => ({
  id: "topic-a", childId: "child-a", title, intent: "support", status: "active", observationIds: [],
  createdAt: "2026-10-01T08:00:00.000Z", updatedAt: "2026-10-01T08:00:00.000Z",
} as FamilyTopic);
const aiFocus = (lang: "en" | "he"): Focus => ({ text: STEP[lang], tryToday: STEP[lang], focus: "Mornings have been busy.", dateKey: "2026-10-12", generatedAt: "2026-10-12T07:00:00Z", lang } as Focus);
const render = () => renderToStaticMarkup(<NowRecommendation name="Noa" onTalkOpen={() => {}} />);
/** Renders the card inside Now's guide host and hands back the host's store. */
const renderHosted = () => {
  const seen: { store: GuideStore | null } = { store: null };
  const Probe = () => { seen.store = useNowGuideHost(); return null; };
  const html = renderToStaticMarkup(<NowGuideHost lang={h.lang}><Probe /><NowRecommendation name="Noa" onTalkOpen={() => {}} /></NowGuideHost>);
  if (!seen.store) throw new Error("no guide host");
  return { html, store: seen.store };
};
const begin = () => {
  const button = h.buttons.find((item) => item["data-primary-move"] === "choose-next-step");
  if (!button) throw new Error("no Begin button");
  return button;
};
const deferred = () => {
  let resolve!: () => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
/** The pick the card leads with for the invented child (no topic). */
const libraryPick = () => dailyPlayForNow({ ageYears: 4, concernDomains: [], goalDomains: [], interests: [], recentlyDoneIds: [], daySeed: daySeedFor(NOW.getTime()) })[0];
/** Text as renderToStaticMarkup escapes it (a library title may carry an apostrophe). */
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const tr = (lang: "en" | "he") => (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  h.lang = "en"; h.childProfile = { ...KNOWN_AGE }; h.activeFamilyTopic = null; h.focus = null; h.buttons = [];
  h.acceptTodayAction.mockReset(); h.acceptTodayAction.mockImplementation(async () => {});
  h.logPlayCompletion.mockReset(); h.logPlayCompletion.mockImplementation(async () => {});
  h.logPlayCompletionAcknowledged.mockReset(); h.logPlayCompletionAcknowledged.mockImplementation(async () => {});
});
afterEach(() => { vi.useRealTimers(); });

describe("FEAT-02 — the reader's one write", () => {
  it("shows no receipt before the write resolved; the button is disabled with the saving label meanwhile", async () => {
    const states: GuideSave[] = [];
    const write = deferred();
    const run = finishGuide(() => write.promise, (save) => states.push(save));
    await Promise.resolve();
    expect(states).toEqual(["saving"]);
    const pending = body("saving");
    expect(pending).not.toContain('data-testid="now-guide-receipt"');
    expect(doneTag(pending)).toContain('disabled=""');
    expect(pending).toContain(NOW_COPY.en.saving);
    write.resolve();
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

  it("the sheet carries How to begin, the words and We did this; tapping calls the write once", () => {
    const onDone = vi.fn();
    const html = renderToStaticMarkup(<NowGuideReader content={CONTENT} lang="en" save="idle" onClose={() => {}} onDone={onDone} />);
    expect(html).toContain(`data-sheet-title="${CONTENT.title}"`);
    expect(html).toContain(`<h3>${NOW_COPY.en.steps}</h3>`);
    expect(html).toContain(`<h3>${NOW_COPY.en.readerWords}</h3>`);
    expect(html).toContain(CONTENT.how[1]);
    expect(html.indexOf(NOW_COPY.en.steps)).toBeLessThan(html.indexOf(NOW_COPY.en.readerWords));
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
    for (const key of ["steps", "readerWords", "readerDone"] as const) expect(html).toContain(NOW_COPY.he[key]);
    expect(body("saved", { ...CONTENT, receipt: NOW_COPY.he.readerSaved }, "he")).toContain(NOW_COPY.he.readerSaved);
    expect(body("failed", CONTENT, "he")).toContain(NOW_COPY.he.saveError);
    const he = NOW_COPY.he;
    const values = [he.pickedBecause, he.pickedLibrary, he.pickedStart, he.oneAction, he.steps, he.readerWords, he.readerDone, he.readerSaved,
      he.pickedQuestion("״בקרים רגועים״"), he.pickedAge("נועה", "4 שנים"), he.readMinutes(2), he.togetherMinutes(10)];
    for (const value of values) expect(value, value).not.toMatch(/[A-Za-z]/);
  });

  it("the copy keeps no dead keys from the old inline guide", () => {
    for (const lang of ["en", "he"] as const) {
      for (const key of ["why", "hide", "minutes", "whySuggestion", "readerHow"]) expect(key in NOW_COPY[lang], `${lang}.${key}`).toBe(false);
    }
  });

  it("splits a screened step into at most three sentences and reads it in whole minutes", () => {
    expect(guideSteps("One. Two! Three? Four. Five.")).toEqual(["One.", "Two!", "Three? Four. Five."]);
    expect(guideSteps("A single long sentence without a stop")).toEqual(["A single long sentence without a stop"]);
    expect(guideReadMinutes(["a few words", null])).toBe(1);
    expect(guideReadMinutes([Array.from({ length: 401 }, () => "word").join(" ")])).toBe(3);
  });
});

describe("FEAT-02 — the guide store outlives the card that opened it", () => {
  it("writes once, shows saving then the receipt, and keeps the receipt with no card mounted", async () => {
    const store = createGuideStore();
    const write = deferred();
    const run = vi.fn(() => write.promise);
    store.open({ content: CONTENT, write: run });
    expect(store.getSnapshot()).toMatchObject({ save: "idle", openId: 1 });
    const done = store.done();
    expect(store.getSnapshot().save).toBe("saving");
    await store.done();
    expect(run).toHaveBeenCalledTimes(1);
    expect(renderToStaticMarkup(<NowGuideSheet store={store} lang="en" />)).not.toContain('data-testid="now-guide-receipt"');
    write.resolve();
    await done;
    expect(store.getSnapshot().save).toBe("saved");
    await store.done();
    expect(run).toHaveBeenCalledTimes(1);
    const sheet = renderToStaticMarkup(<NowGuideSheet store={store} lang="en" />);
    expect(sheet).toContain(`data-sheet-title="${CONTENT.title}"`);
    expect(sheet).toContain('data-testid="now-guide-receipt"');
    expect(sheet).not.toContain('data-testid="now-guide-done"');
    store.close();
    expect(store.getSnapshot().request).toBeNull();
    expect(renderToStaticMarkup(<NowGuideSheet store={store} lang="en" />)).toBe("");
  });

  it("a rejected write ends failed with the button kept; the parent may retry", async () => {
    const store = createGuideStore();
    const run = vi.fn(async () => {}).mockRejectedValueOnce(new Error("offline"));
    store.open({ content: CONTENT, write: run });
    await store.done();
    expect(store.getSnapshot().save).toBe("failed");
    const sheet = renderToStaticMarkup(<NowGuideSheet store={store} lang="en" />);
    expect(sheet).toContain('data-testid="now-guide-error"');
    expect(sheet).toContain('data-testid="now-guide-done"');
    expect(sheet).not.toContain('data-testid="now-guide-receipt"');
    await store.done();
    expect(run).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().save).toBe("saved");
  });

  it("a late result never lands on a guide closed or reopened meanwhile", async () => {
    const store = createGuideStore();
    const first = deferred();
    store.open({ content: CONTENT, write: () => first.promise });
    const done = store.done();
    const next = { content: { ...CONTENT, title: "Another guide" }, write: vi.fn(async () => {}) };
    store.open(next);
    first.resolve();
    await done;
    expect(store.getSnapshot()).toMatchObject({ request: next, save: "idle", openId: 2 });
    const late = deferred();
    store.open({ content: CONTENT, write: () => late.promise });
    const pending = store.done();
    store.close();
    late.reject(new Error("offline"));
    await pending;
    expect(store.getSnapshot()).toMatchObject({ request: null, save: "idle" });
  });
});

describe("FEAT-02 — Begin opens the reader in Now's host; We did this writes once", () => {
  it("library: the play is logged through the acknowledged write, and the receipt names the journal", async () => {
    const { html, store } = renderHosted();
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).not.toContain('data-testid="now-guide-reader"');
    begin().onClick();
    const expected = libraryPick();
    const activity = localizeActivity(expected.activity, "en");
    const opened = store.getSnapshot().request;
    expect(opened?.content).toMatchObject({ title: activity.title, how: activity.steps, receipt: translate("en", "elev.growth.play.toast.added", { name: "Noa" }) });
    await store.done();
    expect(h.logPlayCompletionAcknowledged).toHaveBeenCalledTimes(1);
    const [played, source] = h.logPlayCompletionAcknowledged.mock.calls[0] as [{ activity: { id: string } }, string];
    expect(played.activity.id).toBe(expected.activity.id);
    expect(source).toBe("today");
    expect(h.logPlayCompletion).not.toHaveBeenCalled();
    expect(h.acceptTodayAction).not.toHaveBeenCalled();
    expect(store.getSnapshot().save).toBe("saved");
  });

  it("library offline: the acknowledged write rejects, so the reader shows the error and no receipt", async () => {
    h.logPlayCompletionAcknowledged.mockRejectedValueOnce(new Error("The write needs an online confirmation"));
    const { store } = renderHosted();
    begin().onClick();
    await store.done();
    expect(store.getSnapshot().save).toBe("failed");
    const sheet = renderToStaticMarkup(<NowGuideSheet store={store} lang="en" />);
    expect(sheet).toContain(NOW_COPY.en.saveError);
    expect(sheet).not.toContain('data-testid="now-guide-receipt"');
  });

  it.each(["en", "he"] as const)("%s AI: the reader writes through the one screened accept, never the play log", async (lang) => {
    h.lang = lang;
    h.focus = { ...aiFocus(lang), sayThis: lang === "he" ? "נבחר יחד?" : "Shall we choose together?" } as Focus;
    const { store } = renderHosted();
    begin().onClick();
    const opened = store.getSnapshot().request;
    expect(opened?.content.title).toBe(NOW_COPY[lang].planTag.recommendation);
    expect(opened?.content.how).toEqual(guideSteps(STEP[lang]));
    expect(opened?.content.words).toBe(translate(lang, "elev.loop.ms.quoted", { text: h.focus.sayThis! }));
    expect(opened?.content.receipt).toBe(NOW_COPY[lang].readerSaved);
    await store.done();
    expect(h.acceptTodayAction).toHaveBeenCalledTimes(1);
    expect(h.acceptTodayAction).toHaveBeenCalledWith(STEP[lang], "standard");
    expect(h.logPlayCompletionAcknowledged).not.toHaveBeenCalled();
    expect(store.getSnapshot().save).toBe("saved");
  });

  it("AI rejected: the reader ends failed, never saved", async () => {
    h.focus = aiFocus("en");
    h.acceptTodayAction.mockRejectedValueOnce(new Error("offline"));
    const { store } = renderHosted();
    begin().onClick();
    await store.done();
    expect(store.getSnapshot().save).toBe("failed");
  });

  it("outside the host the card keeps a store of its own and still mounts no sheet until Begin", () => {
    const html = render();
    expect(html).not.toContain('data-testid="now-guide-reader"');
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });
});

describe("FEAT-02 — Picked because, always visible", () => {
  const picked = (html: string) => html.match(/<p class="now-picked" data-testid="now-picked-because">[\s\S]*?<\/p>/)?.[0] ?? "";
  const ageLine = (lang: "en" | "he") => NOW_COPY[lang].pickedAge(isolate("Noa", lang), formatChildAge(KNOWN_AGE, tr(lang), NOW));

  it.each(["en", "he"] as const)("%s library: the line shows the age and the library reason without a tap", (lang) => {
    h.lang = lang;
    const html = render();
    const line = picked(html);
    expect(html).toContain('data-recommendation-source="library"');
    expect(line).toContain(NOW_COPY[lang].pickedBecause);
    expect(line).toContain(ageLine(lang));
    expect(line).toContain(NOW_COPY[lang].curatedWhy);
    expect(line, "the line takes the page's direction").not.toContain('dir="auto"');
    expect(html).not.toContain("<details");
    const meta = html.match(/<ul class="now-guide-meta"[\s\S]*?<\/ul>/)?.[0] ?? "";
    expect(meta).toContain(NOW_COPY[lang].togetherMinutes(libraryPick().activity.durationMin));
    expect(meta).toContain(NOW_COPY[lang].oneAction);
    expect(meta).toContain("schedule");
    expect(meta).toContain("task_alt");
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).toContain(NOW_COPY[lang].begin);
    expect(html).not.toContain(NOW_COPY[lang].choose);
  });

  it("he: a Latin name is isolated inside the Hebrew line; en: a Latin name is left as is", () => {
    expect(isolate("Noa", "he")).toBe("⁨Noa⁩");
    h.lang = "he";
    expect(picked(render())).toContain("⁨Noa⁩");
    h.lang = "en";
    expect(picked(render())).not.toContain("⁨");
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
    expect(html).toContain("now-plan-medallion");
  });

  it.each(["en", "he"] as const)("%s AI: the line names the real inputs, never the question the model did not see", (lang) => {
    h.lang = lang;
    const question = lang === "he" ? "מילים חדשות בבית" : "More words at home";
    h.activeFamilyTopic = topic(question);
    h.focus = aiFocus(lang);
    const html = render();
    const line = picked(html);
    expect(html).toContain('data-recommendation-source="ai"');
    expect(line).toContain(NOW_COPY[lang].pickedBecause);
    expect(line).toContain(ageLine(lang));
    expect(line).not.toContain(question);
    expect(line).not.toContain('dir="auto"');
    expect(html.split(STEP[lang])).toHaveLength(2);
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

describe("FEAT-02 — the guide art branch", () => {
  it.each(["en", "he"] as const)("%s: a shipped illustration replaces the shapes under a scrim; the tag stays", (lang) => {
    const art = guideArtFor("new-words", lang, new Set<GuideTopic>(["new-words"]));
    expect(art).toBeDefined();
    const html = renderToStaticMarkup(<NowPlanFrame kind="recommendation" tag={NOW_COPY[lang].planTag.recommendation} art={art}><p>lead</p></NowPlanFrame>);
    expect(html).toContain('data-art="guide-art"');
    expect(html).toMatch(/<img class="now-plan-img" src="\/visuals\/guides\/new-words-960\.webp"/);
    expect(html).toContain(`alt="${esc(art!.alt)}"`);
    expect(html).toContain('width="960"');
    expect(html).toContain('height="540"');
    expect(html).toContain('class="now-plan-scrim" aria-hidden="true"');
    expect(html).not.toContain("now-plan-blob");
    expect(html).not.toContain("now-plan-medallion");
    expect(html).toContain(NOW_COPY[lang].planTag.recommendation);
    expect(html).toContain("arbor-depth-primary");
  });

  it("without art the shapes and the medallion stay, and nothing claims guide art", () => {
    const html = renderToStaticMarkup(<NowPlanFrame kind="recommendation" tag="Today’s guide" art={guideArtFor("new-words", "en")}><p>lead</p></NowPlanFrame>);
    expect(html).not.toContain("data-art");
    expect(html).not.toContain("now-plan-img");
    expect(html).toContain("now-plan-blob now-plan-blob-a");
    expect(html).toContain("now-plan-medallion");
  });
});

describe("FEAT-02 — source pins", () => {
  const SRC = path.dirname(fileURLToPath(import.meta.url));
  const read = (file: string) => readFileSync(path.join(SRC, file), "utf8").replace(/\r\n/g, "\n");
  const rec = read("NowRecommendation.tsx");
  const view = read("NowView.tsx");
  const css = read("nowView.css");
  const ctx = read("../../context/ArborContext.tsx");

  it("Now's host owns the reader above the lead switch; the card falls back to its own store only outside it", () => {
    // One host per child and language, wrapping the keyed page (the lead switch lives inside NowContent).
    expect(view).toContain("return <NowGuideHost key={`${childProfile.id}:${uiLang}`} lang={uiLang === \"he\" ? \"he\" : \"en\"}>\n    <NowContent key={`${childProfile.id}:${uiLang}`} {...props} />\n  </NowGuideHost>;");
    expect(rec).toContain("const guides = hostedGuides ?? ownGuides;");
    expect(rec).toContain("{!hostedGuides && <NowGuideSheet store={ownGuides} lang={lang} />}");
    expect(rec).not.toContain("<NowGuideReader ");
    // One alert: while the reader is open it carries the write's error itself.
    expect(rec).toContain('{saveError && !readerOpen && <p className="now-inline-status" role="alert">');
  });

  it("the reader's writes are the existing seams: one screened accept, and the acknowledged play-log write", () => {
    expect(rec.match(/acceptTodayAction\(/g)).toHaveLength(1);
    expect(rec).toContain("write: accept });");
    expect(rec).toContain('write: () => logPlayCompletionAcknowledged(played, "today") });');
    expect(ctx).toContain("return writePlayCompletion(a, source, courseId);");
    expect(ctx).toContain("return writePlayCompletion(a, source, undefined, { requireAcknowledgement: true });");
    expect(ctx).toContain("const write = playLogCol.upsert(rec, options);");
  });

  it("drops the Feeds line and the inline steps toggle", () => {
    expect(rec).not.toContain("routines.feeds");
    expect(rec).not.toContain("<details");
    expect(rec).not.toContain("stepsOpen");
  });

  it("the art is a 16:9 band in logical properties, mirrored once in Hebrew", () => {
    expect(css).toContain(".now-plan-img, .now-plan-scrim { position: absolute; inset-block-start: 0; inset-inline: 0; inline-size: 100%; block-size: auto; aspect-ratio: 16 / 9; }");
    expect(css).toContain('[dir="rtl"] .now-plan-img, [dir="rtl"] .now-plan-scrim { transform: scaleX(-1); }');
    const artRules = css.split("\n").filter((line) => line.includes(".now-plan-img") || line.includes(".now-plan-scrim"));
    for (const line of artRules) expect(line, line).not.toMatch(/\b(left|right|top|bottom)\s*:/);
  });
});
