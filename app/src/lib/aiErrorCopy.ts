/* aiErrorCopy — AI-06 / AI-24: ONE classifier from a thrown transport error to
 * the honest thing to say about it.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * Two failures that need OPPOSITE actions were rendering the same sentence:
 *
 *   429  the account has spent its hour of AI (server/aiQuota.ts). It fixes
 *        ITSELF — the only correct advice is "wait, nothing is lost", and the
 *        server even tells us how long via `Retry-After`.
 *   451  the request was refused fail-closed because there is no parental
 *        consent grant for this child's photo/voice (server/requireConsent.ts,
 *        purpose `face_processing`). Waiting NEVER fixes it. The parent has to
 *        grant the permission, and no screen was telling them that.
 *
 * Telling a parent to "try again" on a 451 is not just unhelpful — it is a
 * lie about a consent decision they own. Hence a typed branch, never a
 * message-substring match, and never the server's own English `details`
 * string echoed at a Hebrew-reading parent (ArborVision used to do exactly
 * that).
 *
 * Pure and dependency-light on purpose: it returns i18n KEYS + params, so the
 * render site owns t() and the copy stays translatable. No React, no I/O.
 */
import { ApiError, EscalationRequiredError, PaywallError } from "./api";
import type { ActiveTab } from "./routes";

export type AiFailureKind = "offline" | "quota" | "consent" | "paywall" | "escalation" | "generic";

export interface AiFailureCopy {
  kind: AiFailureKind;
  titleKey: string;
  bodyKey: string;
  /** Interpolation params for `bodyKey` (e.g. {name}, {minutes}). */
  bodyParams: Record<string, string | number>;
  /** Set only when there is a real place to send the parent. */
  actionKey?: string;
  actionRoute?: ActiveTab;
  /**
   * Whether re-sending the SAME request could succeed. False for consent —
   * offering "try again" there would be dishonest, so the render site must
   * suppress its retry button on a false.
   */
  retryable: boolean;
}

export interface AiFailureContext {
  /** The child's first name, for the consent copy. */
  childName?: string;
  /**
   * `navigator.onLine` at the moment of failure. Offline OUTRANKS the status:
   * a fetch that never left the device is not a server refusal, and telling
   * an offline parent their account is rate-limited would be false.
   */
  online?: boolean;
  /** Parsed `Retry-After` seconds, when the caller captured it. */
  retryAfterSeconds?: number;
}

/** Statuses the app already routes elsewhere — kept here so the mapping is
 *  complete and a caller can see WHY a status is not its business. */
const PAYWALL_STATUS = 402;
const ESCALATION_STATUS = 409;
export const QUOTA_STATUS = 429;
export const CONSENT_STATUS = 451;

const statusOf = (err: unknown): number | null => {
  if (err instanceof ApiError) return err.status;
  if (err instanceof PaywallError) return PAYWALL_STATUS;
  if (err instanceof EscalationRequiredError) return ESCALATION_STATUS;
  // A DOM/network TypeError from fetch carries no status at all.
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === "number" && Number.isFinite(s) ? s : null;
};

/**
 * Classify a thrown error into the copy the parent should actually read.
 * Deterministic: same error + same context ⇒ same result.
 */
export function classifyAiFailure(err: unknown, ctx: AiFailureContext = {}): AiFailureCopy {
  const { childName, online, retryAfterSeconds } = ctx;

  // 0) OFFLINE first — the device never reached us, so no status is truthful.
  if (online === false) {
    return {
      kind: "offline",
      titleKey: "elev.aierrors.offline.title",
      bodyKey: "elev.aierrors.offline.body",
      bodyParams: {},
      retryable: false,
    };
  }

  switch (statusOf(err)) {
    case QUOTA_STATUS: {
      const minutes =
        typeof retryAfterSeconds === "number" && retryAfterSeconds > 0
          ? Math.max(1, Math.ceil(retryAfterSeconds / 60))
          : null;
      return {
        kind: "quota",
        titleKey: "elev.aierrors.quota.title",
        bodyKey: minutes === null ? "elev.aierrors.quota.body" : "elev.aierrors.quota.bodyMinutes",
        bodyParams: minutes === null ? {} : { minutes },
        // It really does fix itself — but not this second, so the caller
        // shows the wait, not a button that will fail again.
        retryable: false,
      };
    }
    case CONSENT_STATUS:
      return {
        kind: "consent",
        titleKey: "elev.aierrors.consent.title",
        bodyKey: "elev.aierrors.consent.body",
        bodyParams: { name: childName?.trim() || "" },
        actionKey: "elev.aierrors.consent.cta",
        // Where `face_processing` is granted (profile › avatar/photo consent).
        actionRoute: "profile",
        retryable: false,
      };
    case PAYWALL_STATUS:
      // Owned by the paywall surface (MON-1/MON-2), never an error card.
      return {
        kind: "paywall",
        titleKey: "elev.aierrors.generic.title",
        bodyKey: "elev.aierrors.generic.body",
        bodyParams: {},
        retryable: false,
      };
    case ESCALATION_STATUS:
      // Owned by the escalation screen (DUX-032/VC-8) — resources, not errors.
      return {
        kind: "escalation",
        titleKey: "elev.aierrors.generic.title",
        bodyKey: "elev.aierrors.generic.body",
        bodyParams: {},
        retryable: false,
      };
    default:
      return {
        kind: "generic",
        titleKey: "elev.aierrors.generic.title",
        bodyKey: "elev.aierrors.generic.body",
        bodyParams: {},
        retryable: true,
      };
  }
}

/** Parse a `Retry-After` header value (seconds form) — null when absent/bad. */
export function retryAfterSeconds(header: string | null | undefined): number | undefined {
  if (!header) return undefined;
  const n = Number(header.trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** `navigator.onLine`, safe on a server/test runtime with no navigator. */
export function browserOnline(): boolean {
  const nav = (globalThis as { navigator?: { onLine?: unknown } }).navigator;
  return typeof nav?.onLine === "boolean" ? nav.onLine : true;
}
