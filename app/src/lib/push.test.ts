import { describe, it, expect, vi } from "vitest";

// vi.mock is hoisted to module top — the spy must be created with vi.hoisted so
// the factory can reference it without a ReferenceError.
const sendSpy = vi.hoisted(() => vi.fn(async (_msg: Record<string, unknown>) => "projects/test/messages/mock-id"));
vi.mock("firebase-admin/messaging", () => ({
  getMessaging: () => ({ send: sendSpy }),
}));

// Mock the heavy firebase-admin core subpaths so the unit tests for
// LocalPushTokenStore never trigger a real firebase-admin cold import.
// These subpaths are only consumed by FirestorePushTokenStore (the prod path,
// not exercised by this unit-test file). Parallel workers loading the real
// firebase-admin core simultaneously was the source of a cold-start timeout
// flake on the first test (which performs the module import).
vi.mock("firebase-admin/app", () => ({
  getApps: () => [],
  initializeApp: () => ({}),
  applicationDefault: () => ({}),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({}),
}));

// -- pushCapable: off when no VAPID key --------------------------------------
describe("pushCapable", () => {
  it("returns false when VITE_FIREBASE_VAPID_KEY is absent", async () => {
    const mod = await import("./push.js");
    expect(mod.pushCapable()).toBe(false);
  });
});

// -- LocalPushTokenStore — dedup and remove ----------------------------------
describe("LocalPushTokenStore", () => {
  it("stores and retrieves a token", async () => {
    const { LocalPushTokenStore } = await import("../server/pushTokens.js");
    const store = new LocalPushTokenStore();
    await store.upsert("uid-1", "raw-token-abc");
    expect(await store.getToken("uid-1")).toBe("raw-token-abc");
  });

  it("idempotent upsert — second call with same token is a no-op", async () => {
    const { LocalPushTokenStore } = await import("../server/pushTokens.js");
    const store = new LocalPushTokenStore();
    await store.upsert("uid-2", "token-xyz");
    await store.upsert("uid-2", "token-xyz");
    expect(await store.getToken("uid-2")).toBe("token-xyz");
  });

  it("remove clears the token", async () => {
    const { LocalPushTokenStore } = await import("../server/pushTokens.js");
    const store = new LocalPushTokenStore();
    await store.upsert("uid-3", "token-to-remove");
    await store.remove("uid-3");
    expect(await store.getToken("uid-3")).toBeNull();
  });

  it("getToken returns null for unknown uid", async () => {
    const { LocalPushTokenStore } = await import("../server/pushTokens.js");
    const store = new LocalPushTokenStore();
    expect(await store.getToken("nobody")).toBeNull();
  });
});

// -- sendNudgePush — payload carries no child data ---------------------------
describe("sendNudgePush payload — no child data", () => {
  it("sends a generic notification with no child-identifying fields", async () => {
    sendSpy.mockClear();
    const { LocalPushTokenStore, sendNudgePush } = await import("../server/pushTokens.js");
    const store = new LocalPushTokenStore();
    await store.upsert("uid-push", "raw-fcm-token-for-test");

    const result = await sendNudgePush("uid-push", store);
    expect(result).toBe("sent");
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const payload = sendSpy.mock.calls[0][0] as Record<string, Record<string, unknown>>;
    const notif = payload.notification ?? {};
    const data = payload.data ?? {};

    const forbidden = ["childId", "childName", "name", "milestone", "behavior", "score", "uid", "age"];
    for (const field of forbidden) {
      expect(notif).not.toHaveProperty(field);
      expect(data).not.toHaveProperty(field);
    }

    expect(typeof notif.title).toBe("string");
    expect((notif.title as string).length).toBeGreaterThan(0);
    expect(typeof notif.body).toBe("string");
    expect((notif.body as string).length).toBeGreaterThan(0);

    expect(Object.keys(data)).toEqual(["nudgeId"]);
    expect(typeof data.nudgeId).toBe("string");
  });

  it("returns no-token when uid is not opted in", async () => {
    const { LocalPushTokenStore, sendNudgePush } = await import("../server/pushTokens.js");
    const store = new LocalPushTokenStore();
    expect(await sendNudgePush("uid-nobody", store)).toBe("no-token");
  });
});
