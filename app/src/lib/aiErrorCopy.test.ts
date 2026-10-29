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
import { ApiError, EscalationRequiredError, LIVE_RESTING, PaywallError } from "./api";
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
  it("file consent returns to the pending draft, not the unrelated avatar profile", () => {
    const result = classifyAiFailure(consent(), { childName: "Dylan", consentPurpose: "companion_attachments" });
    expect(result.bodyKey).toBe("elev.aierrors.files.body");
    expect(result.actionKey).toBe("elev.aierrors.files.cta");
    expect(result.actionRoute).toBeUndefined(); expect(result.retryable).toBe(false);
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

describe("B-AIOPS-02 — the family voice allowance is its own failure, not the hourly quota", () => {
  it("live_resting renders voice-resting copy with no retry and no minutes countdown", () => {
    const v = classifyAiFailure(new ApiError(LIVE_RESTING, 429), { online: true });
    expect(v.kind).toBe("voiceResting");
    expect(v.titleKey).toBe("elev.aierrors.voiceResting.title");
    expect(v.bodyKey).toBe("elev.aierrors.voiceResting.body");
    expect(v.retryable).toBe(false);
    expect(v.actionRoute).toBeUndefined();
    // Any other 429 keeps the hourly-quota copy.
    expect(classifyAiFailure(quota(), { online: true }).kind).toBe("quota");
    // Offline still outranks it.
    expect(classifyAiFailure(new ApiError(LIVE_RESTING, 429), { online: false }).kind).toBe("offline");
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

describe("B-ASKJB-49 — a 409 says what it is and sends the parent to Safety", () => {
  it("the escalation copy is the professional-support title, the danger line and the Safety door, never 'try again'", () => {
    const e = classifyAiFailure(new EscalationRequiredError("Professional support recommended", { category: "caregiver_distress" }), { online: true });
    expect(e.kind).toBe("escalation");
    expect(e.titleKey).toBe("beh.escalation.title");
    expect(e.bodyKey).toBe("elev.safety.crisis.danger");
    expect(e.actionKey).toBe("elev.safety.open");
    expect(e.actionRoute).toBe("safety");
    expect(e.retryable).toBe(false);
    // Negative control: the generic copy is what a 409 used to get.
    expect(classifyAiFailure(new ApiError("boom", 500)).titleKey).toBe("elev.aierrors.generic.title");
    expect(e.titleKey).not.toBe("elev.aierrors.generic.title");
    // Never the server's English words.
    expect(JSON.stringify(e)).not.toContain("Professional support recommended");
  });

  it("wave 4: a non-crisis 409 (its own code) is never the crisis copy", () => {
    for (const code of ["hero_missing", "live_renewal_invalid", "seat_in_use"]) {
      const e = classifyAiFailure(new ApiError(code, 409), { online: true });
      expect(e.kind, code).toBe("generic");
      expect(e.titleKey, code).not.toBe("beh.escalation.title");
      expect(e.actionRoute, code).toBeUndefined();
    }
    // Negative control: the crisis error still is.
    expect(classifyAiFailure(new EscalationRequiredError("x"), { online: true }).kind).toBe("escalation");
  });

  it("round 2: fail closed — any other 409 ApiError keeps the crisis copy", () => {
    // A raw-fetch path (streamVoice, the /chat stream) builds ApiError from the
    // status and the server's words; that must never read as "try again".
    for (const message of ["Professional support recommended", "Request failed", "something_new", "HERO_MISSING", ""]) {
      const e = classifyAiFailure(new ApiError(message, 409), { online: true });
      expect(e.kind, message).toBe("escalation");
      expect(e.titleKey, message).toBe("beh.escalation.title");
      expect(e.actionRoute, message).toBe("safety");
      expect(e.retryable, message).toBe(false);
    }
  });
});
