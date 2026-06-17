import { describe, it, expect } from "vitest";
import { parseAttribution, attributionProps, detectMarket, type Attribution } from "./attribution";

const NOW = "2026-06-17T10:00:00.000Z";
const parse = (search: string, path = "/", lang?: string, referrer?: string, host = "joinarbor.com") =>
  parseAttribution(search, path, lang, referrer, host, NOW);

describe("detectMarket", () => {
  it("reads market from the URL path prefix", () => {
    expect(detectMarket("/il", undefined)).toBe("il");
    expect(detectMarket("/nl/grow", undefined)).toBe("nl");
    expect(detectMarket("/uk", "en")).toBe("uk");
  });
  it("falls back to UI language, then intl", () => {
    expect(detectMarket("/", "he")).toBe("il");
    expect(detectMarket("/", "nl-NL")).toBe("nl");
    expect(detectMarket("/", "en-US")).toBe("intl");
    expect(detectMarket("/", undefined)).toBe("intl");
  });
  it("path prefix wins over language", () => {
    expect(detectMarket("/nl", "he")).toBe("nl");
  });
});

describe("parseAttribution", () => {
  it("captures the referral code from ?ref and marks source=referral", () => {
    const a = parse("?ref=ABC123", "/il", "he");
    expect(a.referralCode).toBe("ABC123");
    expect(a.source).toBe("referral");
    expect(a.market).toBe("il");
    expect(a.landingAt).toBe(NOW);
  });

  it("accepts ?referral= as an alias", () => {
    expect(parse("?referral=XYZ").referralCode).toBe("XYZ");
  });

  it("captures all utm params and prefers utm_source for source", () => {
    const a = parse("?utm_source=instagram&utm_medium=reel&utm_campaign=avatar&utm_content=hook2&utm_term=sleep");
    expect(a.source).toBe("instagram");
    expect(a.utmSource).toBe("instagram");
    expect(a.utmMedium).toBe("reel");
    expect(a.utmCampaign).toBe("avatar");
    expect(a.utmContent).toBe("hook2");
    expect(a.utmTerm).toBe("sleep");
  });

  it("source priority: utm_source > referrer host > referral > direct", () => {
    expect(parse("?utm_source=tiktok", "/", undefined, "https://t.co/x").source).toBe("tiktok");
    expect(parse("", "/", undefined, "https://www.facebook.com/groups/x").source).toBe("facebook.com");
    expect(parse("?ref=R1", "/", undefined, undefined).source).toBe("referral");
    expect(parse("", "/", undefined, undefined).source).toBe("direct");
  });

  it("ignores a same-site referrer (treated as direct)", () => {
    expect(parse("", "/", undefined, "https://joinarbor.com/il", "joinarbor.com").source).toBe("direct");
  });

  it("leaves referralCode undefined when no ref param is present", () => {
    expect(parse("?utm_source=x").referralCode).toBeUndefined();
  });
});

describe("attributionProps", () => {
  it("returns {} for null", () => {
    expect(attributionProps(null)).toEqual({});
  });

  it("flattens, prefixes utm_, and drops undefined", () => {
    const a: Attribution = {
      referralCode: "ABC",
      source: "instagram",
      market: "il",
      utmSource: "instagram",
      utmMedium: "reel",
      landingAt: NOW,
    };
    expect(attributionProps(a)).toEqual({
      market: "il",
      source: "instagram",
      referral_code: "ABC",
      utm_source: "instagram",
      utm_medium: "reel",
    });
  });

  it("omits referral_code and utm_* when absent", () => {
    const a: Attribution = { source: "direct", market: "intl", landingAt: NOW };
    expect(attributionProps(a)).toEqual({ market: "intl", source: "direct" });
  });
});
