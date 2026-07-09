import { describe, expect, it } from "vitest";
import { isShareActive, expiryFromDuration, buildGrant, LocalShareStore } from "./shares.js";

// Time-relative, not pinned: LocalShareStore filters with real Date.now(), so a
// pinned NOW turns "live" grants into expired ones once the wall clock passes
// NOW+30d (this test time-bombed on 2026-07-06).
const NOW = Date.now();

describe("server-enforced sharing expiry", () => {
  it("isShareActive: live grant is active", () => {
    expect(isShareActive({ expiresAt: new Date(NOW + 1000).toISOString(), revokedAt: null }, NOW)).toBe(true);
  });
  it("isShareActive: expired grant is inactive", () => {
    expect(isShareActive({ expiresAt: new Date(NOW - 1000).toISOString(), revokedAt: null }, NOW)).toBe(false);
  });
  it("isShareActive: revoked grant is inactive even if not expired", () => {
    expect(isShareActive({ expiresAt: null, revokedAt: new Date(NOW - 1).toISOString() }, NOW)).toBe(false);
  });
  it("isShareActive: 'until revoked' (null expiry) stays active", () => {
    expect(isShareActive({ expiresAt: null, revokedAt: null }, NOW)).toBe(true);
  });

  it("expiryFromDuration maps friendly durations", () => {
    expect(expiryFromDuration("never", NOW)).toBeNull();
    expect(expiryFromDuration("Until revoked", NOW)).toBeNull();
    expect(expiryFromDuration("30 days", NOW)).toBe(new Date(NOW + 30 * 86400000).toISOString());
    expect(expiryFromDuration("end of term", NOW)).toBe(new Date(NOW + 90 * 86400000).toISOString());
  });

  it("buildGrant normalizes recipient email and defaults scope", () => {
    const g = buildGrant({ ownerUid: "u1", ownerEmail: "a@b.com", childId: "c1", recipientEmail: "  TEACHER@School.com " }, NOW);
    expect(g.recipientEmail).toBe("teacher@school.com");
    expect(g.scopes).toEqual(["timeline"]);
    expect(g.role).toBe("viewer");
  });
});

describe("LocalShareStore enforces expiry on read", () => {
  it("hides expired and revoked grants from owner + recipient lists", async () => {
    const store = new LocalShareStore();
    const live = await store.create(buildGrant({ ownerUid: "u1", ownerEmail: null, childId: "c1", recipientEmail: "co@x.com", role: "co_parent", duration: "30 days" }, NOW));
    const expired = await store.create({ ...buildGrant({ ownerUid: "u1", ownerEmail: null, childId: "c1", recipientEmail: "co@x.com" }, NOW), expiresAt: new Date(NOW - 1000).toISOString() });

    const owner = await store.listByOwner("u1");
    expect(owner.map((g) => g.id)).toContain(live.id);
    expect(owner.map((g) => g.id)).not.toContain(expired.id);

    const recip = await store.listByRecipient("CO@x.com");
    expect(recip.some((g) => g.id === live.id)).toBe(true);

    // revoke removes it
    await store.revoke(live.id, "u1");
    expect((await store.listByOwner("u1")).length).toBe(0);
  });

  it("won't revoke another owner's grant", async () => {
    const store = new LocalShareStore();
    const g = await store.create(buildGrant({ ownerUid: "u1", ownerEmail: null, childId: "c1", recipientEmail: "co@x.com" }, NOW));
    expect(await store.revoke(g.id, "intruder")).toBeNull();
  });
});
