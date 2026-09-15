/**
 * localNotifications.ts — N1-06: the local-notification adapter.
 *
 * HONEST SCOPE, STATED FIRST
 * ──────────────────────────
 * **On web this delivers zero notifications, by design and by fact.** The
 * channel is native-only and Arbor has no store presence (DIST-3, Guy-gated),
 * so nothing in this file reaches a production user this wave. What ships live
 * is the SHAPE: a channel that cannot be wired up wrong, and that is already
 * name-free because the only copy it accepts comes from
 * growth/nudgeTemplates.ts by way of growth/nudgeSchedule.ts `planNudge`.
 *
 * WHY THERE IS NO `import("@capacitor/local-notifications")` HERE
 * ──────────────────────────────────────────────────────────────
 * `@capacitor/local-notifications` is not in `app/package.json` and CANNOT be
 * installed from this worktree: `app/node_modules` is a junction to another
 * worktree's modules, so `npm install` here would corrupt a sibling checkout.
 * A literal dynamic import of a package that is absent from `node_modules`
 * fails `npm run lint` (`tsc --noEmit`, TS2307) and fails `vite build`'s import
 * analysis — both of which are wave gates. So the plugin is reached through a
 * LOADER SEAM instead, registered by the native bootstrap once the dependency
 * exists. See FOLLOW-UPS-N1.md (N1-06-F1) for the exact two-line change:
 *
 *     // in lib/native.ts initNativeShell(), alongside the other dynamic imports
 *     const { LocalNotifications } = await import("@capacitor/local-notifications");
 *     configureLocalNotifications({ loader: async () => LocalNotifications });
 *
 * Until that lands, `scheduleLocalNudge` fails closed with a NAMED reason on
 * every path — it never throws, never silently succeeds, and never imports a
 * plugin on the web (asserted by the import spy in
 * growth/nudgeSchedule.test.ts).
 *
 * PRIVACY: this module accepts a `NudgeTemplate` and two RESOLVED strings. It
 * has no access to a child profile, never sees `Nudge.vars`, and has no code
 * path that could interpolate one — the payload it builds is the template's
 * text and nothing else.
 */
import type { NudgeChannel } from "./kpiEvents";

/**
 * The platform probe, reusing the defensive shape `lib/careTrack.ts:319` uses:
 * read the bridge Capacitor injects on `globalThis` rather than importing
 * `@capacitor/core`. Keeps this module import-free (so the guard's import spy
 * means something) and safe to load in a node test environment.
 */
function nativeByBridge(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
}

/** The package this adapter fronts. Referenced as DATA, never imported — see
 *  the header. The follow-up swaps the loader in; this id is the breadcrumb. */
export const LOCAL_NOTIFICATIONS_PLUGIN_ID = "@capacitor/local-notifications";

/** This adapter's channel id in the analytics contract. */
export const LOCAL_NOTIFICATION_CHANNEL: NudgeChannel = "local";

/** Why a schedule attempt did not result in a scheduled notification. */
export type LocalNudgeFailure =
  /** Not a native platform — the web lane has no local-notification channel. */
  | "unsupported"
  /** Native, but no plugin loader is registered (the dependency is not in yet). */
  | "plugin_unavailable"
  /** The OS declined, or the parent has not granted the permission. */
  | "permission_denied"
  /** The plugin was reached and threw. */
  | "error";

export type LocalNudgeResult =
  | { scheduled: true; id: number }
  | { scheduled: false; reason: LocalNudgeFailure };

/** The slice of `@capacitor/local-notifications` this adapter uses. Declared
 *  structurally so the module type-checks with the package absent. */
export interface LocalNotificationsBridge {
  requestPermissions(): Promise<{ display: string }>;
  schedule(options: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule?: { at: Date };
    }>;
  }): Promise<unknown>;
}

interface AdapterConfig {
  /** Registered by the native bootstrap once the dependency exists. */
  loader: (() => Promise<LocalNotificationsBridge>) | null;
  /** Overridable only so the guard can exercise the native branch on jsdom. */
  isNative: () => boolean;
}

const defaults = (): AdapterConfig => ({
  loader: null,
  isNative: nativeByBridge,
});

let config: AdapterConfig = defaults();

/** Register the plugin loader (and, for the guard only, the platform check). */
export function configureLocalNotifications(
  next: Partial<Pick<AdapterConfig, "loader" | "isNative">>,
): void {
  config = { ...config, ...next };
}

/** Test seam — drops any registered loader and restores the real platform check. */
export function resetLocalNotifications(): void {
  config = defaults();
}

/** True when this build could deliver a local notification at all. */
export function localNotificationsAvailable(): boolean {
  return config.isNative() && config.loader !== null;
}

let nextId = 1;

/**
 * Schedule ONE local notification from an already-resolved, name-free payload.
 *
 * The caller resolves `title`/`body` from a `NudgeTemplate`'s keys through
 * `t()`. This function is deliberately unable to accept a `Nudge` or any
 * `vars` object, so the child's name has no route into a lock-screen payload
 * even if a future caller is careless.
 */
export async function scheduleLocalNudge(payload: {
  title: string;
  body: string;
  /** When to fire. Omitted = as soon as the OS allows. */
  at?: Date;
}): Promise<LocalNudgeResult> {
  // Web: answer without touching a plugin. No import, no permission prompt,
  // no throw — the one shape every caller can rely on.
  if (!config.isNative()) return { scheduled: false, reason: "unsupported" };

  const loader = config.loader;
  if (!loader) return { scheduled: false, reason: "plugin_unavailable" };

  try {
    const plugin = await loader();
    const permission = await plugin.requestPermissions();
    if (permission?.display !== "granted") {
      return { scheduled: false, reason: "permission_denied" };
    }
    const id = nextId++;
    await plugin.schedule({
      notifications: [
        {
          id,
          title: payload.title,
          body: payload.body,
          ...(payload.at ? { schedule: { at: payload.at } } : {}),
        },
      ],
    });
    return { scheduled: true, id };
  } catch {
    return { scheduled: false, reason: "error" };
  }
}
