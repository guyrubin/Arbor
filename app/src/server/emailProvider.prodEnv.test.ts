/**
 * B-INF-01 — the mail provider's env, guarded on the PROD deploy config.
 *
 * Switching the channel on is Guy's act (G-03: Resend account, verified
 * sender domain, Secret Manager `arbor-resend-key`, monthly cap), and the
 * builder does not edit cloudbuild.prod.yaml: a `--set-secrets` entry naming
 * a secret that does not exist yet fails the deploy. What this guard pins is
 * the shape of the switch, so the day Guy adds it, it cannot half-enable:
 *
 *   --set-env-vars  …|EMAIL_PROVIDER=resend|EMAIL_FROM=<verified sender>|…
 *   --set-secrets   …,RESEND_API_KEY=arbor-resend-key:latest
 *
 * All three present, or none. With none, `resolveEmailProvider` answers
 * disabled — `/digest/email-status` truthfully reports the channel off.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveEmailProvider } from "./emailProvider.js";

const yaml = readFileSync(new URL("../../../cloudbuild.prod.yaml", import.meta.url), "utf8");

/** The `^|^`-delimited --set-env-vars value, as KEY → value. */
export function prodEnvVars(source: string): Record<string, string> {
  const line = source.split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith("- ^|^"));
  if (!line) throw new Error("no ^|^ env line in cloudbuild.prod.yaml");
  const out: Record<string, string> = {};
  for (const pair of line.slice("- ^|^".length).split("|")) {
    const eq = pair.indexOf("=");
    if (eq > 0) out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

/** The --set-secrets value, as ENV → secret ref. */
export function prodSecrets(source: string): Record<string, string> {
  const lines = source.split(/\r?\n/).map((l) => l.trim());
  const at = lines.indexOf("- --set-secrets");
  if (at < 0) throw new Error("no --set-secrets in cloudbuild.prod.yaml");
  const value = lines.slice(at + 1).find((l) => l.startsWith("- ") && !l.startsWith("- --"));
  const out: Record<string, string> = {};
  for (const pair of (value ?? "").slice(2).split(",")) {
    const eq = pair.indexOf("=");
    if (eq > 0) out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

/** The switch is all-or-nothing. Returns the problems ([] = consistent). */
export function mailSwitchProblems(env: Record<string, string>, secrets: Record<string, string>): string[] {
  const provider = env.EMAIL_PROVIDER;
  const from = env.EMAIL_FROM;
  const key = secrets.RESEND_API_KEY;
  if (env.RESEND_API_KEY) return ["RESEND_API_KEY must come from Secret Manager (--set-secrets), never a plain env var"];
  if (!provider && !from && !key) return [];
  const problems: string[] = [];
  if (provider !== "resend") problems.push(`EMAIL_PROVIDER must be "resend" (got ${JSON.stringify(provider ?? null)})`);
  if (!from || !/@/.test(from)) problems.push("EMAIL_FROM must name the verified sender address");
  if (key !== "arbor-resend-key:latest") problems.push(`RESEND_API_KEY must map to arbor-resend-key:latest (got ${JSON.stringify(key ?? null)})`);
  return problems;
}

describe("B-INF-01 — prod mail-provider env presence", () => {
  const env = prodEnvVars(yaml);
  const secrets = prodSecrets(yaml);

  it("parses the real prod env line and secrets (the parser is not vacuous)", () => {
    expect(env.ARBOR_ENV).toBe("prod");
    expect(env.MEMORY_ADAPTER).toBe("firestore");
    expect(secrets.GEMINI_API_KEY).toBe("arbor-gemini-key:latest");
  });

  it("the prod switch is all-or-nothing (provider + sender + secret)", () => {
    expect(mailSwitchProblems(env, secrets)).toEqual([]);
  });

  it("whatever the yaml says, the server's answer matches it (email-status is truthful)", () => {
    const configured = Boolean(env.EMAIL_PROVIDER);
    const resolution = resolveEmailProvider({ ...env, ...(configured ? { RESEND_API_KEY: "secret-from-manager" } : {}) });
    expect(resolution.enabled).toBe(configured);
  });

  it("negative controls: every half-switch is caught", () => {
    expect(mailSwitchProblems({ EMAIL_PROVIDER: "resend" }, {})).toHaveLength(2);
    expect(mailSwitchProblems({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "Arbor <hello@arborparentingapp.com>" }, {})).toEqual([
      'RESEND_API_KEY must map to arbor-resend-key:latest (got null)',
    ]);
    expect(mailSwitchProblems({}, { RESEND_API_KEY: "arbor-resend-key:latest" })).toHaveLength(2);
    expect(mailSwitchProblems({ RESEND_API_KEY: "re_live_x" }, {})).toHaveLength(1);
    expect(mailSwitchProblems(
      { EMAIL_PROVIDER: "resend", EMAIL_FROM: "Arbor <hello@arborparentingapp.com>" },
      { RESEND_API_KEY: "arbor-resend-key:latest" },
    )).toEqual([]);
  });
});
