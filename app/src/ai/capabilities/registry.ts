import { AiProviderError, type AiCapability, type CapabilityAdapter } from "./contracts.js";
type AnyAdapter = CapabilityAdapter<AiCapability, unknown, unknown>;
const keyOf = (capability: AiCapability, provider: string) => `${capability}:${provider}`;
/** Exact-match registry. Policy chooses an eligible provider first; no implicit fallback can weaken that decision. */
export class CapabilityRegistry {
  private readonly adapters = new Map<string, AnyAdapter>();
  register<C extends AiCapability, Input, Output>(adapter: CapabilityAdapter<C, Input, Output>): void {
    const key = keyOf(adapter.capability, adapter.provider.provider);
    if (this.adapters.has(key)) throw new AiProviderError("invalid_output", `Duplicate AI adapter registration: ${key}`, false, adapter.provider);
    this.adapters.set(key, adapter as AnyAdapter);
  }
  get<C extends AiCapability, Input, Output>(capability: C, provider: string): CapabilityAdapter<C, Input, Output> {
    const adapter = this.adapters.get(keyOf(capability, provider));
    if (!adapter) throw new AiProviderError("not_configured", `No adapter is configured for ${capability} on ${provider}`, false, { provider, model: "unknown" });
    return adapter as CapabilityAdapter<C, Input, Output>;
  }
}
