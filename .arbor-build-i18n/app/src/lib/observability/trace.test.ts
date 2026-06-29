import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isTracingEnabled, resolveProjectId, traceFieldsFromHeaders } from "./trace.js";

const TRACE_KEY = "logging.googleapis.com/trace";
const SPAN_KEY = "logging.googleapis.com/spanId";
const SAMPLED_KEY = "logging.googleapis.com/trace_sampled";

describe("trace propagation (OPS-1)", () => {
  const savedPid = process.env.GCP_PROJECT_ID;
  beforeEach(() => {
    process.env.GCP_PROJECT_ID = "arbor-prod";
  });
  afterEach(() => {
    if (savedPid === undefined) delete process.env.GCP_PROJECT_ID;
    else process.env.GCP_PROJECT_ID = savedPid;
  });

  describe("no-op when GCP_PROJECT_ID is unset", () => {
    it("returns an empty object and never emits a half-formed resource name", () => {
      delete process.env.GCP_PROJECT_ID;
      const fields = traceFieldsFromHeaders(
        { "x-cloud-trace-context": "abc123/456;o=1" },
        undefined
      );
      expect(fields).toEqual({});
      expect(isTracingEnabled()).toBe(false);
    });

    it("explicit empty projectId arg also no-ops", () => {
      delete process.env.GCP_PROJECT_ID;
      expect(traceFieldsFromHeaders({ traceparent: "00-" + "a".repeat(32) + "-" + "b".repeat(16) + "-01" }, "")).toEqual({});
    });
  });

  describe("X-Cloud-Trace-Context (GCP legacy)", () => {
    it("parses TRACE/SPAN;o=1 into qualified fields", () => {
      const fields = traceFieldsFromHeaders({ "x-cloud-trace-context": "105445aa7843bc8bf206b120001000/1234;o=1" });
      expect(fields[TRACE_KEY]).toBe("projects/arbor-prod/traces/105445aa7843bc8bf206b120001000");
      expect(fields[SPAN_KEY]).toBe("1234");
      expect(fields[SAMPLED_KEY]).toBe(true);
    });

    it("handles trace id only (no span, no flag)", () => {
      const fields = traceFieldsFromHeaders({ "x-cloud-trace-context": "abcdef0123456789" });
      expect(fields[TRACE_KEY]).toBe("projects/arbor-prod/traces/abcdef0123456789");
      expect(fields[SPAN_KEY]).toBeUndefined();
      expect(fields[SAMPLED_KEY]).toBeUndefined();
    });

    it("reads o=0 as not sampled", () => {
      const fields = traceFieldsFromHeaders({ "x-cloud-trace-context": "abcdef/99;o=0" });
      expect(fields[SAMPLED_KEY]).toBe(false);
    });

    it("ignores a non-numeric span id", () => {
      const fields = traceFieldsFromHeaders({ "x-cloud-trace-context": "abcdef/notaspan;o=1" });
      expect(fields[TRACE_KEY]).toBe("projects/arbor-prod/traces/abcdef");
      expect(fields[SPAN_KEY]).toBeUndefined();
    });
  });

  describe("W3C traceparent", () => {
    const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
    const PARENT = "00f067aa0ba902b7";

    it("parses a valid traceparent", () => {
      const fields = traceFieldsFromHeaders({ traceparent: `00-${TRACE}-${PARENT}-01` });
      expect(fields[TRACE_KEY]).toBe(`projects/arbor-prod/traces/${TRACE}`);
      expect(fields[SPAN_KEY]).toBe(PARENT);
      expect(fields[SAMPLED_KEY]).toBe(true);
    });

    it("reads the un-sampled flag (00)", () => {
      const fields = traceFieldsFromHeaders({ traceparent: `00-${TRACE}-${PARENT}-00` });
      expect(fields[SAMPLED_KEY]).toBe(false);
    });

    it("rejects an all-zero trace id", () => {
      expect(traceFieldsFromHeaders({ traceparent: `00-${"0".repeat(32)}-${PARENT}-01` })).toEqual({});
    });

    it("drops an all-zero parent span but keeps the trace", () => {
      const fields = traceFieldsFromHeaders({ traceparent: `00-${TRACE}-${"0".repeat(16)}-01` });
      expect(fields[TRACE_KEY]).toBe(`projects/arbor-prod/traces/${TRACE}`);
      expect(fields[SPAN_KEY]).toBeUndefined();
    });
  });

  describe("precedence + malformed input", () => {
    it("prefers X-Cloud-Trace-Context over traceparent when both present", () => {
      const fields = traceFieldsFromHeaders({
        "x-cloud-trace-context": "c10dc0de123/7;o=1",
        traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
      });
      expect(fields[TRACE_KEY]).toBe("projects/arbor-prod/traces/c10dc0de123");
    });

    it("returns empty for garbage / non-hex / missing headers", () => {
      expect(traceFieldsFromHeaders({})).toEqual({});
      expect(traceFieldsFromHeaders(undefined)).toEqual({});
      expect(traceFieldsFromHeaders({ "x-cloud-trace-context": "/;o=1" })).toEqual({});
      expect(traceFieldsFromHeaders({ "x-cloud-trace-context": "not hex!!/9" })).toEqual({});
      expect(traceFieldsFromHeaders({ traceparent: "garbage" })).toEqual({});
    });

    it("handles array-valued headers (Node multi-header) by taking the first", () => {
      const fields = traceFieldsFromHeaders({ "x-cloud-trace-context": ["abc123/5;o=1", "ignored/9"] });
      expect(fields[TRACE_KEY]).toBe("projects/arbor-prod/traces/abc123");
      expect(fields[SPAN_KEY]).toBe("5");
    });
  });

  describe("resolveProjectId", () => {
    it("prefers explicit arg over env", () => {
      expect(resolveProjectId("explicit-pid")).toBe("explicit-pid");
    });
    it("falls back to env", () => {
      expect(resolveProjectId()).toBe("arbor-prod");
    });
    it("is undefined when neither is set", () => {
      delete process.env.GCP_PROJECT_ID;
      expect(resolveProjectId()).toBeUndefined();
    });
  });
});
