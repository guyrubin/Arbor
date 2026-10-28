/**
 * B-CAREPRO-47 — the signed-out /for-professionals page: static, account-free,
 * ten lines in English and the same ten in Hebrew, parent register, no claim
 * to treat (Care is a warm handoff to the family's own professionals), and no
 * claim-gate term — not even in a negation ("not a screening" still prints the
 * word). No form, no sign-up, no script, nothing loaded from elsewhere.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOR_PROFESSIONALS_URL } from "./legalLinks";

const APP = path.resolve(__dirname, "..", "..");
const PAGE = readFileSync(path.join(APP, "public", "for-professionals.html"), "utf8");
const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<style>[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const section = (lang: "en" | "he") => new RegExp(`<section lang="${lang}" dir="${lang === "he" ? "rtl" : "ltr"}"[^>]*>([\\s\\S]*?)</section>`).exec(PAGE)?.[1] ?? "";

/** The claim gate: clinical claims, verdict words and treatment claims. */
const DENY_EN = /\bdiagnos\w*|\bscreen(?:ing|s|ed)?\b|\bclinical(?:ly)?\b|\bvalidated\b|\bcertified\b|\btreat(?:s|ment|ing)?\b|\btherap(?:y|ies|ist)\b|\bcure\b|\bassess\w*|\bscore\w*|\brisk\b|\bdelay\w*|\bdisorder\w*|\bspecialist\w*|\bexpert\w*|%/i;
const DENY_HE = /אבחו|אבחנ|מאבח|סינון|קליני|טיפול|מטפל|תוקף|ציון|סיכון|עיכוב|הפרע|מומח|%/;

describe("B-CAREPRO-47 · /for-professionals", () => {
  it("is served at /for-professionals from the static file, before the app's catch-all", () => {
    const config = JSON.parse(readFileSync(path.join(APP, "..", "firebase.json"), "utf8"));
    const rewrites = config.hosting.rewrites as { source: string; destination?: string }[];
    const own = rewrites.findIndex((r) => r.source === "/for-professionals");
    expect(own).toBeGreaterThanOrEqual(0);
    expect(rewrites[own].destination).toBe("/for-professionals.html");
    expect(own).toBeLessThan(rewrites.findIndex((r) => r.source === "**"));
    expect(FOR_PROFESSIONALS_URL).toBe("https://arborparentingapp.com/for-professionals");
  });

  it("ten lines in English and the same ten in Hebrew, each in its own language and direction", () => {
    const en = section("en"), he = section("he");
    expect((en.match(/<li>/g) ?? []).length).toBe(10);
    expect((he.match(/<li>/g) ?? []).length).toBe(10);
    expect(text(he)).toMatch(/[֐-׿]/);
    expect(text(en)).not.toMatch(/[֐-׿]/);
  });

  it("is account-free: no form, no input, no script, nothing loaded from another origin", () => {
    expect(PAGE).not.toMatch(/<form|<input|<button|<script|<iframe|<img/i);
    expect(PAGE).not.toMatch(/(?:src|href)="https?:/i);
    expect(PAGE).not.toMatch(/@import|fonts\.googleapis|gstatic/i);
  });

  it("carries no claim-gate term in either language, not even in a negation", () => {
    const en = text(section("en")) + " " + text(PAGE.slice(PAGE.indexOf("<footer>")));
    const he = text(section("he"));
    expect(en.match(DENY_EN)?.[0] ?? null).toBeNull();
    expect(he.match(DENY_HE)?.[0] ?? null).toBeNull();
    // the warm handoff is said, the treatment claim is not
    expect(en).toContain("professionals they already work with");
    expect(he).toContain("לאנשי המקצוע שכבר מלווים אותה");
  });

  it("NEGATIVE CONTROL: the obvious drafts fail the gate", () => {
    expect("It is not a screening or a diagnosis.").toMatch(DENY_EN);
    expect("Our therapists treat your child.").toMatch(DENY_EN);
    expect("זה לא אבחון ולא סינון.").toMatch(DENY_HE);
  });

  it("#/science stays a live door to the page", () => {
    const science = readFileSync(path.join(APP, "src", "components", "tabs", "SciencePage.tsx"), "utf8");
    expect(science).toContain('onGo={() => void openLegalUrl(FOR_PROFESSIONALS_URL, { isNative: isNativePlatform })}');
    expect(science).toContain('testId="trust-for-professionals"');
  });
});
