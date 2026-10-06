/**
 * buildHeroSheet — B-GAME-13c: the parent-side sheet builder.
 *
 * Runs ONLY after the parent accepts a hero ("Use this hero", AvatarCreator)
 * or resumes a build the parent started (the child profile). Never from Kid
 * Mode: no module under components/kidmode/ imports this file except its own
 * test (guarded by heroSheetBuilder.guard.test.ts).
 *
 * Per pose, idle first (the anchor), then the other seven in two lanes:
 *   POST /api/hero-pose { childId, pose, avatarHash }   (server draws on green)
 *   -> decode on a canvas -> heroKeyer.keySprite (cut-out + QA gate)
 *   -> on a QA reject: once more with the same prompt (counted, not re-charged)
 *   -> normalise to the idle's pixels-per-head (normalisePose), anchors
 *   -> WebP alpha <= 150 KB (PNG where the device cannot encode WebP)
 *   -> heroSheet/{pose} in the child's record (+ heroSheet/_meta).
 * Resumable: poses already stored for the same hero are kept; a new hero
 * (avatarHash) replaces the old sheet in the same pass.
 */
import { authHeaders } from "../../../lib/api";
import {
  HERO_POSE_REFUSALS,
  HERO_SHEET_ANCHOR,
  HERO_SHEET_META_ID,
  HERO_SHEET_MODEL,
  HERO_SHEET_POSE_IDS,
  heroAvatarHash,
  type HeroSheetMetaDoc,
  type HeroSheetPoseDoc,
  type HeroSheetPoseId,
  type HeroSheetStatus,
} from "../../../lib/heroSheetContract";
import { keySprite, normalisePose, sheetReference, type KeyedSprite, type RgbaImage, type SheetReference } from "./heroKeyer";
import { heroSheetStoreFor, type HeroSheetDocs, type HeroSheetStore } from "./heroSheetStore";

export type PoseResponse =
  | { ok: true; dataUrl: string; avatarHash: string; model?: string }
  | { ok: false; status: number; code: string };

export interface BuilderDeps {
  requestPose(body: { childId: string; pose: HeroSheetPoseId; avatarHash: string }): Promise<PoseResponse>;
  decode(dataUrl: string): Promise<RgbaImage>;
  /** Resample to w x h and encode with alpha; `factor` < 1 when it had to shrink further to fit. */
  encodeSprite(img: RgbaImage, w: number, h: number): Promise<{ dataUrl: string; factor: number }>;
  /** The keyed idle over its key colour, small JPEG: the server's image 1. */
  encodeAnchor(img: RgbaImage, keyColour: string): Promise<string>;
  store: HeroSheetStore;
  sleep(ms: number): Promise<void>;
  now(): string;
}

export interface BuildResult {
  status: HeroSheetStatus | "not-started";
  stored: HeroSheetPoseId[];
  skipped: HeroSheetPoseId[];
  stoppedBy?: string;
  calls: number;
}

/** Refusals that end the build (nothing a retry can change today). */
const TERMINAL = new Set<string>([
  HERO_POSE_REFUSALS.plan, HERO_POSE_REFUSALS.photo, HERO_POSE_REFUSALS.missing, HERO_POSE_REFUSALS.auth,
  HERO_POSE_REFUSALS.upload, HERO_POSE_REFUSALS.resting, HERO_POSE_REFUSALS.anchor, "image_resting", "hero_pose_bad_request",
]);
/** The stored hero lags the accept (the profile is saved a moment later). */
const SAVE_WAIT_MS = 5000;
const SAVE_WAITS = 24;
const BUSY_RETRIES = 3;

type Drawn = { ok: true; keyed: KeyedSprite } | { ok: false; stop?: string; skip?: string };

/**
 * Draw one pose: route call (waiting for the save, backing off when busy),
 * key, QA; one more try on a QA reject.
 */
