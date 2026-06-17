/**
 * ADM-1: founder-only admin surface.
 *
 * `isAdmin` gates the metrics endpoint to the uids/emails in ARBOR_ADMIN_UIDS /
 * ARBOR_ADMIN_EMAILS (same env-list shape as the Plus comp lists). Admin is a
 * superset capability — it does not change a user's billing entitlement.
 */
const envList = (name: string): string[] =>
  (process.env[name] || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const isAdmin = (actor: { uid: string; email: string | null }): boolean => {
  const uid = (actor.uid || "").toLowerCase();
  const email = (actor.email || "").toLowerCase();
  return envList("ARBOR_ADMIN_UIDS").includes(uid) || (!!email && envList("ARBOR_ADMIN_EMAILS").includes(email));
};

/** Approximate EUR cost per 1M tokens, per provider. Rough public list prices —
 *  for an at-a-glance margin read, NOT billing. Tune as pricing changes. */
const RATES_EUR_PER_M: Record<string, { input: number; output: number }> = {
  vertex_claude: { input: 2.8, output: 14 }, // Claude 3.5 Sonnet-class
  vertex_gemini: { input: 0.07, output: 0.3 }, // Gemini 2.5 Flash-class
  gemini_dev: { input: 0.07, output: 0.3 },
};

export type ProviderTokens = { promptTokens?: number; outputTokens?: number };

/** Sum an approximate EUR cost from per-provider token counts. */
export const estimateCostEur = (byProvider: Record<string, ProviderTokens> | undefined): number => {
  let eur = 0;
  for (const [provider, tokens] of Object.entries(byProvider ?? {})) {
    const rate = RATES_EUR_PER_M[provider];
    if (!rate) continue;
    eur += ((tokens.promptTokens ?? 0) / 1_000_000) * rate.input;
    eur += ((tokens.outputTokens ?? 0) / 1_000_000) * rate.output;
  }
  return Math.round(eur * 100) / 100;
};
