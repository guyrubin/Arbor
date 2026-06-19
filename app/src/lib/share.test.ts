import { describe, it, expect } from "vitest";
import { buildShareUrl, buildShareCaption, SHARE_URL } from "./share";

describe("buildShareUrl", () => {
  it("bakes UTM params (source/medium/campaign) keyed to the artifact", () => {
    const url = new URL(buildShareUrl({ artifact: "avatar" }));
    expect(url.searchParams.get("utm_source")).toBe("share");
    expect(url.searchParams.get("utm_medium")).toBe("avatar");
    expect(url.searchParams.get("utm_campaign")).toBe("organic_share");
  });

  it("includes ref= when a referral code is present", () => {
    const url = new URL(buildShareUrl({ artifact: "answer_card", refCode: "MAYA42" }));
    expect(url.searchParams.get("ref")).toBe("MAYA42");
    expect(url.searchParams.get("utm_medium")).toBe("answer_card");
  });

  it("omits ref= when no referral code (UTM-only), per the soft dep", () => {
    const url = new URL(buildShareUrl({ artifact: "story" }));
    expect(url.searchParams.has("ref")).toBe(false);
    expect(url.searchParams.get("utm_source")).toBe("share");
  });

  it("reflects the market in the path prefix, except intl", () => {
    expect(buildShareUrl({ artifact: "avatar", market: "il" })).toContain("/il");
    expect(buildShareUrl({ artifact: "avatar", market: "nl" })).toContain("/nl");
    expect(buildShareUrl({ artifact: "avatar", market: "intl" })).not.toMatch(/\/intl/);
  });

  it("defaults to the canonical SHARE_URL origin", () => {
    expect(buildShareUrl({ artifact: "avatar" }).startsWith(SHARE_URL)).toBe(true);
  });

  it("honors an explicit base override (mk-p0-1 domain swap)", () => {
    const url = buildShareUrl({ artifact: "avatar", base: "https://arbor.app/" });
    expect(url.startsWith("https://arbor.app/")).toBe(true);
  });
});

describe("buildShareCaption", () => {
  it("substitutes {name} and {url} into the localized template", () => {
    const out = buildShareCaption({
      template: "Meet {name}, an Arbor hero. {url}",
      name: "Maya",
      url: "https://arbor.app/?ref=X",
    });
    expect(out).toBe("Meet Maya, an Arbor hero. https://arbor.app/?ref=X");
  });

  it("handles an empty name without leaving a stray placeholder", () => {
    const out = buildShareCaption({ template: "{name}'s story. {url}", name: "", url: "U" });
    expect(out).not.toContain("{name}");
    expect(out).toContain("U");
  });

  it("replaces every {url} occurrence", () => {
    const out = buildShareCaption({ template: "{url} … {url}", name: "", url: "Z" });
    expect(out).toBe("Z … Z");
  });
});
