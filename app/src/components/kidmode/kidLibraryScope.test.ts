/**
 * B-KID-143 / B-KID-85: the saved-comic reader and hidden-grid state must
 * never survive a change of account or child (including matching child IDs
 * across accounts). Synthetic identities only; no private family data.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scopedKidLibraryKey } from "./kidLibraryScope";

describe("saved comic reader owner/child lifetime", () => {
  it("distinguishes identical child IDs belonging to different accounts", () => {
    expect(scopedKidLibraryKey("owner-A", "kid-1")).not.toBe(scopedKidLibraryKey("owner-B", "kid-1"));
  });

  it("distinguishes two siblings under the same account", () => {
    expect(scopedKidLibraryKey("owner-A", "kid-1")).not.toBe(scopedKidLibraryKey("owner-A", "kid-2"));
  });

  it("uses unambiguous tuples, including identifiers containing delimiters", () => {
    expect(scopedKidLibraryKey("owner|A", "kid-1")).not.toBe(scopedKidLibraryKey("owner", "A|kid-1"));
    expect(scopedKidLibraryKey("a", "b,c")).not.toBe(scopedKidLibraryKey("a,b", "c"));
  });

  it("never equates the signed-out lifetime with a signed-in account", () => {
    expect(scopedKidLibraryKey("signed-out", "kid-1")).not.toBe(scopedKidLibraryKey("owner-A", "kid-1"));
  });

  it("remounts the *whole* library reader at the scope boundary, not only its shelf", () => {
    const src = readFileSync(new URL("./KidLibrary.tsx", import.meta.url), "utf8");
    expect(src).toContain("useSyncExternalStore(subscribeHeroSheetOwner, heroSheetOwnerKey, heroSheetOwnerKey)");
    expect(src).toContain("scopedKidLibraryKey(owner, props.childProfile.id)");
    expect(src).toContain("<ScopedKidLibrary key={scope}");
    expect(src).toContain('<KidComicsShelf key={scope} authKey={owner}');
    expect(src).toContain('owner !== "signed-out"');
  });
});
