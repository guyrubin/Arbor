// B-INF-12: equivalent source passes on Windows and Unix checkouts. The repo's .gitattributes
// makes every text file check out with LF, so the source-reading guards (which split a
// component's source on "\n") see the same bytes under core.autocrlf=true as on CI.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE_EXT = ["ts", "tsx", "js", "mjs", "cjs", "css", "json", "md", "html", "yml", "yaml", "txt", "svg"];

/** The rules that matter: `* text=auto eol=lf` first, and nothing later re-marks source as CRLF or binary. */
export function lfRuleProblems(attributes: string | null): string[] {
  if (attributes === null) return ["no .gitattributes"];
  const rules = attributes.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const problems: string[] = [];
  if (rules[0] !== "* text=auto eol=lf") problems.push(`first rule is ${JSON.stringify(rules[0] ?? null)}, not "* text=auto eol=lf"`);
  for (const rule of rules.slice(1)) {
    const [pattern, ...attrs] = rule.split(/\s+/);
    const ext = /^\*\.([a-z0-9]+)$/.exec(pattern)?.[1];
    const touchesSource = pattern === "*" || (ext !== undefined && SOURCE_EXT.includes(ext));
    if (touchesSource && attrs.some((a) => a === "eol=crlf" || a === "-text" || a === "binary" || a === "text=false")) problems.push(`"${rule}" overrides LF for source`);
  }
  return problems;
}

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "buffer", stdio: ["ignore", "pipe", "ignore"] });
}
const gitAvailable = (() => { try { git(repo, "--version"); return true; } catch { return false; } })();

describe("line endings are LF in every checkout", () => {
  const attributes = (() => { try { return readFileSync(path.join(repo, ".gitattributes"), "utf8"); } catch { return null; } })();

  it("the repo's .gitattributes keeps source LF (and the rule check has teeth)", () => {
    expect(lfRuleProblems(attributes)).toEqual([]);
    // Negative controls: no file (the 9 Oct state), a CRLF override, a binary override.
    expect(lfRuleProblems(null)).toEqual(["no .gitattributes"]);
    expect(lfRuleProblems(`${attributes}\n*.tsx text eol=crlf\n`)).toHaveLength(1);
    expect(lfRuleProblems(`${attributes}\n*.ts binary\n`)).toHaveLength(1);
    expect(lfRuleProblems(String(attributes).replace("* text=auto eol=lf", "* text=auto"))).toHaveLength(1);
  });

  // Round 2: 18 test files were committed with CRLF and a doubled CR (\r\r\n), which made git
  // call them binary, so text=auto never converted them. No source file may carry a CR at all.
  it("no source or test file under src/ and scripts/ holds a carriage return", () => {
    const app = path.join(repo, "app");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const file = path.join(dir, name);
        if (statSync(file).isDirectory()) { if (name !== "node_modules") walk(file); }
        else if (/\.(?:tsx?|mjs|cjs|js|css|json)$/.test(name)) files.push(file);
      }
    };
    walk(path.join(app, "src"));
    walk(path.join(app, "scripts"));
    expect(files.length).toBeGreaterThan(500);
    const withCr = files.filter((f) => readFileSync(f).includes(0x0d)).map((f) => path.relative(app, f));
    expect(withCr).toEqual([]);
  });

  it.skipIf(!gitAvailable)("a core.autocrlf=true checkout writes LF with these rules and CRLF without them", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "lf-guard-"));
    try {
      git(dir, "init", "-q");
      writeFileSync(path.join(dir, "Guard.tsx"), "export const a = 1;\nexport const b = 2;\n");
      git(dir, "add", "Guard.tsx");
      git(dir, "-c", "user.email=guard@example.com", "-c", "user.name=guard", "commit", "-qm", "fixture");
      // What a Windows checkout would write for this file (the working-tree filters).
      const checkout = () => git(dir, "-c", "core.autocrlf=true", "cat-file", "--filters", "--path=Guard.tsx", "HEAD:Guard.tsx").toString("utf8");
      expect(checkout()).toContain("\r\n"); // negative control: without the rules, CRLF
      writeFileSync(path.join(dir, ".gitattributes"), String(attributes));
      expect(checkout()).not.toContain("\r");
      expect(checkout()).toBe("export const a = 1;\nexport const b = 2;\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
