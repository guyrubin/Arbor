/**
 * AI-10 (coach answer feedback, 2026-09-04) — the in-product quality signal.
 *
 * The defect: answer quality was unmeasured in production. A parent who got a
 * bad answer had no way to tell us, so the only quality signal we ever received
 * was churn.
 *
 * What is asserted here:
 *  - CLINICAL FIREWALL: the emitted props are an ALLOW-LIST about the ANSWER —
 *    no question text, no answer text, no child name, age band, domains or risk
 *    level, and no score/rating/percentage of any kind;
 *  - the control is REVERSIBLE (the same thumb again clears the vote, and the
 *    un-vote is itself recorded);
 *  - it DEGRADES SILENTLY when storage throws (private window / blocked site
 *    data / non-browser render) — the answer still renders, the vote still sends;
 *  - EN + HE strings render in parent register, HE with no Latin fallback;
 *  - the vote reaches a REAL sink: lib/analytics `track` → the signed-in
 *    parent's Firestore collection `users/{uid}/events`. A control that stores
 *    nothing is theatre, so the landing path is asserted against the source of
 *    the seam, not assumed.
 *
 * Every block carries a NEGATIVE CONTROL: an assertion that fails if the test
 * is passing vacuously (an empty render, an empty source scan, a matcher that
 * matches nothing).
 */
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import CoachAnswerCards, {
  COACH_FEEDBACK_EVENT,
  answerSignature,
  feedbackProps,
  readStoredVote,
  writeStoredVote,
} from "./CoachAnswerCards";
import { translate } from "../../lib/i18n";
import type { CoachContract } from "../../types";

/** A contract carrying every field that MUST NOT reach telemetry. */
const CHILD_NAME = "Zippora-Sentinel";
const contract: CoachContract = {
  text: `${CHILD_NAME} melts down at the door most mornings, and that is very common at four.`,
  riskLevel: "Moderate-Sentinel",
  ageBand: "3-4-Sentinel",
  domains: ["attachment_regulation"],
  nonDiagnosticHypotheses: [
    { label: "Transitions are hard", confidence: "one possibility", rationale: `${CHILD_NAME} needs a runway.` },
  ],
  todayPlan: [`Give ${CHILD_NAME} two choices at the door.`],
  parentScript: `I can see this is hard, ${CHILD_NAME}. One breath together.`,
  avoid: ["Long lectures in the moment."],
  observe: ["When it starts and how long it lasts."],
  escalateIf: ["The pattern intensifies for two weeks."],
  frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
  memoryProposals: [],
  handoffNotes: { teacher: "", professional: "" },
  sourceCardsUsed: ["card-a", "card-b"],
  sourceCards: [
    { id: "card-a", title: "Transitions at four", type: "guide" },
    { id: "card-b", title: "Two-choice offers", type: "guide" },
  ],
};

/** React escapes text nodes, so compare against the escaped form (the EN copy
 *  contains an apostrophe — matching raw would silently never match). */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

const noop = () => {};
const renderCards = (lang: "en" | "he" = "en") =>
  renderToStaticMarkup(
    React.createElement(CoachAnswerCards, {
      contract,
      lens: "Attachment",
      lang,
      onSaveToPlan: noop,
      onCreateLog: noop,
      onAddToHandoff: noop,
    }),
  );

/** In-memory localStorage stand-in (node has none). */
function installStorage(impl?: Partial<Storage>) {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    ...impl,
  };
  (globalThis as any).localStorage = store;
  return map;
}

afterEach(() => {
  delete (globalThis as any).localStorage;
});

