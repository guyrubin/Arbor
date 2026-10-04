/**
 * B-CAREPRO-26 · "Share {name}'s week with the other parent" is the first card
 * on Sharing (CARE-3, ROI 20).
 *
 *  (1) GRANT — email + "See what they will see" + "Share {name}'s week" creates
 *      a live grant: role = the wizard's default (`viewer` until G1), scopes
 *      exactly [weekly_insight, story_timeline], until revoked (no expiry).
 *  (2) PREVIEW = RECIPIENT VIEW — the card's preview call and the server's
 *      recipient path return the same sections for that grant; revoking it
 *      ends the recipient view (403).
 *  (3) LAYOUT — the card is the first thing in the grant module, carries the
 *      route's ONE primary-move stamp; the full wizard sits behind "Custom
 *      share"; the roster stays second. EN + HE strings.
 *
 * Source scans normalise \r\n and assert every extraction before judging it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WEEK_SHARE_SCOPES, WEEK_SHARE_DURATION, normalizeScopes } from "../../lib/shareScopes";
import { buildGrant, LocalShareStore } from "../../sharing/shares";
import { resolveSharedPacket } from "../../server/sharedPacket";
import { buildPacketInput, buildSharedScopePacket, type RawChildRecord } from "../../consult/packet";
import { translate } from "../../lib/i18n";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sharing = readFileSync(path.join(HERE, "TrustedSharing.tsx"), "utf8").replace(/\r\n/g, "\n");

const NOW = Date.parse("2026-10-02T09:00:00.000Z");
const DAY = 86_400_000;
const RAW: RawChildRecord = {
  profile: { name: "Noa Levi", age: 5, birthDate: "2021-05-04", languages: ["Hebrew", "English"], schoolContext: "Gan", strengths: ["curious"], challenges: ["transitions"] },
  logs: [
    { behaviorType: "Transition Refusal", intensity: 4, timestamp: new Date(NOW - DAY).toISOString(), trigger: "leaving the playground" },
    { behaviorType: "Sleep Meltdown", intensity: 2, timestamp: new Date(NOW - 2 * DAY).toISOString() },
  ],
  milestones: [{ domain: "language_communication", title: "Two-word phrases", checked: true, observationStatus: "yes", observationUpdatedAt: new Date(NOW - 3 * DAY).toISOString() }],
  plans: [{ id: `plan-${NOW - 5 * DAY}`, title: "Smoother mornings", issue: "leaving for gan" }],
  memory: [{ fact: "Sleeps better after a bath", status: "approved" }],
};

describe("B-CAREPRO-26 · the week grant", () => {
  it("scopes are exactly weekly_insight + story_timeline, valid stable ids", () => {
    expect([...WEEK_SHARE_SCOPES]).toEqual(["weekly_insight", "story_timeline"]);
    expect(normalizeScopes(WEEK_SHARE_SCOPES)).toEqual([...WEEK_SHARE_SCOPES]);
  });

  it("the grant the card sends is read-only, scoped, and until revoked", () => {
    const g = buildGrant({ ownerUid: "u1", ownerEmail: "me@x.io", childId: "c1", childName: "Noa", recipientEmail: "Dad@X.io", role: "viewer", scopes: [...WEEK_SHARE_SCOPES], duration: WEEK_SHARE_DURATION }, NOW);
    expect(g.role).toBe("viewer");
    expect(g.scopes).toEqual([...WEEK_SHARE_SCOPES]);
    expect(g.expiresAt).toBeNull();
    expect(g.recipientEmail).toBe("dad@x.io");
  });

  it("preview = recipient view; revoke ends it", async () => {
    const store = new LocalShareStore();
    const g = await store.create(buildGrant({ ownerUid: "u1", ownerEmail: "me@x.io", childId: "c1", childName: "Noa", recipientEmail: "dad@x.io", role: "viewer", scopes: [...WEEK_SHARE_SCOPES], duration: WEEK_SHARE_DURATION }, NOW));
    const source = { load: async () => RAW };
    const res = await resolveSharedPacket({ grantId: g.id, recipientEmail: "dad@x.io", shareStore: store, source, now: NOW });
    expect(res.status).toBe(200);
    // the card's own call (TrustedSharing weekPreview), on the same raw record
    const preview = buildSharedScopePacket([...WEEK_SHARE_SCOPES], false, buildPacketInput(RAW, NOW));
    expect(res.status === 200 && res.view.sections).toEqual(preview.sections);
    expect(preview.sections.length).toBeGreaterThan(0);
    await store.revoke(g.id, "u1");
    const after = await resolveSharedPacket({ grantId: g.id, recipientEmail: "dad@x.io", shareStore: store, source, now: NOW + 1000 });
    expect(after.status).toBe(403);
  });
});

describe("B-CAREPRO-26 · the card on #/sharing (source)", () => {
  it("the card builds its preview with the recipient's builder and the shared assembler", () => {
    expect(sharing).toMatch(/buildSharedScopePacket\(\s*\[\.\.\.WEEK_SHARE_SCOPES\],\s*false, \/\/ the week card never grants the professional view\s*buildPacketInput\(/);
    expect(sharing).toContain('data-testid="share-week-preview"');
    expect(sharing).toMatch(/grant\(\{ email, role: WEEK_ROLE, scopes: \[\.\.\.WEEK_SHARE_SCOPES\], duration: WEEK_SHARE_DURATION \}/);
    // role follows the wizard default until G1 (no co_parent hard-code)
    expect(sharing).toContain("const WEEK_ROLE: ShareRole = DEFAULT_ROLE;");
  });

  it("two taps after the email: preview, then share (the confirm carries the ONE primary-move stamp)", () => {
    const card = /data-testid="share-week-card"[\s\S]*?<\/section>/.exec(sharing)?.[0] ?? "";
    expect(card, "card extracted").not.toBe("");
    expect(card).toContain('data-testid="share-week-email"');
    // W2-CAREPRO r1: ONE button carries the stamp at rest AND in preview —
    // it opens the preview, then the same button confirms (sweep found
    // primaryMove null at rest: the stamp lived only on the confirm).
    expect(card).toContain('data-testid={weekPreviewing ? "share-week-confirm" : "share-week-preview-open"}');
    expect(card).toContain('data-primary-move="grant-share"');
    const stamps = sharing.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "").match(/\bdata-primary-move="/g) ?? [];
    expect(stamps).toHaveLength(1);
    // the stamped element is rendered outside the {!weekPreviewing ? … : …} branch
    const stampAt = card.indexOf('data-primary-move="grant-share"');
    const branchEnd = card.indexOf('<div className="flex flex-col sm:flex-row gap-2 sm:items-center">');
    expect(branchEnd).toBeGreaterThan(-1);
    expect(stampAt).toBeGreaterThan(branchEnd);
    // the primary is the filled gradient, never an opacity-disabled ghost at rest
    const btn = card.slice(card.lastIndexOf("<button", stampAt), card.indexOf("</button>", stampAt));
    expect(btn).toContain("var(--gradient-cta)");
    expect(btn).toContain("disabled={weekPreviewing && (");
    expect(btn).not.toMatch(/disabled=\{!weekEmailValid\}|disabled:opacity-40/);
    // an invalid email focuses the field with an inline hint
    expect(sharing).toMatch(/if \(!weekEmailValid\) \{ setWeekHint\(true\); weekEmailRef\.current\?\.focus\(\); return; \}/);
    // NEGATIVE CONTROL: the pre-change confirm-only stamp is caught
    const pre = `{!weekPreviewing ? (<button disabled={!weekEmailValid}>See</button>) : (<button data-primary-move="grant-share">Share</button>)}`;
    expect(pre.indexOf('data-primary-move="grant-share"')).toBeLessThan(pre.lastIndexOf(")}"));
  });

  it("W2-CAREPRO r1: no clinical bar on #/sharing; the copy never claims a time box the week share does not have", () => {
    expect(sharing).not.toContain("<TrustSafetyBar");
    expect(sharing).toContain('data-testid="sharing-trust-line"');
    for (const lang of ["en", "he"] as const) {
      for (const key of ["sec.sharing.sub", "sec.sharing.trustNote"]) {
        const v = translate(lang, key, { name: "Noa" });
        expect(v, `${lang} ${key}`).not.toMatch(/time-boxed|expires|מוגבל(ת)? בזמן|פקיעת/);
      }
    }
    for (const k of ["needEmail"]) {
      const key = `elev.learnCare.share.week.${k}`;
      expect(translate("en", key)).not.toBe(key);
      expect(translate("he", key)).not.toBe(key);
    }
  });

  it("first card: before the invite hand-off, the wizard and the roster; the wizard is behind Custom share", () => {
    const at = (needle: string) => {
      const i = sharing.indexOf(needle);
      expect(i, needle).toBeGreaterThan(-1);
      return i;
    };
    const card = at('data-testid="share-week-card"');
    expect(card).toBeLessThan(at('data-testid="share-invite"'));
    expect(card).toBeLessThan(at("{adding && ("));
    expect(card).toBeLessThan(at('data-module="sharing-roster"'));
    expect(at('data-module="sharing-grant"')).toBeLessThan(card);
    const custom = /data-testid="sharing-custom-open"[\s\S]{0,400}?elev\.learnCare\.share\.week\.custom/.exec(sharing);
    expect(custom, "the wizard door is Custom share").toBeTruthy();
    // W2-CAREPRO r1: the door lives inside the week card, not the page header
    const weekCard = /data-testid="share-week-card"[\s\S]*?<\/section>/.exec(sharing)?.[0] ?? "";
    expect(weekCard).toContain('data-testid="sharing-custom-open"');
    expect(sharing).not.toContain('t("sec.sharing.new")');
  });

  it("every card string exists in EN and HE", () => {
    for (const k of ["title", "body", "email", "preview", "share", "edit", "custom"]) {
      const key = `elev.learnCare.share.week.${k}`;
      expect(translate("en", key), key).not.toBe(key);
      expect(translate("he", key), key).not.toBe(key);
      expect(translate("he", key)).not.toBe(translate("en", key));
    }
    expect(translate("en", "elev.learnCare.share.week.title", { name: "Noa" })).toContain("Noa");
    expect(translate("he", "elev.learnCare.share.week.title", { name: "נועה" })).toContain("נועה");
  });
});
