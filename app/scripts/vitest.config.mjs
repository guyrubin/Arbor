import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // B-INF-06: + the weight ratchet beside the sweep it reads (scripts/weightLimits.test.ts).
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/ai/modelRouter.ts",
        "src/memory/memoryService.ts",
        "src/contracts/coach.ts",
        "src/safety/escalation.ts",
        "src/knowledge/wiki.ts"
      ],
      exclude: [
        "src/ai/claudeVertexProvider.ts",
        "src/memory/firestoreMemoryStore.ts",
        "src/memory/localMemoryStore.ts"
      ],
      thresholds: {
        statements: 40,
        branches: 30
      }
    }
  }
});
