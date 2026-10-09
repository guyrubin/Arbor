import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/** B-GA-28 — a children's-data app keeps nothing in Android cloud backup or device transfer. */
const androidMain = path.resolve(__dirname, "../../android/app/src/main");
const manifest = readFileSync(path.join(androidMain, "AndroidManifest.xml"), "utf8");
const rules = readFileSync(path.join(androidMain, "res/xml/data_extraction_rules.xml"), "utf8");
const DOMAINS = ["root", "file", "database", "sharedpref", "external"];

describe("B-GA-28 Android backup is off", () => {
  it("the manifest disables backup and points at the extraction rules", () => {
    expect(manifest).toContain('android:allowBackup="false"');
    expect(manifest).toContain('android:fullBackupContent="false"');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
    expect(manifest).not.toContain('android:allowBackup="true"');
  });

  it("both cloud backup and device transfer exclude every domain", () => {
    for (const section of ["cloud-backup", "device-transfer"]) {
      const block = rules.slice(rules.indexOf(`<${section}>`), rules.indexOf(`</${section}>`));
      expect(block.length).toBeGreaterThan(0);
      for (const d of DOMAINS) expect(block).toContain(`<exclude domain="${d}" path="." />`);
      expect(block).not.toContain("<include");
    }
  });
});
