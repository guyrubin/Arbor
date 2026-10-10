import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* B-GROWTH-36 residue (framer ruling, REJECTIONS P2-WORDS): the say-back
   question is ONE line in Today's door, the TodayStepLine shape — shown only
   the day after a kept quote in the family's language in transition, never
   beside an open coach step (one question line at a time; the accepted step
   first, Law 6). The answer writes ActionLoopEntry.sayBack through the
   from-record row (d0e2b440). */

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  step: null as null | { id: string; status: string; recommendation: string },
  loop: [] as unknown[],
  writes: {} as Record<string, any>, confirmed: true,
  record: (() => undefined) as (...a: unknown[]) => void,
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    actionLoop: h.loop,
    recordAnswerWrites: h.writes, recordAnswersConfirmed: h.confirmed,
    activeTodayAction: h.step,
    childProfile: { id: "c1", name: "Alex Example", languages: ["Hebrew (Native)", "English (Transition)"] },
    recordFromRecordAnswer: h.record,
  }),
}));
vi.mock("../../lib/age/forChild", () => ({ ageMonthsOf: () => 64 }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(h.lang, k, v), uiLang: h.lang }) };
});

import TodaySayBackLine, { sayBackDoorLine } from "./TodaySayBackLine";
import { translate } from "../../lib/i18n";
import { fromRecordEntry, type FromRecordOpener } from "../../lib/today/fromRecord";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { todayLiveSource } from "../../testTodaySource";

const NOW = new Date(2026, 9, 6, 8, 0, 0); // the morning of 6 Oct (local)
const GUY = ["Hebrew (Native)", "English (Transition)"];
const quoteDoc = (over: Record<string, unknown> = {}) => ({
  id: "quote-2026-10-05-aa",
  kind: "quote",
  milestoneId: "",
  note: "Daddy, the moon is following our car",
  noticedOn: "2026-10-05",
  language: "English",
  ...over,
});
const input = (over: Partial<Parameters<typeof sayBackDoorLine>[0]> = {}) => ({
  now: NOW,
  loop: [] as ActionLoopEntry[],
  keepsakeDocs: [quoteDoc()] as unknown[],
  languages: GUY,
  months: 64,
  childId: "c1",
  stepOpen: false,
  ...over,
});

type El = React.ReactElement<{ children?: React.ReactNode; onClick?: () => void; "data-answer"?: string }>;
const buttons = (node: React.ReactNode, out: El[] = []): El[] => {
  if (Array.isArray(node)) node.forEach((n) => buttons(n, out));
  else if (React.isValidElement(node)) {
    const el = node as El;
    if (el.type === "button") out.push(el);
    buttons(el.props.children, out);
  }
  return out;
};

beforeEach(() => {
  h.step = null;
  h.loop = [];
  h.writes = {}; h.confirmed = true;
  h.record = vi.fn(async () => undefined);
});

describe("sayBackDoorLine — the door's line selection", () => {
  it("a quote kept in the language in transition, no step → the say-back question (cross, kept = Hebrew)", () => {
    const line = sayBackDoorLine(input());
    expect(line?.kind).toBe("ask");
    const opener = (line as { opener: FromRecordOpener }).opener;
    expect(opener.kind).toBe("said");
    expect(opener.sayBackMode).toBe("cross");
    expect(opener.sayBackIn).toBe("Hebrew");
  });

  it("a saved record reflection owns the daily row and is never replaced by a say-back answer", () => {
    const opener: FromRecordOpener = { key: "note:older", kind: "note", topic: null, quote: "The parent wrote this earlier.", quoteAt: "2026-07-09", quoteSource: "parent" };
    expect(sayBackDoorLine(input({ loop: [fromRecordEntry(opener, "easier", "c1", NOW)] }))).toBeNull();
  });

  it("an open coach step → no say-back line (one question line at a time, the step first)", () => {
    expect(sayBackDoorLine(input({ stepOpen: true }))).toBeNull();
  });

  it("no quote kept yesterday, a kept-language quote, or a monolingual family → no line", () => {
    expect(sayBackDoorLine(input({ keepsakeDocs: [] }))).toBeNull();
    expect(sayBackDoorLine(input({ keepsakeDocs: [quoteDoc({ noticedOn: "2026-10-03" })] }))).toBeNull();
    expect(sayBackDoorLine(input({ keepsakeDocs: [quoteDoc({ note: "אבא, הירח נוסע איתנו", language: "Hebrew" })] }))).toBeNull();
    expect(sayBackDoorLine(input({ languages: ["English"] }))).toBeNull();
    // a milestone keepsake is not a quote
    expect(sayBackDoorLine(input({ keepsakeDocs: [quoteDoc({ kind: "milestone" })] }))).toBeNull();
  });

  it("the answer writes the from-record row with sayBack; the line becomes its receipt; never beside an open step", () => {
    const ask = sayBackDoorLine(input()) as { opener: FromRecordOpener };
    for (const answer of ["yes", "not_today"] as const) {
      const row = fromRecordEntry(ask.opener, answer, "c1", NOW);
      expect(row).toMatchObject({ source: "from-record", sayBack: answer, recordKey: "said:quote-2026-10-05-aa" });
      expect(row.reflection).toBeUndefined();
      expect(sayBackDoorLine(input({ loop: [row] }))).toEqual({ kind: "answered", answer });
      expect(sayBackDoorLine(input({ loop: [row], stepOpen: true }))).toBeNull();
    }
  });
});

