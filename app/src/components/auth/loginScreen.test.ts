/**
 * MOB-03 ungated slice (wave T) — password autofill + auth errors as keys.
 *
 *  - The email / password inputs carry `name` + `autoComplete` (+ `inputMode`
 *    on email) so iOS Keychain / Google Password Manager offer credentials.
 *  - The error line renders `t(error)`: AuthContext can hand it an i18n key
 *    (authErrorKey in lib/i18nElevation/storeShell) — every code maps to a
 *    key that exists in EN + HE, never a literal sentence.
 *
 * Cross-lane remainder (context/AuthContext.tsx, not lane S): return
 * `authErrorKey(err?.code)` instead of the English literals, and add the
 * signInWithRedirect fallback on auth/popup-blocked.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AUTH_ERROR_CODES, authErrorKey, en as shellEn, he as shellHe } from "../../lib/i18nElevation/storeShell";

const here = path.dirname(fileURLToPath(import.meta.url));
const login = readFileSync(path.join(here, "LoginScreen.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const inputTag = (type: string): string => {
  const m = login.match(new RegExp(`<input\\s+type="${type}"[\\s\\S]*?\\/>`));
  expect(m, `<input type="${type}"> not found`).toBeTruthy();
  return m![0];
};

describe("LoginScreen inputs are autofill-ready", () => {
  it("email: name=email, autoComplete=email, inputMode=email", () => {
    const tag = inputTag("email");
    expect(tag).toContain('name="email"');
    expect(tag).toContain('autoComplete="email"');
    expect(tag).toContain('inputMode="email"');
  });

  it("password: name=password, autoComplete=current-password", () => {
    const tag = inputTag("password");
    expect(tag).toContain('name="password"');
    expect(tag).toContain('autoComplete="current-password"');
  });

  it("negative control: the matcher sees a bare pre-fix input as lacking autofill", () => {
    const preFix = '<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />';
    expect(preFix).not.toContain("autoComplete");
  });
});

describe("auth errors are keys, resolved through t()", () => {
  it("LoginScreen renders the error through t(error), not as a raw string", () => {
    expect(login).toMatch(/\{t\(error\)\}/);
    expect(login).not.toMatch(/>\s*\{error\}\s*</);
  });

  it("authErrorKey maps every known code (and the unknown default) to a key present in EN + HE", () => {
    for (const code of [...AUTH_ERROR_CODES, "auth/something-new", undefined]) {
      const key = authErrorKey(code);
      expect(key.startsWith("elev.storeshell.auth.err."), `${code} → ${key}`).toBe(true);
      expect(key).not.toMatch(/\s/); // a key, never a sentence
      expect(shellEn[key], `en missing ${key}`).toBeTruthy();
      expect(shellHe[key], `he missing ${key}`).toBeTruthy();
      expect(shellHe[key]).not.toBe(shellEn[key]);
    }
  });

  it("no auth error copy carries a support mailbox literal (MOB-05: the domain is unsettled)", () => {
    for (const key of Object.keys(shellEn).filter((k) => k.startsWith("elev.storeshell.auth.err."))) {
      expect(shellEn[key]).not.toMatch(/@arbor\./);
      expect(shellHe[key]).not.toMatch(/@arbor\./);
    }
  });
});
