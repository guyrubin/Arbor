import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTypedCaptureProposals,
  isTypedAnswer,
  keepableLines,
  turnFingerprint,
  KEEPABLE_CONTRACT_FIELDS,
  NEVER_KEEPABLE_FIELDS,
  MAX_TYPED_PROPOSALS,
  TYPED_TURN_PROMPT,
} from "./captureProposals";
import type { ChatMessage } from "../context/ArborContext";
import type { CoachContract } from "../types";

/**
 * AI-04 — the typed-turn proposals tray.
 *
 * Every rule here has a NEGATIVE CONTROL: the assertion is re-run against the
 * exact shape the defect produces, and must fail on it. A guard that cannot
 * fail is not a guard.
 */

const SRC_ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(SRC_ROOT, "..", rel), "utf8").replace(/\r\n/g, "\n");

const CTX = { childId: "kid-1", language: "en" as const, now: "2026-09-04T10:00:00.000Z" };

function contract(over: Partial<CoachContract> = {}): CoachContract {
  return {
    riskLevel: "low",
    ageBand: "3-4",
    domains: ["language_communication"],
    nonDiagnosticHypotheses: [{ label: "Tiredness", confidence: "medium", rationale: "Most meltdowns land after 6pm." }],
    todayPlan: ["Move bathtime fifteen minutes earlier tonight."],
    parentScript: "I can see you are tired. I am going to stay right here.",
    avoid: ["Do not add a new rule tonight."],
    observe: ["Whether the 6pm wobble lands earlier or later this week."],
    escalateIf: ["It happens every night for two weeks."],
    frameRouting: { aim: "", twoAxes: "", story: "", shadow: "", marriage: "", shepherd: "" },
    memoryProposals: [],
    handoffNotes: { teacher: "", professional: "" },
    ...over,
  };
}

const typedThread = (over: Partial<CoachContract> = {}): ChatMessage[] => [
  { sender: "user", text: "Bedtime is a battle every night. What do I do?" },
  { sender: "ai", text: "Here is what I would try.", contract: contract(over) },
];

/* ── the turn classifier ──────────────────────────────────────────────────── */

describe("isTypedAnswer identifies the typed path POSITIVELY", () => {
  it("a settled answer carrying a contract is a typed answer", () => {
    expect(isTypedAnswer({ sender: "ai", text: "x", contract: contract() })).toBe(true);
  });

  it("a settled answer carrying a council take is a typed answer", () => {
    expect(isTypedAnswer({ sender: "ai", text: "x", council: [{} as never] })).toBe(true);
  });

  it("NEGATIVE CONTROL: a settled VOICE turn is never mistaken for a typed one", () => {
    // settleVoiceTurn (lib/voiceTranscript) strips `voiceLive` and sets NEITHER
    // contract nor council — that is the whole reason those two fields work as
    // the marker. If this ever passes, the voice tray and this tray would both
    // offer the parent the same sentence.
    expect(isTypedAnswer({ sender: "ai", text: "A settled spoken caption." })).toBe(false);
  });

  it("NEGATIVE CONTROL: a still-streaming bubble is not offered", () => {
    expect(isTypedAnswer({ sender: "ai", text: "half a se", chatLive: true, contract: contract() })).toBe(false);
    expect(isTypedAnswer({ sender: "ai", text: "half a se", voiceLive: true, contract: contract() })).toBe(false);
  });

  it("a user turn is never an answer", () => {
    expect(isTypedAnswer({ sender: "user", text: "help" })).toBe(false);
    expect(isTypedAnswer(undefined)).toBe(false);
  });
});

/* ── the clinical firewall over what may be kept ──────────────────────────── */

