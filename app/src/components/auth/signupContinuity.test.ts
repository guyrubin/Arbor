/**
 * B-RESID-05 (the agent half) — a new family joins with e-mail or Google, the
 * invite-only gate is gone, and the referral and UTM a visitor arrived with
 * survive the sign-in round trip, once. (Claim copy is Guy's review; anonymous
 * private API access is pinned in server/anonymousApi.guard.test.ts.)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { AUTH_ERROR_CODES, authErrorKey } from "../../lib/i18nElevation/storeShell";
import { captureAttribution, consumeReferralCode, loadAttribution } from "../../lib/attribution";

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (code: string) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const LOGIN = strip(readFileSync(path.join(here, "LoginScreen.tsx"), "utf8"));
const AUTH = strip(readFileSync(path.join(here, "..", "..", "context", "AuthContext.tsx"), "utf8"));

const INVITE_EN = /invite|request access|been invited/i;
const INVITE_HE = /הזמנה|הוזמנ|בקשת גישה|בקשו גישה/;

describe("B-RESID-05 · the front door is open: no invite-only wording, no access request", () => {
  it("the login screen carries no invite-only line and no access-request control", () => {
    for (const gone of ['"auth.inviteOnly"', "auth.requestAccess", "login-request-access", "api.requestAccess", "handleAccessRequest"]) {
      expect(LOGIN, gone).not.toContain(gone);
    }
  });

  it("no sign-in copy the parent can see, in EN or HE, says the app is by invitation or asks for access", () => {
    // Every key the login screen renders, plus every sign-in error it can show.
    const shown = [...new Set([...LOGIN.matchAll(/\bt\("([a-zA-Z0-9_.-]+)"/g)].map((m) => m[1]))];
    expect(shown.length).toBeGreaterThan(12);
    for (const k of [...shown, ...AUTH_ERROR_CODES.map((c) => authErrorKey(c)), authErrorKey("auth/unknown")]) {
      expect(translate("en", k), k).not.toMatch(INVITE_EN);
      expect(translate("he", k), k).not.toMatch(INVITE_HE);
    }
    // negative control: the dropped lines (B-RESID-05 deleted their keys) fail the rule
    expect("Invite-only for now.").toMatch(INVITE_EN);
    expect("No Arbor account found for this email. Request access if you haven't been invited yet.").toMatch(INVITE_EN);
    expect("בהזמנה בלבד בשלב זה.").toMatch(INVITE_HE);
    expect("נסו שוב או בקשו גישה.").toMatch(INVITE_HE);
  });

  it("the access-request strings are gone from the dictionary in both languages, so nothing can render them", () => {
    for (const k of ["auth.inviteOnly", "auth.requestAccess", "auth.requestingAccess", "auth.accessNeedEmail", "auth.accessInvalidEmail", "auth.accessPrivacy", "auth.accessReceived", "auth.accessFail"]) {
      expect(translate("en", k), k).toBe(k);
      expect(translate("he", k), k).toBe(k);
    }
  });
});

describe("B-RESID-05 · a new family creates its account with e-mail (Google stays)", () => {
  it("one e-mail form, two modes: sign in, or create an account", () => {
    const submit = LOGIN.slice(LOGIN.indexOf("const handleEmail"), LOGIN.indexOf("return (\n"));
    expect(submit).toMatch(/if \(mode === "signup"\) \{\s*await signUpWithEmail\(email\.trim\(\), password\);\s*\} else \{\s*await signInWithEmail\(email\.trim\(\), password\);/);
    // The screen unmounts once the account exists, so it says nothing more:
    // the confirmation-link line is said where the parent lands.
    expect(LOGIN).not.toContain("elev.auth.signup.verifySent");
    expect(LOGIN).toContain('data-testid="login-mode-switch"');
    expect(LOGIN).toContain('{mode === "signup" ? t("elev.auth.signup.cta") : t("auth.signIn")}');
    expect(LOGIN).toContain('{mode === "signin" ? t("elev.auth.signup.toSignup") : t("elev.auth.signup.toSignin")}');
    // Recovery is the existing reset, offered while signing in.
    expect(LOGIN).toContain('{mode === "signin" && <button type="button" data-testid="login-forgot" onClick={handleReset}');
    // Google remains the first door.
    expect(LOGIN).toContain('t("auth.continueGoogle")');
  });

  it("sign-up creates the account, then sends the confirmation link; refusals are keys, never Firebase text", () => {
    const signUp = AUTH.slice(AUTH.indexOf("const signUpWithEmail"), AUTH.indexOf("const resetPassword"));
    expect(signUp).toMatch(/const credential = await createUserWithEmailAndPassword\(auth, email, password\);/);
    expect(signUp).toMatch(/await sendEmailVerification\(credential\.user\);\s*markVerifySent\(\);/);
    expect(signUp.indexOf("createUserWithEmailAndPassword")).toBeLessThan(signUp.indexOf("sendEmailVerification"));
    expect(signUp).toContain("setError(friendlyAuthError(err));");
    expect(AUTH).toMatch(/signInWithEmail,\s*signUpWithEmail,\s*resetPassword,/);
  });

  it.each(["en", "he"] as const)("%s: the sign-up strings exist, and the two sign-up refusals have their own words", (lang) => {
    for (const k of ["elev.auth.signup.cta", "elev.auth.signup.toSignup", "elev.auth.signup.toSignin", "elev.auth.signup.passwordHint", "elev.auth.signup.verifySent"]) {
      const text = translate(lang, k);
      expect(text, k).not.toBe(k);
      if (lang === "he") { expect(text, k).toMatch(/[֐-׿]/); expect(text).not.toBe(translate("en", k)); }
    }
    expect(authErrorKey("auth/email-already-in-use")).toBe("elev.storeshell.auth.err.emailInUse");
    expect(authErrorKey("auth/weak-password")).toBe("elev.storeshell.auth.err.weakPassword");
    for (const k of ["elev.storeshell.auth.err.emailInUse", "elev.storeshell.auth.err.weakPassword"]) expect(translate(lang, k), k).not.toBe(k);
  });
});

describe("B-RESID-05 · the referral and UTM a visitor arrived with survive sign-in, once", () => {
  const store = new Map<string, string>();
  const stubBrowser = (url: string, referrer = "") => {
    const u = new URL(url);
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    vi.stubGlobal("location", { search: u.search, pathname: u.pathname, hostname: u.hostname });
    vi.stubGlobal("document", { documentElement: { lang: "he" }, referrer });
  };
  afterEach(() => { vi.unstubAllGlobals(); store.clear(); });

  it("a shared link's ref + utm_* are kept from the landing through the post-sign-in reload", () => {
    stubBrowser("https://arbor.example/il?ref=ABC2345&utm_source=share&utm_medium=comic&utm_campaign=organic_share", "https://wa.me/");
    const landing = captureAttribution();
    expect(landing).toMatchObject({ referralCode: "ABC2345", utmSource: "share", utmMedium: "comic", utmCampaign: "organic_share", market: "il", source: "share" });
    // Google's redirect (or an e-mail sign-in) brings the parent back to the app without the query.
    stubBrowser("https://arbor.example/#/overview");
    const afterAuth = captureAttribution();
    expect(afterAuth).toEqual(landing);
    expect(loadAttribution()).toEqual(landing);
    expect(consumeReferralCode()).toBe("ABC2345");
  });

  it("a later visit never rewrites the channel that brought the family (first touch, once)", () => {
    stubBrowser("https://arbor.example/?ref=FIRST22&utm_source=share&utm_medium=story");
    const first = captureAttribution();
    stubBrowser("https://arbor.example/?ref=OTHER33&utm_source=newsletter");
    expect(captureAttribution()).toEqual(first);
    expect(consumeReferralCode()).toBe("FIRST22");
  });
});
