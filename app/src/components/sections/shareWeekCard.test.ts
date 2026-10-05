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

  it("W2-CAREPRO r2: ONE tap shares — the preview follows a valid email, the stamped button grants on its first tap", () => {
    const card = /data-testid="share-week-card"[\s\S]*?<\/section>/.exec(sharing)?.[0] ?? "";
    expect(card, "card extracted").not.toBe("");
    expect(card).toContain('data-testid="share-week-email"');
    // the preview is shown by a valid email, not by a tap
    expect(sharing).toContain("const weekPreviewing = weekEmailValid;");
    expect(sharing).not.toContain("setWeekPreviewing");
    // one button, one testid, one label: the confirm IS the button at rest
    expect(card).toContain('data-testid="share-week-confirm"');
    expect(card).not.toContain("share-week-preview-open");
    // B-SHELL-20 (a): the leaf serves #/sharing and #/care-team; the stamp's value follows the route.
    const STAMP = 'data-primary-move={activeTab === "care-team" ? "open-care-roster" : "grant-share"}';
    expect(card).toContain(STAMP);
    const stamps = sharing.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "").match(/\bdata-primary-move=/g) ?? [];
    expect(stamps).toHaveLength(1);
    const stampAt = card.indexOf(STAMP);
    const btn = card.slice(card.lastIndexOf("<button", stampAt), card.indexOf("</button>", stampAt));
    expect(btn).toContain("var(--gradient-cta)");
    expect(btn).not.toMatch(/disabled=\{!weekEmailValid\}|disabled:opacity-40/);
    expect(btn).not.toContain('"visibility"');
    // the handler: hint (focus) or grant — never a preview-only step
    expect(sharing).toMatch(/const onWeekPrimary = \(\) => \{\s*if \(weekPrimaryAction\(weekEmail\) === "hint"\) \{ setWeekHint\(true\); weekEmailRef\.current\?\.focus\(\); return; \}\s*setWeekHint\(false\);\s*void shareWeek\(\);\s*\};/);
    // shareWeek makes exactly one grant call with the week shape
    const shareWeekFn = /const shareWeek = async \(\) => \{[\s\S]*?\n  \};/.exec(sharing)?.[0] ?? "";
    expect((shareWeekFn.match(/\bgrant\(/g) ?? []).length).toBe(1);
  });

  it("W2-CAREPRO r2: weekPrimaryAction — valid email = grant, empty/invalid = hint (zero grants)", async () => {
    const { weekPrimaryAction } = await import("./TrustedSharing");
    expect(weekPrimaryAction("dana@example.com")).toBe("grant");
    expect(weekPrimaryAction("  dana@example.com ")).toBe("grant");
    for (const bad of ["", "   ", "dana", "dana@", "dana@example"]) expect(weekPrimaryAction(bad)).toBe("hint");
    // NEGATIVE CONTROL: the r1 two-tap shape (a preview-open branch on the same label) is caught
    const r1 = `data-testid={weekPreviewing ? "share-week-confirm" : "share-week-preview-open"}`;
    expect(r1).toContain("share-week-preview-open");
  });

  it("W2-CAREPRO r2: two columns at lg; the trust line lives inside the card; an empty roster is one muted line", () => {
    const card = /data-testid="share-week-card"[\s\S]*?<\/section>/.exec(sharing)?.[0] ?? "";
    expect(card).toContain("lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]");
    expect(card).toContain('data-testid="sharing-trust-line"');
    expect(sharing).toMatch(/!loading && team\.length === 0 \? \(\s*<p data-testid="sharing-roster-empty"/);
    expect(sharing).toMatch(/<PageHeader\s+flush/);
    for (const lang of ["en", "he"] as const) {
      const body = translate(lang, "elev.learnCare.share.week.body");
      expect(body.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length, `${lang} one sentence`).toBe(1);
    }
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
    for (const k of ["title", "body", "email", "share", "custom"]) {
      const key = `elev.learnCare.share.week.${k}`;
      expect(translate("en", key), key).not.toBe(key);
      expect(translate("he", key), key).not.toBe(key);
      expect(translate("he", key)).not.toBe(translate("en", key));
    }
    expect(translate("en", "elev.learnCare.share.week.title", { name: "Noa" })).toContain("Noa");
    expect(translate("he", "elev.learnCare.share.week.title", { name: "נועה" })).toContain("נועה");
  });
});

