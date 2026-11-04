/**
 * B-CAREPRO-41 — a sharing grant scoped by developmental domain.
 *
 * A speech-therapist grant shows the recipient only talking and family-domain
 * lines; an unknown domain unlocks nothing; the parent preview equals the
 * recipient view. The scenario runs the SERVER path (resolveSharedPacket over
 * a stored grant) and the PREVIEW path (buildGrantPacket with the default
 * ceiling the wizard computes) on one synthetic record.
 */
import { describe, expect, it } from "vitest";
import { defaultGrantDomains, grantDomainCeiling, normalizeShareDomains, professionDomains } from "./shareDomains";
import { buildGrant, LocalShareStore } from "../sharing/shares";
import { buildGrantPacket, buildSharedScopePacket, buildPacketInput, scopeRecordToDomains, type RawChildRecord } from "../consult/packet";
import { resolveSharedPacket } from "../server/sharedPacket";

const NOW = Date.parse("2026-10-20T09:00:00Z");
const DAY = 86_400_000;
const at = (d: number) => new Date(NOW - d * DAY).toISOString();
const RECIPIENT = "slp@example.org";

/** Synthetic family: one line per domain the SLP must NOT read, and two it must. */
const RECORD: RawChildRecord = {
  profile: { name: "Noa", age: 3, languages: ["Hebrew"], schoolContext: "Gan Rimon", strengths: ["STRENGTH-MARKER"], challenges: ["CHALLENGE-MARKER"], activeGoals: [{ goalId: "g1", label: "GOAL-MARKER" }] },
  logs: [
    { behaviorType: "Moment", timestamp: at(1), trigger: "Said more juice at breakfast", shelf: "words" } as RawChildRecord["logs"][number],
    { behaviorType: "Moment", timestamp: at(2), trigger: "MOVING-MARKER climbed the slide", shelf: "moving" } as RawChildRecord["logs"][number],
    { behaviorType: "Moment", timestamp: at(2), trigger: "UNFILED-MARKER sang in the bath" },
    { behaviorType: "Sleep Meltdown", intensity: 3, timestamp: at(3), trigger: "TRIGGER-MARKER lights off", response: "RESPONSE-MARKER" },
  ],
  milestones: [
    { domain: "language_communication", title: "Uses two-word phrases", checked: true, observationStatus: "yes", observationUpdatedAt: at(4) },
    { domain: "sensory_motor_patterns", title: "MOTOR-MARKER hops on one foot", checked: true, observationStatus: "yes", observationUpdatedAt: at(5) },
    { domain: "Custom area", title: "CUSTOM-MARKER", checked: true, observationStatus: "yes", observationUpdatedAt: at(5) },
  ],
  plans: [{ title: "PLAN-MARKER calm mornings", issue: "mornings" }],
  memory: [{ fact: "MEMORY-MARKER likes a warning", status: "approved" }],
};
const FORBIDDEN = ["MOVING-MARKER", "UNFILED-MARKER", "TRIGGER-MARKER", "RESPONSE-MARKER", "MOTOR-MARKER", "CUSTOM-MARKER", "PLAN-MARKER", "MEMORY-MARKER", "STRENGTH-MARKER", "CHALLENGE-MARKER", "GOAL-MARKER", "Sleep Meltdown"];

const text = (sections: { items: { text: string }[] }[]) => sections.flatMap((s) => s.items.map((i) => i.text)).join(" | ");
const source = { load: async () => RECORD };

async function slpView(over: Partial<Parameters<typeof buildGrant>[0]> = {}) {
  const store = new LocalShareStore();
  const grant = await store.create(buildGrant({ ownerUid: "owner-1", ownerEmail: "parent@example.org", childId: "child-1", childName: "Noa", recipientEmail: RECIPIENT, role: "professional", scopes: ["report_slp"], duration: "30 days", ...over }, NOW));
  return { grant, result: await resolveSharedPacket({ grantId: grant.id, recipientEmail: RECIPIENT, shareStore: store, source, now: NOW }) };
}

describe("B-CAREPRO-41 · the domain ceiling", () => {
  it("a speech-therapist grant reads talking + family by default; other professions their own", () => {
    expect(defaultGrantDomains("professional", ["report_slp"])).toEqual(["talking", "family"]);
    expect(defaultGrantDomains("professional", ["report_pediatrician"])).toEqual(["moving", "body", "family"]);
    // no profession named, or not a professional: no ceiling (legacy behaviour)
    expect(defaultGrantDomains("professional", ["report_therapist"])).toBeUndefined();
    expect(defaultGrantDomains("co_parent", ["report_slp"])).toBeUndefined();
    expect(professionDomains(["slp"])).toEqual(["talking", "family"]);
  });

  it("unknown domains are dropped — never widened", () => {
    expect(normalizeShareDomains(["talking", "speech", "TALKING", 7, null, "family", "talking"])).toEqual(["talking", "family"]);
    expect(grantDomainCeiling({})).toBeNull();
    expect(grantDomainCeiling({ domains: ["nonsense"] })).toEqual([]);
  });

  it("critic r1: a professional grant stored before ceilings existed reads its profession's domains + family, not the whole record", () => {
    expect(grantDomainCeiling({ role: "professional", scopes: ["report_slp"] })).toEqual(["talking", "family"]);
    expect(grantDomainCeiling({ role: "professional", scopes: ["report_slp"], domains: null })).toEqual(["talking", "family"]);
    // a stored ceiling still wins, and non-professional grants keep none
    expect(grantDomainCeiling({ role: "professional", scopes: ["report_slp"], domains: ["moving"] })).toEqual(["moving"]);
    expect(grantDomainCeiling({ role: "co_parent", scopes: ["story_timeline"] })).toBeNull();
    expect(grantDomainCeiling({ role: "professional", scopes: ["report_therapist"] })).toBeNull();
  });

  it("buildGrant stores the default ceiling for a professional report grant, the request's ceiling otherwise", () => {
    const base = { ownerUid: "o", ownerEmail: null, childId: "c", recipientEmail: RECIPIENT };
    expect(buildGrant({ ...base, role: "professional", scopes: ["report_slp"] }, NOW).domains).toEqual(["talking", "family"]);
    expect(buildGrant({ ...base, role: "professional", scopes: ["report_slp"], domains: ["moving", "bogus"] }, NOW).domains).toEqual(["moving"]);
    expect(buildGrant({ ...base, role: "professional", scopes: ["report_slp"], domains: ["bogus"] }, NOW).domains).toEqual([]);
    expect("domains" in buildGrant({ ...base, role: "co_parent", scopes: ["story_timeline"] }, NOW)).toBe(false);
  });
});

