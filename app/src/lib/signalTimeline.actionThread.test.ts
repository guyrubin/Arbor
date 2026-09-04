/**
 * Wave L · TJB-05 — Today's primary move writes the thread.
 *
 * Before this wave `actionLoops` was a write-only ledger: accepting the day's
 * step persisted a record that NO buildTimeline source read, so the one move
 * Today exists to produce left no trace in the parent's story, and
 * surfaceContract declared the overview's `threadWrite` as "none".
 *
 * These are behaviour tests over the pure builder (accept → a row exists;
 * outcome → the SAME row's title changes), plus two structural guards that
 * carry their own negative control: the ingest registry must list the source,
 * and the contract must name it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTimeline,
  signalDetail,
  signalMeta,
  signalTitle,
  SIGNAL_PROVENANCE,
  TIMELINE_SOURCE_IDS,
} from "./signalTimeline";
import { SURFACE_CONTRACTS } from "./surfaceContract";
import type { ActionLoopEntry } from "../actionLoop/model";
import { en as closeloopEn, he as closeloopHe } from "./i18nElevation/closeloop";

/** Echoing translator: renders the key + vars so assertions read structurally. */
const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `[${key}|${Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(",")}]` : `[${key}]`;

const accepted: ActionLoopEntry = {
  id: "today.child-1.2026-09-04",
  recommendation: "Name the next transition five minutes ahead.",
  source: "today-guidance",
  capacity: "standard",
  status: "accepted",
  acceptedAt: "2026-09-04T07:30:00.000Z",
};

const completed: ActionLoopEntry = {
  ...accepted,
  status: "completed",
  outcome: "helped",
  outcomeAt: "2026-09-04T19:05:00.000Z",
};

describe("TJB-05 — accepting the day's step writes a thread row", () => {
  it("an accepted action produces exactly one dated signal in the same build", () => {
    const before = buildTimeline({ actionOutcomes: [] });
    expect(before).toHaveLength(0);

    const after = buildTimeline({ actionOutcomes: [accepted] });
    expect(after).toHaveLength(1);
    expect(after[0].kind).toBe("action");
    expect(after[0].at).toBe(accepted.acceptedAt);
  });

  it("the row is the PARENT's act — provenance manual, so the badge reads You", () => {
    const [row] = buildTimeline({ actionOutcomes: [accepted] });
    expect(SIGNAL_PROVENANCE[row.kind]).toBe("manual");
  });

  it("recording the outcome UPDATES the same row rather than adding a second", () => {
    const [acceptedRow] = buildTimeline({ actionOutcomes: [accepted] });
    const completedRows = buildTimeline({ actionOutcomes: [completed] });

    expect(completedRows).toHaveLength(1);
    expect(completedRows[0].id).toBe(acceptedRow.id);
    expect(signalTitle(acceptedRow, t)).toBe("[elev.closeloop.thread.title.accepted]");
    expect(signalTitle(completedRows[0], t)).toBe("[elev.closeloop.thread.title.helped]");
    // …and it re-sorts onto the moment it was closed out, not the morning.
    expect(completedRows[0].at).toBe(completed.outcomeAt);
  });

  it("carries the step's own words as the detail line and the capacity as meta", () => {
    const [row] = buildTimeline({ actionOutcomes: [completed] });
    expect(signalDetail(row, t)).toBe(completed.recommendation);
    expect(signalMeta(row, t)).toBe("[timeline.meta.minutes|n=5]");
  });

  it("sorts into the one stream alongside the other sources, newest first", () => {
    const stream = buildTimeline({
      behaviorLogs: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: "b1", timestamp: "2026-09-04T06:00:00.000Z", behaviorType: "Meltdown", intensity: 3 } as any,
      ],
      actionOutcomes: [completed],
    });
    expect(stream.map((s) => s.id)).toEqual(["action-today.child-1.2026-09-04", "moment-b1"]);
  });

  it("FIREWALL: every outcome renders in ONE tone — the row never colour-codes a verdict", () => {
    const tones = (["helped", "somewhat", "not_today"] as const).map((outcome) => {
      const [row] = buildTimeline({
        actionOutcomes: [{ ...completed, outcome, id: `x-${outcome}` }],
      });
      return row.tone;
    });
    expect(new Set(tones).size).toBe(1);
  });

  it("every lifecycle title resolves in BOTH languages", () => {
    for (const status of ["accepted", "helped", "somewhat", "not_today", "done"]) {
      const key = `elev.closeloop.thread.title.${status}`;
      expect(closeloopEn[key], `EN ${key}`).toBeTruthy();
      expect(closeloopHe[key], `HE ${key}`).toBeTruthy();
    }
  });
});

describe("TJB-05 — the source is registered and the contract admits it", () => {
  it("actionOutcomes is a real buildTimeline ingest source", () => {
    expect(TIMELINE_SOURCE_IDS).toContain("actionOutcomes");
    // Negative control: the registry is not simply permissive.
    expect(TIMELINE_SOURCE_IDS).not.toContain("actionOutcomesNotARealSource");
  });

  it("the overview contract's threadWrite names it (it declared \"none\" before)", () => {
    const overview = SURFACE_CONTRACTS.find((c) => c.route === "overview");
    expect(overview?.primaryMove).toBe("do-today-action");
    expect(overview?.threadWrite).toBe("actionOutcomes");
    // Negative control: the assertion above would have FAILED on the shipped
    // pre-change shape, which is the whole point of SC-4 (no silent dead-ends).
    expect(overview?.threadWrite).not.toBe("none");
  });

  it("every declared threadWrite source id is a real ingest source (SC-4)", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const contract = readFileSync(path.join(here, "./surfaceContract.ts"), "utf8");
    // Guard the comment too: the old text asserted no such source EXISTS.
    expect(contract).not.toMatch(/NO such source exists in\s*\n?\s*\/\/ buildTimeline/);
    for (const c of SURFACE_CONTRACTS) {
      if (c.threadWrite === "none" || c.threadWrite === "consented") continue;
      expect(TIMELINE_SOURCE_IDS, `${c.route} → ${c.threadWrite}`).toContain(c.threadWrite);
    }
  });
});