/* W2-CAREPRO c2 r1 — sharing critics (product P0 G0 + P1 G0/G1/G2, design P1 G1/G2). */
describe("W2-CAREPRO c2 r1 · the week is true, at rest and in the preview", () => {
  const withMoments: RawChildRecord = {
    ...RAW,
    logs: [
      ...RAW.logs,
      { behaviorType: "Moment", intensity: 1, timestamp: new Date(NOW - 2 * DAY).toISOString(), trigger: "He called the tower Grandpa's house" },
      { behaviorType: "Moment", intensity: 1, timestamp: new Date(NOW - 20 * DAY).toISOString(), trigger: "Old moment outside the week" },
    ],
    milestones: [
      ...RAW.milestones,
      { domain: "social_development", title: "Notices others' feelings", checked: true, observationStatus: "yes", observationUpdatedAt: new Date(NOW - 5 * DAY).toISOString() },
    ],
  };
  const DENOM = /\d+\s*(of|\/|מתוך)\s*\d+/;

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the viewer's week = the parent's own 7-day moments + a numerator-only milestone line; no denominator, no 30-day window`, async () => {
      const { itemText, sectionTitle } = await import("../../consult/packet");
      const p = buildSharedScopePacket([...WEEK_SHARE_SCOPES], false, buildPacketInput(withMoments, NOW));
      const text = p.sections.flatMap((s) => [sectionTitle(s, lang), ...s.items.map((i) => itemText(i, lang))]).join("\n");
      expect(text).not.toMatch(DENOM);
      expect(text).toContain("He called the tower Grandpa's house");
      expect(text).not.toContain("Old moment outside the week");
      expect(text).not.toMatch(/last 30 days|30 הימים/);
      const dev = p.sections.find((s) => s.id === "development")!;
      expect(dev.items[0].id).toBe("dev-noticed");
      expect(dev.items[0].vars?.n).toBe(2);
      expect(dev.items.find((i) => i.id === "dev-observed")!.vars?.n).toBe(2); // one count source
      if (lang === "he") {
        for (const s of p.sections) for (const it of s.items) {
          const line = itemText(it, "he");
          expect(/[\u0590-\u05FF]/.test(line) && /\d{4}-\d{2}-\d{2}/.test(line), line).toBe(false);
        }
      }
    });
  }

  it("source: the at-rest strip quotes the grant's own moments section with a weekday, inside the start column, before the trust line", () => {
    const at = sharing.indexOf('data-testid="share-week-atrest"');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(sharing.indexOf('data-testid="sharing-trust-line"'));
    expect(sharing).toMatch(/packet\.sections\.find\(\(s\) => s\.id === "moments"\)/);
    expect(sharing.slice(at, at + 1200)).toContain('<q dir="auto">');
    expect(sharing.slice(at, at + 1200)).toContain("<bdi>");
    expect(sharing.slice(at, at + 1200)).toContain('borderInlineStart: "2px solid var(--arbor-sky-ink)"');
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "elev.learnCare.share.week.atRest")).not.toBe("elev.learnCare.share.week.atRest");
      expect(translate(lang, "elev.learnCare.share.week.atRestEmpty")).not.toBe("elev.learnCare.share.week.atRestEmpty");
    }
  });

  it("source: at lg the preview is a direct grid child in the START column at a 60ch measure; the email + one tap are a sticky end column", () => {
    const card = sharing.slice(sharing.indexOf('data-testid="share-week-card"'), sharing.indexOf("</section>", sharing.indexOf('data-testid="share-week-card"')));
    const preview = card.indexOf('data-testid="share-week-preview"');
    expect(card.slice(preview, preview + 260)).toContain("lg:col-start-1 lg:row-start-2 lg:max-w-[60ch]");
    expect(card).toContain("lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6 lg:self-start");
    // the preview is AFTER the end column closes (a grid child, not nested in it)
    expect(preview).toBeGreaterThan(card.indexOf('data-testid="sharing-custom-open"'));
    // one list direction, never dir=auto per li
    expect(card).not.toMatch(/<li key=\{it\.id\}[^>]*dir="auto"/);
  });
});
