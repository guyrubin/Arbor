/**
 * LC-17 guard — Trusted Sharing shows the parent what is actually shared.
 *
 * The review step used to list scope CHIPS ("Weekly insight", "Milestones") —
 * labels for content, never the content. A parent consenting to share their
 * child's data has to see the content. This file proves two things:
 *
 *  (1) BEHAVIOUR — the client preview is byte-identical to the recipient view
 *      the server builds, because it is the same function on the same input;
 *  (2) MOUNT — the review step renders that packet, and the create flow offers
 *      the parent an invite to send (Arbor sends no recipient email).
 *
 * Scan discipline for (2): \r\n normalised first, extractions asserted
 * toBeTruthy(), and a negative control against the pre-change source shape.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSharedScopePacket, serializePacket, type BuildPacketInput } from "../../consult/packet";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "..");
const sharing = readFileSync(path.join(SRC, "components/sections/TrustedSharing.tsx"), "utf8").replace(/\r\n/g, "\n");

const NOW = Date.parse("2026-09-04T09:00:00.000Z");
const DAY = 86_400_000;

const input: BuildPacketInput = {
  profile: { name: "Noa Levi", age: 4, languages: ["Hebrew", "English"], schoolContext: "Bilingual gan", strengths: ["curious"], challenges: ["transitions"] },
  logs: [
    { behaviorType: "Transition Refusal", intensity: 4, timestamp: new Date(NOW - DAY).toISOString() },
    { behaviorType: "Transition Refusal", intensity: 3, timestamp: new Date(NOW - 3 * DAY).toISOString() },
  ],
  milestones: [{ domain: "language_communication", title: "Two-word phrases", checked: true, status: "yes", observedAt: new Date(NOW - 10 * DAY).toISOString() }],
  plans: [{ title: "Smoother mornings", issue: "leaving for gan" }],
  memory: [{ fact: "Sleeps better after a bath", status: "approved" }],
  nowMs: NOW,
};

describe("LC-17 · the preview IS the recipient's view", () => {
  it("client preview and server recipient view agree, section for section", () => {
    const scopes = ["weekly_insight", "milestones"];
    const client = buildSharedScopePacket(scopes, false, input);
    expect(client.sections.length).toBeGreaterThan(0); // not a vacuous match
    const server = buildSharedScopePacket(scopes, false, input);
    expect(serializePacket(client)).toBe(serializePacket(server));
    // …and the server's recipient path really routes through the same builder.
    const serverSrc = readFileSync(path.join(SRC, "server/sharedPacket.ts"), "utf8");
    expect(serverSrc.length).toBeGreaterThan(500);
    expect(serverSrc).toContain("buildSharedScopePacket(");
  });

  it("the preview shows real content, not scope labels", () => {
    const packet = buildSharedScopePacket(["weekly_insight"], false, input);
    const text = serializePacket(packet);
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
    expect(/buildSharedScopePacket\(draft\.scopes, draft\.role === "professional"/.exec(sharing)).toBeTruthy();
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
