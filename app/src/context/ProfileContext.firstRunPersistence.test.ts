import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { ChildProfile } from "../types";
import { CLEARABLE_PROFILE_FIELDS, RETIRED_PROFILE_FIELDS } from "../lib/childAge";

/** Execute the real provider's update callback with hooks and Firestore at
 * explicit offline boundaries. No effects run, so no ownership/network work. */
type TestProvider = {
  updateChild: (id: string, patch: Partial<ChildProfile>) => Promise<boolean>;
  addChild: (input: Omit<ChildProfile, "id">) => Promise<ChildProfile>;
};
function harness() {
  let profiles = [{ id: "child-a" }, { id: "child-b" }] as ChildProfile[];
  let stateIndex = 0;
  const updateDoc = vi.fn<(...args: unknown[]) => Promise<void>>();
  const setDoc = vi.fn<(...args: unknown[]) => Promise<void>>();
  const react = {
    createContext: () => ({ Provider: "Provider" }), useContext: () => null,
    useEffect: () => {}, useCallback: (fn: unknown) => fn, useRef: (value: unknown) => ({ current: value }),
    useState: (value: unknown) => {
      const index = stateIndex++;
      if (index === 0) return [profiles, (next: (p: ChildProfile[]) => ChildProfile[]) => { profiles = next(profiles); }];
      return [typeof value === "function" ? value() : value, () => {}];
    },
    createElement: (_type: unknown, props: { value: TestProvider }) => props.value,
  };
  const auth = { currentUser: { uid: "owner" } };
  const imports: Record<string, unknown> = {
    react: { __esModule: true, default: react, ...react },
    "firebase/auth": { onAuthStateChanged: () => () => {} },
    "firebase/firestore": { updateDoc, setDoc, doc: (_db: unknown, ...p: string[]) => p.join("/"), deleteField: () => "deleted" },
    "../lib/firebase": { db: {}, auth, firebaseEnabled: true }, "./AuthContext": { useAuth: () => ({ user: { uid: "owner" }, firebaseEnabled: true }) },
    "../initialData": { defaultChildProfile: profiles[0] }, "../lib/childData": {}, "../lib/childLocalState": {},
    "../lib/api": {}, "../lib/loopEvents": {}, "../lib/screening": {},
    "../lib/onboardingGate": { computeNeedsOnboarding: () => false },
    "../lib/childAge": { CLEARABLE_PROFILE_FIELDS, RETIRED_PROFILE_FIELDS },
  };
  const code = ts.transpileModule(readFileSync(new URL("./ProfileContext.tsx", import.meta.url), "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as { ProfileProvider: (props: { children: null }) => TestProvider } };
  new Function("require", "module", "exports", "localStorage", code)((name: string) => {
    if (!(name in imports)) throw new Error("Unmocked boundary: " + name);
    return imports[name];
  }, module, module.exports, { getItem: () => "child-a" });
  const provider = module.exports.ProfileProvider({ children: null });
  return { ...provider, updateDoc, setDoc, profiles: () => profiles };
}
describe("B-SHELL-36 onboarding completion persistence", () => {
  it("a deferred completion keeps the profile incomplete until persistence confirms it", async () => {
    const h = harness(); let resolve!: () => void;
    h.updateDoc.mockReturnValueOnce(new Promise<void>(done => { resolve = done; }));
    const saving = h.updateChild("child-a", { onboardingComplete: true, onboardingCompletedAt: "2026-10-09T21:00:00Z" });
    expect(h.profiles()[0].onboardingComplete).not.toBe(true);
    expect(h.profiles()[1].onboardingComplete).toBeUndefined();
    resolve(); expect(await saving).toBe(true); expect(h.profiles()[0].onboardingComplete).toBe(true);
  });
  it("a rejected completion cannot unmount setup or alter a sibling", async () => {
    const h = harness(); h.updateDoc.mockRejectedValueOnce(new Error("offline"));
    expect(await h.updateChild("child-a", { onboardingComplete: true })).toBe(false);
    expect(h.profiles()[0].onboardingComplete).not.toBe(true); expect(h.profiles()[1].onboardingComplete).toBeUndefined();
  });
  it("a later rejection never reverts another successfully completed write", async () => {
    const h = harness(); let reject!: (e: Error) => void;
    h.updateDoc.mockReturnValueOnce(new Promise<void>((_done, no) => { reject = no; }));
    const old = h.updateChild("child-a", { onboardingComplete: true });
    h.updateDoc.mockResolvedValueOnce(); expect(await h.updateChild("child-a", { onboardingComplete: true, name: "Saved name" })).toBe(true);
    reject(new Error("old write failed")); expect(await old).toBe(false);
    expect(h.profiles()[0]).toMatchObject({ onboardingComplete: true, name: "Saved name" });
  });
});


describe("B-SHELL-36 onboarding create persistence", () => {
  const input = { name: "Noa", age: 4, birthMonth: "2022-04", languages: ["English"], schoolContext: "", strengths: [], challenges: [], onboardingComplete: false };
  it("a deferred/rejected remote create never installs a phantom local child", async () => {
    const h = harness(); let reject!: (e: Error) => void;
    h.setDoc.mockReturnValueOnce(new Promise<void>((_done, no) => { reject = no; }));
    const creating = h.addChild(input); expect(h.profiles()).toHaveLength(2);
    const rejected = expect(creating).rejects.toThrow("offline"); reject(new Error("offline")); await rejected;
    expect(h.profiles()).toHaveLength(2); expect(h.updateDoc).not.toHaveBeenCalled();
    h.setDoc.mockResolvedValueOnce(); const created = await h.addChild(input);
    expect(h.profiles()).toHaveLength(3); expect(created.onboardingComplete).toBe(false);
    expect(h.profiles().filter(profile => profile.id === created.id)).toHaveLength(1);
  });
});


describe("review: first-run draft persistence boundary", () => {
  const draft = { step: 3 as const, choice: "talking" as const, words: "", quote: "bus", hardMomentId: "" };
  it("failed draft checkpoints never become local resume data", async () => {
    const h = harness(); h.updateDoc.mockRejectedValueOnce(new Error("offline"));
    expect(await h.updateChild("child-a", { onboardingDraft: draft })).toBe(false);
    expect(h.profiles()[0].onboardingDraft).toBeUndefined();
  });
  it("completion sends a Firestore deleteField sentinel and removes the draft locally", async () => {
    const h = harness(); h.updateDoc.mockResolvedValue();
    await h.updateChild("child-a", { onboardingDraft: draft });
    expect(h.profiles()[0].onboardingDraft?.quote).toBe("bus");
    expect(await h.updateChild("child-a", { onboardingComplete: true, onboardingDraft: undefined })).toBe(true);
    expect(h.updateDoc.mock.calls.at(-1)?.[1]).toMatchObject({ onboardingComplete: true, onboardingDraft: "deleted" });
    expect(Object.hasOwn(h.profiles()[0], "onboardingDraft")).toBe(false);
  });
});
