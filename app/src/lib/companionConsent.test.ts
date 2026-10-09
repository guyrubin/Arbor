import { describe, expect, it } from "vitest";
import { companionConsentActive, latestCompanionConsent } from "./companionConsent";
import { buildConsent, COMPANION_CONSENT_POLICY_VERSION, CONSENT_POLICY_VERSION, LocalConsentStore } from "../sharing/consent";

const now = Date.parse("2026-10-09T09:00:00Z");
const grant = () => buildConsent({ childId: "child-a", purpose: "companion_attachments", granted: true, actorUid: "parent-a" }, now);

describe("Companion file consent remains purpose- and child-scoped", () => {
  it("requires a new recorded purpose and policy, without expanding avatar grants", async () => {
    const store = new LocalConsentStore();
    const avatar = buildConsent({ childId: "child-a", purpose: "face_processing", granted: true, actorUid: "parent-a" }, now);
    await store.set(avatar);
    expect(await store.isActive("child-a", "companion_attachments", now)).toBe(false);
    expect(avatar.policyVersion).toBe(CONSENT_POLICY_VERSION);
    const next = grant(); await store.set(next);
    expect(next.policyVersion).toBe(COMPANION_CONSENT_POLICY_VERSION);
    expect(await store.isActive("child-a", "companion_attachments", now)).toBe(true);
    expect(await store.isActive("child-b", "companion_attachments", now)).toBe(false);
    expect(await store.isActive("child-a", "voice_processing", now)).toBe(false);
    expect(await store.isActive("child-a", "ai_training", now)).toBe(false);
    await store.revoke(next.id);
    expect(await store.isActive("child-a", "companion_attachments", now)).toBe(false);
    expect(await store.isActive("child-a", "face_processing", now)).toBe(true);
  });
  it("latest revoked decision wins and other children cannot supply permission", () => {
    const first = grant();
    const last = { ...first, id: "revoked", grantedAt: "2026-10-10T00:00:00Z", revokedAt: "2026-10-10T00:00:00Z" };
    const other = { ...first, childId: "child-b", grantedAt: "2026-10-11T00:00:00Z" };
    expect(latestCompanionConsent([first, other, last], "child-a")).toEqual(last);
    expect(companionConsentActive(last, now)).toBe(false);
    expect(latestCompanionConsent([other], "child-a")).toBeUndefined();
  });
  it("expires at the boundary and fails closed for malformed dates", () => {
    const first = grant();
    expect(companionConsentActive(first, now)).toBe(true);
    expect(companionConsentActive(first, Date.parse(first.expiresAt!))).toBe(false);
    expect(companionConsentActive({ ...first, expiresAt: "not-a-date" }, now)).toBe(false);
    expect(companionConsentActive(undefined, now)).toBe(false);
  });
});
