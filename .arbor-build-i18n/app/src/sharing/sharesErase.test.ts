import { describe, expect, it } from "vitest";
import { LocalShareStore, buildGrant } from "./shares.js";

describe("GDPR share erasure (CMP-2)", () => {
  it("hard-deletes every grant the owner created for the child — including revoked/expired ones", async () => {
    const store = new LocalShareStore();
    const mk = (childId: string, recipient: string) =>
      store.create(buildGrant({ ownerUid: "owner-1", ownerEmail: "o@example.com", childId, recipientEmail: recipient }));
    await mk("child-1", "coparent@example.com");
    const revoked = await mk("child-1", "teacher@example.com");
    await store.revoke(revoked.id, "owner-1");
    await mk("child-2", "coparent@example.com");

    const removed = await store.eraseByChild("owner-1", "child-1");
    expect(removed).toBe(2);
    expect(await store.listByOwner("owner-1", "child-1")).toHaveLength(0);
    // The other child's grants are untouched.
    expect(await store.listByOwner("owner-1", "child-2")).toHaveLength(1);
  });

  it("does not erase another owner's grants for the same child id", async () => {
    const store = new LocalShareStore();
    await store.create(buildGrant({ ownerUid: "owner-1", ownerEmail: null, childId: "c", recipientEmail: "a@b.com" }));
    await store.create(buildGrant({ ownerUid: "owner-2", ownerEmail: null, childId: "c", recipientEmail: "a@b.com" }));
    const removed = await store.eraseByChild("owner-1", "c");
    expect(removed).toBe(1);
    expect(await store.listByOwner("owner-2", "c")).toHaveLength(1);
  });
});
