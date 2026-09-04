/* AI-06 / AI-24 — a 429 and a 451 are not the same failure.
 *
 *   429  the account has spent its hour of AI. It fixes ITSELF; the honest
 *        advice is "wait, nothing is lost", and Retry-After says how long.
 *   451  fail-closed: no parental consent grant for this child's photo/voice.
 *        Waiting NEVER fixes it. Telling a parent to "try again" here is a
 *        lie about a consent decision that is theirs to make.
 *
 * Before this both rendered one sentence with one Retry button.
 */
import { describe, it, expect } from "vitest";
import { ApiError, EscalationRequiredError, PaywallError } from "./api";
import { CONSENT_STATUS, QUOTA_STATUS, classifyAiFailure, retryAfterSeconds } from "./aiErrorCopy";

const quota = () => new ApiError("You've reached the hourly AI limit (25 requests).", 429, 2_400);
const consent = () => new ApiError("Parental consent required.", 451);

describe("AI-06 — 429 and 451 never collapse into one message", () => {
  it("FAILS WITHOUT THE CHANGE — the two produce different titles, bodies and affordances", () => {
    const q = classifyAiFailure(quota(), { online: true, childName: "Dylan" });
    const c = classifyAiFailure(consent(), { online: true, childName: "Dylan" });

    expect(q.kind).toBe("quota");
    expect(c.kind).toBe("consent");
    expect(q.titleKey).not.toBe(c.titleKey);
    expect(q.bodyKey).not.toBe(c.bodyKey);

    // Only the consent case has somewhere to send the parent.
    expect(c.actionRoute).toBe("profile");
    expect(c.actionKey).toBe("elev.aierrors.consent.cta");
    expect(q.actionRoute).toBeUndefined();

    // NEITHER offers "try again": one needs time, the other needs permission.
    expect(q.retryable).toBe(false);
    expect(c.retryable).toBe(false);
  });

  it("NEGATIVE CONTROL — the pre-change behaviour (one generic message for both) is what this rejects", () => {
    const generic = classifyAiFailure(new Error("Server response failed"), { online: true });
    expect(generic.kind).toBe("generic");
    expect(generic.retryable).toBe(true);
    // The old card rendered THIS for a 429 and a 451 too. It no longer can:
    expect(classifyAiFailure(quota()).bodyKey).not.toBe(generic.bodyKey);
    expect(classifyAiFailure(consent()).bodyKey).not.toBe(generic.bodyKey);
  });

  it("the quota wait is concrete when Retry-After is present, and honestly vague when it is not", () => {
    // 2400s → 40 minutes.
    const withHeader = classifyAiFailure(quota(), { retryAfterSeconds: 2_400 });
    expect(withHeader.bodyKey).toBe("elev.aierrors.quota.bodyMinutes");
    expect(withHeader.bodyParams.minutes).toBe(40);
    // A sub-minute wait still reads as at least a minute, never "0 minutes".
    expect(classifyAiFailure(quota(), { retryAfterSeconds: 5 }).bodyParams.minutes).toBe(1);
    // No header → no invented number.
    const without = classifyAiFailure(new ApiError("limit", 429), {});
    expect(without.bodyKey).toBe("elev.aierrors.quota.body");
    expect(without.bodyParams).toEqual({});
  });

  it("the consent copy is about THIS child, by name", () => {
    expect(classifyAiFailure(consent(), { childName: "Dylan" }).bodyParams.name).toBe("Dylan");
    // …and degrades to an empty interpolation rather than a placeholder leak.
    expect(classifyAiFailure(consent(), {}).bodyParams.name).toBe("");
  });

  it("never carries the server's own words into the copy", () => {
    const c = classifyAiFailure(consent(), { childName: "Dylan" });
    const serialized = JSON.stringify(c);
    expect(serialized).not.toContain("Parental consent required.");
    expect(JSON.stringify(classifyAiFailure(quota()))).not.toContain("hourly AI limit");
  });

  it("statuses the app routes elsewhere are classified, not mislabelled as generic", () => {
    expect(classifyAiFailure(new PaywallError("upgrade", { plan: "plus" })).kind).toBe("paywall");
    expect(classifyAiFailure(new EscalationRequiredError("escalate")).kind).toBe("escalation");
    expect(QUOTA_STATUS).toBe(429);
    expect(CONSENT_STATUS).toBe(451);
  });
});

describe("AI-24 — offline is a state, and it outranks any status", () => {
  it("an offline device is told it is offline, never that its account is rate-limited", () => {
    const off = classifyAiFailure(quota(), { online: false });
    expect(off.kind).toBe("offline");
    expect(off.titleKey).toBe("elev.aierrors.offline.title");
    expect(off.retryable).toBe(false);
    // Same for a bare network TypeError, which is what fetch throws offline.
    expect(classifyAiFailure(new TypeError("Failed to fetch"), { online: false }).kind).toBe("offline");
  });

  it("NEGATIVE CONTROL — with no online signal the same error is NOT called offline", () => {
    expect(classifyAiFailure(new TypeError("Failed to fetch"), {}).kind).toBe("generic");
    expect(classifyAiFailure(quota(), { online: true }).kind).toBe("quota");
  });
});

describe("retryAfterSeconds", () => {
  it("parses the seconds form and refuses everything else", () => {
    expect(retryAfterSeconds("2400")).toBe(2_400);
    expect(retryAfterSeconds(" 60 ")).toBe(60);
    expect(retryAfterSeconds("0")).toBeUndefined();
    expect(retryAfterSeconds("Wed, 21 Oct 2026 07:28:00 GMT")).toBeUndefined();
    expect(retryAfterSeconds(null)).toBeUndefined();
  });
});
