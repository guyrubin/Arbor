import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EntitlementInfo } from "./api";

// Mock the analytics pipe so we assert event name + props without Firestore.
const track = vi.fn();
vi.mock("./analytics", () => ({ track: (...args: unknown[]) => track(...args) }));

// In-memory localStorage so the once()/lastBilledPlan dedup is deterministic.
let store: Record<string, string> = {};
beforeEach(() => {
  track.mockClear();
  store = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  });
});

describe("share funnel helpers", () => {
  it("trackShareInitiated emits share_initiated with artifact + surface", async () => {
    const { trackShareInitiated } = await import("./loopEvents");
    trackShareInitiated("answer_card", "coach");
    expect(track).toHaveBeenCalledWith("share_initiated", { artifact: "answer_card", surface: "coach" });
  });

  it("trackShareCompleted emits share_completed with artifact + channel", async () => {
    const { trackShareCompleted } = await import("./loopEvents");
    trackShareCompleted("story", "clipboard");
    expect(track).toHaveBeenCalledWith("share_completed", { artifact: "story", channel: "clipboard" });
  });

  it("a copy surface emits share_initiated then share_completed in order", async () => {
    const { trackShareInitiated, trackShareCompleted } = await import("./loopEvents");
    trackShareInitiated("answer_card", "coach");
    trackShareCompleted("answer_card", "clipboard");
    expect(track.mock.calls.map((c) => c[0])).toEqual(["share_initiated", "share_completed"]);
  });
});

describe("activation enrichment", () => {
  it("trackProfileCreated carries the coarse age band", async () => {
    const { trackProfileCreated } = await import("./loopEvents");
    trackProfileCreated(2, "3-5y");
    expect(track).toHaveBeenCalledWith("profile_created", { child_count: 2, band: "3-5y" });
  });

  it("trackProfileCreated omits band when not provided", async () => {
    const { trackProfileCreated } = await import("./loopEvents");
    trackProfileCreated(1);
    expect(track).toHaveBeenCalledWith("profile_created", { child_count: 1 });
  });
});

describe("invite funnel (export-only, frozen contract)", () => {
  it("trackInviteSent still emits invite_sent with the frozen signature", async () => {
    const { trackInviteSent } = await import("./loopEvents");
    trackInviteSent("whatsapp");
    expect(track).toHaveBeenCalledWith("invite_sent", { channel: "whatsapp" });
  });
});

describe("recordBillingTransition (pay funnel)", () => {
  const base: EntitlementInfo = {
    plan: "free",
    limits: { coachMessagesPerDay: 10, maxChildren: 1, professionalReports: false, advancedPlans: false, coParentSeats: 0 },
    source: "test",
    enforced: true,
    usage: { coachMessagesToday: 0 },
    status: "active",
  };

  it("fires `paid` exactly once when crossing free → active on a real paid plan", async () => {
    const { recordBillingTransition } = await import("./billingTransition");
    const paid: EntitlementInfo = { ...base, plan: "plus", status: "active", provider: "stripe" };
    recordBillingTransition(paid);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("paid", { tier: "plus" });

    // Re-evaluating the same state (e.g. reload of ?billing=success) must not re-fire.
    recordBillingTransition(paid);
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("fires `trial_start` once when crossing into in_trial on a real paid plan", async () => {
    const { recordBillingTransition } = await import("./billingTransition");
    const trial: EntitlementInfo = { ...base, plan: "plus", status: "in_trial", provider: "stripe" };
    recordBillingTransition(trial);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("trial_start", { tier: "plus" });
  });

  it("fires nothing for a beta Plus grant (enforced === false)", async () => {
    const { recordBillingTransition } = await import("./billingTransition");
    recordBillingTransition({ ...base, plan: "plus", status: "active", enforced: false, provider: "none" });
    expect(track).not.toHaveBeenCalled();
  });

  it("fires nothing for a comp grant", async () => {
    const { recordBillingTransition } = await import("./billingTransition");
    recordBillingTransition({ ...base, plan: "plus", status: "active", provider: "comp" });
    expect(track).not.toHaveBeenCalled();
  });

  it("fires nothing for a plain free entitlement", async () => {
    const { recordBillingTransition } = await import("./billingTransition");
    recordBillingTransition(base);
    expect(track).not.toHaveBeenCalled();
  });

  it("fires `paid` after a free→trial→active progression (one paid event)", async () => {
    const { recordBillingTransition } = await import("./billingTransition");
    recordBillingTransition({ ...base, plan: "plus", status: "in_trial", provider: "stripe" });
    expect(track).toHaveBeenCalledWith("trial_start", { tier: "plus" });
    recordBillingTransition({ ...base, plan: "plus", status: "active", provider: "stripe" });
    expect(track).toHaveBeenCalledWith("paid", { tier: "plus" });
    expect(track).toHaveBeenCalledTimes(2);
  });
});
