/**
 * B-BOOK-79 — the child's Everyday plans reach the clinician packet as COUNTS
 * through the one input assembler (`buildPacketInput` reads the raw `books`
 * rows), labelled when one step was relayed from the professional who works
 * with the child; never the child's lines, never a rate, never a verdict; a
 * teacher never receives them; a malformed row is dropped.
 */
import { describe, expect, it } from "vitest";
import { buildConsultPacket, buildPacketInput, buildPresetPacket, CONSULT_PRESETS, serializePacket } from "./packet";
import { CLINICIAN_BASE_SECTIONS } from "../content/consultPresets";

const NOW = Date.parse("2026-10-26T19:00:00.000Z");
const row = (extra: Record<string, unknown> = {}) => ({
  id: "plan-poo-sit.c1", bookId: "plan-poo-sit.c1", kind: "plan", pattern: "plan-poo-sit", lang: "en",
  stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["song"], durationDays: 14,
  approvedAt: "2026-10-20T18:00:00.000Z", approvedBy: "parent-1", createdAt: "2026-10-20T18:00:00.000Z", updatedAt: "2026-10-20T18:00:00.000Z", status: "active",
  nights: ["2026-10-21", "2026-10-23"], ...extra,
});
const record = (books: unknown[]) => ({ profile: { name: "Noa", age: 4, languages: [] }, logs: [], milestones: [], plans: [], memory: [], books });

describe("Everyday plans in the intake packet", () => {
  it("the assembler reads the books rows into counts; a malformed row is dropped", () => {
    const input = buildPacketInput(record([row(), { junk: true }, row({ stepMenuIds: ["nope", "x", "y"] })]), NOW);
    expect(input.everydayPlans).toEqual([{ title: expect.any(String), approvedAt: "2026-10-20T18:00:00.000Z", durationDays: 14, nights: 2, status: "active", practitionerStep: false }]);
  });

  it("the section carries the start, the bounded length and the night COUNT — no rate, no verdict, none of the child's lines", () => {
    const packet = buildConsultPacket(buildPacketInput(record([row()]), NOW));
    const section = packet.sections.find((s) => s.id === "everyday-plans")!;
    expect(section.titleKey).toBe("elev.packet.section.everydayPlans");
    expect(section.items).toHaveLength(1);
    expect(section.items[0].text).toMatch(/started 2026-10-20, a 14-day plan, 2 nights confirmed by the parent\.$/);
    expect(section.items[0].textKey).toBe("elev.packet.item.everydayPlan.active.other");
    const text = serializePacket(packet);
    expect(text).not.toMatch(/\d+\s?%|of 14|streak/i);
    expect(text).not.toContain("Step one"); // never the child's lines
  });

  it("a closed plan says so; one night reads in the singular", () => {
    const packet = buildConsultPacket(buildPacketInput(record([row({ status: "closed", closedAt: "2026-10-25T20:00:00Z", nights: ["2026-10-21"] })]), NOW));
    const item = packet.sections.find((s) => s.id === "everyday-plans")!.items[0];
    expect(item.text).toMatch(/1 night confirmed by the parent \(closed\)\.$/);
    expect(item.textKey).toBe("elev.packet.item.everydayPlan.closed.one");
  });

  it("a step relayed from the professional who works with the child is labelled as such (door a)", () => {
    const own = { slot: 2, origin: "practitioner", sourceText: "bubbles while sitting", aiPhrased: true, approvedAt: "2026-10-20T18:00:00.000Z", text: { en: "Step two: while I sit, I blow bubbles.", he: { m: "שלב שני: בזמן שאני יושב, אני מנשף בועות.", f: "שלב שני: בזמן שאני יושבת, אני מנשפת בועות." } } };
    const packet = buildConsultPacket(buildPacketInput(record([row({ stepMenuIds: ["sit-after-meal", "own", "just-try"], ownStep: own })]), NOW));
    const items = packet.sections.find((s) => s.id === "everyday-plans")!.items;
    expect(items).toHaveLength(2);
    expect(items[1].textKey).toBe("elev.packet.item.everydayPlanPro");
    expect(items[1].text).toContain("relayed from the professional who works with the child");
    expect(items.map((i) => i.text).join(" ")).not.toContain("bubbles while sitting"); // the parent's typed words stay on the device
  });

  it("every clinician preset receives the section; the teacher never does; no plans, no section", () => {
    const input = buildPacketInput(record([row()]), NOW);
    for (const audience of ["therapist", "pediatrician", "slp", "behavioral_health", "ot", "pt", "psychology"] as const) {
      expect(CONSULT_PRESETS[audience].sections, audience).toContain("everyday-plans");
      expect(buildPresetPacket(audience, input).sections.some((s) => s.id === "everyday-plans"), audience).toBe(true);
    }
    expect(CONSULT_PRESETS.teacher.sections).not.toContain("everyday-plans");
    expect(CLINICIAN_BASE_SECTIONS).toContain("everyday-plans");
    expect(buildConsultPacket(buildPacketInput(record([]), NOW)).sections.some((s) => s.id === "everyday-plans")).toBe(false);
  });
});
