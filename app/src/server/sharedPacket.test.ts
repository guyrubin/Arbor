/**
 * CARE-2 — recipient shared view v0.
 *
 * Covers the acceptance criteria:
 *  - the recipient sees EXACTLY the granted scopes (scope-filtering tests);
 *  - revoked/expired/misaddressed grants return 403 (server-enforced);
 *  - a legacy grant whose scopes fail-closed to nothing returns 403;
 *  - NO raw subcollection documents reach a recipient — the only recipient
 *    endpoint (GET /shared/:grantId/packet) emits resolveSharedPacket's view,
 *    and this suite proves that view carries only derived, counts-only packet
 *    lines (no raw log/milestone/plan fields or values);
 *  - the fail-closed egress guards run on every payload: forbidden tokens
 *    block everyone, the clinical-diagnosis term scan blocks non-clinician
 *    recipients (co_parent/viewer), clinicians stay exempt by policy.
 */
import { describe, expect, it } from "vitest";
import { buildGrant, LocalShareStore, type ShareGrant } from "../sharing/shares.js";
import { buildSharedScopePacket, type BuildPacketInput } from "../consult/packet.js";
import { NullSharedChildSource, resolveSharedPacket, type SharedChildRecord } from "./sharedPacket.js";

const NOW = Date.now();
const OWNER = { ownerUid: "owner-1", ownerEmail: "owner@example.com" };
const RECIPIENT = "coparent@example.com";

// Distinctive raw-only markers: none of these may ever appear in a recipient view.
const RAW_TRIGGER = "RAW-TRIGGER-MARKER-7f3";
const RAW_RESPONSE = "RAW-RESPONSE-MARKER-9c1";

const record = (over: Partial<SharedChildRecord> = {}): SharedChildRecord => ({
  profile: { name: "Mia", age: 4, languages: ["Hebrew", "English"], schoolContext: "Gan Tamar", strengths: ["curious"], challenges: ["morning transitions"] },
  logs: [
    { behaviorType: "Morning refusal", intensity: 2, timestamp: new Date(NOW - 2 * 86400000).toISOString(), trigger: RAW_TRIGGER, response: RAW_RESPONSE, resolved: true },
    { behaviorType: "Morning refusal", intensity: 3, timestamp: new Date(NOW - 3 * 86400000).toISOString(), trigger: RAW_TRIGGER },
  ],
  milestones: [
    { domain: "Language", title: "Uses full sentences", checked: true },
    { domain: "Motor", title: "Hops on one foot", checked: false },
  ],
  plans: [{ title: "Calm mornings plan", issue: "morning transitions" }],
  memory: [{ fact: "Transitions go better with a 5-minute warning.", status: "approved" }],
  ...over,
});

class FakeSource {
  constructor(private readonly rec: SharedChildRecord | null) {}
  async load() { return this.rec; }
}

const makeGrant = async (store: LocalShareStore, over: Partial<Parameters<typeof buildGrant>[0]> = {}, patch: Partial<ShareGrant> = {}) => {
  const grant = buildGrant({ ...OWNER, childId: "child-1", childName: "Mia", recipientEmail: RECIPIENT, role: "co_parent", scopes: ["story_timeline"], duration: "30 days", ...over }, NOW);
  const stored = { ...grant, ...patch };
  await store.create(stored);
  return stored;
};

const resolve = (store: LocalShareStore, grantId: string, email: string | null, rec: SharedChildRecord | null = record()) =>
  resolveSharedPacket({ grantId, recipientEmail: email, shareStore: store, source: new FakeSource(rec), now: NOW });

