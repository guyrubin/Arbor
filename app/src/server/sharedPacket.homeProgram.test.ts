/**
 * B-PROG-09 (read link, server) — the professional opens the parent's
 * home-program link and reads ONLY the home program: practice days as counts
 * and the goals in the family's words, read-only, EN + HE. Any other scope on
 * that link answers 403, and revoke ends it at once.
 *
 * Old code fails here: `home-program-adherence` was not a recognised scope,
 * so a home-program grant resolved to no scope and every open answered 403
 * (the link never worked), and the server never read `programs` /
 * `familyGoals`.
 */
import { describe, expect, it } from "vitest";
import { buildGrant, LocalShareStore, type ShareGrant } from "../sharing/shares.js";
import { buildPacketInput, buildSharedScopePacket, itemText, sectionTitle } from "../consult/packet.js";
import { HOME_PROGRAM_SCOPE_ID, normalizeScopes } from "../lib/shareScopes.js";
import { acceptProposedGoal, startHomeProgram, toggleExerciseDay } from "../content/programs/homeProgram.js";
import { scoreGoal, type FamilyGoal } from "../lib/goals.js";
import { translate } from "../lib/i18n.js";
import { loopFirewallHits } from "../lib/loop/firewall.js";
import { resolveSharedPacket, type SharedChildRecord, type SharedChildRecordSource } from "./sharedPacket.js";

const NOW = new Date(2026, 9, 14, 10).getTime();
const PRO = "slp@example.com";
const OWNER = { ownerUid: "owner-1", ownerEmail: "owner@example.com" };
const PRIVATE_MOMENT = "PRIVATE-MOMENT-MARKER-4b2";

const SCALE = { "-2": "Not at all", "-1": "Once or twice", "0": "Some days", "1": "Most days", "2": "Every day" };
const started = startHomeProgram([], {
  profession: "slp",
  exercises: [{ text: "Name the toy, then wait" }, { text: "Sing the bath song with a gap" }],
}, new Date(2026, 9, 8, 9));
if (!("enrolment" in started)) throw new Error("no enrolment");
let enrolment = started.enrolment;
enrolment = toggleExerciseDay(enrolment, enrolment.home.exercises[0].id, new Date(2026, 9, 12, 9));
enrolment = toggleExerciseDay(enrolment, enrolment.home.exercises[0].id, new Date(2026, 9, 13, 9));
const accepted = acceptProposedGoal([], { text: "Asks for more with a word", scale: SCALE }, "slp", new Date(2026, 9, 8, 9));
if (!("goal" in accepted)) throw new Error("no goal");
const goals: FamilyGoal[] = [scoreGoal(accepted.goal, 1, new Date(2026, 9, 13, 20))];

const record = (): SharedChildRecord => ({
  profile: { name: "Mia", age: 2, languages: ["Hebrew"], strengths: [], challenges: [] },
  logs: [{ behaviorType: "Moment", intensity: 1, timestamp: new Date(NOW - 86400000).toISOString(), trigger: PRIVATE_MOMENT, resolved: true }],
  milestones: [{ domain: "Language", title: "Says two words together", checked: true }],
  plans: [{ title: "Calm mornings plan", issue: "mornings" }],
  memory: [{ fact: "Transitions go better with a warning.", status: "approved" }],
  programs: [enrolment],
  familyGoals: goals,
});

/** Records which sub-collections a load asked for. */
class SpySource implements SharedChildRecordSource {
  calls: { homeProgram?: boolean }[] = [];
  async load(_owner: string, _child: string, opts?: { homeProgram?: boolean }) {
    this.calls.push(opts ?? {});
    const r = record();
    // A non-home-program load never carries the two sub-collections.
    if (!opts?.homeProgram) { delete r.programs; delete r.familyGoals; }
    return r;
  }
}

