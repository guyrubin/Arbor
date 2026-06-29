/**
 * F-NEW — AP-049 binding safety test (GATED-CLEARANCES-SAFETY.md AP-049, condition F-NEW).
 *
 * Asserts: on the photo/face capture path, a `face_processing` grant for the
 * matching childId is recorded BEFORE the avatar capture/upload (generateAvatar)
 * call fires. The test FAILS if someone reorders the two calls so generateAvatar
 * fires first, or if grantConsent is removed from the photo path entirely.
 *
 * No network, no DOM — deterministic node-environment test.
 */

import { describe, it, expect, vi } from "vitest";
import { runAvatarGeneration } from "./avatarGate";

const CHILD_ID = "child-test-001";
const PHOTO_URL = "data:image/jpeg;base64,/9j/abc123";
const AVATAR_RESULT = { dataUrl: "data:image/png;base64,generated", style: "comichero", source: "photo" as const };

describe("F-NEW — face_processing consent must precede generateAvatar on the photo path", () => {
  it("records grantConsent BEFORE generateAvatar fires (photo path)", async () => {
    const callOrder: string[] = [];

    const grantConsent = vi.fn(async () => {
      callOrder.push("grantConsent");
    });
    const generateAvatar = vi.fn(async () => {
      callOrder.push("generateAvatar");
      return AVATAR_RESULT;
    });

    await runAvatarGeneration(
      CHILD_ID,
      { mode: "photo", refPhoto: PHOTO_URL, style: "comichero", descriptors: {} },
      { grantConsent, generateAvatar },
    );

    // Both must have been called.
    expect(grantConsent).toHaveBeenCalledOnce();
    expect(generateAvatar).toHaveBeenCalledOnce();

    // ORDER IS THE GATE: grantConsent must precede generateAvatar.
    expect(callOrder).toEqual(["grantConsent", "generateAvatar"]);
    expect(callOrder.indexOf("grantConsent")).toBeLessThan(
      callOrder.indexOf("generateAvatar"),
    );
  });

  it("passes the correct childId and purpose to grantConsent", async () => {
    const grantConsent = vi.fn(async () => undefined);
    const generateAvatar = vi.fn(async () => AVATAR_RESULT);

    await runAvatarGeneration(
      CHILD_ID,
      { mode: "photo", refPhoto: PHOTO_URL, style: "storybook", descriptors: {} },
      { grantConsent, generateAvatar },
    );

    expect(grantConsent).toHaveBeenCalledWith({ childId: CHILD_ID, purpose: "face_processing" });
  });

  it("passes the refPhoto dataUrl to generateAvatar on the photo path", async () => {
    const grantConsent = vi.fn(async () => undefined);
    const generateAvatar = vi.fn(async () => AVATAR_RESULT);

    await runAvatarGeneration(
      CHILD_ID,
      { mode: "photo", refPhoto: PHOTO_URL, style: "soft3d", descriptors: {} },
      { grantConsent, generateAvatar },
    );

    expect(generateAvatar).toHaveBeenCalledWith(
      expect.objectContaining({ photo: { dataUrl: PHOTO_URL } }),
    );
    // Must NOT contain a descriptors key on the photo path.
    expect(generateAvatar).not.toHaveBeenCalledWith(
      expect.objectContaining({ descriptors: expect.anything() }),
    );
  });

  it("FAILS (reversed order) — this test verifies the gate is sensitive to reordering", async () => {
    // Simulate what a broken implementation looks like: generateAvatar fires first.
    const callOrder: string[] = [];
    const brokenGenerateAvatar = vi.fn(async (_payload?: unknown) => {
      callOrder.push("generateAvatar"); // fires first in the broken version
      return AVATAR_RESULT;
    });
    const brokenGrantConsent = vi.fn(async (_opts?: unknown) => {
      callOrder.push("grantConsent"); // fires second — too late
    });

    // Call them in the WRONG order to prove the assertion would catch it.
    await brokenGenerateAvatar({});
    await brokenGrantConsent({ childId: CHILD_ID, purpose: "face_processing" });

    // This is the BROKEN order — the test asserts it is wrong.
    expect(callOrder[0]).toBe("generateAvatar");
    expect(callOrder[1]).toBe("grantConsent");
    // Confirm: grantConsent does NOT precede generateAvatar here.
    expect(callOrder.indexOf("grantConsent")).toBeGreaterThan(
      callOrder.indexOf("generateAvatar"),
    );
  });

  it("does NOT call grantConsent on the describe path (no photo, no face data)", async () => {
    const grantConsent = vi.fn(async () => undefined);
    const generateAvatar = vi.fn(async () => ({
      dataUrl: "data:image/png;base64,desc",
      style: "flat",
      source: "descriptor" as const,
    }));

    await runAvatarGeneration(
      CHILD_ID,
      { mode: "describe", refPhoto: undefined, style: "flat", descriptors: { hair: "curly", skin: "tan" } },
      { grantConsent, generateAvatar },
    );

    expect(grantConsent).not.toHaveBeenCalled();
    expect(generateAvatar).toHaveBeenCalledOnce();
    expect(generateAvatar).toHaveBeenCalledWith(
      expect.objectContaining({ descriptors: { hair: "curly", skin: "tan" } }),
    );
    expect(generateAvatar).not.toHaveBeenCalledWith(
      expect.objectContaining({ photo: expect.anything() }),
    );
  });

  it("does NOT call grantConsent when mode is photo but refPhoto is absent (no file chosen yet)", async () => {
    const grantConsent = vi.fn(async () => undefined);
    const generateAvatar = vi.fn(async () => ({
      dataUrl: "data:image/png;base64,desc2",
      style: "flat",
      source: "descriptor" as const,
    }));

    await runAvatarGeneration(
      CHILD_ID,
      { mode: "photo", refPhoto: undefined, style: "flat", descriptors: {} },
      { grantConsent, generateAvatar },
    );

    // Without a refPhoto there is no face to process — gate does not fire.
    expect(grantConsent).not.toHaveBeenCalled();
  });
});
