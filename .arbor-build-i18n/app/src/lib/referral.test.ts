import { describe, it, expect } from "vitest";
import {
  referralCodeFromUid,
  buildJoinUrl,
  isSelfReferral,
  isActivated,
  canGrantReferralReward,
} from "./referral";

describe("referralCodeFromUid", () => {
  it("is deterministic — same uid always yields the same code", () => {
    expect(referralCodeFromUid("user-abc")).toBe(referralCodeFromUid("user-abc"));
  });

  it("returns a 7-char code from the unambiguous alphabet", () => {
    const code = referralCodeFromUid("some-firebase-uid-123");
    expect(code).toHaveLength(7);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{7}$/);
    // no ambiguous characters
    expect(code).not.toMatch(/[0O1IL]/);
  });

  it("distinguishes different uids", () => {
    const codes = new Set(
      ["a", "b", "c", "user-1", "user-2", "user-3", "xZ9", "firebase|long-uid-0001"].map(referralCodeFromUid),
    );
    expect(codes.size).toBe(8); // all distinct
  });

  it("returns empty string for an empty uid", () => {
    expect(referralCodeFromUid("")).toBe("");
  });
});

describe("buildJoinUrl", () => {
  it("builds the ref deep-link, trimming trailing slashes on the base", () => {
    expect(buildJoinUrl("https://joinarbor.com/", "ABC2345")).toBe("https://joinarbor.com/join?ref=ABC2345");
    expect(buildJoinUrl("https://joinarbor.com", "ABC2345")).toBe("https://joinarbor.com/join?ref=ABC2345");
  });

  it("falls back to the base root when there is no code", () => {
    expect(buildJoinUrl("https://joinarbor.com", "")).toBe("https://joinarbor.com/");
  });
});

describe("isSelfReferral", () => {
  it("flags a code that belongs to the recipient's own uid", () => {
    const uid = "user-self";
    expect(isSelfReferral(referralCodeFromUid(uid), uid)).toBe(true);
  });
  it("does not flag a genuine third-party referral", () => {
    expect(isSelfReferral(referralCodeFromUid("inviter"), "different-recipient")).toBe(false);
  });
  it("is false when either side is missing", () => {
    expect(isSelfReferral(undefined, "x")).toBe(false);
    expect(isSelfReferral("CODE", undefined)).toBe(false);
  });
});

describe("isActivated", () => {
  it("requires both a profile and a first coach interaction", () => {
    expect(isActivated({ hasProfile: true, hadFirstCoachInteraction: true })).toBe(true);
    expect(isActivated({ hasProfile: true, hadFirstCoachInteraction: false })).toBe(false);
    expect(isActivated({ hasProfile: false, hadFirstCoachInteraction: true })).toBe(false);
    expect(isActivated(null)).toBe(false);
  });
});

describe("canGrantReferralReward", () => {
  const activated = { hasProfile: true, hadFirstCoachInteraction: true };

  it("grants when a real referral has activated and was not yet rewarded", () => {
    expect(canGrantReferralReward({
      inviterCode: referralCodeFromUid("inviter"),
      recipientUid: "recipient",
      activation: activated,
      alreadyRewarded: false,
    })).toBe(true);
  });

  it("blocks a self-referral", () => {
    const uid = "cheater";
    expect(canGrantReferralReward({
      inviterCode: referralCodeFromUid(uid),
      recipientUid: uid,
      activation: activated,
      alreadyRewarded: false,
    })).toBe(false);
  });

  it("blocks a not-yet-activated recipient", () => {
    expect(canGrantReferralReward({
      inviterCode: referralCodeFromUid("inviter"),
      recipientUid: "recipient",
      activation: { hasProfile: true, hadFirstCoachInteraction: false },
      alreadyRewarded: false,
    })).toBe(false);
  });

  it("blocks a double reward", () => {
    expect(canGrantReferralReward({
      inviterCode: referralCodeFromUid("inviter"),
      recipientUid: "recipient",
      activation: activated,
      alreadyRewarded: true,
    })).toBe(false);
  });

  it("blocks when there is no inviter code", () => {
    expect(canGrantReferralReward({
      inviterCode: undefined,
      recipientUid: "recipient",
      activation: activated,
      alreadyRewarded: false,
    })).toBe(false);
  });
});
