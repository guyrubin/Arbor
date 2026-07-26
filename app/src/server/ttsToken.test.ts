/**
 * AI-V5 — screened-sentence HMAC token unit contract: a token is valid ONLY
 * for the exact text + lang it was minted for, within its TTL; every defect
 * (altered text, wrong lang, expiry, malformed shape, forged signature) fails
 * verification so /api/tts falls back to the FULL screen.
 */
import { describe, expect, it } from "vitest";
import { mintTtsToken, verifyTtsToken, TTS_TOKEN_TTL_MS } from "./ttsToken.js";

const TEXT = "Take a slow breath together and name the feeling.";

describe("mintTtsToken / verifyTtsToken", () => {
  it("round-trips for the exact text + lang", () => {
    const token = mintTtsToken(TEXT, "en");
    expect(verifyTtsToken(token, TEXT, "en")).toBe(true);
  });

  it("fails for text altered by ONE character", () => {
    const token = mintTtsToken(TEXT, "en");
    expect(verifyTtsToken(token, `${TEXT}!`, "en")).toBe(false);
    expect(verifyTtsToken(token, TEXT.slice(0, -1), "en")).toBe(false);
    expect(verifyTtsToken(token, ` ${TEXT}`, "en")).toBe(false);
  });

  it("fails for the wrong language", () => {
    const token = mintTtsToken(TEXT, "en");
    expect(verifyTtsToken(token, TEXT, "he")).toBe(false);
  });

  it("expires after the TTL", () => {
    const mintedAt = 1_000_000_000_000;
    const token = mintTtsToken(TEXT, "en", mintedAt);
    expect(verifyTtsToken(token, TEXT, "en", mintedAt + TTS_TOKEN_TTL_MS - 1)).toBe(true);
    expect(verifyTtsToken(token, TEXT, "en", mintedAt + TTS_TOKEN_TTL_MS)).toBe(false);
    expect(verifyTtsToken(token, TEXT, "en", mintedAt + TTS_TOKEN_TTL_MS + 60_000)).toBe(false);
  });

  it("rejects a tampered expiry (the signature binds it)", () => {
    const token = mintTtsToken(TEXT, "en");
    const [exp, sig] = token.split(".");
    const later = `${Number(exp) + 3_600_000}.${sig}`;
    expect(verifyTtsToken(later, TEXT, "en")).toBe(false);
  });

  it("rejects malformed and absent tokens", () => {
    expect(verifyTtsToken(undefined, TEXT, "en")).toBe(false);
    expect(verifyTtsToken(null, TEXT, "en")).toBe(false);
    expect(verifyTtsToken("", TEXT, "en")).toBe(false);
    expect(verifyTtsToken("garbage", TEXT, "en")).toBe(false);
    expect(verifyTtsToken(".abcdef", TEXT, "en")).toBe(false);
    expect(verifyTtsToken(`${Date.now() + 60_000}.`, TEXT, "en")).toBe(false);
    expect(verifyTtsToken(`${Date.now() + 60_000}.deadbeef`, TEXT, "en")).toBe(false);
    expect(verifyTtsToken(12345, TEXT, "en")).toBe(false);
  });

  it("Hebrew text round-trips (unicode-safe hashing)", () => {
    const he = "ניקח נשימה איטית ביחד.";
    const token = mintTtsToken(he, "he");
    expect(verifyTtsToken(token, he, "he")).toBe(true);
    expect(verifyTtsToken(token, he, "en")).toBe(false);
  });
});
