import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { buildTimeline, SIGNAL_PROVENANCE, signalDetail, signalTitle } from "../../lib/signalTimeline";
import type { ActionLoopEntry } from "../../actionLoop/model";
import type { BehaviorLog } from "../../types";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he", share: null as any, edit: null as any, hardActions: false }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "fixture", name: "Noa" } }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { displayName: "Parent" } }) }));
vi.mock("../ui/Modal", () => ({ Modal: ({ open, children }: any) => open ? <div>{children}</div> : null }));
vi.mock("../ui/Icon", () => ({ Icon: () => null }));
vi.mock("./JournalMomentDetails", () => ({ default: ({ log }: any) => <p>{log.trigger}</p> }));
vi.mock("../ui/ShareButton", async original => {
  const actual = await original<typeof import("../ui/ShareButton")>();
  return { ...actual, ShareButton: (props: any) => { h.share = props; return <button>Send</button>; } };
});
vi.mock("react/jsx-runtime", async () => {
  const actual = await vi.importActual<typeof import("react/jsx-runtime")>("react/jsx-runtime");
  const capture = (type: any, props: any, key?: any, many = false) => {
    if (props?.["data-testid"] === "journal-entry-edit") h.edit = props;
    if (props?.["data-testid"] === "journal-entry-hard-actions") h.hardActions = true;
    return (many ? actual.jsxs : actual.jsx)(type, props, key);
  };
  return { ...actual, jsx: (type: any, props: any, key?: any) => capture(type, props, key), jsxs: (type: any, props: any, key?: any) => capture(type, props, key, true) };
});

vi.mock("react/jsx-dev-runtime", async () => {
  const actual = await vi.importActual<typeof import("react/jsx-dev-runtime")>("react/jsx-dev-runtime");
  return { ...actual, jsxDEV: (type: any, props: any, key: any, isStatic: boolean, source: any, self: any) => {
    if (props?.["data-testid"] === "journal-entry-edit") h.edit = props;
    if (props?.["data-testid"] === "journal-entry-hard-actions") h.hardActions = true;
    return actual.jsxDEV(type, props, key, isStatic, source, self);
  } };
});

import JournalEntrySheet from "./JournalEntrySheet";
import { shareButtonText } from "../ui/ShareButton";
const row = (contentSource?: BehaviorLog["contentSource"]): BehaviorLog => ({ id: "history", timestamp: "2026-10-09T12:00:00Z", behaviorType: "Moment", trigger: "The exact saved words stay visible", durationMinutes: 0, kept: "said", ...(contentSource ? { contentSource } : {}) });
beforeEach(() => { h.share = null; h.edit = null; h.hardActions = false; });