async function drawPose(childId: string, pose: HeroSheetPoseId, avatarHash: string, deps: BuilderDeps, count: () => void): Promise<Drawn> {
  for (let qaTry = 0; qaTry < 2; qaTry++) {
    let res: PoseResponse | null = null;
    for (let wait = 0, busy = 0; ; ) {
      count();
      res = await deps.requestPose({ childId, pose, avatarHash }).catch(() => ({ ok: false as const, status: 0, code: "network" }));
      if (res.ok) break;
      if (res.code === HERO_POSE_REFUSALS.changed && wait < SAVE_WAITS) { wait++; await deps.sleep(SAVE_WAIT_MS); continue; }
      if (TERMINAL.has(res.code) || res.code === HERO_POSE_REFUSALS.changed) return { ok: false, stop: res.code };
      if (busy < BUSY_RETRIES) { busy++; await deps.sleep(4000 * 2 ** (busy - 1)); continue; }
      return { ok: false, skip: "busy" };
    }
    if (!res || !res.ok) return { ok: false, skip: "busy" };
    const img = await deps.decode(res.dataUrl).catch(() => null);
    if (!img) continue;
    const keyed = keySprite(img);
    if (keyed.ok && keyed.sprite) return { ok: true, keyed };
  }
  return { ok: false, skip: "qa" };
}

/** Normalise, encode and store one keyed pose. */
async function storePose(pose: HeroSheetPoseId, keyed: KeyedSprite, ref: SheetReference, avatarHash: string, deps: BuilderDeps, extra: Partial<HeroSheetPoseDoc> = {}): Promise<HeroSheetPoseDoc> {
  const sprite = keyed.sprite as RgbaImage;
  const n = normalisePose(pose, sprite, ref);
  const enc = await deps.encodeSprite(sprite, n.w, n.h);
  const f = enc.factor;
  const r1 = (v: number) => Math.round(v * f * 10) / 10;
  const doc: HeroSheetPoseDoc = {
    id: pose, v: 1, pose, dataUrl: enc.dataUrl,
    w: Math.max(1, Math.round(n.w * f)), h: Math.max(1, Math.round(n.h * f)),
    foot: { x: r1(n.foot.x), y: r1(n.foot.y) },
    head: { x: r1(n.head.x), y: r1(n.head.y), r: r1(n.head.r) },
    ...(n.hand ? { hand: { ...(n.hand.l ? { l: [r1(n.hand.l[0]), r1(n.hand.l[1])] as [number, number] } : {}), ...(n.hand.r ? { r: [r1(n.hand.r[0]), r1(n.hand.r[1])] as [number, number] } : {}) } } : {}),
    scale: n.scale,
    avatarHash,
    model: HERO_SHEET_MODEL,
    keyColour: keyed.keyColour,
    createdAt: deps.now(),
    ...extra,
  };
  if (pose === HERO_SHEET_ANCHOR) doc.anchor = await deps.encodeAnchor(sprite, keyed.keyColour);
  await deps.store.writePose(doc);
  return doc;
}