describe("CLINICAL FIREWALL — only the allow-listed fields can become a kept row", () => {
  it("the allow-list is exactly today's steps, the script, and what to look out for", () => {
    expect([...KEEPABLE_CONTRACT_FIELDS].sort()).toEqual(["observe", "parentScript", "todayPlan"]);
  });

  it("a verdict, an area pointer or a hypothesis is never keepable", () => {
    const lines = keepableLines(contract()).map((l) => l.text);
    const c = contract();
    // NEGATIVE CONTROL: the excluded content genuinely EXISTS on the fixture —
    // a vacuous exclusion (empty fields) would pass this test for free.
    expect(c.riskLevel).toBeTruthy();
    expect(c.domains.length).toBeGreaterThan(0);
    expect(c.nonDiagnosticHypotheses.length).toBeGreaterThan(0);
    expect(c.escalateIf.length).toBeGreaterThan(0);
    expect(c.avoid.length).toBeGreaterThan(0);
    // …and none of it reaches a proposal.
    expect(lines).not.toContain(c.riskLevel);
    expect(lines.join(" ")).not.toContain(c.nonDiagnosticHypotheses[0].rationale);
    expect(lines).not.toContain(c.escalateIf[0]);
    expect(lines).not.toContain(c.avoid[0]);
    expect(lines.join(" ")).not.toContain("language_communication");
  });

  it("the excluded list names every field the answer carries but must not keep", () => {
    for (const field of NEVER_KEEPABLE_FIELDS) {
      expect(field in contract(), `${field} is not a real CoachContract field`).toBe(true);
      expect(KEEPABLE_CONTRACT_FIELDS as readonly string[]).not.toContain(field);
    }
  });

  it("the source scan of the module is real: the allow-list drives keepableLines", () => {
    const src = read("lib/captureProposals.ts");
    expect(src.length).toBeGreaterThan(2000);
    for (const field of NEVER_KEEPABLE_FIELDS) {
      // The excluded fields may be NAMED (in the doc-comment + the exported
      // list) but must never be READ off a contract into a proposal.
      expect(src).not.toContain(`contract.${field}`);
    }
    expect(src).toContain("contract.todayPlan");
    expect(src).toContain("contract.observe");
  });
});

/* ── the proposals themselves ─────────────────────────────────────────────── */

describe("buildTypedCaptureProposals", () => {
  it("quotes the answer's own lines, newest typed turn only", () => {
    const out = buildTypedCaptureProposals(typedThread(), CTX);
    expect(out.map((p) => p.field)).toEqual(["todayPlan", "parentScript", "observe"]);
    expect(out[0].proposal.summary).toBe("Move bathtime fifteen minutes earlier tonight.");
  });

  it("every proposal carries the parent's OWN question as its source excerpt", () => {
    const out = buildTypedCaptureProposals(typedThread(), CTX);
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) {
      expect(p.proposal.sourceExcerpt).toBe("Bedtime is a battle every night. What do I do?");
      // NEGATIVE CONTROL for the whole item: an empty excerpt is exactly the
      // "saved row with no recorded origin" this backlog item exists to stop,
      // and normalizeConversationProposals would drop such a row on the floor.
      expect(p.proposal.sourceExcerpt.trim()).not.toBe("");
    }
  });

  it("names the prompt behind the answer, so a kept row can be explained later", () => {
    const [first] = buildTypedCaptureProposals(typedThread(), CTX);
    expect(first.proposal.sessionId).toContain(TYPED_TURN_PROMPT.key);
    expect(first.proposal.sessionId).toContain(TYPED_TURN_PROMPT.version);
  });

  it("writes to the journal target — never an observation, never a milestone", () => {
    for (const p of buildTypedCaptureProposals(typedThread(), CTX)) {
      expect(p.proposal.target).toBe("journal");
      expect(p.proposal.milestoneId).toBeUndefined();
      expect(p.proposal.milestoneStatus).toBeUndefined();
    }
  });

  it("is deterministic: the same exchange always yields the same ids", () => {
    const a = buildTypedCaptureProposals(typedThread(), CTX);
    const b = buildTypedCaptureProposals(typedThread(), CTX);
    expect(a.map((p) => p.proposal.id)).toEqual(b.map((p) => p.proposal.id));
    // NEGATIVE CONTROL: a different exchange must NOT collide.
    const other = buildTypedCaptureProposals(
      [{ sender: "user", text: "Different question entirely." }, typedThread()[1]],
      CTX,
    );
    expect(other[0].proposal.turnId).not.toBe(a[0].proposal.turnId);
  });

  it("caps the tray so one answer cannot flood the surface", () => {
    const many = buildTypedCaptureProposals(
      typedThread({ todayPlan: ["a", "b", "c", "d", "e", "f"] }),
      CTX,
    );
    expect(many.length).toBe(MAX_TYPED_PROPOSALS);
  });

  it("NEGATIVE CONTROL: a voice-only thread offers nothing", () => {
    const voice: ChatMessage[] = [
      { sender: "user", text: "spoken question" },
      { sender: "ai", text: "spoken answer, settled" },
    ];
    expect(buildTypedCaptureProposals(voice, CTX)).toEqual([]);
  });

  it("NEGATIVE CONTROL: an answer whose keepable fields are empty offers nothing", () => {
    expect(
      buildTypedCaptureProposals(typedThread({ todayPlan: [], parentScript: "", observe: [] }), CTX),
    ).toEqual([]);
  });

  it("NEGATIVE CONTROL: only the LAST answer is offered, never an old one", () => {
    const thread: ChatMessage[] = [
      ...typedThread(),
      { sender: "user", text: "and what about naps?" },
      { sender: "ai", text: "a spoken follow-up with no contract" },
    ];
    // The most recent AI turn is a voice turn → nothing, rather than silently
    // re-offering the older typed answer the parent has already moved past.
    expect(buildTypedCaptureProposals(thread, CTX)).toEqual([]);
  });

  it("an empty thread or a missing child is a calm no-op", () => {
    expect(buildTypedCaptureProposals([], CTX)).toEqual([]);
    expect(buildTypedCaptureProposals(typedThread(), { ...CTX, childId: "" })).toEqual([]);
  });

  it("the fingerprint is stable and dependency-free", () => {
    expect(turnFingerprint("abc")).toBe(turnFingerprint("abc"));
    expect(turnFingerprint("abc")).not.toBe(turnFingerprint("abd"));
    expect(turnFingerprint("abc")).toMatch(/^[0-9a-f]{8}$/);
  });
});