for (const lang of ["en", "he"] as const) describe(`${lang}: Journal content-source boundary`, () => {
  it.each(["accepted", "completed"] as const)("keeps the %s observation prompt and parent words separate, exact and line-preserving", status => {
    h.lang = lang;
    const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
    const prompt = lang === "en" ? "What happened with Noa today?\nSay it back: Yes, ball!" : "מה קרה עם נועה היום?\nאפשר לומר: כן, כדור!";
    const words = lang === "en" ? "She said ball.\nThen rolled it to me." : "היא אמרה כדור.\nואז גלגלה אותו אליי.";
    const entry: ActionLoopEntry = Object.freeze({ id: "today.fixture.observation", source: "onboarding", observation: true, status, capacity: "tiny", acceptedAt: "2026-10-10T08:00:00Z", recommendation: prompt, ...(status === "completed" ? { whatHappened: words, completedAt: "2026-10-10T09:00:00Z" } : {}) });
    const signal = buildTimeline({ actionOutcomes: [entry] })[0];
    const detail = signalDetail(signal, t);
    const html = renderToStaticMarkup(<JournalEntrySheet signal={signal} domain={null} domainLabel="" prov="manual" provLabel={t("journal.manual")} when="10 Oct" title={signalTitle(signal, t)} detail={detail} onClose={vi.fn()} />);
    const promptSection = html.match(/<div data-testid="journal-entry-observation-prompt"[\s\S]*?<\/div>/)?.[0];
    const wordsSection = html.match(/<div data-testid="journal-entry-observation-words"[\s\S]*?<\/div>/)?.[0];
    expect(promptSection).toBeDefined();
    expect(promptSection).toContain(t("ob.first.observation.chosen"));
    expect(promptSection).toContain(t("elev.closeloop.entry.suggested"));
    expect(promptSection).toContain(prompt);
    expect(promptSection).toContain("white-space:pre-wrap");
    expect(promptSection).not.toContain(words);
    expect(html.split(prompt)).toHaveLength(2);
    expect(html).not.toContain(t("elev.closeloop.entry.noted"));
    if (status === "completed") {
      expect(wordsSection).toContain(t("ob.first.observation.answer"));
      expect(wordsSection).toContain(t("journal.manual"));
      expect(wordsSection).toContain(words);
      expect(wordsSection).toContain("white-space:pre-wrap");
      expect(wordsSection).not.toContain(t("elev.closeloop.entry.suggested"));
      expect(html.split(words)).toHaveLength(2);
    } else expect(wordsSection).toBeUndefined();
    expect(entry.recommendation).toBe(prompt);
    expect(entry.whatHappened).toBe(status === "completed" ? words : undefined);
    expect(h.share.getCardOpts().takeaway).toBe(detail);
  });
  it.each(["hard-moment", "historical-outcome"] as const)("keeps existing %s action detail and attribution", kind => {
    h.lang = lang;
    const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
    const entry: ActionLoopEntry = { id: "today.fixture.guide", source: kind === "hard-moment" ? "hard-moment" : "onboarding", status: "completed", capacity: "tiny", acceptedAt: "2026-10-10T08:00:00Z", recommendation: "The original accepted suggestion.", acceptanceKey: "onboarding-v1.fixture.legacy", outcome: "helped", outcomeAt: "2026-10-10T09:00:00Z" };
    const signal = buildTimeline({ actionOutcomes: [entry] })[0];
    const html = renderToStaticMarkup(<JournalEntrySheet signal={signal} domain={null} domainLabel="" prov="manual" provLabel={t("journal.manual")} when="10 Oct" title={signalTitle(signal, t)} detail={signalDetail(signal, t)} onClose={vi.fn()} />);
    expect(html).toContain(entry.recommendation);
    expect(html).toContain(t("elev.closeloop.entry.noted"));
    expect(html).toContain(t("elev.closeloop.entry.suggested"));
    expect(html).not.toContain("journal-entry-observation-");
  });
  it.each(["ai_draft", "unverified", undefined] as const)("%s survives projection, detail and final Send text without changing edit ownership", contentSource => {
    h.lang = lang;
    const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
    const log = Object.freeze(row(contentSource));
    const signal = buildTimeline({ behaviorLogs: [log] })[0];
    expect(SIGNAL_PROVENANCE[signal.kind]).toBe("manual");
    expect(signal.contentSource).toBe(contentSource);
    const edit = vi.fn(), remove = vi.fn();
    const html = renderToStaticMarkup(<JournalEntrySheet signal={signal} momentLog={log} domain={null} domainLabel="" prov="manual" provLabel={t("journal.manual")} when="9 Oct" title="A moment" detail={log.trigger} onClose={vi.fn()} onEdit={edit} onDelete={remove} />);
    expect(html).toContain(log.trigger);
    expect(h.edit).not.toBeNull(); h.edit.onClick(); expect(edit).toHaveBeenCalledTimes(1);
    expect(h.hardActions).toBe(true); expect(remove).not.toHaveBeenCalled();
    expect(h.share).not.toBeNull();
    const payload = shareButtonText(h.share.getCardOpts(), { caption: h.share.captionKey, parent: "Parent", childName: "Noa", t });
    expect(payload).toContain(log.trigger);
    expect(payload).not.toMatch(/https?:|data:image|base64/);
    if (contentSource) {
      const sourceLine = t(`kept.capture.source.${contentSource}`);
      expect(html).toContain(t("kept.capture.sourceLabel"));
      expect(html).toContain(sourceLine);
      expect(html).not.toContain(t("elev.closeloop.entry.noted"));
      expect(payload.split("\n")[0]).toBe(sourceLine);
      expect(payload.split(sourceLine)).toHaveLength(2);
    } else {
      expect(html).toContain(t("elev.closeloop.entry.noted"));
      expect(html).toContain(t("journal.manual"));
      expect(payload).not.toContain(t("kept.capture.source.ai_draft"));
      expect(payload).not.toContain(t("kept.capture.source.unverified"));
      expect(h.share.getCardOpts()).not.toHaveProperty("sub");
    }
    expect(log.contentSource).toBe(contentSource);
  });
});