/** Build (or resume) the sheet of the child's current hero. */
export async function buildHeroSheet(input: { childId: string; avatarHash: string; poses?: readonly HeroSheetPoseId[] }, deps: BuilderDeps): Promise<BuildResult> {
  const { childId, avatarHash } = input;
  const wanted = (input.poses ?? HERO_SHEET_POSE_IDS).filter((p) => p !== HERO_SHEET_ANCHOR);
  let calls = 0;
  const count = () => { calls++; };
  const existing: HeroSheetDocs = await deps.store.read().catch(() => ({ meta: null, poses: {} }));
  const stale = existing.meta && existing.meta.avatarHash !== avatarHash;
  const kept = new Set<HeroSheetPoseId>();
  if (!stale) for (const p of HERO_SHEET_POSE_IDS) if (existing.poses[p]?.avatarHash === avatarHash) kept.add(p);
  const stored: HeroSheetPoseId[] = HERO_SHEET_POSE_IDS.filter((p) => kept.has(p));
  const skipped: HeroSheetPoseId[] = [];
  const meta = (status: HeroSheetStatus, stoppedBy?: string): HeroSheetMetaDoc => ({
    id: HERO_SHEET_META_ID, v: 1, heroId: avatarHash, source: "generated", avatarHash,
    poses: HERO_SHEET_POSE_IDS.filter((p) => stored.includes(p)), status, ...(stoppedBy ? { stoppedBy } : {}), updatedAt: deps.now(),
  });

  // 1. The anchor.
  let ref: SheetReference | null = null;
  if (kept.has(HERO_SHEET_ANCHOR)) {
    const idleImg = await deps.decode(existing.poses[HERO_SHEET_ANCHOR]!.dataUrl).catch(() => null);
    if (idleImg) ref = sheetReference(idleImg);
  }
  if (!ref) {
    const drawn = await drawPose(childId, HERO_SHEET_ANCHOR, avatarHash, deps, count);
    if (!drawn.ok) {
      // A refusal before anything was drawn (Free plan, photo hero, no hero):
      // nothing is written; an old sheet of another hero stays stale (unplayed).
      if (!stored.length && drawn.stop && !existing.meta) return { status: "not-started", stored, skipped: [HERO_SHEET_ANCHOR], stoppedBy: drawn.stop, calls };
      const stop = drawn.stop ?? drawn.skip ?? "qa";
      await deps.store.writeMeta(meta("stopped", stop)).catch(() => undefined);
      return { status: "stopped", stored, skipped: [HERO_SHEET_ANCHOR], stoppedBy: stop, calls };
    }
    // The new hero's first pose exists: the old hero's sheet goes in this pass.
    if (stale || existing.meta?.avatarHash !== avatarHash) {
      const old = HERO_SHEET_POSE_IDS.filter((p) => existing.poses[p] && existing.poses[p]!.avatarHash !== avatarHash);
      if (old.length) await deps.store.remove(old).catch(() => undefined);
    }
    const sprite = drawn.keyed.sprite as RgbaImage;
    ref = sheetReference(sprite);
    await storePose(HERO_SHEET_ANCHOR, drawn.keyed, ref, avatarHash, deps);
    stored.unshift(HERO_SHEET_ANCHOR);
    await deps.store.writeMeta(meta("building"));
  }

  // 2. The other poses, two lanes (cheer first: idle + cheer make it playable).
  const queue = wanted.filter((p) => !kept.has(p)).sort((a, b) => (a === "cheer" ? -1 : b === "cheer" ? 1 : 0));
  let stopped: string | undefined;
  const lane = async () => {
    for (let p = queue.shift(); p && !stopped; p = queue.shift()) {
      const drawn = await drawPose(childId, p, avatarHash, deps, count);
      if (!drawn.ok) {
        if (drawn.stop) stopped = drawn.stop;
        else skipped.push(p);
        continue;
      }
      await storePose(p, drawn.keyed, ref as SheetReference, avatarHash, deps);
      stored.push(p);
      await deps.store.writeMeta(meta("building"));
    }
  };
  await Promise.all([lane(), lane()]);
  const status: HeroSheetStatus = stopped ? "stopped" : "complete";
  await deps.store.writeMeta(meta(status, stopped));
  return { status, stored: HERO_SHEET_POSE_IDS.filter((p) => stored.includes(p)), skipped, ...(stopped ? { stoppedBy: stopped } : {}), calls };
}

/* ── Browser wiring ──────────────────────────────────────────────────────── */

const SPRITE_MAX_BYTES = 150 * 1024;
const DOC_MAX_BYTES = 700 * 1024;

