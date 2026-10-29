// B-GA-19 (agent half): the native Google path and Sign in with Apple, in code — inert on the
// web and in a binary without the plugin, credential-only (skipNativeAuth) when the plugin ships.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const h = vi.hoisted(() => ({
  native: false,
  platform: "web" as "web" | "ios" | "android",
  pluginAvailable: false,
  calls: [] as unknown[][],
  result: { credential: { idToken: "id-token", accessToken: "access-token", nonce: "raw-nonce" } } as any,
}));
vi.mock("./runtime", () => ({ get isNativePlatform() { return h.native; }, get nativePlatform() { return h.platform; } }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isPluginAvailable: (name: string) => h.pluginAvailable && name === "FirebaseAuthentication" },
  registerPlugin: (name: string) => ({
    signInWithGoogle: async (o: unknown) => { h.calls.push([name, "google", o]); return h.result; },
    signInWithApple: async (o: unknown) => { h.calls.push([name, "apple", o]); return h.result; },
    signOut: async () => { h.calls.push([name, "signOut"]); },
  }),
}));
vi.mock("firebase/auth", () => {
  class OAuthProvider {
    scopes: string[] = [];
    constructor(public providerId: string) {}
    addScope(s: string) { this.scopes.push(s); }
    credential(c: unknown) { return { providerId: this.providerId, ...(c as object) }; }
  }
  return {
    OAuthProvider,
    GoogleAuthProvider: { credential: (idToken: string, accessToken?: string) => ({ providerId: "google.com", idToken, accessToken }) },
    signInWithCredential: async (auth: unknown, cred: unknown) => { h.calls.push(["firebase", "signInWithCredential", cred]); return { user: { uid: "u1" } }; },
  };
});

import { appleProvider, appleSignInOffered, isNativeCancel, nativeAppleSignIn, nativeGoogleSignIn, nativeSignInAvailable, nativeSignOut } from "./nativeSignIn";

const auth = {} as any;
beforeEach(() => { h.native = false; h.platform = "web"; h.pluginAvailable = false; h.calls = []; h.result = { credential: { idToken: "id-token", accessToken: "access-token", nonce: "raw-nonce" } }; });

describe("B-GA-19 — the native sign-in path", () => {
  it("is inert on the web and in a native binary that does not ship the plugin", async () => {
    expect(nativeSignInAvailable()).toBe(false);
    h.native = true; h.platform = "ios";
    expect(nativeSignInAvailable()).toBe(false);
    await nativeSignOut();
    expect(h.calls).toEqual([]);
  });

  it("native Google: the plugin returns the credential and the Firebase JS SDK signs in with it", async () => {
    h.native = true; h.platform = "android"; h.pluginAvailable = true;
    expect(nativeSignInAvailable()).toBe(true);
    await nativeGoogleSignIn(auth);
    expect(h.calls).toEqual([
      ["FirebaseAuthentication", "google", { skipNativeAuth: true }],
      ["firebase", "signInWithCredential", { providerId: "google.com", idToken: "id-token", accessToken: "access-token" }],
    ]);
  });

  it("native Apple: the nonce binds the token to the Firebase credential", async () => {
    h.native = true; h.platform = "ios"; h.pluginAvailable = true;
    await nativeAppleSignIn(auth);
    expect(h.calls[1]).toEqual(["firebase", "signInWithCredential", { providerId: "apple.com", idToken: "id-token", rawNonce: "raw-nonce" }]);
  });

  it("a missing ID token is a failed sign-in, never a half session; a closed sheet is not an error", async () => {
    h.native = true; h.platform = "ios"; h.pluginAvailable = true; h.result = { credential: null };
    await expect(nativeGoogleSignIn(auth)).rejects.toMatchObject({ code: "auth/invalid-credential" });
    await expect(nativeAppleSignIn(auth)).rejects.toMatchObject({ code: "auth/invalid-credential" });
    expect(h.calls.some((c) => c[1] === "signInWithCredential")).toBe(false);
    expect(isNativeCancel({ message: "The user canceled the sign-in flow." })).toBe(true);
    expect(isNativeCancel({ code: "auth/network-request-failed" })).toBe(false);
  });

  it("signs the platform account out too when the plugin is there", async () => {
    h.native = true; h.platform = "ios"; h.pluginAvailable = true;
    await nativeSignOut();
    expect(h.calls).toEqual([["FirebaseAuthentication", "signOut"]]);
  });
});

describe("B-GA-19 — Sign in with Apple is offered only where it can complete", () => {
  it("dark without the provider flag; on the web with it; in a native shell only on iOS with the plugin", () => {
    expect(appleSignInOffered(undefined)).toBe(false);
    expect(appleSignInOffered("true")).toBe(true);
    h.native = true; h.platform = "android"; h.pluginAvailable = true;
    expect(appleSignInOffered("true")).toBe(false);
    h.platform = "ios"; h.pluginAvailable = false;
    expect(appleSignInOffered("true")).toBe(false);
    h.pluginAvailable = true;
    expect(appleSignInOffered("true")).toBe(true);
    expect(appleSignInOffered("false")).toBe(false);
  });

  it("the web provider is apple.com asking for the e-mail and name", () => {
    const p = appleProvider() as any;
    expect(p.providerId).toBe("apple.com");
    expect(p.scopes).toEqual(["email", "name"]);
  });

  it("AuthContext routes Google through the platform when available, offers Apple and signs the platform out", () => {
    const ctx = readFileSync(path.join(__dirname, "..", "context", "AuthContext.tsx"), "utf8");
    const google = ctx.slice(ctx.indexOf("const signInWithGoogle = async"), ctx.indexOf("const signInWithApple = async"));
    expect(google.indexOf("if (nativeSignInAvailable())")).toBeLessThan(google.indexOf("signInWithPopup(auth, new GoogleAuthProvider())"));
    expect(google).toContain("await nativeGoogleSignIn(auth);");
    expect(ctx).toContain("if (nativeSignInAvailable()) await nativeAppleSignIn(auth);");
    expect(ctx).toContain("await signInWithPopup(auth, appleProvider());");
    expect(ctx).toContain("await nativeSignOut();");
    const login = readFileSync(path.join(__dirname, "..", "components", "auth", "LoginScreen.tsx"), "utf8");
    expect(login).toContain("const offerApple = appleSignInOffered();");
    expect(login).toContain("{offerApple && (");
    expect(login).toContain('{t("auth.continueApple")}');
  });
});