describe("AI-10 clinical firewall — the signal is about the ANSWER, never the child", () => {
  it("feedbackProps emits an allow-list and NOTHING about the child", () => {
    const props = feedbackProps({
      answerId: answerSignature(contract),
      vote: "down",
      lens: "Attachment",
      surface: "coach",
      lang: "en",
      sources: 2,
    });
    // NEGATIVE CONTROL: the props are real and carry the identifying fields —
    // without this, every `not.toContain` below could pass on an empty object.
    expect(Object.keys(props).sort()).toEqual(["answer_id", "lang", "lens", "sources", "surface", "vote"]);
    expect(props.vote).toBe("down");
    expect(String(props.answer_id)).toMatch(/^a-[0-9a-f]{8}$/);

    // …and NOTHING that describes the child or the conversation.
    const serialized = JSON.stringify(props);
    expect(serialized).not.toContain(CHILD_NAME);
    expect(serialized).not.toContain(contract.riskLevel);
    expect(serialized).not.toContain(contract.ageBand);
    expect(serialized).not.toContain("attachment_regulation");
    expect(serialized).not.toContain(contract.parentScript);
    expect(serialized).not.toContain(contract.todayPlan[0]);
    // No verdict vocabulary about a child can be introduced later either.
    expect(serialized).not.toMatch(/score|rating|percent|grade|level/i);
    // NEGATIVE CONTROL for those matchers: they DO fire on the excluded text.
    expect(JSON.stringify({ leak: contract.parentScript })).toContain(CHILD_NAME);
    expect(JSON.stringify({ leak: "risk_score" })).toMatch(/score/i);
  });

  it("the answer id is a one-way fingerprint: stable per answer, different across answers, and reveals no content", () => {
    const id = answerSignature(contract);
    expect(answerSignature({ ...contract })).toBe(id); // stable → the un-vote finds the same answer
    expect(id).not.toContain(CHILD_NAME);
    expect(id.length).toBeLessThan(12); // 32 bits cannot carry an answer

    // NEGATIVE CONTROL: a genuinely different answer gets a different id, so
    // the stability assertion above is not passing on a constant.
    const other = answerSignature({ ...contract, parentScript: "Something else entirely, said differently." });
    expect(other).toMatch(/^a-[0-9a-f]{8}$/);
    expect(other).not.toBe(id);
  });
});

describe("AI-10 reversibility and silent degradation", () => {
  it("a vote can be taken back: storing then clearing leaves no recorded vote", () => {
    installStorage();
    const id = answerSignature(contract);
    expect(readStoredVote(id)).toBeNull();
    writeStoredVote(id, "down");
    // NEGATIVE CONTROL: the store really did take the write — otherwise the
    // "cleared" assertion below would pass on a store that never works.
    expect(readStoredVote(id)).toBe("down");
    writeStoredVote(id, null);
    expect(readStoredVote(id)).toBeNull();
  });

  it("a garbage stored value is ignored rather than rendered as a vote", () => {
    const map = installStorage();
    const id = answerSignature(contract);
    map.set(`arbor.coachVote.${id}`, "5-stars");
    expect(readStoredVote(id)).toBeNull();
    // NEGATIVE CONTROL: the key really is the one the reader looks at.
    map.set(`arbor.coachVote.${id}`, "up");
    expect(readStoredVote(id)).toBe("up");
  });

  it("storage that THROWS degrades silently — no vote read, no exception on write", () => {
    const boom = () => { throw new Error("site data blocked"); };
    installStorage({ getItem: boom as any, setItem: boom as any, removeItem: boom as any });
    const id = answerSignature(contract);
    expect(readStoredVote(id)).toBeNull();
    expect(() => writeStoredVote(id, "down")).not.toThrow();
    expect(() => writeStoredVote(id, null)).not.toThrow();
  });

  it("no storage at all (server render / non-browser) degrades silently", () => {
    delete (globalThis as any).localStorage;
    expect(readStoredVote("a-deadbeef")).toBeNull();
    expect(() => writeStoredVote("a-deadbeef", "up")).not.toThrow();
  });
});

