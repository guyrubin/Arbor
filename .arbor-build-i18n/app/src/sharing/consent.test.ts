import { describe, it, expect } from "vitest";
import { buildConsent, isConsentActive, LocalConsentStore } from "./consent";

describe("consent grant model", () => {
  it("buildConsent: a granted processing consent is time-boxed; a denial is revoked", () => {
    const now = Date.UTC(2026, 5, 1);
    const face = buildConsent({ childId: "k1", purpose: "face_processing", granted: true, actorUid: "u1" }, now);
    expect(face.granted).toBe(true);
    expect(face.revokedAt).toBeNull();
    expect(face.expiresAt).not.toBeNull(); // ~365d
    expect(new Date(face.expiresAt!).getTime()).toBeGreaterThan(now);

    const train = buildConsent({ childId: "k1", purpose: "ai_training", granted: true, actorUid: "u1" }, now);
    expect(train.expiresAt).toBeNull(); // standing preference, no expiry

    const denied = buildConsent({ childId: "k1", purpose: "face_processing", granted: false, actorUid: "u1" }, now);
    expect(denied.granted).toBe(false);
    expect(denied.revokedAt).not.toBeNull();
  });

  it("isConsentActive: true only while granted, unrevoked, unexpired", () => {
    const now = 1_000_000;
    expect(isConsentActive({ granted: true, expiresAt: null, revokedAt: null }, now)).toBe(true);
    expect(isConsentActive({ granted: false, expiresAt: null, revokedAt: null }, now)).toBe(false);
    expect(isConsentActive({ granted: true, expiresAt: null, revokedAt: new Date(now - 1).toISOString() }, now)).toBe(false);
    expect(isConsentActive({ granted: true, expiresAt: new Date(now - 1).toISOString(), revokedAt: null }, now)).toBe(false);
    expect(isConsentActive(undefined, now)).toBe(false);
  });
});

describe("LocalConsentStore", () => {
  it("set/list/isActive/revoke/eraseByChild round-trip, latest grant wins", async () => {
    const store = new LocalConsentStore();
    expect(await store.isActive("k1", "face_processing")).toBe(false);

    const g = await store.set(buildConsent({ childId: "k1", purpose: "face_processing", granted: true, actorUid: "u1" }));
    expect(await store.isActive("k1", "face_processing")).toBe(true);
    expect(await store.isActive("k1", "voice_processing")).toBe(false); // purpose-scoped

    // a later denial supersedes the earlier grant
    await store.set(buildConsent({ childId: "k1", purpose: "face_processing", granted: false, actorUid: "u1" }, Date.now() + 1000));
    expect(await store.isActive("k1", "face_processing")).toBe(false);

    await store.revoke(g.id);
    const erased = await store.eraseByChild("k1");
    expect(erased).toBeGreaterThanOrEqual(2);
    expect(await store.list("k1")).toHaveLength(0);
  });

  it("isolates children", async () => {
    const store = new LocalConsentStore();
    await store.set(buildConsent({ childId: "k1", purpose: "face_processing", granted: true, actorUid: "u1" }));
    expect(await store.isActive("k2", "face_processing")).toBe(false);
  });
});
