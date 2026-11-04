import { describe, expect, it } from "vitest";
import { OFFERS, OFFER_IDS, normalizeOfferCode, offerForCode, redemptionViaOf } from "./offers";
import { codeForUid } from "../server/referral";

describe("B-GROWTH-43 — the offer record", () => {
  it("a minted referral code, linked or typed, leads to the approved referral month", () => {
    const code = codeForUid("uid_A", "salt");
    expect(offerForCode(code)?.id).toBe("referral_month");
    const body = code.slice("ARBOR-".length);
    for (const typed of [code.toLowerCase(), body, ` ${body.slice(0, 4)} ${body.slice(4)} `, `arbor ${body.toLowerCase()}`, `ARBOR--${body}`]) {
      expect(normalizeOfferCode(typed), typed).toBe(code);
      expect(offerForCode(normalizeOfferCode(typed))?.id, typed).toBe("referral_month");
    }
  });

  it("an ill-formed code leads nowhere and is not reshaped into a real one", () => {
    for (const bad of ["", "ARBOR-NOPENOPE", "ARBOR-1234567", "hello", "ARBOR-ABCDEFGHJ"]) {
      expect(offerForCode(normalizeOfferCode(bad)), bad).toBeNull();
    }
    expect(normalizeOfferCode(" arbor-nopenope ")).toBe("ARBOR-NOPENOPE");
  });

  it("only an approved offer with a grant length is ever granted; the founding offer waits for Guy", () => {
    expect(OFFER_IDS).toEqual(["referral_month", "founding_family"]);
    expect(OFFERS.referral_month).toMatchObject({ approved: true, grantDays: 30, grantsReferrer: true, version: 1 });
    expect(OFFERS.founding_family).toMatchObject({ approved: false, grantDays: null });
    for (const offer of Object.values(OFFERS)) {
      if (!offer.approved) expect(offer.grantDays, offer.id).toBeNull();
    }
  });

  it("how a code was entered is link unless the client says typed", () => {
    expect(redemptionViaOf("typed")).toBe("typed");
    for (const other of [undefined, null, "link", "TYPED", 1]) expect(redemptionViaOf(other)).toBe("link");
  });
});
