import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { ChildProfile } from "../types";
import { harness } from "./ProfileContext.testSupport";

const child = (id: string, name = id): ChildProfile => ({ id, name, age: 4, birthMonth: "2022-04", languages: ["English"], schoolContext: "", strengths: [], challenges: [], onboardingComplete: false });
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const provisionedIds = (h: ReturnType<typeof harness>) => h.calls.fetch.map(call => JSON.parse(String(call.opts.body)).childId);

describe("profile lifetime boundaries", () => {
  it("signed-in read failure never imports unowned cache or starts fake onboarding", async () => {
    const h = harness(); h.transport.read = async () => { throw Error("offline"); }; h.effects(); await h.flush();
    expect(h.value.profiles).toEqual([]); expect(h.calls.localReads).not.toContain("arbor.children");
    expect(h.value.loadError).toBe(true); expect(h.value.needsOnboarding).toBe(false);
  });
  it("an empty answer from the offline cache is not 'no children': Retry, never onboarding", async () => {
    const h = harness(); h.transport.read = async () => []; h.transport.fromCache = true; h.effects(); await h.flush();
    expect(h.value.loadError).toBe(true); expect(h.value.needsOnboarding).toBe(false);
    // Control: the same empty answer confirmed by the server is a new account.
    const fresh = harness(); fresh.transport.read = async () => []; fresh.effects(); await fresh.flush();
    expect(fresh.value.loadError).toBe(false); expect(fresh.value.needsOnboarding).toBe(true);
  });
  it("late A load neither displays nor provisions after B", async () => {
    const h = harness(), a = deferred<ChildProfile[]>();
    h.transport.read = path => path.includes("/A/") ? a.promise : Promise.resolve([child("B-child")]);
    h.effects(); h.setOwner("B"); await h.flush(); a.resolve([child("A-child")]); await h.flush();
    expect(h.value.profiles.map(p => p.id)).toEqual(["B-child"]); expect(provisionedIds(h)).not.toContain("A-child");
  });
  it("a late token cannot provision A data with B credentials", async () => {
    const h = harness(), a = deferred<{ Authorization: string }>(); h.transport.headers = () => a.promise;
    h.effects(); await h.flush(); h.transport.read = async () => []; h.setOwner("B"); await h.flush();
    a.resolve({ Authorization: "test-B" }); await h.flush(); expect(provisionedIds(h)).not.toContain("A-child");
  });
  it("late create never appends an A child to B state", async () => {
    const h = harness(); h.effects(); await h.flush(); const a = deferred(); h.transport.set = () => a.promise;
    const { id: _id, ...input } = child("ignored"); const creating = h.value.addChild(input).catch(() => undefined);
    h.transport.read = async () => [child("B-child")]; h.setOwner("B"); await h.flush(); a.resolve(); await creating; await h.flush();
    expect(h.value.profiles.map(p => p.id)).toEqual(["B-child"]); expect(provisionedIds(h).filter(id => id.startsWith("child-"))).toEqual([]);
  });
  it("late update cannot mutate B's same-ID child", async () => {
    const h = harness({ rows: [child("same-child", "Owner A")] }); h.effects(); await h.flush();
    const a = deferred(); h.transport.update = () => a.promise; const updating = h.value.updateChild("same-child", { name: "A edit" });
    h.transport.read = async () => [child("same-child", "Owner B")]; h.setOwner("B"); await h.flush(); a.resolve();
    expect(await updating).toBe(false); await h.flush(); expect(h.value.profiles[0].name).toBe("Owner B");
  });
  it("old callbacks cannot begin new writes after an owner change", async () => {
    const h = harness(); h.effects(); await h.flush(); const old = h.value;
    h.setOwner("B"); await h.flush(); const writes = h.calls.updates.length;
    expect(await old.updateChild("A-child", { name: "A edit" })).toBe(false); expect(h.calls.updates).toHaveLength(writes);
    const { id: _id, ...input } = child("ignored"); await expect(old.addChild(input)).rejects.toThrow("session changed"); expect(h.calls.sets).toHaveLength(0);
  });
  it("failed draft checkpoint stays incomplete through provider rerender", async () => {
    const h = harness(); h.effects(); await h.flush(); h.transport.update = async () => { throw Error("offline"); };
    expect(await h.value.updateChild("A-child", { onboardingDraft: { step: 3, choice: "hands", words: "Buttons", quote: "", hardMomentId: "" } })).toBe(false);
    await h.flush(); expect(h.value.profiles[0].onboardingDraft).toBeUndefined();
  });
  it("child A→B→A retires a pending onboarding checkpoint even when selection returns", async () => {
    const h = harness({ rows: [child("child-a"), child("child-b")] }); h.effects(); await h.flush();
    h.value.setActiveChild("child-a"); await h.flush();
    const pending = deferred(); h.transport.update = () => pending.promise;
    const saving = h.value.updateChild("child-a", { onboardingComplete: true });
    h.value.setActiveChild("child-b"); await h.flush(); h.value.setActiveChild("child-a"); await h.flush();
    pending.resolve(); expect(await saving).toBe(false); await h.flush();
    expect(h.value.profiles.find(p => p.id === "child-a")?.onboardingComplete).toBe(false);
  });
  it("same-render child A→B→A retires a pending first-child create", async () => {
    const h = harness({ rows: [child("child-a"), child("child-b")] }); h.effects(); await h.flush();
    const pending = deferred(); h.transport.set = () => pending.promise;
    const { id: _id, ...input } = child("ignored"); const creating = h.value.addChild(input);
    const rejected = expect(creating).rejects.toThrow("session changed");
    h.value.setActiveChild("child-b"); h.value.setActiveChild("child-a");
    pending.resolve(); await rejected; await h.flush();
    expect(h.value.profiles).toHaveLength(2);
  });
  it("same-account explicit retry recovers without local data", async () => {
    const h = harness(); h.transport.read = async () => { throw Error("offline"); }; h.effects(); await h.flush();
    h.transport.read = async () => [child("A-child", "Recovered")]; h.value.retryProfiles(); await h.flush();
    expect(h.value.loadError).toBe(false); expect(h.value.loading).toBe(false); expect(h.value.profiles[0].name).toBe("Recovered");
    expect(h.calls.localReads).not.toContain("arbor.children");
  });
  it("returning to A retries cancelled ownership without a retained in-flight marker", async () => {
    const h = harness(), token = deferred<{ Authorization: string }>(); h.transport.headers = () => token.promise;
    h.effects(); await h.flush(); h.transport.read = async path => path.includes("/A/") ? [child("A-child")] : [];
    h.setOwner("B"); await h.flush(); token.resolve({ Authorization: "old-A" }); await h.flush();
    h.transport.headers = async () => ({ Authorization: "new-A" }); h.setOwner("A"); await h.flush();
    expect(provisionedIds(h)).toEqual(["A-child"]);
  });
  it("stale A cleanup cannot delete a newer pending A attempt", async () => {
    const h = harness(), oldToken = deferred<{ Authorization: string }>(), newToken = deferred<{ Authorization: string }>();
    h.transport.headers = () => oldToken.promise; h.effects(); await h.flush();
    h.transport.read = async path => path.includes("/A/") ? [child("A-child")] : []; h.setOwner("B"); await h.flush();
    h.transport.headers = () => newToken.promise; h.setOwner("A"); await h.flush();
    oldToken.resolve({ Authorization: "old-A" }); await h.flush(); h.value.retryProfiles(); await h.flush();
    expect(h.calls.headers).toHaveLength(2); newToken.resolve({ Authorization: "new-A" }); await h.flush();
    expect(provisionedIds(h)).toEqual(["A-child"]);
  });
  it("sandbox keeps its own local family and never overwrites it with remote profiles", async () => {
    const h = harness(); h.effects(); await h.flush(); h.setOwner("local-sandbox"); await h.flush();
    expect(h.value.profiles.map(p => p.id)).toEqual(["local-private"]); expect(h.value.loadError).toBe(false);
    expect(JSON.parse(h.localStore.get("arbor.children")!)[0].id).toBe("local-private");
  });
  it("a raw auth change before React's owner render blocks late load provisioning", async () => {
    const h = harness(), load = deferred<ChildProfile[]>(); h.transport.read = () => load.promise; h.effects();
    h.setActualUser({ uid: "B" }); load.resolve([child("A-child")]); await h.flush();
    expect(provisionedIds(h)).toEqual([]); expect(h.value.loading).toBe(true); expect(h.value.needsOnboarding).toBe(false);
  });
  it("raw auth changes invalidate already-pending token acquisition", async () => {
    const h = harness(), token = deferred<{ Authorization: string }>(); h.transport.headers = () => token.promise;
    h.effects(); await h.flush(); h.setActualUser({ uid: "B" }); token.resolve({ Authorization: "old-A" }); await h.flush();
    expect(provisionedIds(h)).toEqual([]);
  });
  it("raw A→B→original A is latched, while a fresh same-account load can recover", async () => {
    const h = harness(), original = h.actualUser, token = deferred<{ Authorization: string }>(); h.transport.headers = () => token.promise;
    const originalSession = h.value.isCurrentSession;
    h.effects(); await h.flush(); expect(originalSession()).toBe(true); h.setActualUser({ uid: "B" }); h.setActualUser(original);
    expect(originalSession()).toBe(false);
    // Prevent a new load from itself provisioning until we inspect cancellation.
    const reload = deferred<ChildProfile[]>(); h.transport.read = () => reload.promise;
    token.resolve({ Authorization: "old-A" }); await h.flush(); expect(provisionedIds(h)).toEqual([]);
    h.transport.headers = async () => ({ Authorization: "fresh-A" }); expect(h.value.loadError).toBe(true);
    h.value.retryProfiles(); await h.flush(); reload.resolve([child("A-child")]); await h.flush();
    expect(provisionedIds(h)).toEqual(["A-child"]); expect(h.value.loading).toBe(false);
  });
  it("raw auth invalidation fences late profile writes before React owner changes", async () => {
    const h = harness(); h.effects(); await h.flush(); const pending = deferred(); h.transport.update = () => pending.promise;
    const saving = h.value.updateChild("A-child", { onboardingComplete: true }); h.setActualUser({ uid: "B" }); pending.resolve();
    expect(await saving).toBe(false); await h.flush(); expect(h.value.profiles.some(p => p.onboardingComplete === true)).toBe(false);
  });
  it("a raw auth change blocks a pending create before React catches up", async () => {
    const h = harness(); h.effects(); await h.flush(); const pending = deferred(); h.transport.set = () => pending.promise;
    const { id: _id, ...input } = child("ignored"); const creating = h.value.addChild(input);
    const caught = creating.catch(error => error); h.setActualUser({ uid: "B" }); pending.resolve();
    expect(await caught).toBeInstanceOf(Error); await h.flush();
    expect(h.value.profiles.some(p => p.id.startsWith("child-"))).toBe(false);
    expect(provisionedIds(h).some(id => id.startsWith("child-"))).toBe(false);
  });
  it("successful ownership guards cannot suppress another owner's same-ID child", async () => {
    const h = harness({ rows: [child("same-child", "Owner A")] }); h.effects(); await h.flush();
    h.transport.read = async () => [child("same-child", "Owner B")]; h.setOwner("B"); await h.flush();
    expect(provisionedIds(h)).toEqual(["same-child", "same-child"]);
    expect(h.sessionStore.has("arbor.ownershipProvisioned.remote:A:same-child")).toBe(true);
    expect(h.sessionStore.has("arbor.ownershipProvisioned.remote:B:same-child")).toBe(true);
  });
  it("failed current-owner hero writes keep local edits while reporting failure", async () => {
    const h = harness(); h.effects(); await h.flush();
    h.transport.update = async () => { throw Error("offline"); };
    const patch = { photoUrl: "data:image/png;base64,synthetic", avatar: { style: "comichero", source: "descriptor" as const, createdAt: "2026-10-09T12:00:00.000Z" } };
    expect(await h.value.updateChild("A-child", patch)).toBe(false); await h.flush();
    expect(h.value.profiles[0].photoUrl).toBe(patch.photoUrl);
    expect(h.value.profiles[0].avatar).toEqual(patch.avatar);
    expect(h.calls.updates).toEqual(["users/A/children/A-child"]);
  });
  it("ProfileGate renders retryable load errors before loading or onboarding", () => {
    const source = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const gate = source.slice(source.indexOf("function ProfileGate"), source.indexOf("function BillingReturnWatcher"));
    expect(gate).toContain("onClick={retryProfiles}"); expect(gate.indexOf("if (loadError)")).toBeLessThan(gate.indexOf("if (loading)"));
    expect(gate.indexOf("if (loadError)")).toBeGreaterThan(-1);
  });
});
