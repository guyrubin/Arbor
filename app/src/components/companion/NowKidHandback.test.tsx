/**
 * B-BOOK-66 + B-GAME-23 — the hand-back rows render inside "Today at a
 * glance", EN and HE, as receipt-sized rows (not a card), with the parent's
 * own-words capture and no automatic record. Synthetic data only.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fiveSmoothStones } from "../../lib/library/books/fiveSmoothStones";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  reads: [] as unknown[],
  events: [] as unknown[],
  gender: "girl" as string,
  openCaptureSheet: vi.fn(),
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "kid-synthetic-1", name: "Mia Test", gender: state.gender }, openCaptureSheet: state.openCaptureSheet }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_id: string, name: string) => ({ items: name === "bookReads" ? state.reads : name === "practiceEvents" ? state.events : [], loaded: true, upsert: vi.fn() }),
}));

import NowKidHandback from "./NowKidHandback";

const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(19, 0, 0, 0); return d; };
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

beforeEach(() => {
  state.lang = "en";
  state.reads = [{ id: "read-1", bookId: fiveSmoothStones.id, lang: "en", finishedAt: yesterday().toISOString() }];
  state.events = [
    { id: "sit-2", game: "sneak-freeze", day: dayKey(new Date()), experiences: ["sunglasses"], rounds: 7, prizes: ["bell"] },
    { id: "sit-1", game: "sneak-freeze", day: dayKey(yesterday()), experiences: ["fake-turn"] },
  ];
});

describe("B-BOOK-66 + B-GAME-23 · Today's hand-back rows", () => {
  it("EN: the book row (cover, tomorrow, ask-after, Log it, hide) and the play row (visits, experiences, the idea)", () => {
    const html = renderToStaticMarkup(<NowKidHandback />);
    expect(html).toContain('data-testid="today-handback-book"');
    expect(html).toContain(`/visuals/books/${fiveSmoothStones.id}/PL3-cover.webp`);
    expect(html).toContain("Five Smooth Stones · one thing for today");
    expect(html).toContain("Choose one small");
    expect(html).toContain("Ask: “Why did David leave the king&#x27;s armour in the tent?”");
    expect(html).toContain(">Log it<");
    expect(html).toContain('aria-label="Hide this line"');
    expect(html).toContain('data-testid="today-handback-play"');
    expect(html).toContain("2 visits this week · Along the way: the cat’s sunglasses trick, the cat’s fake turn");
    expect(html).toContain("Play it for real tonight — in the living room, Mia is the cat");
    // receipt rows, not a card: no card or module class, no heading
    expect(html).not.toMatch(/card|data-module|<h[1-6]/);
    // the firewall: the sitting's rounds and prizes never reach the parent
    expect(html).not.toMatch(/\b7\b|bell/);
  });

  it("HE: the same rows in Hebrew, with the girl's form of the idea", () => {
    state.lang = "he";
    const html = renderToStaticMarkup(<NowKidHandback />);
    expect(html).toContain("קטן אחד שהילד יכול לפגוש לבד");
    expect(html).toContain("היא החתולה"); // the girl's form of the off-screen idea
    expect(html).toContain("· דבר אחד להיום");
    expect(html).toContain("לשאול: „");
    expect(html).toContain(">לרשום ביומן<");
    expect(html).toContain("משחק בבית · דג מלוח");
    expect(html).toContain("2 ביקורים השבוע · בדרך: תעלול משקפי השמש של החתול, הסיבוב המדומה של החתול");
    expect(html).not.toMatch(/Log it|Play at home|visits this week/);
  });

  it("nothing to hand back renders nothing (no empty row)", () => {
    state.reads = [];
    state.events = [];
    expect(renderToStaticMarkup(<NowKidHandback />)).toBe("");
  });

  it("Log it opens the ONE capture sheet empty, the ask-after as its cue (the parent's own words; only their Save writes a moment)", () => {
    const src = readFileSync(path.join(__dirname, "NowKidHandback.tsx"), "utf8");
    expect(src).toContain('openCaptureSheet({ mode: "text", cue: copy.bookRowAsk(book.askAfter) })');
    expect(src).not.toMatch(/initialText|addMoment|saveMoment|upsert\(|recordFromRecordAnswer/);
    // the sheet shows the cue where it shows a prompt question, and never stores it
    const modal = readFileSync(path.join(__dirname, "..", "overview", "QuickLogModal.tsx"), "utf8");
    expect(modal).toMatch(/\{!promptKey && cue && \([\s\S]*?data-testid="quicklog-prompt-cue"[\s\S]*?\{cue\}/);
    expect(modal).not.toMatch(/addMoment\([^)]*cue/);
    expect(readFileSync(path.join(__dirname, "..", "layout", "Shell.tsx"), "utf8")).toContain("cue={captureSheet.cue}");
  });

  it("mounted once, as a row of the existing glance list (NowAgendaExtras), never its own card", () => {
    const lines = readFileSync(path.join(__dirname, "NowTodayLines.tsx"), "utf8");
    const agenda = lines.slice(lines.indexOf("export function NowAgendaExtras"));
    expect(agenda).toContain("<NowKidHandback />");
    const view = readFileSync(path.join(__dirname, "NowView.tsx"), "utf8");
    expect(view).not.toContain("NowKidHandback");
    const css = readFileSync(path.join(__dirname, "nowView.css"), "utf8");
    const row = css.slice(css.indexOf(".now-handback-row {"), css.indexOf("}", css.indexOf(".now-handback-row {")));
    expect(row).not.toMatch(/box-shadow|background:|border:/);
    // 44 px targets for both actions
    expect(css).toMatch(/\.now-handback-log, \.now-handback-hide \{[^}]*min-block-size: 44px; min-inline-size: 44px;/);
  });
});
