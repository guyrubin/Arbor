/**
 * Share orchestrator (mk-p0-3) — the 1-tap branded-share engine behind every
 * loop artifact. Pipeline: render the on-device card (lib/shareCard.ts) → build
 * the caption with the referral/UTM deep link baked in → try the native share
 * sheet (@capacitor/share) → web `navigator.share({ files })` → download
 * fallback. Fires the canonical loop events (lib/loopEvents.ts) and returns the
 * resolved transport channel. User-cancel of the OS sheet is honored silently
 * (no ShareCompleted), per the no-dark-patterns rule.
 *
 * The caption/URL builders are pure and unit-tested in share.test.ts.
 */
import { renderShareCard, type ShareCardOpts } from "./shareCard";
import { trackShareInitiated, trackShareCompleted, type LoopArtifact } from "./loopEvents";
import type { Market } from "./attribution";

/**
 * Canonical share/landing origin. Soft dep on mk-p0-1-domain: until the final
 * domain lands, point at the prod hosting origin. Centralized here so mk-p0-1
 * swaps it in one place. Mirrors lib/runtime.ts PROD_API_ORIGIN (kept local to
 * avoid importing the Capacitor runtime into the pure URL builder).
 */
export const SHARE_URL = "https://arborprd-westeu.web.app";

export type ShareChannel = "native" | "web_share" | "download";

/** Pure: build the tappable deep link with first-touch attribution baked in. */
export function buildShareUrl(args: {
  artifact: LoopArtifact;
  refCode?: string;
  market?: Market;
  base?: string;
}): string {
  const base = (args.base || SHARE_URL).replace(/\/+$/, "");
  const path = args.market && args.market !== "intl" ? `/${args.market}` : "/";
  const url = new URL(base + path);
  if (args.refCode) url.searchParams.set("ref", args.refCode);
  url.searchParams.set("utm_source", "share");
  url.searchParams.set("utm_medium", args.artifact);
  url.searchParams.set("utm_campaign", "organic_share");
  return url.toString();
}

/** Pure: build the localized share caption with the deep link appended. */
export function buildShareCaption(args: {
  template: string; // localized "…{name}…{url}" string
  name: string;
  url: string;
}): string {
  return args.template
    .replace(/\{name\}/g, args.name || "")
    .replace(/\{url\}/g, args.url)
    .trim();
}

/** True if a native @capacitor/share sheet is available (Capacitor native runtime). */
function isNativeShareAvailable(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** Native share via @capacitor/share (writes the PNG to cache, then opens the sheet). */
async function shareNative(blob: Blob, filename: string, caption: string): Promise<boolean> {
  const [{ Share }, { Filesystem, Directory }] = await Promise.all([
    import("@capacitor/share"),
    import("@capacitor/filesystem"),
  ]);
  const base64 = await blobToBase64(blob);
  const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  await Share.share({ text: caption, files: [written.uri] });
  return true;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || "");
      resolve(res.includes(",") ? res.split(",")[1] : res);
    };
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(blob);
  });
}

/** Web share with a file, when the browser supports sharing files. */
async function shareWebFile(blob: Blob, filename: string, caption: string): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  if (typeof nav.share !== "function") return false;
  const file = new File([blob], filename, { type: "image/png" });
  const data: ShareData & { files?: File[] } = { text: caption, files: [file] };
  if (typeof nav.canShare === "function" && !nav.canShare(data)) return false;
  await nav.share(data);
  return true;
}

/** Download fallback (always works in a browser). */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** True if the rejection is an OS/user cancel of the share sheet. */
function isAbort(err: unknown): boolean {
  const name = (err as { name?: string })?.name;
  const msg = String((err as { message?: string })?.message || "");
  return name === "AbortError" || /abort|cancel/i.test(msg);
}

export type ShareArgs = {
  artifact: LoopArtifact;
  surface: string;
  opts: ShareCardOpts;
  /** Localized caption template, e.g. t("share.caption.avatar"). */
  captionTemplate: string;
  refCode?: string;
  market?: Market;
};

export type ShareResult =
  | { ok: true; channel: ShareChannel }
  | { ok: false; cancelled: true }
  | { ok: false; error: true };

/**
 * Render → caption → native/web-share/download, with loop instrumentation.
 * Returns the resolved channel (or cancelled/error). Throws nothing.
 */
export async function shareCard(args: ShareArgs): Promise<ShareResult> {
  trackShareInitiated(args.artifact, args.surface);

  let blob: Blob;
  try {
    const rendered = await renderShareCard(args.artifact, args.opts);
    blob = rendered.blob;
  } catch {
    return { ok: false, error: true }; // render failure — no completed event
  }

  const url = buildShareUrl({ artifact: args.artifact, refCode: args.refCode, market: args.market });
  const caption = buildShareCaption({ template: args.captionTemplate, name: args.opts.name || "", url });
  const filename = `${args.artifact}-arbor.png`;

  // 1) Native share sheet.
  if (isNativeShareAvailable()) {
    try {
      await shareNative(blob, filename, caption);
      trackShareCompleted(args.artifact, "native");
      return { ok: true, channel: "native" };
    } catch (err) {
      if (isAbort(err)) return { ok: false, cancelled: true };
      // fall through to web/download
    }
  }

  // 2) Web share with file.
  try {
    if (await shareWebFile(blob, filename, caption)) {
      trackShareCompleted(args.artifact, "web_share");
      return { ok: true, channel: "web_share" };
    }
  } catch (err) {
    if (isAbort(err)) return { ok: false, cancelled: true };
    // fall through to download
  }

  // 3) Download fallback.
  try {
    downloadBlob(blob, filename);
    trackShareCompleted(args.artifact, "download");
    return { ok: true, channel: "download" };
  } catch {
    return { ok: false, error: true };
  }
}
