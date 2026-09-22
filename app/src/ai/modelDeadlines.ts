import type { ModelProvider } from "./modelRouter.js";
import { abortableIterate, raceWithAbort, type ModelCallBudget } from "./modelRetry.js";

/** Last-resort deadline for legacy routes without a route-owned cancellation budget. */
export const withDefaultModelDeadlines = (provider: ModelProvider): ModelProvider => {
  const bounded = <T extends { budget?: ModelCallBudget }>(options: T, ms = 45000): T => options.budget?.signal ? options : {
    ...options, budget: { signal: AbortSignal.timeout(ms), deadlineAt: Date.now() + ms, totalMs: ms },
  };
  return {
    routeDecision: route => provider.routeDecision(route),
    generateJson(options) { const call = bounded(options); return raceWithAbort(provider.generateJson(call), call.budget!.signal); },
    generateImage(options) { const call = bounded(options, 60000); return raceWithAbort(provider.generateImage(call), call.budget!.signal); },
    async *generateJsonStream(options) { const call = bounded(options); yield* abortableIterate(provider.generateJsonStream(call), call.budget!.signal); },
    async *streamText(options) { const call = bounded(options); yield* abortableIterate(provider.streamText(call), call.budget!.signal); },
  };
};
