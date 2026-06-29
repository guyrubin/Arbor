import { describe, it, expect, vi } from "vitest";
import { requireConsent } from "./requireConsent";
import { LocalConsentStore, buildConsent } from "../sharing/consent.js";

/**
 * A2 + A3 regression: the COPPA gate on /api/vision (and /api/generate-avatar).
 * /vision sends a child photo to a multimodal model, so it must fail CLOSED with
 * 451 unless an active `face_processing` parental consent exists for the childId
 * — the same grant the onboarding consent step (A3) records into this store.
 */

function ctx(over: { uid?: string; childId?: string; image?: unknown } = {}) {
  const req = {
    params: {},
    body: {
      ...(over.childId ? { childId: over.childId } : {}),
      ...(over.image !== undefined ? { image: over.image } : {}),
    },
    user: over.uid ? { uid: over.uid } : undefined,
  } as any;
  let status = 200;
  let payload: any;
  const res = {
    status(code: number) { status = code; return { json: (b: any) => { payload = b; } }; },
    json(b: any) { payload = b; },
  } as any;
  const next = vi.fn();
  return { req, res, next, get status() { return status; }, get payload() { return payload; } };
}

// Mirrors the wiring in routes/api.ts: gate /vision whenever an image is present.
const visionGate = (store: LocalConsentStore) =>
  requireConsent(store, "face_processing", (req) => !!req.body?.image);

describe("requireConsent — /vision COPPA gate (A2/A3)", () => {
  const IMAGE = { dataUrl: "data:image/png;base64,iVBORw0KGgo=" };

  it("451s for an authenticated parent when NO consent has been recorded", async () => {
    const store = new LocalConsentStore();
    const c = ctx({ uid: "parentA", childId: "kid1", image: IMAGE });
    await visionGate(store)(c.req, c.res, c.next);
    expect(c.next).not.toHaveBeenCalled();
    expect(c.status).toBe(451);
    expect(c.payload).toMatchObject({ consentRequired: true, purpose: "face_processing" });
  });

  it("451s (fails closed) when the client omits childId, even with an image", async () => {
    const store = new LocalConsentStore();
    // Pre-record consent for a child — but the request carries no childId.
    await store.set(buildConsent({ childId: "kid1", purpose: "face_processing", granted: true, actorUid: "parentA" }));
    const c = ctx({ uid: "parentA", image: IMAGE }); // no childId
    await visionGate(store)(c.req, c.res, c.next);
    expect(c.next).not.toHaveBeenCalled();
    expect(c.status).toBe(451);
  });

  it("passes once the parent's face_processing consent is recorded (the onboarding/A3 grant)", async () => {
    const store = new LocalConsentStore();
    // Exactly what the onboarding consent step + POST /api/consent write.
    await store.set(buildConsent({ childId: "kid1", purpose: "face_processing", granted: true, actorUid: "parentA" }));
    const c = ctx({ uid: "parentA", childId: "kid1", image: IMAGE });
    await visionGate(store)(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalled();
    expect(c.status).toBe(200);
  });

  it("451s again after the consent is revoked (re-prompt on withdrawal)", async () => {
    const store = new LocalConsentStore();
    const grant = await store.set(buildConsent({ childId: "kid1", purpose: "face_processing", granted: true, actorUid: "parentA" }));
    await store.revoke(grant.id);
    const c = ctx({ uid: "parentA", childId: "kid1", image: IMAGE });
    await visionGate(store)(c.req, c.res, c.next);
    expect(c.next).not.toHaveBeenCalled();
    expect(c.status).toBe(451);
  });

  it("no-ops the unauthenticated local-sandbox uid so dev/sandbox keep working", async () => {
    const store = new LocalConsentStore();
    const c = ctx({ childId: "kid1", image: IMAGE }); // no user -> local-sandbox
    await visionGate(store)(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalled();
  });

  it("does not gate a /vision call with no image (appliesWhen guard)", async () => {
    const store = new LocalConsentStore();
    const c = ctx({ uid: "parentA", childId: "kid1" }); // no image
    await visionGate(store)(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalled();
  });
});
