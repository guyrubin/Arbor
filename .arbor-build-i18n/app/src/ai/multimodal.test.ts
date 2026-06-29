import { describe, expect, it } from "vitest";
import { buildGenAiContents, buildVertexParts } from "./modelRouter.js";

const img = { data: "QUJD", mimeType: "image/png" };

describe("multimodal content builders (VIS-1)", () => {
  it("returns a bare prompt string when there are no images", () => {
    expect(buildGenAiContents("hello")).toBe("hello");
    expect(buildGenAiContents("hello", [])).toBe("hello");
  });

  it("builds genai contents with text + inline image parts", () => {
    const c = buildGenAiContents("describe", [img]) as any[];
    expect(Array.isArray(c)).toBe(true);
    expect(c[0]).toEqual({ text: "describe" });
    expect(c[1]).toEqual({ inlineData: { mimeType: "image/png", data: "QUJD" } });
  });

  it("builds vertex parts with text always first", () => {
    const p = buildVertexParts("describe", [img, img]);
    expect(p[0]).toEqual({ text: "describe" });
    expect(p).toHaveLength(3);
    expect(p[1]).toEqual({ inlineData: { mimeType: "image/png", data: "QUJD" } });
  });

  it("vertex parts is text-only when no images", () => {
    expect(buildVertexParts("hi")).toEqual([{ text: "hi" }]);
  });
});
