import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "synthetic-child", languages: ["Hebrew (Native)", "English (Transition)"] },
  actionLoop: [], activeTodayAction: null, recordFromRecordAnswer: vi.fn(),
}) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("../../lib/age/forChild", () => ({ ageMonthsOf: () => 64 }));

import TodaySayBackLine, { saidQuoteRows, sayBackDoorLine } from "./TodaySayBackLine";

const now = new Date(2026, 9, 6, 8);
const quote = (provenance: Record<string, unknown> = {}) => ({
  id: "synthetic-quote", kind: "quote", note: "  The moon follows our car  ",
  noticedOn: "2026-10-05", language: "English", ...provenance,
});
const input = (docs: readonly unknown[]) => ({
  now, loop: [], keepsakeDocs: docs, languages: ["Hebrew (Native)", "English (Transition)"],
  months: 64, childId: "synthetic-child", stepOpen: false,
});
const forbidden = [
  ...["ai_proposed_parent_confirmed", "ai_proposed_unconfirmed", "kid_practice", "professional_entered", "document_extracted", "future_source", "", null, {}]
    .flatMap(source => [{ source }, { observationSource: source }]),
  { captureSource: "co_parent" }, { conversationProposalId: "synthetic-proposal" },
  { source: "parent_typed", observationSource: "ai_proposed_parent_confirmed" },
];

describe("Today say-back uses only parent-written quotes", () => {
  it.each(forbidden)("does not offer an answer or project a child's quote from %j", provenance => {
    const row = Object.freeze(quote(provenance));
    const before = JSON.stringify(row);
    expect(saidQuoteRows([row])).toEqual([]);
    expect(sayBackDoorLine(input([row]))).toBeNull();
    // An empty actual component cannot expose an answer handler that would
    // store generated text as a from-record recommendation.
    expect(renderToStaticMarkup(<TodaySayBackLine keepsakeDocs={[row]} now={now} />)).toBe("");
    expect(JSON.stringify(row)).toBe(before);
  });

  it.each([undefined, "parent_typed", "parent_voice"])("preserves %s parent words and their language", source => {
    const row = Object.freeze(quote(source === undefined ? {} : { source, observationSource: source }));
    expect(saidQuoteRows([row])).toEqual([{ id: row.id, note: row.note, noticedOn: row.noticedOn, language: row.language }]);
    expect(sayBackDoorLine(input([row]))).toMatchObject({ kind: "ask", opener: { kind: "said", quoteSource: "child" } });
    expect(renderToStaticMarkup(<TodaySayBackLine keepsakeDocs={[row]} now={now} />)).toContain('data-answer="yes"');
  });

  it("chooses genuine words even when a generated quote has the selector's preferred id", () => {
    const own = quote();
    const generated = quote({ id: "zzz-ai", note: "AI MUST STAY OUT", source: "ai_proposed_parent_confirmed" });
    expect(generated.id.localeCompare(own.id)).toBeGreaterThan(0);
    const line = sayBackDoorLine(input([generated, own]));
    expect(line).toMatchObject({ kind: "ask", opener: { key: `said:${own.id}`, quote: own.note.trim() } });
    expect(JSON.stringify(line)).not.toContain("AI MUST STAY OUT");
  });
});
