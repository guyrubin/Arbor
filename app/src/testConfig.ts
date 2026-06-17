import type { ArborConfig } from "./config/env.js";

export const createTestConfig = (overrides: Partial<ArborConfig> = {}): ArborConfig => ({
  nodeEnv: "test",
  arborEnv: "local",
  port: 3000,
  appUrl: "http://localhost:3000",
  corsOrigins: ["http://localhost:3000"],
  gcpProjectId: "arbor-test",
  gcpRegion: "europe-west4",
  vertexLocation: "europe-west4",
  vertexModelChat: "claude-3-5-sonnet@anthropic",
  vertexModelStory: "gemini-2.5-flash",
  vertexModelAnalysis: "gemini-2.5-pro",
  vertexModelHandoff: "gemini-2.5-flash",
  modelProvider: "vertex",
  geminiApiKey: "test-key",
  geminiModel: "gemini-2.5-flash",
  firebaseProjectId: "arbor-test",
  firestoreDatabaseId: "(default)",
  memoryAdapter: "local",
  enableLocalMemoryAdapter: true,
  enableHighRiskReviewQueue: true,
  maxOutputTokens: 8192,
  memoryPromptMaxFacts: 40,
  ...overrides
});
