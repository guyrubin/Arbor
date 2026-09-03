// Wave S+L: profile language ROLES never leave the app in a packet. A parent
// stores "Hebrew (Native)" / "English (Transition)" as their own bookkeeping;
// on a teacher's or clinician's page "(Transition)" reads as a status label.
import { describe, expect, it } from "vitest";
import { exportLanguageName } from "./packet";

describe("exportLanguageName — roles stripped from exported language names", () => {
  it("drops the parenthetical role", () => {
    expect(exportLanguageName("Hebrew (Native)")).toBe("Hebrew");
    expect(exportLanguageName("English (Transition)")).toBe("English");
    expect(exportLanguageName("Dutch (Exposure) ")).toBe("Dutch");
  });

  it("leaves plain names untouched", () => {
    expect(exportLanguageName("Hebrew")).toBe("Hebrew");
    expect(exportLanguageName("Frank Ruhl")).toBe("Frank Ruhl");
  });

  it("negative control: the raw join would have leaked the role", () => {
    const raw = ["Hebrew (Native)", "English (Transition)"].join(" and ");
    expect(raw).toContain("(Transition)");
    const exported = ["Hebrew (Native)", "English (Transition)"].map(exportLanguageName).join(" and ");
    expect(exported).toBe("Hebrew and English");
  });
});