describe("CARE-2 resolveSharedPacket — authorization (fail closed)", () => {
  it("unknown grant → 404", async () => {
    const store = new LocalShareStore();
    const r = await resolve(store, "nope", RECIPIENT);
    expect(r.status).toBe(404);
  });

  it("missing recipient email (unauthenticated) → 403", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store);
    const r = await resolve(store, g.id, null);
    expect(r.status).toBe(403);
  });

  it("wrong recipient email → 403", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store);
    const r = await resolve(store, g.id, "stranger@example.com");
    expect(r.status).toBe(403);
  });

  it("recipient email matches case-insensitively", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store);
    const r = await resolve(store, g.id, "CoParent@Example.COM");
    expect(r.status).toBe(200);
  });

  it("revoked grant → 403", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, {}, { revokedAt: new Date(NOW - 1000).toISOString() });
    const r = await resolve(store, g.id, RECIPIENT);
    expect(r.status).toBe(403);
  });

  it("expired grant → 403", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, {}, { expiresAt: new Date(NOW - 1000).toISOString() });
    const r = await resolve(store, g.id, RECIPIENT);
    expect(r.status).toBe(403);
  });

  it("legacy grant whose scopes fail-closed to nothing → 403, never a broader default", async () => {
    const store = new LocalShareStore();
    // Simulate a pre-CARE-3 grant carrying an unrecognized stored scope string.
    const g = await makeGrant(store, {}, { scopes: ["Everything", "Full record"] });
    const r = await resolve(store, g.id, RECIPIENT);
    expect(r.status).toBe(403);
  });

  it("no server-side child record → 404 (local adapter / deleted child)", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store);
    const r = await resolveSharedPacket({ grantId: g.id, recipientEmail: RECIPIENT, shareStore: store, source: new NullSharedChildSource(), now: NOW });
    expect(r.status).toBe(404);
  });
});

describe("CARE-2 resolveSharedPacket — the recipient sees EXACTLY the granted scopes", () => {
  const sectionIds = async (scopes: string[], role: "co_parent" | "viewer" | "professional" = "co_parent") => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, { scopes, role });
    const r = await resolve(store, g.id, RECIPIENT);
    expect(r.status).toBe(200);
    if (r.status !== 200) throw new Error("unreachable");
    return r.view.sections.map((s) => s.id);
  };

  it("story_timeline → the counts-only patterns section, nothing else", async () => {
    expect(await sectionIds(["story_timeline"])).toEqual(["patterns"]);
  });

  it("behavior_patterns → patterns only", async () => {
    expect(await sectionIds(["behavior_patterns"])).toEqual(["patterns"]);
  });

  it("milestones → development snapshot only (counts, no about/tried/memory)", async () => {
    expect(await sectionIds(["milestones"])).toEqual(["development"]);
  });

  it("weekly_insight → patterns + development", async () => {
    expect(await sectionIds(["weekly_insight"])).toEqual(["patterns", "development"]);
  });

  it("report_teacher → exactly the teacher preset ceiling (about + tried)", async () => {
    expect(await sectionIds(["report_teacher"])).toEqual(["about", "tried"]);
  });

  it("report_therapist (professional) → the clinician preset ceiling", async () => {
    expect(await sectionIds(["report_therapist"], "professional")).toEqual(["about", "patterns", "development", "tried", "memory"]);
  });

  it("pre-CARE-3 legacy English labels resolve through the fail-closed map", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, {}, { scopes: ["Story timeline", "Bogus scope"] });
    const r = await resolve(store, g.id, RECIPIENT);
    expect(r.status).toBe(200);
    if (r.status !== 200) throw new Error("unreachable");
    expect(r.view.scopes).toEqual(["story_timeline"]);
    expect(r.view.sections.map((s) => s.id)).toEqual(["patterns"]);
  });
});

