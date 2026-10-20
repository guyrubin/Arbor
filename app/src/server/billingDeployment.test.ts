import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("billing configuration survives releases", () => {
  it("updates deployment values without erasing checkout links or provider secrets", () => {
    const config = readFileSync(new URL("../../../cloudbuild.prod.yaml", import.meta.url), "utf8");
    const flags = config.split("\n").map(line => line.trim()).filter(line => line.startsWith("- --"));
    expect(flags).toContain("- --update-env-vars");
    expect(flags).toContain("- --update-secrets");
    expect(flags).not.toContain("- --set-env-vars");
    expect(flags).not.toContain("- --set-secrets");
    expect(config).toContain("REQUIRE_AUTH=true");
    expect(config).toContain("ENFORCE_ENTITLEMENTS=true");
  });

  it("binds the checkout link from Secret Manager on every release", () => {
    const config = readFileSync(new URL("../../../cloudbuild.prod.yaml", import.meta.url), "utf8");
    const lines = config.split("\n").map(line => line.trim());
    const secrets = lines[lines.indexOf("- --update-secrets") + 1] ?? "";
    expect(secrets.split(",")).toContain("BILLING_WEB_PURCHASE_LINK=arbor-billing-web-purchase-link:latest");
  });
});
