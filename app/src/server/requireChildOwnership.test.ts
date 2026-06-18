import { describe, it, expect, vi } from "vitest";
import { requireChildOwnership } from "./requireChildOwnership";

function ctx(over: { uid?: string; childId?: string; bodyChildId?: string } = {}) {
  const req = {
    params: over.childId ? { childId: over.childId } : {},
    body: over.bodyChildId ? { childId: over.bodyChildId } : {},
    user: over.uid ? { uid: over.uid } : undefined,
  } as any;
  let status = 200;
  const res = {
    status(code: number) { status = code; return { json: () => undefined }; },
    get statusCode() { return status; },
  } as any;
  const next = vi.fn();
  return { req, res, next, get status() { return status; } };
}

describe("requireChildOwnership", () => {
  it("no-ops when the store has no ownsChild (single-tenant/local)", async () => {
    const mw = requireChildOwnership({});
    const c = ctx({ uid: "userA", childId: "kid1" });
    await mw(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalled();
  });

  it("no-ops for the unauthenticated local-sandbox uid", async () => {
    const ownsChild = vi.fn();
    const mw = requireChildOwnership({ ownsChild });
    const c = ctx({ childId: "kid1" }); // no user -> local-sandbox
    await mw(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalled();
    expect(ownsChild).not.toHaveBeenCalled();
  });

  it("calls next() when the actor owns the child (params)", async () => {
    const mw = requireChildOwnership({ ownsChild: async () => true });
    const c = ctx({ uid: "userA", childId: "kid1" });
    await mw(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalled();
    expect(c.status).toBe(200);
  });

  it("403s when the actor does NOT own the child (the IDOR case)", async () => {
    const mw = requireChildOwnership({ ownsChild: async () => false });
    const c = ctx({ uid: "attacker", childId: "victimsKid" });
    await mw(c.req, c.res, c.next);
    expect(c.next).not.toHaveBeenCalled();
    expect(c.status).toBe(403);
  });

  it("authorizes from body.childId too (e.g. POST /privacy/erase)", async () => {
    const ownsChild = vi.fn(async () => false);
    const mw = requireChildOwnership({ ownsChild });
    const c = ctx({ uid: "attacker", bodyChildId: "victimsKid" });
    await mw(c.req, c.res, c.next);
    expect(ownsChild).toHaveBeenCalledWith("attacker", "victimsKid");
    expect(c.status).toBe(403);
  });

  it("fails closed (403) when the ownership lookup throws", async () => {
    const mw = requireChildOwnership({ ownsChild: async () => { throw new Error("firestore down"); } });
    const c = ctx({ uid: "userA", childId: "kid1" });
    await mw(c.req, c.res, c.next);
    expect(c.next).not.toHaveBeenCalled();
    expect(c.status).toBe(403);
  });
});