describe("B-CAREPRO-41 · a speech-therapist grant shows only talking and family lines", () => {
  it("the recipient reads the talking milestone, the words-shelf moment and the setting — nothing else", async () => {
    const { grant, result } = await slpView();
    expect(grant.domains).toEqual(["talking", "family"]);
    expect(result.status).toBe(200);
    if (result.status !== 200) throw new Error("unreachable");
    const shown = text(result.view.sections);
    expect(shown).toContain("Uses two-word phrases");
    expect(shown).toContain("Said more juice at breakfast");
    expect(shown).toContain("Gan Rimon");
    for (const marker of FORBIDDEN) expect(shown, marker).not.toContain(marker);
  });

  it("NEGATIVE CONTROL: the same grant without a ceiling (pre-change) reads the whole record", async () => {
    const pre = buildSharedScopePacket(["report_slp"], true, buildPacketInput(RECORD, NOW));
    const shown = text(pre.sections);
    expect(FORBIDDEN.filter((m) => shown.includes(m)).length).toBeGreaterThan(4);
  });

  it("an unknown domain unlocks nothing: the recipient gets 403, the preview builds no section", async () => {
    const { grant, result } = await slpView({ domains: ["speech"] });
    expect(grant.domains).toEqual([]);
    expect(result.status).toBe(403);
    expect(buildGrantPacket({ role: "professional", scopes: ["report_slp"], domains: ["speech"] }, RECORD, NOW).sections).toEqual([]);
  });

  it("the parent's preview (the wizard's default ceiling) equals the recipient's view", async () => {
    const { result } = await slpView();
    if (result.status !== 200) throw new Error("unreachable");
    const preview = buildGrantPacket({ role: "professional", scopes: ["report_slp"], domains: defaultGrantDomains("professional", ["report_slp"]) }, RECORD, NOW);
    expect(preview.sections).toEqual(result.view.sections);
  });

  it("the record filter is pure and keeps the child's basics", () => {
    const scoped = scopeRecordToDomains(RECORD, ["talking"]);
    expect(scoped.profile.name).toBe("Noa");
    expect(scoped.profile.schoolContext).toBeUndefined(); // no family context asked for
    expect(scoped.logs.map((l) => l.trigger)).toEqual(["Said more juice at breakfast"]);
    expect(scoped.milestones.map((m) => m.title)).toEqual(["Uses two-word phrases"]);
    expect(scoped.plans).toEqual([]);
    expect(scoped.memory).toEqual([]);
    expect(RECORD.logs).toHaveLength(4); // input untouched
  });

  it("critic r1: a professional grant stored before ceilings (no domains) reads what a new one does — never the whole record", async () => {
    const store = new LocalShareStore();
    const grant = buildGrant({ ownerUid: "owner-1", ownerEmail: null, childId: "child-1", recipientEmail: RECIPIENT, role: "professional", scopes: ["report_slp"] }, NOW);
    const { domains: _d, ...legacy } = grant;
    const fresh = buildGrant({ ownerUid: "owner-1", ownerEmail: null, childId: "child-1", recipientEmail: RECIPIENT, role: "professional", scopes: ["report_slp"] }, NOW);
    await store.create(legacy);
    await store.create(fresh);
    const old = await resolveSharedPacket({ grantId: legacy.id, recipientEmail: RECIPIENT, shareStore: store, source, now: NOW });
    const now = await resolveSharedPacket({ grantId: fresh.id, recipientEmail: RECIPIENT, shareStore: store, source, now: NOW });
    if (old.status !== 200 || now.status !== 200) throw new Error("unreachable");
    expect(text(old.view.sections)).not.toContain("PLAN-MARKER");
    expect(text(old.view.sections)).toBe(text(now.view.sections));
  });

  it("NEGATIVE CONTROL: with no ceiling at all the same legacy grant would read the plan line", () => {
    // r1's legacy path: no ceiling → the whole record into the professional packet.
    expect(text(buildSharedScopePacket(["report_slp"], true, buildPacketInput(RECORD, NOW)).sections)).toContain("PLAN-MARKER");
  });
});
