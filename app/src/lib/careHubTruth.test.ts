/**
 * W2-CAREPRO critic round 1 — the Care hub never claims a roster it does not keep.
 *
 * B-CAREPRO-19 retired the professional directory (#/find-pro → Consult) and
 * deleted elev.carehonesty.pro.verified, but the hub sentence nav.sub.care
 * still read "Share with a verified professional" on every Care route (eyebrow
 * below lg, topbar subtitle at lg+), and care.trust carried an unbacked
 * "· GDPR/COPPA" badge (Latin chrome in HE; COPPA is a US statute). Arbor
 * verifies no one: Care is a handoff, never a staffed expert layer.
 */
import { describe, expect, it } from "vitest";
import { en, he, translate } from "./i18n";

const VERIFIED = /verified|מאומת/i;
const COMPLIANCE_BADGE = /GDPR|COPPA/;
const HUB_SENTENCE = /^(nav\.sub\.|sec\.[a-z0-9-]+\.sub$)/;

function hubSentences(dict: Record<string, string>): [string, string][] {
  return Object.entries(dict).filter(([k]) => HUB_SENTENCE.test(k));
}

describe("Care hub truth — no verified-roster claim, no compliance badge", () => {
  it("negative control: the regexes fire on the retired strings", () => {
    expect(VERIFIED.test("Share with a verified professional")).toBe(true);
    expect(VERIFIED.test("לשתף עם איש מקצוע מאומת")).toBe(true);
    expect(VERIFIED.test("רשת אנשי מקצוע מובחרת ומאומתת בידי ארבור")).toBe(true);
    expect(COMPLIANCE_BADGE.test("Nothing leaves your device until you choose · GDPR/COPPA")).toBe(true);
  });

  it("no nav.sub.* or sec.*.sub sentence claims verification, EN or HE", () => {
    const hits = [...hubSentences(en), ...hubSentences(he)].filter(([, v]) => VERIFIED.test(v));
    expect(hits).toEqual([]);
    // The sweep scanned something real.
    expect(hubSentences(en).length).toBeGreaterThan(10);
    expect(hubSentences(he).length).toBeGreaterThan(10);
  });

  it("nav.sub.care says what the hub does and names the child in both locales", () => {
    const e = translate("en", "nav.sub.care", { name: "Dylan" });
    const h = translate("he", "nav.sub.care", { name: "Dylan" });
    expect(e).toContain("Dylan");
    expect(h).toContain("Dylan");
    expect(e).not.toMatch(VERIFIED);
    expect(h).not.toMatch(VERIFIED);
  });

  it("the dead Arbor-verified network sentence is gone", () => {
    expect(en["sec.findpro.sub"]).toBeUndefined();
    expect(he["sec.findpro.sub"]).toBeUndefined();
  });

  it("care.trust carries no compliance badge and no Latin chrome in HE", () => {
    expect(translate("en", "care.trust")).not.toMatch(COMPLIANCE_BADGE);
    const h = translate("he", "care.trust");
    expect(h).not.toMatch(COMPLIANCE_BADGE);
    expect(h).not.toMatch(/[A-Za-z]/);
  });

  it("no Care-hub string anywhere in the dictionaries says 'verified professional'", () => {
    const all = [...Object.values(en), ...Object.values(he)];
    expect(all.filter((v) => /verified professional|Arbor-verified|מקצוע מאומת|מאומתת בידי ארבור/i.test(v))).toEqual([]);
  });
});
