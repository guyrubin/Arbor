/**
 * LC-17 guard — Trusted Sharing shows the parent what is actually shared.
 *
 * The review step used to list scope CHIPS ("Weekly insight", "Milestones") —
 * labels for content, never the content. A parent consenting to share their
 * child's data has to see the content, and the consent copy promises exactly
 * that: "They will see exactly this", "the same code the recipient's view
 * uses — word for word."
 *
 * That promise was false. Both sides called the same BUILDER but assembled
 * different INPUTS: the client dropped every log `trigger` (so a parent
 * granting `report_behavioral_health` approved a preview with no triggers
 * section while the recipient read the parent's own free-text trigger words),
 * and only the client derived `ageMonths` (so the age label and the
 * age-windowed milestone denominator differed between the two views).
 *
 * The old guard here could not catch that: it called `buildSharedScopePacket`
 * twice on ONE input and compared the results — an assertion about
 * determinism, which passes on any revision of this repo, defect or no defect.
 * The risk lives in the CALL SITES, so this file pins the call sites:
 *
 *  (1) INPUT — both sides assemble through the one shared assembler
 *      (`consult/packet.buildPacketInput`) and hand-roll no mapping of their
 *      own, with the pre-change assemblies as negative controls;
 *  (2) CONTENT — the fields that used to diverge (trigger words, the
 *      months-precise age) are in the packet, each with a negative control
 *      showing the packet changes when that field is dropped;
 *  (3) MOUNT — the review step renders that packet, and the create flow offers
 *      the parent an invite to send (Arbor sends no recipient email).
 *
 * Scan discipline: \r\n normalised first, extractions asserted toBeTruthy(),
 * and every rule carries a negative control against the pre-change source.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPacketInput,
  buildSharedScopePacket,
  serializePacket,
  type BuildPacketInput,
  type RawChildRecord,
} from "../../consult/packet";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const sharing = read("components/sections/TrustedSharing.tsx");
const server = read("server/sharedPacket.ts");

const NOW = Date.parse("2026-09-04T09:00:00.000Z");
const DAY = 86_400_000;

/** ONE raw child record — the shape BOTH call sites hold (the browser's
 *  context objects; the server's Firestore documents). Deliberately loaded
 *  with the two fields that used to diverge:
 *   · `trigger` on each log — dropped by the client, kept by the server;
 *   · a `birthDate` alongside a STALE legacy `age` — a side that derives
 *     ageMonths says "3 years 4 months", a side that does not says "5 years". */
const RAW: RawChildRecord = {
  profile: {
    name: "Noa Levi",
    age: 5,
    birthDate: "2023-05-04",
    languages: ["Hebrew", "English"],
    schoolContext: "Bilingual gan",
    strengths: ["curious"],
    challenges: ["transitions"],
  },
  logs: [
    { behaviorType: "Transition Refusal", intensity: 4, timestamp: new Date(NOW - DAY).toISOString(), trigger: "leaving the playground" },
    { behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date(NOW - 3 * DAY).toISOString(), trigger: "leaving the playground" },
  ],
  milestones: [
    {
      domain: "language_communication",
      title: "Two-word phrases",
      checked: true,
      observationStatus: "yes",
      observationUpdatedAt: new Date(NOW - 10 * DAY).toISOString(),
    },
  ],
  plans: [{ id: `plan-${NOW - 20 * DAY}`, title: "Smoother mornings", issue: "leaving for gan" }],
  memory: [{ fact: "Sleeps better after a bath", status: "approved" }],
};

/** What every call site now produces from that record. */
const input: BuildPacketInput = buildPacketInput(RAW, NOW);

/** The pre-change client assembly (TrustedSharing.tsx), verbatim: no `trigger`. */
const PRE_CLIENT = `
        logs: behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, intensity: l.intensity, timestamp: l.timestamp, resolved: l.resolved })),
        plans: actionPlans.map((p) => ({ title: p.title, issue: p.issue })),
        nowMs: Date.now(),
`.replace(/\r\n/g, "\n");

/** The pre-change server assembly (server/sharedPacket.ts), verbatim: no
 *  `ageMonths` derivation, no milestone `ageMonths`. */
const PRE_SERVER = `
        return {
          behaviorType: str(l.behaviorType),
          intensity: num(l.intensity),
          timestamp: str(l.timestamp) || 0,
          trigger: str(l.trigger) || undefined,
          response: str(l.response) || undefined,
          resolved: l.resolved === true,
        };
`.replace(/\r\n/g, "\n");

/** A call site is honest when it routes through the ONE shared assembler and
 *  hand-rolls no packet-input mapping of its own — a second mapping is exactly
 *  how these two drifted apart while both "used the same builder". */
