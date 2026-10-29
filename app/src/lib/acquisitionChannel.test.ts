import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACQUISITION_CHANNELS, channelOfSource } from "./acquisitionChannel";
import { parseAttribution } from "./attribution";

describe("BD-37 — the acquisition channel of a first-touch source", () => {
  it("partners, studio, founding, a parent's invite and direct each keep their own channel", () => {
    for (const ch of ["practitioner", "centre", "presenter", "sponsor", "studio", "founding", "referral", "direct"] as const) {
      expect(channelOfSource(ch)).toBe(ch);
      expect(channelOfSource(` ${ch.toUpperCase()} `)).toBe(ch);
    }
  });

  it("content, search and the stores are separate, from a utm_source or a referring host", () => {
    expect(channelOfSource("instagram")).toBe("content");
    expect(channelOfSource("landing")).toBe("content");
    expect(channelOfSource("l.instagram.com")).toBe("content");
    expect(channelOfSource("m.facebook.com")).toBe("content");
    expect(channelOfSource("google.com")).toBe("search");
    expect(channelOfSource("google.co.il")).toBe("search");
    expect(channelOfSource("duckduckgo.com")).toBe("search");
    expect(channelOfSource("appstore")).toBe("store");
    expect(channelOfSource("playstore")).toBe("store");
  });

  it("anything else is other — never guessed into a partner channel", () => {
    for (const s of ["", null, undefined, "partner", "clinic.example.org", "googleads", "notgoogle.com"]) expect(channelOfSource(s)).toBe("other");
  });

  it("the attribution capture feeds it end to end: a tagged practitioner link and a ?ref= invite", () => {
    const practitioner = parseAttribution("?utm_source=practitioner&utm_medium=referral&utm_campaign=everyday_plans", "/", "he", undefined, "arbor.app", "2026-10-28T09:00:00Z");
    expect(channelOfSource(practitioner.source)).toBe("practitioner");
    const invite = parseAttribution("?ref=ARBOR-ABCDEFGH", "/", "en", undefined, "arbor.app", "2026-10-28T09:00:00Z");
    expect(channelOfSource(invite.source)).toBe("referral");
    const studio = parseAttribution("?utm_source=studio&utm_medium=social", "/", "he", undefined, "arbor.app", "2026-10-28T09:00:00Z");
    expect(channelOfSource(studio.source)).toBe("studio");
    expect(channelOfSource(parseAttribution("", "/", "en", "https://www.google.com/", "arbor.app", "x").source)).toBe("search");
    expect(channelOfSource(parseAttribution("", "/", "en", undefined, "arbor.app", "x").source)).toBe("direct");
  });

  it("every channel-named utm_source is documented in the UTM scheme", () => {
    const scheme = readFileSync(path.resolve(__dirname, "..", "..", "public", "marketing", "utm-scheme.md"), "utf8");
    const row = scheme.split("\n").find((l) => l.startsWith("| `utm_source`"))!;
    for (const ch of ["practitioner", "centre", "presenter", "sponsor", "studio", "founding"]) expect(row, ch).toContain(`\`${ch}\``);
    expect(ACQUISITION_CHANNELS).toContain("other");
  });
});
