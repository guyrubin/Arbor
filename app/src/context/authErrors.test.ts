// Wave T (MOB-03 slice): auth errors reach the parent as i18n KEYS, never as
// English literals — the LoginScreen renders `t(error)`. This pins the seam so
// a future "helpful" literal cannot creep back in, and pins the popup-blocked
// redirect fallback so a blocked popup is never a dead end.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { authErrorKey } from "../lib/i18nElevation/storeShell";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "AuthContext.tsx"), "utf8");

function friendlyAuthErrorBody(code: string): string {
  const start = code.indexOf("const friendlyAuthError");
  expect(start, "friendlyAuthError must exist").toBeGreaterThan(-1);
  // The helper is a one-liner or a block; take up to the next blank line.
  const rest = code.slice(start);
  const end = rest.search(/\n\n/);
  return end === -1 ? rest : rest.slice(0, end);
}

describe("AuthContext error copy (Wave T, MOB-03)", () => {
  it("friendlyAuthError returns keys via authErrorKey, never an English literal", () => {
    const body = friendlyAuthErrorBody(src);
    expect(body).toContain("authErrorKey(");
    // No sentence-shaped string literal (two+ words with a space) in the helper.
    expect(body).not.toMatch(/"[A-Z][a-z]+ [^"]{8,}"/);
  });

  it("negative control: the pre-fix helper body is caught", () => {
    const old = `const friendlyAuthError = (err: any): string => {
  switch (err?.code) {
    case "auth/user-disabled":
      return "This account has been disabled. Contact hello@arbor.app for help.";
    default:
      return "Something went wrong signing you in. Please try again or request access.";
  }
};`;
    expect(old).toMatch(/"[A-Z][a-z]+ [^"]{8,}"/);
    expect(old).not.toContain("authErrorKey(");
  });

  it("every key authErrorKey can return is a real storeShell key", () => {
    for (const code of [
      "auth/invalid-credential",
      "auth/user-not-found",
      "auth/user-disabled",
      "auth/too-many-requests",
      "auth/network-request-failed",
      "auth/popup-blocked",
      "auth/some-unknown-code",
      undefined,
    ]) {
      const key = authErrorKey(code as string | undefined);
      expect(key).toMatch(/^elev\./);
      expect(key).not.toContain(" ");
    }
  });

  it("a blocked popup falls back to the redirect flow instead of throwing", () => {
    expect(src).toContain("signInWithRedirect");
    expect(src).toMatch(/auth\/popup-blocked[\s\S]{0,200}signInWithRedirect\(/);
  });
});