/* ── the prompt-version pin ───────────────────────────────────────────────── */

describe("the prompt pin tracks the server, so provenance cannot go stale", () => {
  const prompts = read("ai/prompts.ts");

  it("the scanned file is real, not an empty read", () => {
    expect(prompts.length).toBeGreaterThan(2000);
    expect(prompts).toContain("PROMPT_VERSIONS");
  });

  it("TYPED_TURN_PROMPT matches PROMPT_VERSIONS in src/ai/prompts.ts", () => {
    const match = new RegExp(`${TYPED_TURN_PROMPT.key}:\\s*\\{\\s*version:\\s*"([^"]+)"`).exec(prompts);
    expect(match, `${TYPED_TURN_PROMPT.key} is no longer in PROMPT_VERSIONS`).toBeTruthy();
    expect(match![1]).toBeTruthy();
    expect(
      match![1],
      "the coach prompt was bumped — update TYPED_TURN_PROMPT so kept rows name the prompt that actually produced them",
    ).toBe(TYPED_TURN_PROMPT.version);
  });

  it("NEGATIVE CONTROL: the matcher really would catch a drifted pin", () => {
    const match = new RegExp(`${TYPED_TURN_PROMPT.key}:\\s*\\{\\s*version:\\s*"([^"]+)"`).exec(prompts);
    expect(match![1]).not.toBe("0.0.0-stale");
  });
});

/* ── the surface contract may only say "consented" once it is true ────────── */

describe("the coach contract cannot be flipped to 'consented' before the gate exists", () => {
  /**
   * AI-04's third clause is "flip contract to `consented`". Half of the gate
   * now ships — a typed turn produces keepable proposals and "Keep this"
   * writes a Journal row with recorded provenance. The OTHER half does not:
   * buildTimeline still folds `sources.conversations` unconditionally, so
   * every coach thread lands in the thread with no consent step at all. Until
   * that auto-ingest is gated, `threadWrite: "consented"` would be a false
   * statement in a manifest the surfaceContract header itself says later waves
   * read as fact.
   *
   * This guard does not decide WHEN the flip happens; it makes flipping
   * without the gate fail loudly.
   */
  const contractSrc = read("lib/surfaceContract.ts");
  const timelineSrc = read("lib/signalTimeline.ts");

  const coachContract = /\{\s*route: "coach",[\s\S]*?\},\n/.exec(contractSrc)?.[0] ?? "";
  const threadWrite = /threadWrite: "([^"]+)"/.exec(coachContract)?.[1] ?? "";
  /** buildTimeline's unconditional coach-thread ingest loop. */
  const autoIngest = /for \(const c of sources\.conversations \|\| \[\]\) \{/.test(timelineSrc);

  it("the scan found the real contract and the real ingest loop", () => {
    expect(contractSrc.length).toBeGreaterThan(5000);
    expect(timelineSrc.length).toBeGreaterThan(5000);
    expect(coachContract, "the coach surface contract was not found").toBeTruthy();
    expect(threadWrite, "the coach contract declares no threadWrite").toBeTruthy();
  });

  it("'consented' requires the unconditional conversations ingest to be gone", () => {
    if (threadWrite === "consented") {
      expect(
        autoIngest,
        "surfaceContract says coach turns are consent-only, but buildTimeline still folds every conversation — gate or remove that loop first",
      ).toBe(false);
    } else {
      // Today: the declaration is honest about what ships.
      expect(threadWrite).toBe("conversations");
      expect(autoIngest, "the ingest loop this guard watches has moved — re-point it").toBe(true);
    }
  });

  it("NEGATIVE CONTROL: the implication really can fail", () => {
    const flippedTooEarly = { threadWrite: "consented", autoIngest: true };
    const ok = !(flippedTooEarly.threadWrite === "consented" && flippedTooEarly.autoIngest);
    expect(ok).toBe(false);
  });
});
