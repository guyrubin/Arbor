import { describe, expect, it } from "vitest";
import { isShareActive, expiryFromDuration, buildGrant, grantScopes, grantAllowsScope, LocalShareStore } from "./shares.js";

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
    expect(g.scopes).toEqual(["story_timeline"]);
    expect(g.role).toBe("viewer");
  });

  it("buildGrant sends stable duration IDs (the localized UI values) through expiryFromDuration", () => {
    // CARE-3: the client now sends stable duration IDs, never display strings.
    expect(expiryFromDuration("30d", NOW)).toBe(new Date(NOW + 30 * 86400000).toISOString());
    expect(expiryFromDuration("60d", NOW)).toBe(new Date(NOW + 60 * 86400000).toISOString());
    expect(expiryFromDuration("term", NOW)).toBe(new Date(NOW + 90 * 86400000).toISOString());
    expect(expiryFromDuration("until_revoked", NOW)).toBeNull();
  });
});

// ── CARE-3: stable scope IDs — server-enforced, fail-closed migration ────────
describe("CARE-3 stable scope IDs on the grant", () => {
  it("buildGrant stores stable IDs when the client sends stable IDs", () => {
    const g = buildGrant({ ownerUid: "u1", ownerEmail: null, childId: "c1", recipientEmail: "t@x.com", scopes: ["story_timeline", "report_teacher"] }, NOW);
    expect(g.scopes).toEqual(["story_timeline", "report_teacher"]);
  });

  it("buildGrant migrates legacy English display strings to stable IDs", () => {
    const g = buildGrant(
      { ownerUid: "u1", ownerEmail: null, childId: "c1", recipientEmail: "t@x.com", scopes: ["Story timeline", "Weekly Insight", "Teacher Handoff"] },
      NOW,
    );
    expect(g.scopes).toEqual(["story_timeline", "weekly_insight", "report_teacher"]);
  });

  it("FAILS CLOSED: unrecognized scope strings are dropped, never widened to a default", () => {
    const g = buildGrant(
      { ownerUid: "u1", ownerEmail: null, childId: "c1", recipientEmail: "t@x.com", scopes: ["Everything", "full_access", "memory"] },
      NOW,
    );
    expect(g.scopes).toEqual([]); // requested-but-unknown grants NOTHING
  });

  it("grantScopes resolves a legacy stored grant (pre-migration doc) to stable IDs", () => {
    // Direction 1: legacy English labels on an existing Firestore doc.
    expect(grantScopes({ scopes: ["Story timeline", "Pediatrician Summary"] })).toEqual(["story_timeline", "report_pediatrician"]);
    // Direction 2: post-CARE-3 stable IDs pass through untouched.
    expect(grantScopes({ scopes: ["behavior_patterns", "milestones"] })).toEqual(["behavior_patterns", "milestones"]);
    // The old server default "timeline" keeps resolving.
    expect(grantScopes({ scopes: ["timeline"] })).toEqual(["story_timeline"]);
    // Unknown legacy string → NO access.
    expect(grantScopes({ scopes: ["All data"] })).toEqual([]);
  });

  it("grantAllowsScope: live grant + recognized scope only", () => {
    const live = { scopes: ["Story timeline"], expiresAt: null, revokedAt: null };
    expect(grantAllowsScope(live, "story_timeline", NOW)).toBe(true);
    expect(grantAllowsScope(live, "weekly_insight", NOW)).toBe(false);
    // Unrecognized legacy scope grants nothing even on a live grant.
    expect(grantAllowsScope({ scopes: ["Everything"], expiresAt: null, revokedAt: null }, "story_timeline", NOW)).toBe(false);
    // Revoked/expired grants never resolve, whatever their scopes claim.
    expect(grantAllowsScope({ scopes: ["story_timeline"], expiresAt: null, revokedAt: new Date(NOW - 1).toISOString() }, "story_timeline", NOW)).toBe(false);
    expect(grantAllowsScope({ scopes: ["story_timeline"], expiresAt: new Date(NOW - 1000).toISOString(), revokedAt: null }, "story_timeline", NOW)).toBe(false);
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