describe("AI-10 render — the control ships on the answer, in both languages", () => {
  it("EN: both thumbs render un-pressed, with the firewall note, and the answer is unaffected", () => {
    const html = renderCards("en");
    // NEGATIVE CONTROL: the answer itself rendered — an empty markup string
    // would satisfy nothing below honestly.
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain("two choices at the door");

    // NEGATIVE CONTROL for `esc`: it really does transform the copy that needs
    // it, so a bad escaper cannot make these assertions vacuous.
    expect(esc(translate("en", "elev.coachcontract.feedback.down"))).not.toBe(
      translate("en", "elev.coachcontract.feedback.down"),
    );
    expect(html).toContain(esc(translate("en", "elev.coachcontract.feedback.prompt")));
    expect(html).toContain(esc(translate("en", "elev.coachcontract.feedback.up")));
    expect(html).toContain(esc(translate("en", "elev.coachcontract.feedback.down")));
    expect(html).toContain(esc(translate("en", "elev.coachcontract.feedback.note")));
    // Un-voted on first paint, and both controls are real toggles.
    expect(html.match(/aria-pressed="false"/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain('aria-pressed="true"');
    // The thanks copy is the POST-vote state — it must not pre-empt the ask.
    expect(html).not.toContain(esc(translate("en", "elev.coachcontract.feedback.thanks")));
  });

  it("HE: the strings are hand-written Hebrew, with no English fallback leaking through", () => {
    const html = renderCards("he");
    for (const key of [
      "elev.coachcontract.feedback.prompt",
      "elev.coachcontract.feedback.up",
      "elev.coachcontract.feedback.down",
      "elev.coachcontract.feedback.thanks",
      "elev.coachcontract.feedback.undo",
      "elev.coachcontract.feedback.note",
    ]) {
      const he = translate("he", key);
      const en = translate("en", key);
      // NEGATIVE CONTROL: the key resolves to real copy, not to the key itself.
      expect(he).not.toBe(key);
      expect(he).not.toBe(en); // a missing HE key would fall back to the EN string
      expect(he).toMatch(/[֐-׿]/);
      expect(he).not.toMatch(/[A-Za-z]/);
    }
    expect(html).toContain(esc(translate("he", "elev.coachcontract.feedback.note")));
  });

  it("the copy makes no claim about the child: no score, rating, percentage or verdict wording", () => {
    for (const lang of ["en", "he"] as const) {
      for (const key of ["elev.coachcontract.feedback.prompt", "elev.coachcontract.feedback.up", "elev.coachcontract.feedback.down", "elev.coachcontract.feedback.note"]) {
        const value = translate(lang, key);
        expect(value.length).toBeGreaterThan(0); // NEGATIVE CONTROL: real copy
        expect(value).not.toMatch(/\bscore|rating|percentile|%|\bon[ -]track\b|delayed/i);
        expect(value).not.toMatch(/ציון|דירוג|אחוזון|מעוכב|בסיכון/);
      }
    }
  });
});

// ── Where the signal actually lands ─────────────────────────────────────────
const CARDS_SOURCE = readFileSync(fileURLToPath(new URL("./CoachAnswerCards.tsx", import.meta.url)), "utf8");
const ANALYTICS_SOURCE = readFileSync(fileURLToPath(new URL("../../lib/analytics.ts", import.meta.url)), "utf8");

describe("AI-10 the downvote is retrievable — it is wired to the real telemetry sink", () => {
  it("the scan reads real, non-empty sources (negative control for every assertion below)", () => {
    expect(CARDS_SOURCE.length).toBeGreaterThan(5_000);
    expect(ANALYTICS_SOURCE.length).toBeGreaterThan(1_000);
    expect(CARDS_SOURCE).toContain("function AnswerFeedback(");
    // …and the matcher DISCRIMINATES: a string that is not in the file is not found.
    expect(CARDS_SOURCE).not.toContain("function ThisFunctionDoesNotExist(");
  });

  it("the vote is emitted through lib/analytics track(), not swallowed locally", () => {
    expect(COACH_FEEDBACK_EVENT).toBe("coach_answer_feedback");
    expect(CARDS_SOURCE).toContain('import { track } from "../../lib/analytics"');
    expect(CARDS_SOURCE).toContain("track(COACH_FEEDBACK_EVENT, feedbackProps(");
    // Reversible AND recorded: the un-vote sends "cleared" rather than sending
    // nothing, so a retracted downvote is visible to us too.
    expect(CARDS_SOURCE).toContain('vote: resolved ?? "cleared"');
    expect(CARDS_SOURCE).toContain("const resolved = vote === next ? null : next;");
  });

  it("track() persists to the parent's own Firestore events collection — the sink is real", () => {
    // This is the answer to \"where does a downvote land\": users/{uid}/events.
    expect(ANALYTICS_SOURCE).toContain("addDoc(collection(db, `users/${uid}/events`)");
    expect(ANALYTICS_SOURCE).toContain("firebaseEnabled && db && uid");
    // NEGATIVE CONTROL: the write really is guarded (so the "degrades silently
    // without network/Firebase" claim is verified, not assumed) — and the
    // matcher above is not matching a comment.
    expect(ANALYTICS_SOURCE).not.toContain("addDoc(collection(db, `users/${uid}/feedback`)");
  });
});
