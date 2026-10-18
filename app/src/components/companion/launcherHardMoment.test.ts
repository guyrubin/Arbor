import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { availableHardMomentCards } from "../../content/selectCards";
import { en, he } from "../../lib/i18n";

/**
 * B-ASKJB-39 (web half) — the hard-moment sheet is one tap from every parent
 * screen through the floating launcher. It shares the gate every door uses
 * (a pilot guide fits this child and language), opens the ONE sheet (openHardMomentNow) and keeps the calm rules:
 * the launcher's neutral button style, no "SOS", no alarm colour.
 */
const src = readFileSync(path.resolve(__dirname, "CompanionWorkspace.tsx"), "utf8");
const door = src.slice(src.indexOf('data-testid="launcher-hard-moment"') - 400, src.indexOf('data-testid="launcher-hard-moment"') + 600);

describe("B-ASKJB-39 — the launcher's hard-moment door", () => {
  it("renders behind the shared gate on every parent screen, Now included (v4: one door, everywhere)", () => {
    expect(src).toContain('data-testid="launcher-hard-moment"');
    expect(src).toMatch(/availableHardMomentCards\(\{ now: at, ageMonths: ageMonthsFromProfile\(childProfile, at\)/);
    expect(door).toMatch(/\{hardMomentDoor && <button/);
    expect(door).not.toContain('activeTab !== "overview"');
    // Now no longer duplicates it in its glance.
    const now = readFileSync(path.resolve(__dirname, "NowView.tsx"), "utf8");
    expect(now).not.toContain("openHardMomentNow()");
  });

  it("opens the one shared sheet, in the launcher's neutral style, never 'SOS'", () => {
    expect(door).toContain("onClick={() => openHardMomentNow()}");
    expect(door).toContain('className="companion-launch-save companion-launch-hard"');
    expect(door).not.toMatch(/SOS|danger|alert|--arbor-(?:peach|pink|red)/i);
    expect(en["companion.input.hard-moment"]).toBe("A hard moment?");
    expect(he["companion.input.hard-moment"]).toBe("רגע קשה?");
    expect(`${en["companion.input.hard-moment-aria"]} ${he["companion.input.hard-moment-aria"]}`).not.toMatch(/SOS/i);
  });

  it("the gate is real: after the pilot window no guide is available (the door hides)", () => {
    const farFuture = new Date("2030-01-01T12:00:00Z");
    expect(availableHardMomentCards({ now: farFuture, ageMonths: 48, locale: "en" })).toHaveLength(0);
  });
});