describe("TodaySayBackLine — rendered (EN + HE)", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: ONE line, the question in the kept language's name, Yes · Not today ≥ 44 px; a tap writes the answer`, () => {
      h.lang = lang;
      const html = renderToStaticMarkup(<TodaySayBackLine keepsakeDocs={[quoteDoc()]} now={NOW} />);
      expect(html.match(/data-testid="today-door-saidback"/g)).toHaveLength(1);
      const kept = translate(lang, "ob.lang.hebrew");
      expect(html).toContain(translate(lang, "elev.words.today.q.cross", { kept }));
      if (lang === "en") expect(html).toContain("Did you get to say it back in Hebrew?");
      else expect(html).toContain("הספקתם להגיד את זה בחזרה בעברית?");
      for (const a of ["yes", "not_today"]) expect(html).toContain(translate(lang, `elev.words.today.a.${a}`));
      for (const b of html.match(/<button[^>]*>/g) ?? []) { expect(b).toMatch(/min-h-11/); expect(b).toMatch(/min-w-11/); }
      // parent register: no count, %, verdict, the child's words are not re-shown here
      expect(html).not.toMatch(/%|\bscore\b|on track|uppercase|gradient/i);
      const chips = buttons(TodaySayBackLine({ keepsakeDocs: [quoteDoc()], now: NOW }));
      expect(chips.map((b) => b.props["data-answer"])).toEqual(["yes", "not_today"]);
      chips[1].props.onClick?.();
      expect(h.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "said", key: "said:quote-2026-10-05-aa" }), "not_today", NOW);
    });

    it(`${lang}: beside an open step nothing renders; after an answer, the receipt (no chips)`, () => {
      h.lang = lang;
      h.step = { id: "step-1", status: "accepted", recommendation: "Name the feeling once" };
      expect(renderToStaticMarkup(<TodaySayBackLine keepsakeDocs={[quoteDoc()]} now={NOW} />)).toBe("");
      h.step = null;
      const ask = sayBackDoorLine(input()) as { opener: FromRecordOpener };
      h.loop = [fromRecordEntry(ask.opener, "yes", "c1", NOW)];
      const html = renderToStaticMarkup(<TodaySayBackLine keepsakeDocs={[quoteDoc()]} now={NOW} />);
      expect(html).toContain('data-testid="today-door-saidback-receipt"');
      expect(html).toContain(translate(lang, "today.record.receipt"));
      expect(html).not.toContain("<button");
    });
  }
});

describe("the door mounts the line after the step line (Law 6 order)", () => {
  const OV = todayLiveSource();
  it("inside the door, once, after the offer slot", () => {
    // Parity 9 Oct: the door is Now's NowMoreForToday; the step line left with
    // the Today hub (an accepted step leads Now).
    const door = OV.slice(OV.indexOf('data-testid="today-door"'), OV.indexOf("</details>"));
    expect(door.match(/<TodaySayBackLine /g)).toHaveLength(1);
    expect(door.indexOf("<CompanionOfferSlot ")).toBeLessThan(door.indexOf("<TodaySayBackLine "));
    expect(door).toContain("<TodaySayBackLine keepsakeDocs={keepsakeDocs} now={now} />");
  });
});

it("keeps say-back pending until acknowledgement and permits a failed optimistic answer to retry", () => {
  const opener = (sayBackDoorLine(input()) as { opener: FromRecordOpener }).opener;
  const row = fromRecordEntry(opener, "yes", "c1", NOW);
  h.confirmed = false;
  expect(renderToStaticMarkup(<TodaySayBackLine keepsakeDocs={[quoteDoc()]} now={NOW} />)).toContain("today-door-saidback-pending");
  h.loop = [row]; h.writes[row.id] = { opener, status: "saving" };
  let html = renderToStaticMarkup(<TodaySayBackLine keepsakeDocs={[quoteDoc()]} now={NOW} />);
  expect(html).toContain("today-door-saidback-pending"); expect(html).not.toContain("today-door-saidback-receipt");
  h.writes[row.id] = { opener, status: "failed" };
  html = renderToStaticMarkup(<TodaySayBackLine keepsakeDocs={[quoteDoc()]} now={NOW} />);
  expect(html).toContain('role="alert"'); expect(html.match(/data-answer=/g)).toHaveLength(2); expect(html).not.toContain("today-door-saidback-receipt");
  h.writes[row.id] = { opener, status: "saved", entry: row };
  expect(renderToStaticMarkup(<TodaySayBackLine keepsakeDocs={[quoteDoc()]} now={NOW} />)).toContain("today-door-saidback-receipt");
});
