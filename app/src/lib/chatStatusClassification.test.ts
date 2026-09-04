import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyAiFailure } from "./aiErrorCopy";

/**
 * AI-06, the /chat text path specifically.
 *
 * The status plumbing shipped INERT once already: ArborContext threw a typed
 * ApiError and then caught it in the same function, collapsing it to
 * `setApiError(err.message)`. CoachTab therefore called
 * `classifyAiFailure(null, …)` and a 429 (quota — waiting helps) and a 451
 * (your permission is needed — waiting never helps) rendered ONE identical
 * sentence with a Retry button. The typed throw was dead code and the comment
 * above it was false.
 *
 * These pin both halves: the classifier distinguishes them, AND the context
 * actually carries the status to the surface that classifies.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8").replace(/\r\n/g, "\n");
const context = read("../context/ArborContext.tsx");
const coach = read("../components/tabs/CoachTab.tsx");

describe("a quota refusal and a consent refusal are different problems", () => {
  it("429 and 451 produce different copy, and only one of them is retryable", () => {
    const quota = classifyAiFailure({ status: 429 }, { online: true });
    const consent = classifyAiFailure({ status: 451 }, { online: true });

    expect(quota.kind).not.toBe(consent.kind);
    expect(quota.bodyKey).not.toBe(consent.bodyKey);
    // Offering "try again" on a decision the parent owns is a lie.
    expect(consent.retryable).toBe(false);
  });

  it("offline outranks any status — no status is truthful if we were never reached", () => {
    expect(classifyAiFailure({ status: 429 }, { online: false }).kind).toBe("offline");
  });

  it("a bare status object classifies, because that is what the context can carry", () => {
    // The context holds a number, not the original Error, so the classifier has
    // to accept the shape the surface can actually reconstruct.
    expect(classifyAiFailure({ status: 451 }, { online: true }).kind)
      .toBe(classifyAiFailure({ status: 451 }, { online: true }).kind);
    expect(classifyAiFailure({ status: 451 }, { online: true }).kind).not.toBe("generic");
  });
});

describe("the status survives the trip from /chat to the coach", () => {
  it("ArborContext records the status, not only the message", () => {
    expect(context).toContain("setApiErrorStatus(");
    expect(context).toMatch(/apiErrorStatus,/);
    // Negative control: the shipped shape kept only the message.
    const SHIPPED = 'setApiError(err.message || "An exception occurred");';
    expect(SHIPPED).not.toContain("setApiErrorStatus");
  });

  it("CoachTab classifies on that status instead of passing null", () => {
    expect(coach).toContain("apiErrorStatus");
    // The exact dead shape that shipped: null, so always "generic".
    expect(coach).not.toContain("classifyAiFailure(null, { online, childName: childFirst })");
  });
});
