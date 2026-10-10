import { describe, expect, it } from "vitest";
import { childExportFilename } from "./childExportFilename";

describe("Your data portable filename", () => {
  it.each([
    ["Noa Levi", "noa"], ["ANNE-Marie Smith", "anne-marie"], ["Noa_2", "noa_2"],
    ["  Noa\tLevi  ", "noa"], ["נועה לוי", "child"], ["李明", "child"], ["K", "child"],
    ["", "child"], [" \t\n", "child"], ["../\\", "child"], ["---___", "child"],
    ["../Noa\\Levi", "noa-levi"], ["Noa\0Levi", "noa-levi"], ["Noa\x7fLevi", "noa-levi"],
    ["Noa<>:\"|?*Levi", "noa-levi"], ["\u202eNoa\u2066Levi\u2069", "noa-levi"],
    ["Noa-נועה", "noa"], ["CON", "con"], ["AUX.txt", "aux-txt"], ["LPT1", "lpt1"],
  ])("uses a bounded ASCII label for %j without changing receipt status", (name, token) => {
    expect(childExportFilename(name, "complete")).toBe(`arbor-${token}-data.json`);
    expect(childExportFilename(name, "incomplete")).toBe(`arbor-${token}-data.partial.json`);
  });

  it("bounds long labels while keeping the truthful extension", () => {
    for (const status of ["complete", "incomplete"] as const) {
      const filename = childExportFilename("A".repeat(1000), status);
      expect(filename).toBe(`arbor-${"a".repeat(64)}-data${status === "incomplete" ? ".partial" : ""}.json`);
      expect(filename).toMatch(/^arbor-[a-z0-9_-]+-data(?:\.partial)?\.json$/);
      expect(filename.length).toBeLessThan(100);
    }
  });
});
