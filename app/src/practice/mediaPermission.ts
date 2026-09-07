/**
 * KID-23 — is this device's microphone / camera actually available to us?
 *
 * The defect: the record button and the mirror invite rendered unconditionally.
 * A child tapped them, `getUserMedia` was called, and the browser either threw
 * instantly (permission already `denied` — no prompt is shown for a denied
 * origin) or the API did not exist at all. The child got a dead control and,
 * on the Sound Lab, an error line. A control the child cannot use should not
 * be in front of the child; the kid register gets a line instead, and the
 * PARENT (who is the only one who can change a permission) sees the reason on
 * the parent door.
 *
 * Three states, and only three, because only three change what we render:
 *   "unsupported"  — no mediaDevices/getUserMedia on this device or context
 *                    (an insecure origin drops it too). Nothing to ask for.
 *   "denied"       — the Permissions API says this origin is blocked. Asking
 *                    again shows no prompt; the tap does nothing.
 *   "available"    — usable, or unknown (Permissions API missing / the query
 *                    is unsupported for this name). Unknown must read as
 *                    available: hiding a working control is the worse failure.
 *
 * Pure + injectable so the node harness can drive every branch without a DOM.
 */

export type MediaPermission = "available" | "denied" | "unsupported";

export type MediaKind = "microphone" | "camera";

/** The slice of `navigator` this module reads. Injectable for tests. */
export interface MediaNavigatorLike {
  mediaDevices?: { getUserMedia?: unknown };
  permissions?: { query?: (d: { name: string }) => Promise<{ state: string }> };
}

/** Synchronous half: is the capability present at all? */
export function mediaSupported(nav: MediaNavigatorLike | undefined | null): boolean {
  return typeof nav?.mediaDevices?.getUserMedia === "function";
}

/**
 * Resolve the permission for `kind`. Never throws and never rejects: a browser
 * that does not know the permission name (Firefox has no "camera" descriptor)
 * throws from `query`, which means "unknown", which means available.
 */
export async function resolveMediaPermission(
  kind: MediaKind,
  nav: MediaNavigatorLike | undefined | null,
): Promise<MediaPermission> {
  if (!mediaSupported(nav)) return "unsupported";
  const query = nav?.permissions?.query;
  if (typeof query !== "function") return "available";
  try {
    const status = await query.call(nav!.permissions, { name: kind });
    return status?.state === "denied" ? "denied" : "available";
  } catch {
    return "available";
  }
}

/** True when the control must NOT be rendered to the child. */
export function mediaControlHidden(state: MediaPermission): boolean {
  return state !== "available";
}
