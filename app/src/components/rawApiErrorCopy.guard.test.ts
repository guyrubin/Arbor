/**
 * B-AIOPS-01 follow-up guard — no raw API error string reaches a parent.
 *
 * Release c1e53baa made metered gates answer a retryable 503
 * `{ error: "quota_unavailable" }` when the usage-counter store is down. The
 * api layer turns a failed response into `ApiError(details || error, status)`,
 * so `err.message` IS the server's code ("quota_unavailable", "image_resting")
 * or its English `details`. A screen that toasts it shows a Hebrew or English
 * parent a slug. Failures go through lib/aiErrorCopy (classifyAiFailure /
 * aiFailureMessage) or a surface's own keyed copy — never the message itself.
 *
 * Static scan of the client tree (components, hooks, context) for the three
 * shapes that rendered a raw message:
 *   1. toast(<x>.message | .code | .error | .details …)
 *   2. a ternary that picks `err.message` as the display value
 *      (`err instanceof Error ? err.message : "…"`)
 *   3. set…Error(<x>.message …) — the inline-note twin of a toast
 * The allow-list names every remaining match and why it is not rendered.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentsDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(componentsDir, "..");
const SCANNED = ["components", "hooks", "context"].map((d) => path.join(srcDir, d));

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [full] : [];
  });

const RAW_FIELD = String.raw`\b[A-Za-z_$][\w$]*\??\.(?:message|code|error|details)\b`;
const RULES: { name: string; re: RegExp }[] = [
  { name: "toast of a raw error field", re: new RegExp(String.raw`toast\(\s*[^,)"'\x60]*` + RAW_FIELD) },
  { name: "raw message picked for display", re: /\?\s*(?:e|err|error|ex)\??\.message\s*:/ },
  { name: "inline error set from a raw message", re: /\bset\w*Error\(\s*[^)]*\b(?:e|err|error|ex)\??\.message\b/ },
];

/** file (relative to src/) → substring of the allowed line → why it is safe. */
const ALLOWED: { file: string; line: string; why: string }[] = [
  {
    file: "components/tabs/BedtimeStoriesTab.tsx",
    line: "const message = err instanceof Error ? err.message : String(err);",
    why: "legacy escalation substring match only; the rendered copy is toMessage → t(\"elev.bedtime.generate.failed\")",
  },
  {
    file: "hooks/useAsyncAction.ts",
    line: "const msg = (err instanceof Error ? err.message : typeof err === \"string\"",
    why: "failureReason(): lower-cased into a fixed analytics enum, never displayed",
  },
  {
    file: "context/ArborContext.tsx",
    line: "setApiError(",
    why: "apiError is never rendered: CoachTab classifies apiErrorStatus through classifyAiFailure",
  },
  {
    file: "components/layout/AdminDashboard.tsx",
    line: "setError(e?.message",
    why: "operator-only admin console (English, not a parent or kid surface)",
  },
];

export function rawErrorOffenders(rel: string, src: string): string[] {
  const out: string[] = [];
  src.split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "");
    for (const rule of RULES) {
      if (!rule.re.test(code)) continue;
      if (ALLOWED.some((a) => a.file === rel && line.includes(a.line))) continue;
      out.push(`${rel}:${i + 1} (${rule.name}): ${line.trim()}`);
    }
  });
  return out;
}

const relOf = (file: string) => path.relative(srcDir, file).split(path.sep).join("/");
const read = (rel: string) => readFileSync(path.join(srcDir, rel), "utf8");

describe("B-AIOPS-01 follow-up — no raw API error string in a toast or inline note", () => {
  it("no client component, hook or context renders err.message / a server code", () => {
    const offenders = SCANNED.flatMap((dir) => walk(dir)).flatMap((f) => rawErrorOffenders(relOf(f), readFileSync(f, "utf8")));
    expect(offenders, `route failures through lib/aiErrorCopy (aiFailureMessage / classifyAiFailure):\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("every allow-list entry still matches real source (no stale exemptions)", () => {
    for (const a of ALLOWED) expect(read(a.file), a.file).toContain(a.line);
  });

  it("the fixed sites route through the classifier", () => {
    const hero = read("components/tabs/HeroJourneyTab.tsx");
    expect(hero.match(/aiFailureMessage\(e, t\)/g)?.length).toBe(2);
    expect(read("components/profile/AvatarCreator.tsx")).toContain("classifyAiFailure(err");
    expect(read("hooks/useAsyncAction.ts")).toContain("opts.toMessage ? opts.toMessage(err) : opts.fallbackError");
  });

  it("NEGATIVE CONTROL — reverting the real HeroJourneyTab / AvatarCreator / useAsyncAction source is caught", () => {
    const heroRel = "components/tabs/HeroJourneyTab.tsx";
    const hero = read(heroRel);
    const toastMutant = hero.replace("toast(aiFailureMessage(e, t), \"error\")", "toast(e.message, \"error\")");
    expect(toastMutant).not.toBe(hero);
    expect(rawErrorOffenders(heroRel, toastMutant).some((o) => o.includes("toast of a raw error field"))).toBe(true);
    const ternaryMutant = hero.replace("const msg = aiFailureMessage(e, t);", "const msg = e instanceof Error ? e.message : \"Failed to start the journey.\";");
    expect(ternaryMutant).not.toBe(hero);
    expect(rawErrorOffenders(heroRel, ternaryMutant).some((o) => o.includes("raw message picked for display"))).toBe(true);
    // The unmutated file is clean.
    expect(rawErrorOffenders(heroRel, hero)).toEqual([]);

    const avatarRel = "components/profile/AvatarCreator.tsx";
    const avatar = read(avatarRel);
    const avatarMutant = avatar.replace(
      /const copy = classifyAiFailure\(err, \{ online: browserOnline\(\) \}\);\s*return [^;]+;/,
      'return err instanceof Error && err.message ? err.message : t("gen.avatar.fail");',
    );
    expect(avatarMutant).not.toBe(avatar);
    expect(rawErrorOffenders(avatarRel, avatarMutant).length).toBeGreaterThan(0);

    const hookRel = "hooks/useAsyncAction.ts";
    const hook = read(hookRel);
    const hookMutant = hook.replace(
      "opts.toMessage ? opts.toMessage(err) : opts.fallbackError",
      "opts.toMessage ? opts.toMessage(err) : err instanceof Error && err.message ? err.message : opts.fallbackError",
    );
    expect(hookMutant).not.toBe(hook);
    expect(rawErrorOffenders(hookRel, hookMutant).length).toBeGreaterThan(0);

    // An inline-note leak (setError(err.message)) and a server-code toast are caught too.
    expect(rawErrorOffenders("x.tsx", "  catch (err) { setError(err.message); }").length).toBe(1);
    expect(rawErrorOffenders("x.tsx", "  toast(body.code, \"error\");").length).toBe(1);
    // Keyed copy is not an offender.
    expect(rawErrorOffenders("x.tsx", "  toast(t(\"gen.avatar.fail\"), \"error\");")).toEqual([]);
    expect(rawErrorOffenders("x.tsx", "  toast(t(\"set.referral.error\"), \"error\");")).toEqual([]);
  });
});
