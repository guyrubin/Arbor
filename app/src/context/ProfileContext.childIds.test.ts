/**
 * B-DATA-15 — the client never chooses a new child's id. The actual
 * ProfileProvider asks POST /api/onboarding/child-id (auth headers, no body)
 * and writes the profile under the id the server issued. When no id can be
 * issued (offline, server down) addChild rejects and writes nothing — the
 * caller keeps its form. Synthetic SDK/fetch boundaries only.
 */
import { describe, expect, it } from "vitest";
import { harness } from "./ProfileContext.testSupport";
import type { ChildProfile } from "../types";

const input: Omit<ChildProfile, "id"> = { name: "Synthetic", age: 4, birthMonth: "2022-04", languages: ["English"], schoolContext: "", strengths: [], challenges: [], onboardingComplete: true };
const owned = (id: string): ChildProfile => ({ ...input, id });

describe("B-DATA-15 — new child ids are server-issued", () => {
  it("addChild writes the profile under the issued id, then provisions that id", async () => {
    const h = harness({ rows: [owned("A-child")] }); h.effects(); await h.flush();
    const created = await h.value.addChild(input); await h.flush();
    expect(created.id).toBe("child-issued-1");
    const issue = h.calls.fetch.find(call => call.url === "/api/onboarding/child-id");
    expect(issue?.opts).toMatchObject({ method: "POST" });
    expect(issue?.opts.body).toBeUndefined();
    expect(h.calls.sets).toEqual(["users/A/children/child-issued-1"]);
    const provisioned = h.calls.fetch.filter(call => call.url === "/api/onboarding/family-child").map(call => JSON.parse(String(call.opts.body)).childId);
    expect(provisioned).toEqual(["A-child", "child-issued-1"]);
    // Never the old client-chosen timestamp namespace.
    expect(h.value.profiles.map(p => p.id)).not.toContainEqual(expect.stringMatching(/^child-\d+$/));
  });

  it("the first-run create reserves the issued id", async () => {
    const h = harness({ rows: [] }); h.effects(); await h.flush();
    const created = await h.value.addChild({ ...input, onboardingComplete: false }); await h.flush();
    expect(created.id).toBe("child-issued-1");
    expect(h.calls.sets).toEqual(["users/A/children/child-issued-1"]);
  });

  it("no issued id → addChild rejects and writes nothing", async () => {
    const h = harness({ rows: [owned("A-child")] }); h.effects(); await h.flush();
    h.transport.headers = async () => { throw Error("offline"); };
    await expect(h.value.addChild(input)).rejects.toThrow();
    expect(h.calls.sets).toEqual([]);
    expect(h.value.profiles.map(p => p.id)).toEqual(["A-child"]);
  });
});
