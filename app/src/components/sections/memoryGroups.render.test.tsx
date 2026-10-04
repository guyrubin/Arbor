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

import { PendingGroupCard, MemoryRow } from "./ChildMemory";
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

describe("W2-CAREPRO r1 · the stamp is the lead row's Approve, never a wrapper", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: lead group → ONE stamped gradient button "Remember this"; other groups unstamped`, () => {
      harness.locale = locale;
      const [group] = groupPendingMemory([fact(1, "Dylan cries at bedtime"), fact(2, "Dylan needs comfort at bedtime")]);
      const lead = renderToStaticMarkup(<PendingGroupCard group={group} lead isMemoryUpdating={null} onDecide={vi.fn()} />);
      const stamps = lead.match(/data-primary-move="approve-memory-fact"/g) ?? [];
      expect(stamps).toHaveLength(1);
      const at = lead.indexOf('data-primary-move="approve-memory-fact"');
      expect(lead.lastIndexOf("<button", at)).toBeGreaterThan(lead.lastIndexOf(">", lead.lastIndexOf("<button", at) - 1) - 1);
      const btn = lead.slice(lead.lastIndexOf("<button", at), lead.indexOf("</button>", at));
      expect(btn).toContain("var(--gradient-cta)");
      expect(btn).toContain(translate(locale, "elev.childmem.action.remember"));
      const rest = renderToStaticMarkup(<PendingGroupCard group={group} isMemoryUpdating={null} onDecide={vi.fn()} />);
      expect(rest).not.toContain("data-primary-move");
    });
  }

  it("page source: no display:contents wrapper carries the stamp (negative control on the old shape)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./ChildMemory.tsx", import.meta.url), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/data-primary-move="approve-memory-fact"[^>]*display: "contents"/);
    expect((src.match(/data-primary-move="/g) ?? []).length).toBe(1);
    expect(src).not.toContain("<TrustSafetyBar");
    const pre = `<div data-module="memory-pending" data-primary-move="approve-memory-fact" style={{ display: "contents" }}>`;
    expect(/data-primary-move="approve-memory-fact"[^>]*display: "contents"/.test(pre)).toBe(true);
  });

  it("the transitions fact lands in a topic, not 'other' (EN + HE); the sole catch-all hides its label", () => {
    expect(groupPendingMemory([fact(1, "Dylan finds leaving the house hard; shoes are where it shows")])[0].topic).not.toBe("other");
    expect(groupPendingMemory([fact(1, "לדילן קשה לצאת מהבית, בעיקר עם הנעליים")])[0].topic).not.toBe("other");
    expect(groupPendingMemory([fact(1, "Dylan loves dinosaurs")])[0].topic).toBe("other");
    const [other] = groupPendingMemory([fact(1, "Dylan loves dinosaurs")]);
    const html = renderToStaticMarkup(<PendingGroupCard group={other} hideLabel isMemoryUpdating={null} onDecide={vi.fn()} />);
    expect(html).not.toContain(translate("en", "elev.childmem.group.other"));
  });
});

/* B-CAREPRO-NEW-2k / 2l — the lead row says where the fact came from (the
   parent's own words), and an approval settles in place into one line that
   says what changes next — no toast, no count, no confetti. */
describe("B-CAREPRO-NEW-2k/2l · provenance on the lead row, an in-place settle line", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: a chat-sourced lead fact carries 'From what you wrote on {date}'; a non-lead row does not`, () => {
      harness.locale = locale;
      const [group] = groupPendingMemory([fact(1, "Dylan cries at bedtime"), fact(2, "Dylan needs comfort at bedtime")]);
      const lead = renderToStaticMarkup(<PendingGroupCard group={group} lead isMemoryUpdating={null} onDecide={vi.fn()} />);
      const prov = /<p data-testid="memory-provenance"[^>]*>([^<]*)<\/p>/.exec(lead);
      expect(prov).toBeTruthy();
      expect(prov![1].startsWith(translate(locale, "elev.childmem.provenance", { date: "X" }).split("X")[0])).toBe(true);
      expect(prov![0]).toContain("var(--arbor-paper-deep)");
      const quiet = renderToStaticMarkup(<PendingGroupCard group={group} isMemoryUpdating={null} onDecide={vi.fn()} />);
      expect(quiet).not.toContain('data-testid="memory-provenance"');
    });
  }

  it("negative control: a non-parent source (digest) shows no provenance", () => {
    harness.locale = "en";
    const [group] = groupPendingMemory([{ ...fact(1, "Dylan cries at bedtime"), source: "digest" }]);
    const html = renderToStaticMarkup(<PendingGroupCard group={group} lead isMemoryUpdating={null} onDecide={vi.fn()} />);
    expect(html).not.toContain('data-testid="memory-provenance"');
  });

  it("source: approve sets the kept topic and the settle line is a status line in green-soft, EN + HE copy, no digits", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./ChildMemory.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/if \(status === "approved"\) setKeptTopic\(g\.topic\);\s*return handleMemoryDecision\(id, status\);/);
    expect(src).toMatch(/data-testid="memory-kept" role="status"[^>]*style=\{\{ background: "var\(--arbor-green-soft\)", color: "var\(--arbor-green-ink\)" \}\}/);
    for (const locale of ["en", "he"] as const) {
      const line = translate(locale, "elev.childmem.kept.topic", { topic: "T" });
      expect(line).not.toMatch(/\d|%/);
      expect(translate(locale, "elev.childmem.kept.any")).not.toBe("elev.childmem.kept.any");
    }
  });
});
