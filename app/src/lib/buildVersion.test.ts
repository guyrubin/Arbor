import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_BUILD, formatBuildVersion } from "./buildVersion";

describe("B-INF-05 · About shows the build SHA, never 0.0.0", () => {
  it("a full commit SHA becomes its 7-char short form", () => {
    expect(formatBuildVersion("9252c9c1f0e4b6d2a8c7e3f5b1d9a0c4e6f8b2d1")).toBe("9252c9c");
    expect(formatBuildVersion("9252C9C")).toBe("9252c9c");
  });

  it("no SHA (local dev, tests) reads 'dev'", () => {
    expect(formatBuildVersion(undefined)).toBe("dev");
    expect(formatBuildVersion("")).toBe("dev");
    expect(formatBuildVersion("0.0.0")).toBe("dev");
    expect(formatBuildVersion("abc")).toBe("dev");
    expect(APP_BUILD).toBe("dev");
  });

  it("vite defines __APP_VERSION__ from GITHUB_SHA through the formatter", () => {
    const cfg = readFileSync(resolve(__dirname, "../../vite.config.ts"), "utf8");
    expect(cfg).toContain("__APP_VERSION__: JSON.stringify(formatBuildVersion(process.env.GITHUB_SHA))");
  });

  it("the About row reads APP_BUILD, not the manifest's placeholder version", () => {
    const settings = readFileSync(resolve(__dirname, "../components/layout/SettingsModal.tsx"), "utf8");
    expect(settings).toContain("{ version: APP_BUILD }");
    expect(settings).not.toContain("metadata.version");
  });
});
