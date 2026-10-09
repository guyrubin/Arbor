/**
 * B-STATUS-01 — rendered sweep, EN + HE: every loop action answers back with
 * the ONE Receipt line (components/ui/Receipt.tsx) — the practice card's "Did
 * it" / "Not today", the Notice card's "Seen it" / "Not yet" / kept moment,
 * Tonight's answers and the capture sheet's milestone row — saying exactly
 * what it said before, with a link to where it went (unless the host IS that
 * place), Undo where the write can be reversed, and no live role on the line
 * (the shared polite region announces it). The capture confirm line and the
 * pending lines are pinned on source (the sheet and Now need the whole app).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import PracticeCard from "./PracticeCard";
import NoticeCard, { type NoticePhase } from "./NoticeCard";
import TonightFlow from "./TonightFlow";
import MilestoneProposalRow from "./MilestoneProposalRow";
import { translate } from "../../lib/i18n";
import { PRACTICES } from "../../content/practices";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import type { PracticePick } from "../../lib/practice/choosePractice";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), "utf8").replace(/\r\n/g, "\n");
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const words = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const LANGS = ["en", "he"] as const;

const practice = PRACTICES.find((p) => p.shelf === "words")!;
const pick: PracticePick = { practice, milestone: ALL_MILESTONES.find((m) => m.id === practice.milestoneId)!, shelf: "words", via: "chooser" };
const cdc = ALL_MILESTONES.find((m) => m.id === "cdc-24m-1")!;

/** The receipt line with this test id: the <p>, its words, and its row. */
function receipt(html: string, testId: string) {
  const line = new RegExp(`<p data-testid="${testId}"[^>]*>[\\s\\S]*?</p>`).exec(html);
  expect(line, `${testId} rendered`).toBeTruthy();
  // the icon's ligature ("check") is not part of what the line says
  return { line: line![0], words: words(line![0].replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, "")) };
}

function expectReceiptShape(line: string, lang: "en" | "he") {
  expect(line).toMatch(/data-receipt="(muted|soft|ink|kept)"/);
  expect(line).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
  expect(line).toContain(`lang="${lang}"`);
  expect(line).not.toMatch(/role="status"|aria-live/);
}

const shelfHref = (shelf: string) => `href="#/journal?shelf=${shelf}"`;

describe("B-STATUS-01 · the practice card answers back", () => {
  for (const lang of LANGS) {
    it(`${lang}: "Did it" → the receipt, a link to its shelf, Undo; "Not today" → the receipt, no link`, () => {
      state.lang = lang;
      const shelf = translate(lang, "elev.shelves.words");
      const did = renderToStaticMarkup(<PracticeCard practice={practice} milestone={null} shelf="words" childName="Noa" gender="girl" answered="did" onAnswer={() => undefined} onUndo={() => undefined} />);
      const r = receipt(did, "practice-receipt");
      expectReceiptShape(r.line, lang);
      expect(r.words).toBe(words(translate(lang, "elev.loop.practice.didReceipt", { name: "Noa", shelf })));
      expect(did).toContain(shelfHref("words"));
      expect(did).toContain('data-testid="practice-receipt-open"');
      expect(did).toMatch(/<button[^>]*data-testid="practice-undo"[^>]*min-h-\[44px\]/);
      const notToday = renderToStaticMarkup(<PracticeCard practice={practice} milestone={null} shelf="words" childName="Noa" gender="girl" answered="not_today" onAnswer={() => undefined} />);
      expect(receipt(notToday, "practice-receipt").words).toBe(words(translate(lang, "elev.loop.practice.notTodayReceipt")));
      expect(notToday).not.toContain("practice-receipt-open");
      expect(notToday).not.toContain("practice-undo");
    });
  }
});

describe("B-STATUS-01 · the Notice card answers back", () => {
  const render = (lang: "en" | "he", phase: NoticePhase, over: Record<string, unknown> = {}) => {
    state.lang = lang;
    return renderToStaticMarkup(<NoticeCard milestone={cdc} shelf="words" gender="girl" childName="Noa" onAnswer={() => undefined} onUndo={() => undefined} initialPhase={phase} {...over} />);
  };
  for (const lang of LANGS) {
    it(`${lang}: "Seen it" → the receipt with a link to its shelf and Undo; a host that IS the shelf gets no link`, () => {
      const html = render(lang, "seen");
      const r = receipt(html, "notice-receipt");
      expectReceiptShape(r.line, lang);
      expect(r.words).toBe(words(translate(lang, "elev.loop.notice.seenReceipt", { name: "Noa", shelf: translate(lang, "elev.shelves.words") })));
      expect(html).toContain(shelfHref("words"));
      expect(html).toContain('data-testid="notice-undo"');
      // NEGATIVE CONTROL: the shelf page / shelf map already names the shelf
      const onShelf = render(lang, "seen", { hideShelf: true });
      expect(onShelf).toContain('data-testid="notice-receipt"');
      expect(onShelf).not.toContain("notice-receipt-open");
    });

    it(`${lang}: "Not yet" → the thanks line (no icon, Undo); a kept moment → the green kept pill (Undo)`, () => {
      const thanked = receipt(render(lang, "thanked"), "notice-thanks");
      expectReceiptShape(thanked.line, lang);
      expect(thanked.line).not.toContain('class="msr');
      expect(thanked.words).toBe(words(translate(lang, "elev.loop.notice.thanks")));
      const keptHtml = render(lang, "kept");
      const kept = receipt(keptHtml, "notice-kept-status");
      expect(kept.line).toContain('data-receipt="kept"');
      expect(kept.line).toContain("var(--arbor-green-soft)");
      expect(keptHtml).toContain('data-testid="notice-undo"');
    });
  }
});

