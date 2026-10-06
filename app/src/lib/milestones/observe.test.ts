import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Milestone } from "../../types";
import { ALL_MILESTONES } from "../milestoneData";
import { toObservations } from "../observations";
import { answeredToday, localDay, observeMilestoneDoc } from "./observe";

/* B-LOOP-04 — the ONE milestone write seam. The Milestones tab and the
   Notice card (Today, Journal) both answer through the context's
   setMilestoneObservation, which writes observeMilestoneDoc's document: the
   same answer is the same bytes wherever it was given. */

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(path.join(here, "..", "..", rel), "utf8");

const NOW = "2026-10-06T07:30:00.000Z";
const row = (): Milestone => ({ ...ALL_MILESTONES.find((m) => m.id === "cdc-24m-1")! });

describe("observeMilestoneDoc", () => {
  it('"yes" writes observationStatus "yes", checked and observedAt (When defaults to today)', () => {
    const doc = observeMilestoneDoc(row(), "yes", { now: NOW });
    expect(doc.observationStatus).toBe("yes");
    expect(doc.checked).toBe(true);
    expect(doc.observedAt).toBe(NOW);
    expect(doc.observationUpdatedAt).toBe(NOW);
    expect(doc.observedWhen).toBe("today");
    expect(doc.observationSource).toBe("parent_typed");
    expect("observationProvenance" in doc).toBe(false);
  });

  it('"When?" refines the same "yes"; an AI proposal the parent confirmed keeps its source and log id', () => {
    expect(observeMilestoneDoc(row(), "yes", { now: NOW, when: "earlier" }).observedWhen).toBe("earlier");
    const ai = observeMilestoneDoc(row(), "yes", { now: NOW, source: "ai_proposed_parent_confirmed", provenance: "log-1" });
    expect(ai.observationSource).toBe("ai_proposed_parent_confirmed");
    expect(ai.observationProvenance).toBe("log-1");
  });

  it('"not yet" / "not sure" clear every seen-field and never write undefined', () => {
    const seen = observeMilestoneDoc(row(), "yes", { now: NOW, source: "ai_proposed_parent_confirmed", provenance: "log-1" });
    for (const status of ["not_yet", "not_sure"] as const) {
      const doc = observeMilestoneDoc(seen, status, { now: NOW });
      expect(doc.checked).toBe(false);
      expect(doc.observationStatus).toBe(status);
      for (const k of ["observedAt", "observedWhen", "observationSource", "observationProvenance"]) expect(k in doc).toBe(false);
      expect(Object.values(doc).some((v) => v === undefined)).toBe(false);
    }
  });

  it("is pure: the same answer from two surfaces is the same document, byte for byte", () => {
    const fromTab = observeMilestoneDoc(row(), "yes", { now: NOW });
    const fromCard = observeMilestoneDoc(row(), "yes", { now: NOW });
    expect(JSON.stringify(fromCard)).toBe(JSON.stringify(fromTab));
  });

  it("the record dates a seen milestone by observedAt and carries the confirmed source", () => {
    const doc = observeMilestoneDoc(row(), "yes", { now: NOW, source: "ai_proposed_parent_confirmed", provenance: "log-7" });
    const [o] = toObservations({ milestones: [doc] }, { id: "c1" });
    expect(o.at).toBe(NOW);
    expect(o.source).toBe("ai_proposed_parent_confirmed");
    expect(o.provenance).toBe("log-7");
  });

  it("answeredToday reads the parent's local day, any answer", () => {
    const now = new Date(2026, 9, 6, 21, 0);
    expect(answeredToday({ observationUpdatedAt: new Date(2026, 9, 6, 7, 0).toISOString() }, now)).toBe(true);
    expect(answeredToday({ observationUpdatedAt: new Date(2026, 9, 5, 23, 0).toISOString() }, now)).toBe(false);
    expect(answeredToday({}, now)).toBe(false);
    expect(localDay(now)).toBe("2026-10-06");
  });
});

describe("one seam — source pins", () => {
  it("the context's setMilestoneObservation writes observeMilestoneDoc's document", () => {
    const ctx = src("context/ArborContext.tsx");
    expect(ctx).toMatch(/const setMilestoneObservation = \(id: string, status: ObserveStatus, opts: ObserveOptions = \{\}\) => \{[\s\S]{0,200}?milestonesCol\.upsert\(observeMilestoneDoc\(milestone, status, opts\)\)/);
  });

  it("the Milestones tab answers through setMilestoneObservation (never its own document)", () => {
    const tab = src("components/tabs/MilestonesTab.tsx");
    expect(tab).toMatch(/const observeMilestone = \(item: Milestone, status: ObserveStatus\) => \{[\s\S]{0,200}?setMilestoneObservation\(item\.id, status\);/);
    expect(tab).not.toMatch(/observationStatus:\s*status/);
  });

  it("the Notice card never writes: it hands the answer to its caller", () => {
    const card = src("components/loop/NoticeCard.tsx");
    expect(card).not.toMatch(/milestonesCol|\.upsert\(|useArbor\(/);
    expect(card).toContain("onAnswer(status)");
  });
});
