/**
 * B-RESID-05 — e-mail sign-up through the real AuthContext handler (Firebase
 * faked): the account is created, then the confirmation link is sent, and only
 * a sent link marks the "we sent a link" line for the screen the family lands
 * on (lib/signupNotice). A refusal surfaces as an i18n key and marks nothing.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ calls: [] as string[], create: null as null | (() => Promise<unknown>), verify: null as null | (() => Promise<void>) }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), signInWithEmailAndPassword: vi.fn(), sendPasswordResetEmail: vi.fn(), signOut: vi.fn(),
  onAuthStateChanged: () => () => undefined,
  createUserWithEmailAndPassword: async (_auth: unknown, email: string) => { h.calls.push(`create:${email}`); return h.create!(); },
  sendEmailVerification: async (user: { uid: string }) => { h.calls.push(`verify:${user.uid}`); return h.verify!(); },
}));
vi.mock("../lib/firebase", () => ({ auth: {}, firebaseEnabled: true }));
vi.mock("../lib/api", () => ({ setAuthTokenProvider: () => undefined }));
vi.mock("../lib/naturalVoice", () => ({ initNaturalVoice: async () => undefined, resetNaturalVoice: () => undefined }));
vi.mock("../lib/analytics", () => ({ setAnalyticsUser: () => undefined }));
vi.mock("../lib/loopEvents", () => ({ trackSessionOpen: () => undefined }));
vi.mock("../lib/retentionRollup", () => ({ recordRetentionSession: () => undefined }));
vi.mock("../lib/heroRenderStore", () => ({ purgeAllHeroRenders: async () => undefined }));
vi.mock("../lib/bookAssetStore", () => ({ purgeBookAssets: async () => undefined }));
vi.mock("../lib/comicPrewarm", () => ({ clearPrewarmedComic: () => undefined }));
vi.mock("../components/kidmode/parentGate", () => ({ clearMathExit: () => { h.calls.push("clearMathExit"); } }));

import { AuthProvider, useAuth } from "./AuthContext";
import { clearVerifySent, verifySentPending } from "../lib/signupNotice";

function handlers() {
  let value: ReturnType<typeof useAuth> | null = null;
  const Capture = () => { value = useAuth(); return null; };
  renderToStaticMarkup(<AuthProvider><Capture /></AuthProvider>);
  return value!;
}

beforeEach(() => { h.calls = []; h.create = async () => ({ user: { uid: "new-family" } }); h.verify = async () => undefined; clearVerifySent(); });
afterEach(() => clearVerifySent());

describe("B-RESID-05 · signUpWithEmail", () => {
  it("creates the account, then sends the link, then marks the landing line", async () => {
    await handlers().signUpWithEmail("parent@example.com", "a-long-password");
    expect(h.calls).toEqual(["create:parent@example.com", "clearMathExit", "verify:new-family"]);
    expect(verifySentPending()).toBe(true);
  });

  it("a link that could not be sent leaves the account and marks nothing (the line would be untrue)", async () => {
    h.verify = async () => { throw new Error("quota"); };
    await expect(handlers().signUpWithEmail("parent@example.com", "a-long-password")).resolves.toBeUndefined();
    expect(h.calls).toEqual(["create:parent@example.com", "clearMathExit", "verify:new-family"]);
    expect(verifySentPending()).toBe(false);
  });

  it("an address already in use is refused: no link, no line, the error rethrown for the form", async () => {
    h.create = async () => { throw Object.assign(new Error("in use"), { code: "auth/email-already-in-use" }); };
    await expect(handlers().signUpWithEmail("parent@example.com", "a-long-password")).rejects.toMatchObject({ code: "auth/email-already-in-use" });
    expect(h.calls).toEqual(["create:parent@example.com"]);
    expect(verifySentPending()).toBe(false);
  });
});