const grant = async (store: LocalShareStore, scopes: string[], patch: Partial<ShareGrant> = {}) => {
  const g = { ...buildGrant({ ...OWNER, childId: "child-1", childName: "Mia", recipientEmail: PRO, role: "professional", scopes, duration: "until_revoked" }, NOW), ...patch };
  await store.create(g);
  return g;
};
const open = (store: LocalShareStore, id: string, source: SharedChildRecordSource, requestedScope?: string | null, now = NOW) =>
  resolveSharedPacket({ grantId: id, recipientEmail: PRO, shareStore: store, source, now, requestedScope });

describe("B-PROG-09 read link · the scope is real now", () => {
  it("the server recognises the scope (it used to drop it: fail closed → 403)", () => {
    expect(normalizeScopes([HOME_PROGRAM_SCOPE_ID])).toEqual([HOME_PROGRAM_SCOPE_ID]);
  });
});

describe("B-PROG-09 read link · the professional sees the home program and nothing else", () => {
  it("a live home-program grant → 200 with ONLY the home-program section, read from programs + familyGoals", async () => {
    const store = new LocalShareStore();
    const source = new SpySource();
    const g = await grant(store, [HOME_PROGRAM_SCOPE_ID]);
    const r = await open(store, g.id, source, HOME_PROGRAM_SCOPE_ID);
    expect(r.status).toBe(200);
    if (r.status !== 200) return;
    expect(r.view.sections.map((s) => s.id)).toEqual(["intake-home-program"]);
    expect(source.calls).toEqual([{ homeProgram: true }]);
    const lines = r.view.sections[0].items.map((it) => it.text);
    expect(lines[0]).toMatch(/^Home program · Speech therapist: week 1 of \d+ · practice days 2\/7 this week · 2 practice days since/);
    expect(lines).toContain("Name the toy, then wait: done on 2 days");
    expect(lines).toContain("Sing the bath song with a gap: not marked yet");
    expect(lines).toContain("Asks for more with a word · Proposed by the speech therapist · last marked, in the family's words: “Most days”");
    // the family-set NUMBER never rides this link (the family's own word does)
    expect(lines.join(" ")).not.toMatch(/\+1/);
    const all = JSON.stringify(r.view);
    for (const marker of [PRIVATE_MOMENT, "Calm mornings plan", "Transitions go better", "Says two words together"]) expect(all).not.toContain(marker);
    expect(all).not.toMatch(/%/);
    expect(loopFirewallHits(lines.join("\n"))).toEqual([]);
  });

  it("HE: the same lines re-render in Hebrew for a Hebrew reader (keys travel with the lines)", async () => {
    const store = new LocalShareStore();
    const g = await grant(store, [HOME_PROGRAM_SCOPE_ID]);
    const r = await open(store, g.id, new SpySource(), HOME_PROGRAM_SCOPE_ID);
    if (r.status !== 200) throw new Error(String(r.status));
    const section = r.view.sections[0];
    expect(sectionTitle(section, "he")).toBe(translate("he", "elev.homeProgram.pro.line"));
    const he = section.items.map((it) => itemText(it, "he"));
    expect(he[0]).toContain(translate("he", "elev.homeProgram.name", { profession: translate("he", "elev.carehonesty.consult.audience.slp") }));
    expect(he[0]).not.toMatch(/Home program|week|practice days/);
    expect(he).toContain(translate("he", "elev.homeProgram.packet.exercise", { text: "Name the toy, then wait", n: 2 }));
    expect(he.some((l) => l.includes(translate("he", "elev.homeProgram.goal.proposedBy", { profession: translate("he", "elev.carehonesty.consult.audience.slp") })))).toBe(true);
    expect(loopFirewallHits(he.join("\n"))).toEqual([]);
  });

  it("the scope is EXCLUSIVE: a stored grant that also lists other scopes reads only the home program, and says so", async () => {
    const store = new LocalShareStore();
    const g = await grant(store, [HOME_PROGRAM_SCOPE_ID, "story_timeline", "milestones"]);
    for (const asked of [undefined, HOME_PROGRAM_SCOPE_ID]) {
      const r = await open(store, g.id, new SpySource(), asked);
      expect(r.status).toBe(200);
      if (r.status === 200) {
        expect(r.view.sections.map((s) => s.id)).toEqual(["intake-home-program"]);
        expect(r.view.scopes).toEqual([HOME_PROGRAM_SCOPE_ID]);
      }
    }
  });

  it("a mixed grant that also names a report scope carries that report's domain ceiling (B-CAREPRO-41): fail closed, no home program, nothing else", async () => {
    const store = new LocalShareStore();
    const g = await grant(store, [HOME_PROGRAM_SCOPE_ID, "report_slp"]);
    const r = await open(store, g.id, new SpySource(), HOME_PROGRAM_SCOPE_ID);
    expect(r.status).toBe(200);
    if (r.status === 200) { expect(r.view.sections).toEqual([]); expect(r.view.scopes).toEqual([HOME_PROGRAM_SCOPE_ID]); }
  });

  it("round 2: a mixed grant asked for one of its OTHER scopes answers 403 (it never gives that view), with no child data", async () => {
    const store = new LocalShareStore();
    const g = await grant(store, [HOME_PROGRAM_SCOPE_ID, "story_timeline", "milestones"]);
    for (const other of ["story_timeline", "milestones"]) {
      const r = await open(store, g.id, new SpySource(), other);
      expect(r.status, other).toBe(403);
      expect(JSON.stringify(r)).not.toMatch(/Name the toy|PRIVATE-MOMENT/);
    }
  });

  it("no active home program → the section is simply absent (no other section fills the page)", () => {
    const input = buildPacketInput({ ...record(), programs: [] }, NOW);
    expect(buildSharedScopePacket([HOME_PROGRAM_SCOPE_ID], true, input).sections).toEqual([]);
  });
});

