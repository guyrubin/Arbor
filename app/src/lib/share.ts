/**
 * Share orchestrator (mk-p0-3) — the 1-tap branded-share engine behind every
 * loop artifact. Pipeline: render the on-device card (lib/shareCard.ts) → build
 * the caption with the referral/UTM deep link baked in → try the native share
 * sheet (@capacitor/share) → web `navigator.share({ files })` → download
 * fallback. Fires the canonical loop events (lib/loopEvents.ts) and returns the
 * resolved transport channel. User-cancel of the OS sheet is honored silently
 * (no ShareCompleted), per the no-dark-patterns rule.
 *
 * MOB-06 / LC-10: the native → web-share → download ladder is exported as
 * `deliverFile` so EVERY egress (report HTML, care packets) rides the one
 * pipeline that actually works inside the Capacitor webviews, instead of
 * `window.open` + `window.print` (dead in WKWebView).
 *
 * The caption/URL builders are pure and unit-tested in share.test.ts.
 */
import { renderShareCard, type ShareCardOpts } from "./shareCard";
import { trackShareInitiated, trackShareCompleted, type LoopArtifact } from "./loopEvents";
import type { Market } from "./attribution";
import { PUBLIC_ORIGIN } from "./publicOrigin";

/**
 * Canonical share/landing origin = the ONE public origin (lib/publicOrigin.ts,
 * MOB-17). Kept as a named export because the URL builders and their tests
 * address it by this name.
 */
export const SHARE_URL = PUBLIC_ORIGIN;

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

/** Native share via @capacitor/share (writes the file to cache, then opens the sheet). */
async function shareNative(blob: Blob, filename: string, text: string | undefined): Promise<void> {
  const [{ Share }, { Filesystem, Directory }] = await Promise.all([
    import("@capacitor/share"),
    import("@capacitor/filesystem"),
  ]);
  const base64 = await blobToBase64(blob);
  const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
  await Share.share({ ...(text ? { text } : {}), files: [written.uri] });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || "");
      resolve(res.includes(",") ? res.split(",")[1] : res);
    };
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(blob);
  });
}

/** Web share with a file, when the browser supports sharing files. */
async function shareWebFile(blob: Blob, filename: string, mime: string, text: string | undefined): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  if (typeof nav.share !== "function") return false;
  const file = new File([blob], filename, { type: mime });
  const data: ShareData & { files?: File[] } = { ...(text ? { text } : {}), files: [file] };
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

export type ShareResult =
  | { ok: true; channel: ShareChannel }
  | { ok: false; cancelled: true }
  | { ok: false; error: true };

/** The transport seams `deliverFile` rides — injectable so the ladder is unit-tested without a device. */
export type DeliverDeps = {
  isNative: () => boolean;
  native: (blob: Blob, filename: string, text: string | undefined) => Promise<void>;
  webShare: (blob: Blob, filename: string, mime: string, text: string | undefined) => Promise<boolean>;
  download: (blob: Blob, filename: string) => void;
};

const DEFAULT_DELIVER_DEPS: DeliverDeps = {
  isNative: isNativeShareAvailable,
  native: shareNative,
  webShare: shareWebFile,
  download: downloadBlob,
};

/**
 * Hand a file to the parent: native share sheet → web share → download.
 * Never throws; a user cancel is reported as `{ ok: false, cancelled: true }`.
 * This is THE egress seam for every artifact that leaves the app.
 */
export async function deliverFile(
  blob: Blob,
  filename: string,
  opts: { mime: string; text?: string } ,
  deps: DeliverDeps = DEFAULT_DELIVER_DEPS,
): Promise<ShareResult> {
  // 1) Native share sheet.
  if (deps.isNative()) {
    try {
      await deps.native(blob, filename, opts.text);
      return { ok: true, channel: "native" };
    } catch (err) {
      if (isAbort(err)) return { ok: false, cancelled: true };
      // fall through to web/download
    }
  }

  // 2) Web share with file.
  try {
    if (await deps.webShare(blob, filename, opts.mime, opts.text)) return { ok: true, channel: "web_share" };
  } catch (err) {
    if (isAbort(err)) return { ok: false, cancelled: true };
    // fall through to download
  }

  // 3) Download fallback.
  try {
    deps.download(blob, filename);
    return { ok: true, channel: "download" };
  } catch {
    return { ok: false, error: true };
  }
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

  const result = await deliverFile(blob, filename, { mime: "image/png", text: caption });
  if (result.ok) trackShareCompleted(args.artifact, result.channel);
  return result;
}