describe("B-STATUS-01 · Tonight answers back", () => {
  const render = (lang: "en" | "he", over: Record<string, unknown>) => {
    state.lang = lang;
    return renderToStaticMarkup(
      <TonightFlow childName="Noa" gender="girl" practice={pick} onPracticeAnswer={() => undefined} onOutcome={() => undefined} onWhatHappened={() => undefined}
        dayQuestion={{ key: "elev.loop.tonight.day.generic", vars: {} }} onQuote={() => undefined} notice={null} onNotice={() => undefined} initialStep={1} {...over} />,
    );
  };
  for (const lang of LANGS) {
    it(`${lang}: the morning's "Did it" and a "Not today" are receipt lines, in the same words`, () => {
      const did = receipt(render(lang, { doseAnswer: "did", doseAt: new Date(2026, 9, 6, 7, 30).toISOString() }), "tonight-did-receipt");
      expectReceiptShape(did.line, lang);
      expect(did.words).toBe(words(translate(lang, "elev.loop.tonight.practice.didMorning")));
      const notToday = receipt(render(lang, { doseAnswer: "not_today" }), "tonight-not-today");
      expectReceiptShape(notToday.line, lang);
      expect(notToday.words).toBe(words(translate(lang, "elev.loop.practice.notTodayReceipt")));
    });
  }

  it("the kept words link to Things {name} said (state after Keep: pinned on source)", () => {
    const src = read("TonightFlow.tsx");
    expect(src).toMatch(/<Receipt testId="tonight-kept" link=\{\{ where: g\(t\("elev\.loop\.said\.title", \{ name \}\)\), href: `#\$\{routeHash\("language", \{ view: "said" \}\)\}`/);
    expect(src).toContain('{g(t("elev.loop.tonight.day.receipt", { name }))}');
    // the Hebrew slash form of the place resolves from the child's gender
    expect(resolveHebrewSlash(translate("he", "elev.loop.said.title", { name: "נועה" }), "girl")).not.toMatch(/[א-ת]\/[א-ת]/);
  });
});

describe("B-STATUS-01 · the capture sheet answers back", () => {
  for (const lang of LANGS) {
    it(`${lang}: the milestone row's "Add" → the receipt with a link to its shelf (the sheet closes as it opens)`, () => {
      state.lang = lang;
      const html = renderToStaticMarkup(
        <MilestoneProposalRow proposal={{ kind: "milestone", logId: "log-1", shelf: "words", milestoneId: cdc.id }} milestoneTitle="x" done onAccept={() => undefined} onDecline={() => undefined} onOpenShelf={() => undefined} />,
      );
      const r = receipt(html, "capture-milestone-done");
      expectReceiptShape(r.line, lang);
      expect(r.words).toBe(words(translate(lang, "elev.loop.capture.milestone.done", { shelf: translate(lang, "elev.shelves.words") })));
      expect(html).toContain(shelfHref("words"));
      expect(html).not.toContain("<button");
    });
  }

  it("the capture confirm line is the Receipt (journal link closes the sheet); the drafting spinner is the pending line", () => {
    const sheet = read("../overview/QuickLogModal.tsx");
    expect(sheet).toMatch(/<Receipt\s+testId="quicklog-reply-line1"\s+tone="ink"\s+strong\s+icon="check_circle"\s+link=\{\{ where: t\("nav\.tab\.journal"\), href: `#\$\{routeHash\("journal"\)\}`, onOpen: closeSheet/);
    expect(sheet).toContain("onOpenShelf={closeSheet}");
    expect((sheet.match(/<PendingLine active=\{drafting\} testId="quicklog-drafting">\{t\("beh\.parsing"\)\}<\/PendingLine>/g) ?? []).length).toBe(2);
    expect(sheet).not.toMatch(/progress_activity|animate-spin/);
  });

  it("Now waits on AI with the pending line, never an instant status line", () => {
    const rec = read("../companion/NowRecommendation.tsx");
    expect(rec).toContain('<PendingLine active={loading && !useAi && !preferLibrary} testId="now-recommendation-pending" className="now-inline-status">{copy.loading}</PendingLine>');
    expect(rec).not.toMatch(/\{loading && [^\n]*role="status"/);
    const blocks = read("../companion/NowLoopBlocks.tsx");
    expect(blocks).toContain('<PendingLine active={choosing && !loop.doseAnswer} testId="now-practice-pending">{t("elev.loop.pending.practice")}</PendingLine>');
    const now = read("../companion/NowView.tsx");
    expect(now).toContain("onPending={setFocusPending}");
    expect(now).toContain("choosing={focusPending}");
  });

  it("NEGATIVE CONTROL: no per-card receipt markup is left in the four loop files (Tonight's closing line is not a receipt)", () => {
    for (const f of ["PracticeCard.tsx", "NoticeCard.tsx", "TonightFlow.tsx", "MilestoneProposalRow.tsx"]) {
      const src = read(f);
      expect(src, f).toContain("<Receipt");
      const statuses = src.match(/role="status"[^>]*data-testid="([a-z-]+)"/g) ?? [];
      expect(statuses.filter((s) => !s.includes("tonight-done")), f).toEqual([]);
    }
    expect('<p role="status" data-testid="practice-receipt" className="x">').toMatch(/role="status"[^>]*data-testid="([a-z-]+)"/);
  });
});