/** POST /api/hero-pose with the parent's token; refusals come back as codes. */
export async function fetchHeroPose(body: { childId: string; pose: HeroSheetPoseId; avatarHash: string }): Promise<PoseResponse> {
  const res = await fetch("/api/hero-pose", { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = null;
  }
  if (!res.ok || !data || typeof data.dataUrl !== "string") {
    return { ok: false, status: res.status, code: typeof data?.code === "string" ? data.code : `http_${res.status}` };
  }
  return { ok: true, dataUrl: data.dataUrl, avatarHash: typeof data.avatarHash === "string" ? data.avatarHash : body.avatarHash };
}

const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function canvasFromRgba(img: RgbaImage): HTMLCanvasElement {
  const c = canvasOf(img.width, img.height);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  const data = new ImageData(img.width, img.height);
  data.data.set(img.data);
  ctx.putImageData(data, 0, 0);
  return c;
}

export const browserImageDeps: Pick<BuilderDeps, "decode" | "encodeSprite" | "encodeAnchor"> = {
  async decode(dataUrl) {
    const el = new Image();
    el.src = dataUrl;
    await el.decode();
    const c = canvasOf(el.naturalWidth, el.naturalHeight);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(el, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    return { width: d.width, height: d.height, data: d.data };
  },
  async encodeSprite(img, w, h) {
    const src = canvasFromRgba(img);
    let factor = 1;
    for (let round = 0; round < 4; round++) {
      const out = canvasOf(Math.max(1, Math.round(w * factor)), Math.max(1, Math.round(h * factor)));
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(src, 0, 0, out.width, out.height);
      const webp = out.toDataURL("image/webp", 0.88);
      if (webp.startsWith("data:image/webp")) {
        for (const q of [0.88, 0.8, 0.72, 0.64, 0.56]) {
          const u = q === 0.88 ? webp : out.toDataURL("image/webp", q);
          if (bytesOf(u) <= SPRITE_MAX_BYTES) return { dataUrl: u, factor };
        }
      } else {
        const png = out.toDataURL("image/png");
        if (bytesOf(png) <= DOC_MAX_BYTES) return { dataUrl: png, factor };
      }
      factor *= 0.85;
    }
    const last = canvasOf(Math.max(1, Math.round(w * factor)), Math.max(1, Math.round(h * factor)));
    last.getContext("2d")?.drawImage(src, 0, 0, last.width, last.height);
    const u = last.toDataURL("image/webp", 0.5);
    return { dataUrl: u.startsWith("data:image/webp") ? u : last.toDataURL("image/png"), factor };
  },
  async encodeAnchor(img, keyColour) {
    const src = canvasFromRgba(img);
    const k = Math.min(1, 512 / img.height);
    const out = canvasOf(Math.max(1, Math.round(img.width * k)), Math.max(1, Math.round(img.height * k)));
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.fillStyle = keyColour;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.85);
  },
};

const running = new Map<string, Promise<BuildResult>>();

/** The browser builder for one child (Firestore when signed in, else the device copy). */
export function browserBuilderDeps(childId: string): BuilderDeps {
  return {
    requestPose: fetchHeroPose,
    ...browserImageDeps,
    store: heroSheetStoreFor(childId),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => new Date().toISOString(),
  };
}

/**
 * "Use this hero": start the sheet for the hero just accepted. Only a hero
 * drawn from a description gets poses (the server refuses the rest anyway).
 * One build per child at a time; the promise of a running build is shared.
 */
export function startHeroSheet(input: { childId: string; photoUrl: string; source: string }, deps?: BuilderDeps): Promise<BuildResult> | null {
  if (!input.childId || input.source !== "descriptor" || !/^data:image\//.test(input.photoUrl)) return null;
  const avatarHash = heroAvatarHash(input.photoUrl);
  const key = `${input.childId}:${avatarHash}`;
  const live = running.get(key);
  if (live) return live;
  const job = buildHeroSheet({ childId: input.childId, avatarHash }, deps ?? browserBuilderDeps(input.childId))
    .catch((): BuildResult => ({ status: "stopped", stored: [], skipped: [], stoppedBy: "error", calls: 0 }))
    .finally(() => running.delete(key));
  running.set(key, job);
  return job;
}

/** A reload continues a build the parent started: same hero, still building. */
export function resumeHeroSheet(child: { id: string; photoUrl?: string | null; avatar?: { source?: string } | null }, docs: HeroSheetDocs | null | undefined): Promise<BuildResult> | null {
  if (!docs?.meta || docs.meta.status !== "building" || !child.photoUrl) return null;
  if (docs.meta.avatarHash !== heroAvatarHash(child.photoUrl)) return null;
  return startHeroSheet({ childId: child.id, photoUrl: child.photoUrl, source: child.avatar?.source ?? "" });
}

/** True while this device is drawing the sheet of this hero. */
export function heroSheetRunning(childId: string, photoUrl?: string | null): boolean {
  return !!photoUrl && running.has(`${childId}:${heroAvatarHash(photoUrl)}`);
}
