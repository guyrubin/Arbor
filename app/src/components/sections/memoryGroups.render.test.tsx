/**
 * B-CAREPRO-25 — rendered: one pending topic group shows its topic name and
 * "N similar notes", ONE fact row (the newest), "See all N" and "Dismiss all N"
 * in EN and HE; a single-fact group shows no group controls. Approval stays per
 * fact (G6): the group renders exactly one Approve.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import type { MemoryReviewItem } from "../../types";

const harness = vi.hoisted(() => ({ locale: "en" as "en" | "he" }));

vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({}) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: harness.locale,
    aiLang: harness.locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars),
  }),
}));

import { PendingGroupCard } from "./ChildMemory";
import { groupPendingMemory } from "../../lib/memoryGroups";

const fact = (i: number, text: string): MemoryReviewItem => ({
  memoryId: `m${i}`, childId: "c1", status: "pending", fact: text, source: "chat", retention: "90 days",
  createdAt: new Date(Date.UTC(2026, 8, 1) + i * 86_400_000).toISOString(), latestEventId: `e${i}`,
});

beforeEach(() => { harness.locale = "en"; });

describe("B-CAREPRO-25 · a pending topic group (rendered)", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: topic name + count, one row, See all, Dismiss all`, () => {
      harness.locale = locale;
      const [group] = groupPendingMemory([
        fact(1, "Dylan cries at bedtime"),
        fact(2, "Dylan has a meltdown leaving the park"),
        fact(3, "Dylan is upset when the light goes off"),
        fact(4, "Dylan needs comfort at bedtime"),
      ]);
      expect(group.topic).toBe("feelings");
      const html = renderToStaticMarkup(<PendingGroupCard group={group} isMemoryUpdating={null} onDecide={vi.fn()} />);
      expect(html).toContain(translate(locale, "elev.childmem.group.similar", { n: 4 }));
      expect(html).toContain(translate(locale, "elev.childmem.group.seeAll", { n: 4 }));
      expect(html).toContain(translate(locale, "elev.childmem.group.dismissAll", { n: 4 }));
      expect((html.match(/data-testid="memory-row"/g) ?? []).length).toBe(1);
      expect(html).toContain("Dylan needs comfort at bedtime"); // the newest fact
      // G6: approval stays per fact — the collapsed group carries exactly one Approve
      const approve = translate(locale, "elev.childmem.action.approve");
      expect(html.replace(/<[^>]+>/g, "|").split("|").filter((x) => x.trim() === approve)).toHaveLength(1);
      expect(html).not.toContain('data-testid="memory-group-dismiss-confirm"');
    });
  }

  it("a single-fact group shows no group controls", () => {
    const [group] = groupPendingMemory([fact(1, "Dylan loves dinosaurs")]);
    expect(group.topic).toBe("other");
    const html = renderToStaticMarkup(<PendingGroupCard group={group} isMemoryUpdating={null} onDecide={vi.fn()} />);
    expect(html).toContain(translate("en", "elev.childmem.group.other"));
    expect(html).not.toContain('data-testid="memory-group-see-all"');
    expect(html).not.toContain('data-testid="memory-group-dismiss-all"');
  });
});
