/**
 * Wave L · TJB-11 — the fallback digest silently lost the recap's only move.
 *
 * The recap ends on ONE card whose entire job is a single recommendation with
 * a CTA into acceptTodayAction. TODAY-1 rightly blocks that CTA for a fallback
 * digest (deterministic copy must never be persisted into actionLoops), and
 * the renderer's ternary chain then fell through to `null`: the parent read
 * the week's only suggestion and found a blank space where the button lives,
 * with no note, no route, and no error. `resolveRecapMove` makes that case a
 * NAMED outcome the renderer must handle instead of a fall-through.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRecapMove } from "./recapMove";
import { en as closeloopEn, he as closeloopHe } from "./i18nElevation/closeloop";

const TEXT = "Name the next transition five minutes ahead, once this week.";

describe("TJB-11 resolveRecapMove", () => {
  it("an AI digest still offers the accept CTA (TODAY-1 unchanged)", () => {
    expect(resolveRecapMove({ text: TEXT, canAccept: true, accepted: false })).toEqual({ kind: "accept" });
  });

  it("an already-accepted step shows the done-state", () => {
    expect(resolveRecapMove({ text: TEXT, canAccept: true, accepted: true })).toEqual({ kind: "accepted" });
    // …even when the digest could not be accepted from here in the first place.
    expect(resolveRecapMove({ text: TEXT, canAccept: false, accepted: true })).toEqual({ kind: "accepted" });
  });

  it("a FALLBACK digest keeps the move visible with an honest note — never nothing", () => {
    const move = resolveRecapMove({ text: TEXT, canAccept: false, accepted: false });
    expect(move.kind).toBe("note");
    // NEGATIVE CONTROL: the shipped renderer's chain produced null here, which
    // is the exact silence this item is about.
    const shipped = (canAccept: boolean, accepted: boolean) => (accepted ? "done" : canAccept ? "cta" : null);
    expect(shipped(false, false)).toBeNull();
    expect(move.kind).not.toBe("none");
  });

  it("the note never becomes an accept path — fallback copy stays out of actionLoops", () => {
    for (const accepted of [false]) {
      const move = resolveRecapMove({ text: TEXT, canAccept: false, accepted });
      expect(move.kind).not.toBe("accept");
    }
  });

  it("no recommendation at all is its own outcome, not a mislabelled note", () => {
    expect(resolveRecapMove({ text: "", canAccept: true, accepted: false })).toEqual({ kind: "none" });
    expect(resolveRecapMove({ text: "   ", canAccept: false, accepted: false })).toEqual({ kind: "none" });
    expect(resolveRecapMove({ text: null, canAccept: false, accepted: false })).toEqual({ kind: "none" });
  });

  it("the note's copy exists in BOTH languages", () => {
    const move = resolveRecapMove({ text: TEXT, canAccept: false, accepted: false });
    if (move.kind !== "note") throw new Error("expected a note");
    for (const key of [move.noteKey, move.whyKey]) {
      expect(closeloopEn[key], `EN ${key}`).toBeTruthy();
      expect(closeloopHe[key], `HE ${key}`).toBeTruthy();
    }
  });

  it("FIREWALL + de-jargon: the note explains provenance without tech framing", () => {
    const en = `${closeloopEn["elev.closeloop.recap.builtin"]} ${closeloopEn["elev.closeloop.recap.builtin.why"]}`;
    expect(en).not.toMatch(/\b(AI|LLM|model|engine|algorithm)\b/i);
  });
});

describe("TJB-11 — the recap card renders the resolved move", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cards = readFileSync(path.join(here, "../components/weekly/RecapStoryCards.tsx"), "utf8");

  it("RecapStoryCards resolves instead of falling through a ternary chain", () => {
    expect(cards).toContain("resolveRecapMove({ text: card.text, canAccept, accepted })");
    expect(cards).toContain('data-testid="recap-move-note"');
    // The old `) : null}` fall-through for the action row is gone.
    expect(cards).not.toContain("} ) : canAccept ? (");
  });

  it("the accept CTA still fires only on the AI path", () => {
    // Slice each branch by its own boundaries — a non-greedy `);` would stop
    // inside the track() call and make the assertion meaningless.
    const between = (from: string, to: string) => {
      const a = cards.indexOf(from);
      const b = cards.indexOf(to, a + 1);
      expect(a, from).toBeGreaterThan(-1);
      expect(b, to).toBeGreaterThan(a);
      return cards.slice(a, b);
    };
    const acceptBlock = between('if (move.kind === "accept") return (', 'if (move.kind === "note") return (');
    expect(acceptBlock).toContain("onAccept()");
    const noteBlock = between('if (move.kind === "note") return (', "return null;");
    expect(noteBlock).toContain('data-testid="recap-move-note"');
    expect(noteBlock).not.toContain("onAccept");
    expect(noteBlock).not.toContain("<button");
  });
});