describe("CARE-2 — no raw subcollection documents ever reach a recipient", () => {
  it("the recipient view carries only derived counts-only lines — no raw log fields or values", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, { scopes: ["story_timeline", "weekly_insight", "behavior_patterns", "milestones"] });
    const r = await resolve(store, g.id, RECIPIENT);
    expect(r.status).toBe(200);
    if (r.status !== 200) throw new Error("unreachable");
    const payload = JSON.stringify(r.view);
    // Raw behavior-log field NAMES must not appear as payload keys...
    for (const rawKey of ["behaviorType", "intensity", "durationMinutes", "trigger", "response", "resolved", "timestamp", "photoAttachment", "resolutionNotes", "behaviorLogs"]) {
      expect(payload, `raw field "${rawKey}" leaked to a recipient`).not.toContain(`"${rawKey}"`);
    }
    // ...and raw field VALUES must not appear either.
    expect(payload).not.toContain(RAW_TRIGGER);
    expect(payload).not.toContain(RAW_RESPONSE);
    // Every emitted item is a derived string line, not a document.
    for (const section of r.view.sections) {
      for (const item of section.items) {
        expect(Object.keys(item).sort()).toEqual(["id", "text"]);
        expect(typeof item.text).toBe("string");
      }
    }
  });

  it("counts-only by construction: patterns lines are frequency counts, development lines are x/y counts", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, { scopes: ["behavior_patterns", "milestones"] });
    const r = await resolve(store, g.id, RECIPIENT);
    expect(r.status).toBe(200);
    if (r.status !== 200) throw new Error("unreachable");
    const text = r.view.sections.flatMap((s) => s.items.map((i) => i.text)).join("\n");
    expect(text).toContain("2 times");            // derived frequency count
    expect(text).toContain("1 of 2");             // derived milestone count
    expect(text).not.toMatch(/\d+(\.\d+)?\s*%/);  // never a percentage
  });
});

describe("CARE-2 — fail-closed egress guards run on every payload", () => {
  it("forbidden token in the assembled payload → 422, content never echoed", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, { scopes: ["behavior_patterns"] });
    const poisoned = record({
      logs: [{ behaviorType: "riskLevel spike", intensity: 2, timestamp: new Date(NOW - 86400000).toISOString() }],
    });
    const r = await resolve(store, g.id, RECIPIENT, poisoned);
    expect(r.status).toBe(422);
    expect(JSON.stringify(r)).not.toContain("riskLevel");
  });

  it("clinical-diagnosis term blocks a NON-clinician recipient (fail closed)", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, { scopes: ["behavior_patterns"], role: "viewer" });
    const poisoned = record({
      logs: [{ behaviorType: "ADHD meltdown", intensity: 2, timestamp: new Date(NOW - 86400000).toISOString() }],
    });
    const r = await resolve(store, g.id, RECIPIENT, poisoned);
    expect(r.status).toBe(422);
    expect(JSON.stringify(r)).not.toContain("ADHD");
  });

  it("clinician recipient (professional) is term-scan exempt by policy — same as the therapist preset", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, { scopes: ["report_therapist"], role: "professional" });
    const poisoned = record({
      logs: [{ behaviorType: "Speech delay concern", intensity: 2, timestamp: new Date(NOW - 86400000).toISOString() }],
    });
    const r = await resolve(store, g.id, RECIPIENT, poisoned);
    expect(r.status).toBe(200);
  });

  it("forbidden tokens still block clinicians — no audience is exempt", async () => {
    const store = new LocalShareStore();
    const g = await makeGrant(store, { scopes: ["report_therapist"], role: "professional" });
    const poisoned = record({
      memory: [{ fact: "milestonesPercent was 80", status: "approved" }],
    });
    const r = await resolve(store, g.id, RECIPIENT, poisoned);
    expect(r.status).toBe(422);
  });
});

describe("CARE-2 buildSharedScopePacket — scope→section mapping fails closed", () => {
  const input: BuildPacketInput = { ...record(), nowMs: NOW };

  it("unknown scope strings unlock nothing", () => {
    const p = buildSharedScopePacket(["not_a_scope"], false, input);
    expect(p.sections).toEqual([]);
  });

  it("empty scope list unlocks nothing", () => {
    const p = buildSharedScopePacket([], false, input);
    expect(p.sections).toEqual([]);
  });

  it("scopes union without duplication", () => {
    const p = buildSharedScopePacket(["story_timeline", "behavior_patterns", "milestones"], false, input);
    expect(p.sections.map((s) => s.id)).toEqual(["patterns", "development"]);
  });
});
