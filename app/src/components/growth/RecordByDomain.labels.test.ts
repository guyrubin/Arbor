/**
 * B-SHELL-28 — the Milestones development map renders each domain label
 * once per row: the PRIMARY registry domain, never the " · " cross-tag
 * ("Moving · Hands, senses & self-care" beside "Hands, senses & self-care").
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";
import { DEVELOPMENTAL_DOMAIN_IDS, domainLabel, primaryDomainLabel } from "../../lib/domains/registry";

describe("B-SHELL-28 — one label per map row", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: every developmental id prints one domain name (no " · ")`, () => {
      const t = (k: string) => translate(lang, k);
      for (const id of DEVELOPMENTAL_DOMAIN_IDS) expect(primaryDomainLabel("developmental", id, t), id).not.toContain(" · ");
      // the cross-tag that produced the double label is the first name only
      expect(primaryDomainLabel("developmental", "sensory_motor_patterns", t)).toBe(domainLabel("developmental", "sensory_motor_patterns", t).split(" · ")[0]);
    });
  }

  it("the map labels come from primaryDomainLabel (source pin)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../tabs/MilestonesTab.tsx"), "utf8");
    expect(src).toContain('const domainLabel = (id: string) => primaryDomainLabel("developmental", id, t);');
    expect(src).not.toContain('registryDomainLabel("developmental"');
  });
});
