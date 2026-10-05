/**
 * B-KID-36 (KA-01) — a real photo can never become the hero.
 *
 * The leak: ProfileEditDrawer "Upload a photo instead" set `photoUrl` to the
 * real photo and cleared `avatarMeta`, but save wrote
 * `...(avatarMeta ? { avatar: avatarMeta } : {})` — the key was OMITTED, the
 * stored `avatar` metadata survived, and resolveHeroUrl returned the real
 * photo as the hero on every kid surface (and as the /generate-scene
 * reference image).
 *
 * The fix is at both ends: the drawer always writes its own `avatar` key (an
 * own `undefined` on a CLEARABLE field becomes deleteField()), and the read
 * side only ever resolves a generated image.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLEARABLE_PROFILE_FIELDS } from "../../lib/childAge";
import { resolveHeroUrl } from "../ui/HeroAvatar";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const drawer = readFileSync(path.join(HERE, "ProfileEditDrawer.tsx"), "utf8");

const HERO = "data:image/png;base64,GENERATEDHERO";
const UPLOADED_INLINE = "data:image/jpeg;base64,REALPHOTO";
const UPLOADED_STORAGE = "https://firebasestorage.googleapis.com/v0/b/x/o/children%2Fc1%2Fphoto.jpg";
const STORED = { id: "c1", photoUrl: HERO, avatar: { style: "soft3d", source: "descriptor" as const, createdAt: "2026-09-22T10:00:00.000Z" } };

/** ProfileContext.updateChild's clear + local-apply logic, verbatim in effect. */
function applyPatch(stored: Record<string, unknown>, patch: Record<string, unknown>) {
  const clears = CLEARABLE_PROFILE_FIELDS.filter((k) => Object.prototype.hasOwnProperty.call(patch, k) && patch[k] === undefined);
  const next = { ...stored, ...patch } as Record<string, unknown>;
  for (const k of clears) delete next[k];
  return { clears, next };
}

describe("B-KID-36 — the profile drawer cannot turn a real photo into the hero", () => {
  it("avatar and comicAvatarUrl are clearable profile fields", () => {
    expect(CLEARABLE_PROFILE_FIELDS).toContain("avatar");
    expect(CLEARABLE_PROFILE_FIELDS).toContain("comicAvatarUrl");
    expect(CLEARABLE_PROFILE_FIELDS).toContain("birthDate");
  });

  it("the drawer save always writes its own avatar key (never the omit-when-empty spread)", () => {
    expect(drawer).not.toMatch(/\.\.\.\(avatarMeta \? \{ avatar: avatarMeta \} : \{\}\)/);
    expect(drawer).toContain("avatar: avatarMeta ?? undefined,");
    // Upload and Remove are the two paths that clear the metadata.
    expect(drawer).toContain("setAvatarMeta(undefined); // a raw uploaded photo isn't a generated avatar");
  });

  it("'Upload a photo instead' + Save → the patch deletes avatar and the child has no hero", () => {
    for (const photo of [UPLOADED_INLINE, UPLOADED_STORAGE]) {
      const avatarMeta = undefined; // what onPickPhoto leaves behind
      const patch = { photoUrl: photo, avatar: avatarMeta ?? undefined };
      const { clears, next } = applyPatch(STORED, patch);
      expect(clears).toContain("avatar");
      expect("avatar" in next).toBe(false);
      expect(resolveHeroUrl(next)).toBeNull();
    }
  });

  it("negative control: the shipped omit-the-key shape kept the stored avatar and leaked the photo", () => {
    const avatarMeta: unknown = undefined;
    const shipped = { photoUrl: UPLOADED_INLINE, ...(avatarMeta ? { avatar: avatarMeta } : {}) };
    const { clears, next } = applyPatch(STORED, shipped);
    expect(clears).toEqual([]);
    expect(next.avatar).toBeDefined();
    // An inline upload is indistinguishable at read time — the write fix is load-bearing.
    expect(resolveHeroUrl(next)).toBe(UPLOADED_INLINE);
  });

  it("read side: a hero is only ever a generated inline image with well-formed metadata", () => {
    // Stale metadata next to a Storage-hosted real photo (pre-fix data) → no hero.
    expect(resolveHeroUrl({ photoUrl: UPLOADED_STORAGE, avatar: STORED.avatar })).toBeNull();
    // Metadata without a generator source → no hero.
    expect(resolveHeroUrl({ photoUrl: HERO, avatar: { style: "flat" } })).toBeNull();
    expect(resolveHeroUrl({ photoUrl: HERO, avatar: true })).toBeNull();
    // A real generated hero still resolves (both generator sources).
    expect(resolveHeroUrl(STORED)).toBe(HERO);
    expect(resolveHeroUrl({ photoUrl: HERO, avatar: { ...STORED.avatar, source: "photo" } })).toBe(HERO);
  });

  it("making a hero in the drawer still persists it (the creator path sets avatarMeta)", () => {
    const patch = { photoUrl: HERO, avatar: STORED.avatar ?? undefined };
    const { clears, next } = applyPatch({ id: "c1", photoUrl: UPLOADED_STORAGE }, patch);
    expect(clears).toEqual([]);
    expect(resolveHeroUrl(next)).toBe(HERO);
  });
});
