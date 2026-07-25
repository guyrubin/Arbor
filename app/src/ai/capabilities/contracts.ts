import type { ModelRoute } from "../modelRouter.js";

export type AiCapability = "structured_text" | "text_stream" | "realtime_audio" | "speech_recognition" | "speech_synthesis" | "vision_understanding" | "image_generation";
export type AiAudience = "parent" | "child" | "professional" | "internal";
export type AiDataClass = "public" | "account" | "child_profile" | "child_voice" | "child_image";
export type AiRisk = "low" | "moderate" | "high";
export interface CapabilityRequest<C extends AiCapability = AiCapability> { capability: C; route: ModelRoute; audience: AiAudience; locale: "en" | "he"; dataClasses: readonly AiDataClass[]; risk: AiRisk; requestId?: string; }
export interface ProviderRef { provider: string; model: string; version?: string; region?: string; }
export interface NormalizedAiUsage { inputTokens?: number; outputTokens?: number; totalTokens?: number; inputChars?: number; audioInputMs?: number; audioOutputMs?: number; estimatedCostUsd?: number; }
export type AiErrorCode = "not_configured" | "policy_denied" | "rate_limited" | "timeout" | "provider_unavailable" | "invalid_output" | "safety_blocked" | "unknown";
export class AiProviderError extends Error {
  constructor(public readonly code: AiErrorCode, message: string, public readonly retryable: boolean, public readonly provider?: ProviderRef, options?: { cause?: unknown }) { super(message, options); this.name = "AiProviderError"; }
}
export interface CapabilityAdapter<C extends AiCapability, Input, Output> { readonly capability: C; readonly provider: ProviderRef; execute(input: Input, context: CapabilityRequest<C>): Promise<Output>; }
/** Additive only: legacy ModelProvider implementations migrate one capability at a time. */
export interface CapabilityAwareProvider { capabilities(): readonly AiCapability[]; }
