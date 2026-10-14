import { describe, expect, expectTypeOf, it } from "vitest";
import type { AdminCost30d, AdminOverview } from "./api";
import type { Cost30d, AdminOverview as ServerOverview } from "../server/adminMetrics";

describe("founder cost overview wire contract", () => {
  it("keeps the client cost fields identical to the server without runtime server imports", () => {
    expectTypeOf<AdminCost30d>().toEqualTypeOf<Cost30d>();
    // Use the existing equality matcher so the runtime/type matcher versions
    // cannot disagree about the newer toExtend helper.
    expectTypeOf<ServerOverview extends AdminOverview ? true : false>().toEqualTypeOf<true>();
  });
  it("supports a rolling release without inventing costs on older responses", () => {
    const legacy: AdminOverview = {
      users: 0, paying: { plus: 0, family: 0, trialing: 0, total: 0 },
      usageToday: { date: "2026-10-14", calls: 0, promptTokens: 0, outputTokens: 0,
        totalTokens: 0, byProvider: {}, approxCostEur: 0 },
      generatedAt: "2026-10-14T00:00:00Z",
    };
    expect(legacy.cost30d).toBeUndefined();
  });
});