describe("B-PROG-09 read link · any other scope 403s; revoke kills the link at once", () => {
  it("asking the home-program link for any other scope → 403", async () => {
    const store = new LocalShareStore();
    const g = await grant(store, [HOME_PROGRAM_SCOPE_ID]);
    for (const other of ["report_slp", "story_timeline", "milestones", "weekly_insight", "everything"]) {
      expect((await open(store, g.id, new SpySource(), other)).status, other).toBe(403);
    }
  });

  it("asking another grant for the home program → 403, and it never reads programs or familyGoals", async () => {
    const store = new LocalShareStore();
    const source = new SpySource();
    const g = await grant(store, ["report_slp"]);
    expect((await open(store, g.id, source, HOME_PROGRAM_SCOPE_ID)).status).toBe(403);
    const r = await open(store, g.id, source);
    expect(r.status).toBe(200);
    if (r.status === 200) expect(r.view.sections.map((s) => s.id)).not.toContain("intake-home-program");
    expect(source.calls).toEqual([{}]);
  });

  it("revoke → the very next open answers 403", async () => {
    const store = new LocalShareStore();
    const g = await grant(store, [HOME_PROGRAM_SCOPE_ID]);
    expect((await open(store, g.id, new SpySource(), HOME_PROGRAM_SCOPE_ID)).status).toBe(200);
    expect(await store.revoke(g.id, OWNER.ownerUid)).toBeTruthy();
    expect((await open(store, g.id, new SpySource(), HOME_PROGRAM_SCOPE_ID)).status).toBe(403);
  });

  it("someone else's email → 403", async () => {
    const store = new LocalShareStore();
    const g = await grant(store, [HOME_PROGRAM_SCOPE_ID]);
    const r = await resolveSharedPacket({ grantId: g.id, recipientEmail: "other@example.com", shareStore: store, source: new SpySource(), now: NOW, requestedScope: HOME_PROGRAM_SCOPE_ID });
    expect(r.status).toBe(403);
  });
});
