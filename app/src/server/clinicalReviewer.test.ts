import { describe, it, expect, afterEach } from "vitest";
import { isClinicalReviewer } from "./clinicalReviewer";
import { loadConfig } from "../config/env";
import { createTestConfig } from "../testConfig";

/**
 * GD-1 reviewer-preview — allow-list guard + env parsing, pinned fail-closed:
 * CLINICAL_REVIEWER_EMAILS unset/empty means NOBODY previews drafts. The guard
 * gates render/egress of draft-review signals only; the publication predicate
 * (isPublishableContent) is not involved here in any way.
 */

const ENV_KEY = "CLINICAL_REVIEWER_EMAILS";
const savedEnv = process.env[ENV_KEY];

afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedEnv;
});

describe("env parsing — CLINICAL_REVIEWER_EMAILS", () => {
  it("defaults to EMPTY (fail-closed: nobody) when the var is unset", () => {
    delete process.env[ENV_KEY];
    expect(loadConfig().clinicalReviewerEmails).toEqual([]);
  });

  it("defaults to EMPTY when the var is blank or only separators", () => {
    process.env[ENV_KEY] = "  , ,  ";
    expect(loadConfig().clinicalReviewerEmails).toEqual([]);
  });

  it("parses a comma-separated list, trimmed and lowercased", () => {
    process.env[ENV_KEY] = " Reviewer@Example.com , second@x.io ";
    expect(loadConfig().clinicalReviewerEmails).toEqual(["reviewer@example.com", "second@x.io"]);
  });

  it("testConfig ships the fail-closed default (empty list)", () => {
    expect(createTestConfig().clinicalReviewerEmails).toEqual([]);
  });
});

describe("isClinicalReviewer — fail-closed allow-list", () => {
  const config = createTestConfig({ clinicalReviewerEmails: ["reviewer@example.com"] });

  it("matches the appointed reviewer's email, case-insensitively", () => {
    expect(isClinicalReviewer(config, { uid: "u1", email: "reviewer@example.com" })).toBe(true);
    expect(isClinicalReviewer(config, { uid: "u1", email: "Reviewer@Example.COM" })).toBe(true);
  });

  it("rejects every other authenticated email", () => {
    expect(isClinicalReviewer(config, { uid: "u2", email: "parent@example.com" })).toBe(false);
    // Exact match only — never substring or domain-wide.
    expect(isClinicalReviewer(config, { uid: "u3", email: "reviewer@example.com.evil.io" })).toBe(false);
    expect(isClinicalReviewer(config, { uid: "u4", email: "xreviewer@example.com" })).toBe(false);
  });

  it("rejects unauthenticated / sandbox actors (no email)", () => {
    expect(isClinicalReviewer(config, { uid: "local-sandbox", email: null })).toBe(false);
    expect(isClinicalReviewer(config, { uid: "u5", email: "" })).toBe(false);
    expect(isClinicalReviewer(config, { uid: "u6", email: "   " })).toBe(false);
  });

  it("FAIL-CLOSED: with the list unset/empty NOBODY is a reviewer", () => {
    const empty = createTestConfig(); // clinicalReviewerEmails: []
    expect(empty.clinicalReviewerEmails).toEqual([]);
    expect(isClinicalReviewer(empty, { uid: "u1", email: "reviewer@example.com" })).toBe(false);
    expect(isClinicalReviewer(empty, { uid: "local-sandbox", email: null })).toBe(false);
  });
});
