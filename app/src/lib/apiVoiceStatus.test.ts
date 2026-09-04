/* AI-06 (transport half) — streamVoice used to DESTROY the HTTP status.
 *
 *   if (!res.ok || !res.body) throw new Error("Voice stream failed to start");
 *
 * So a 429 (this account's hour of AI is spent) and a 451 (no parental consent
 * for this child's voice) both arrived at CoachTab as one unrecognisable
 * Error, and the surface "fell back" to browser voice — which calls the same
 * server and gets the same refusal. Nothing downstream could tell a parent
 * which of the two had happened, because nothing downstream still knew.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError, streamVoice } from "./api";
import { classifyAiFailure } from "./aiErrorCopy";
import type { ChildProfile } from "../types";

const child = { id: "c1", name: "Dylan" } as unknown as ChildProfile;

const respond = (status: number, body: unknown, headers: Record<string, string> = {}) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      body: null,
      headers: { get: (n: string) => headers[n] ?? null },
      json: async () => body,
    })),
  );
};

afterEach(() => vi.unstubAllGlobals());

describe("AI-06 — streamVoice preserves the status", () => {
  it("FAILS WITHOUT THE CHANGE — a 429 arrives as an ApiError carrying 429 and Retry-After", async () => {
    respond(429, { error: "AI usage limit reached", details: "hourly limit" }, { "Retry-After": "1800" });
    const err = await streamVoice({ message: "hi", childProfile: child }, () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(429);
    expect((err as ApiError).retryAfterSeconds).toBe(1800);
    // …which is exactly what the copy classifier needs to say "wait 30 minutes".
    const copy = classifyAiFailure(err, { online: true, retryAfterSeconds: (err as ApiError).retryAfterSeconds });
    expect(copy.kind).toBe("quota");
    expect(copy.bodyParams.minutes).toBe(30);
  });

  it("a 451 arrives as an ApiError carrying 451, and classifies as a consent problem", async () => {
    respond(451, { error: "Parental consent required.", purpose: "face_processing", consentRequired: true });
    const err = await streamVoice({ message: "hi", childProfile: child }, () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(451);
    const copy = classifyAiFailure(err, { online: true, childName: "Dylan" });
    expect(copy.kind).toBe("consent");
    expect(copy.retryable).toBe(false);
  });

  it("NEGATIVE CONTROL — the pre-change throw carried no status at all", () => {
    const preFix = new Error("Voice stream failed to start");
    expect(preFix).not.toBeInstanceOf(ApiError);
    expect((preFix as unknown as { status?: number }).status).toBeUndefined();
    // and therefore could only ever classify as the generic "try again".
    expect(classifyAiFailure(preFix, { online: true }).kind).toBe("generic");
  });

  it("an OK response with no readable body still fails, unchanged", async () => {
    respond(200, {});
    const err = await streamVoice({ message: "hi", childProfile: child }, () => {}).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ApiError);
  });
});
