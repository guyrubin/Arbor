/**
 * B-NEXT-01 — the hearing question as the parent meets it (Words shelf and
 * beside the speech therapist's packet), and where it is mounted: only while
 * the pilot flag is on, only on Words and the speech therapist's packet.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import { HEARING_CHECK_ANSWERS } from "../../lib/hearingCheck";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  profile: { id: "c1", name: "Noa" } as Record<string, unknown>,
  updateChild: vi.fn(async () => true),
  nodes: [] as { type: unknown; props: Record<string, any> }[],
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: state.profile, updateChild: state.updateChild }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: state.lang, t: (k: string, v?: Record<string, string | number>) => translate(state.lang as UiLang, k, v) }) }));
vi.mock("react/jsx-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-runtime")>();
  const capture = (type: unknown, props: any) => { if (typeof type === "string") state.nodes.push({ type, props }); };
  return { ...real, jsx: (...a: Parameters<typeof real.jsx>) => { capture(a[0], a[1]); return real.jsx(...a); }, jsxs: (...a: Parameters<typeof real.jsxs>) => { capture(a[0], a[1]); return real.jsxs(...a); } };
});

vi.mock("react/jsx-dev-runtime", async (original) => {
  const real = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...real, jsxDEV: (...a: Parameters<typeof real.jsxDEV>) => { if (typeof a[0] === "string") state.nodes.push({ type: a[0], props: a[1] as Record<string, any> }); return real.jsxDEV(...a); } };
});

import HearingCheckQuestion from "./HearingCheckQuestion";

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (code: string) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SHELVES = strip(readFileSync(path.join(here, "JournalShelves.tsx"), "utf8"));
const SHELF = strip(readFileSync(path.join(here, "ShelfPage.tsx"), "utf8"));
const PRO = strip(readFileSync(path.join(here, "ProView.tsx"), "utf8"));
const escape = (text: string) => renderToStaticMarkup(<span>{text}</span>).slice(6, -7);

beforeEach(() => { state.nodes = []; state.updateChild.mockClear(); state.profile = { id: "c1", name: "Noa" }; state.lang = "en"; });

describe("B-NEXT-01 · the question", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: unanswered → the question, why it is asked, five answers at 44 px`, () => {
      state.lang = lang;
      const html = renderToStaticMarkup(<HearingCheckQuestion testId="shelf-hearing-check" />);
      expect(html).toContain(escape(translate(lang, "elev.hearing.question")));
      expect(html).toContain(escape(translate(lang, "elev.hearing.why")));
      for (const a of HEARING_CHECK_ANSWERS) {
        expect(html).toMatch(new RegExp(`<button[^>]*data-answer="${a}"[^>]*class="[^"]*min-h-\\[44px\\]`));
        expect(html).toContain(escape(translate(lang, `elev.hearing.answer.${a}`)));
      }
      expect(html).not.toContain('data-testid="shelf-hearing-check-kept"');
    });
  }

  it("an answer is kept on the profile with today's date", async () => {
    renderToStaticMarkup(<HearingCheckQuestion />);
    const year = state.nodes.find((n) => n.type === "button" && n.props["data-answer"] === "year")!;
    await year.props.onClick();
    expect(state.updateChild).toHaveBeenCalledOnce();
    const [id, patch] = state.updateChild.mock.calls[0] as unknown as [string, { hearingCheck: { answer: string; answeredAt: string } }];
    expect(id).toBe("c1");
    expect(patch.hearingCheck.answer).toBe("year");
    expect(Math.abs(Date.parse(patch.hearingCheck.answeredAt) - Date.now())).toBeLessThan(60_000);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: answered → one dated line and Change; "not sure" adds the nurse-or-paediatrician route`, () => {
      state.lang = lang;
      state.profile = { id: "c1", name: "Noa", hearingCheck: { answer: "recent", answeredAt: "2026-10-20T08:00:00.000Z" } };
      const html = renderToStaticMarkup(<HearingCheckQuestion testId="shelf-hearing-check" />);
      expect(html).toContain('data-testid="shelf-hearing-check-kept"');
      expect(html).toContain(escape(translate(lang, "elev.hearing.answer.recent")));
      expect(html).toContain('data-testid="shelf-hearing-check-change"');
      expect(html).not.toContain('data-testid="shelf-hearing-check-route"');
      expect(html).not.toContain("data-answer=");
      state.profile = { id: "c1", name: "Noa", hearingCheck: { answer: "notSure", answeredAt: "2026-10-20T08:00:00.000Z" } };
      const unsure = renderToStaticMarkup(<HearingCheckQuestion testId="shelf-hearing-check" />);
      expect(unsure).toContain('data-testid="shelf-hearing-check-route"');
      expect(unsure).toContain(escape(translate(lang, "elev.hearing.notSure")));
    });
  }
});

describe("B-NEXT-01 · its own card beside the packet, bare inside the shelf's card", () => {
  it("bare drops the card chrome; the default keeps it", () => {
    expect(renderToStaticMarkup(<HearingCheckQuestion testId="pro-hearing-check" />)).toMatch(/^<section[^>]*class="arbor-depth-card min-w-0 p-4"/);
    const bare = renderToStaticMarkup(<HearingCheckQuestion testId="shelf-hearing-check" bare />);
    expect(bare).toMatch(/^<section[^>]*class="min-w-0"/);
    expect(bare).not.toContain("arbor-depth-card");
    expect(bare).not.toMatch(/^<section[^>]*style=/);
  });
});

describe("B-NEXT-01 · mounted only behind the pilot flag, on Words and beside the speech therapist's packet", () => {
  it("the journal reads the flag once and mounts the question only where it belongs", () => {
    expect(SHELVES).toContain("const hearingOn = useMemo(() => hearingQuestionOn(), []);");
    expect(SHELVES).toContain('askHearing={hearingOn && shelf === "words" ? <HearingCheckQuestion testId="shelf-hearing-check" bare /> : undefined}');
    expect(SHELVES).toContain('askHearing={hearingOn && profession === "slp" ? <HearingCheckQuestion testId="pro-hearing-check" /> : undefined}');
  });

  it("the shelf page places it under the Notice card; the pro view above the packet, whose hearing line comes first", () => {
    expect(SHELF.indexOf("{askHearing}")).toBeGreaterThan(SHELF.indexOf("<NoticeCard"));
    expect(SHELF.indexOf("{askHearing}")).toBeLessThan(SHELF.indexOf('data-module="shelf-entries"'));
    expect(PRO.indexOf("{askHearing}")).toBeLessThan(PRO.indexOf('data-testid="pro-packet"'));
    expect(PRO).toMatch(/PACKET_LINES[^=]*=\s*\[\s*\{ section: "intake-hearing", labelKey: "elev.hearing.packet.title", onlyWhenPresent: true \},/);
  });
});