const usesSharedAssembler = (src: string): boolean =>
  /buildPacketInput\(/.test(src) && !/behaviorType:/.test(src);

describe("LC-17 · the preview IS the recipient's view — same INPUT, not just the same builder", () => {
  it("both call sites assemble their input with the ONE shared assembler", () => {
    // Non-vacuity: the sources were really read.
    expect(sharing.length).toBeGreaterThan(3000);
    expect(server.length).toBeGreaterThan(500);
    expect(sharing).toContain("export default function TrustedSharing");
    expect(server).toContain("buildSharedScopePacket(");

    expect(usesSharedAssembler(sharing), "TrustedSharing.tsx hand-rolls its packet input").toBe(true);
    expect(usesSharedAssembler(server), "server/sharedPacket.ts hand-rolls its packet input").toBe(true);

    // NEGATIVE CONTROL: the two pre-change assemblies — the client's, which
    // dropped `trigger`, and the server's, which derived no age — fail the
    // same predicate. A future hand-rolled mapping fails with them.
    expect(usesSharedAssembler(PRE_CLIENT)).toBe(false);
    expect(usesSharedAssembler(PRE_SERVER)).toBe(false);
  });

  it("the parent's own trigger words are in the preview, because the recipient reads them", () => {
    const text = serializePacket(buildSharedScopePacket(["report_behavioral_health"], true, input));
    expect(text).toContain("What we noticed came first");
    expect(text).toContain("leaving the playground");
  });

  it("NEGATIVE CONTROL: drop `trigger` on the way in and the triggers section vanishes from the preview", () => {
    // This is the shipped divergence: the parent approved THIS packet while
    // the recipient opened one carrying their free-text trigger words.
    const preChange: BuildPacketInput = { ...input, logs: input.logs.map(({ trigger: _dropped, ...rest }) => rest) };
    const text = serializePacket(buildSharedScopePacket(["report_behavioral_health"], true, preChange));
    expect(text).not.toContain("What we noticed came first");
    expect(text).not.toContain("leaving the playground");
  });

  it("the age in the packet is derived from the record, not from the stale legacy year", () => {
    const about = buildSharedScopePacket(["report_therapist"], true, input).sections.find((s) => s.id === "about");
    expect(about).toBeTruthy();
    expect(about!.items[0].text).toContain("3 years 4 months");
  });

  it("NEGATIVE CONTROL: drop the derived `ageMonths` and the two views disagree about the child's age", () => {
    const preChange: BuildPacketInput = { ...input, profile: { ...input.profile, ageMonths: undefined } };
    const about = buildSharedScopePacket(["report_therapist"], true, preChange).sections.find((s) => s.id === "about");
    expect(about!.items[0].text).toContain("5 years");
    expect(about!.items[0].text).not.toContain("3 years 4 months");
  });

  it("the preview shows real content, not scope labels", () => {
    const text = serializePacket(buildSharedScopePacket(["weekly_insight"], false, input));
    expect(text).toContain("Transition Refusal");
    // A scope-label listing would contain the label and nothing beneath it.
    expect(text.length).toBeGreaterThan("Weekly insight".length * 3);
  });

  it("NEGATIVE CONTROL: a scope that unlocks nothing previews nothing", () => {
    const packet = buildSharedScopePacket(["not_a_real_scope"], false, input);
    expect(packet.sections).toHaveLength(0);
  });

  it("a professional recipient sees more than a viewer — the preview is scope-true", () => {
    const viewer = buildSharedScopePacket(["report_teacher"], false, input);
    const clinician = buildSharedScopePacket(["report_therapist"], true, input);
    expect(serializePacket(viewer)).not.toBe(serializePacket(clinician));
  });
});

describe("LC-17 · the review step mounts the preview, and the parent can invite", () => {
  /** The pre-change review step: scope chips only, no invite path. */
  const PRE = `
              <div><p>{t("sec.sharing.review.canSee")}</p><div>{draft.scopes.map((scope) => <Chip key={scope} tone="sky">{t(shareScopeLabelKey(scope))}</Chip>)}</div></div>
              <div className="rounded-2xl p-4 flex items-start gap-3"><p>{t("sec.sharing.review.note")}</p></div>
`.replace(/\r\n/g, "\n");

  it("the source was really read", () => {
    expect(sharing.length).toBeGreaterThan(3000);
    expect(sharing).toContain("export default function TrustedSharing");
  });

  it("the review step builds and renders the recipient packet", () => {
    expect(/buildSharedScopePacket\(\s*draft\.scopes,\s*draft\.role === "professional"/.exec(sharing)).toBeTruthy();
    expect(/data-testid="share-scope-preview"/.exec(sharing)).toBeTruthy();
    expect(/data-testid="share-scope-preview"/.exec(PRE)).toBeNull();
    // The section items themselves are rendered, not just the section titles.
    const block = /data-testid="share-scope-preview"[\s\S]*?<\/div>\s*\)\}/.exec(sharing);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("section.items.map");
  });

  it("a blocked build shows the reason and NO content (fail closed)", () => {
    const block = /previewPacket\.blocked \? \([\s\S]{0,600}?\) :/.exec(sharing);
    expect(block).toBeTruthy();
    expect(block![0]).toContain("elev.learnCare.share.preview.blocked");
    expect(/ClinicalLanguageError/.exec(sharing)).toBeTruthy();
  });

  it("the parent is offered an invite, and told Arbor does not send one", () => {
    expect(/data-testid="share-invite"/.exec(sharing)).toBeTruthy();
    expect(/mailto:\$\{encodeURIComponent\(email\)\}/.exec(sharing)).toBeTruthy();
    expect(/elev\.learnCare\.share\.invite\.hint/.exec(sharing)).toBeTruthy();
    expect(/data-testid="share-invite"/.exec(PRE)).toBeNull();
  });
});
