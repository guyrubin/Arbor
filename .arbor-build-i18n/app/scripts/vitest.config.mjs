import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
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
