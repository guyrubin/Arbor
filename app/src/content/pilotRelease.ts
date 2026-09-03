import { isPublishableContent, type ContentLocale, type ContentPublicationKind } from "./governance";
import type { HardMomentCard } from "./hardMomentCards";

/** Editorial release evidence is separate from an individual clinical review. */
export interface PilotRelease {
  readonly id: string;
  readonly kind: "editorial-pilot";
  readonly status: "active" | "withdrawn";
  readonly availableFrom: string;
  readonly expiresAt: string;
  readonly entries: Readonly<Record<string, string>>;
  readonly withdrawnIds: readonly string[];
}

export const HARD_MOMENT_PILOT: PilotRelease = Object.freeze({
  id: "arbor-pilot-2026-09-04",
  kind: "editorial-pilot",
  status: "active",
  availableFrom: "2026-09-04T00:00:00.000Z",
  expiresAt: "2026-12-03T00:00:00.000Z",
  // Fixed release digests, never computed from the catalog at runtime.
  entries: Object.freeze({
    "tantrum": "fnv1a64:9beddf630cc61060",
    "refusal": "fnv1a64:d7c463725776fb5d",
    "hitting": "fnv1a64:4b75f2aacc7b9027",
    "sibling-conflict": "fnv1a64:d9ec6615c7afd42f",
    "separation": "fnv1a64:977bffe54d5e8095",
    "bedtime": "fnv1a64:454941db7d618503",
    "leaving-play": "fnv1a64:80717f0c542b070a",
    "morning-rush": "fnv1a64:22f5821d63c619f5",
    "homework": "fnv1a64:abef18b6d3d7603d",
    "screen-ending": "fnv1a64:8501879601ce1095",
    "public-meltdown": "fnv1a64:4f8fdbb4baf2729f",
    "whining": "fnv1a64:f1ba48455ff9fcd2",
    "not-listening": "fnv1a64:cf51b5ea138daa21",
    "fear-new-thing": "fnv1a64:9894637539b310c0",
    "losing-game": "fnv1a64:6ae0873821a8d4d1",
    "sharing": "fnv1a64:55e7598cbe36dabb",
    "teasing": "fnv1a64:cc26966b194dbd7d",
    "clinging": "fnv1a64:e9a0bdf4007c8eef",
    "school-dropoff": "fnv1a64:ad17442c19945554",
    "getting-dressed": "fnv1a64:07088827d63e3acc",
    "toothbrushing": "fnv1a64:cd3b15e857460519",
    "mealtime": "fnv1a64:fd9ed6e4ede21872",
    "bath": "fnv1a64:981d41f6e6beab42",
    "waiting": "fnv1a64:5ec8b9a9e1cec97a",
    "change-of-plan": "fnv1a64:f3a200301e8c3646",
  }),
  withdrawnIds: Object.freeze([] as string[]),
});

export interface HardMomentContext {
  locale: ContentLocale;
  ageMonths: number | null | undefined;
  now?: Date;
  release?: PilotRelease;
}

const COPY_FIELDS = ["title", "doNow", "sayThis", "avoid", "observe", "escalation"] as const;

/**
 * Versioned, unambiguous serialization binds copy AND safety/routing metadata.
 * FNV-1a64 is an editorial change checksum, not a signature or clinical stamp.
 * Authorization lives in the source-controlled manifest, never in a card field.
 */
export function computePilotDigest(card: HardMomentCard): string {
  const canonical = JSON.stringify([
    "hard-moment-pilot-v1", card.id, card.version, card.category,
    card.ageBands, card.domains, card.concerns, card.moment ?? null,
    card.locales, card.safetyClass, card.evidenceRefs,
    card.reviewStatus, card.reviewerRole, card.reviewedBy, card.reviewedAt,
    card.reviewDueAt, card.contentHash ?? null,
    COPY_FIELDS.map((key) => [card[key]?.en, card[key]?.he]),
  ]);
  let digest = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonical)) {
    digest = BigInt.asUintN(64, (digest ^ BigInt(byte)) * 0x100000001b3n);
  }
  return "fnv1a64:" + digest.toString(16).padStart(16, "0");
}

/** Years are inclusive: 2–5 means 24 <= months < 72. Unknown metadata closes. */
export function fitsHardMomentAge(card: HardMomentCard, months?: number | null): boolean {
  if (typeof months !== "number" || !Number.isFinite(months) || months < 0 || !Array.isArray(card.ageBands) || !card.ageBands.length) return false;
  const ranges = card.ageBands.map((band) => {
    const closed = /^(\d+)[–-](\d+)$/.exec(band);
    if (closed && Number(closed[1]) <= Number(closed[2])) return [Number(closed[1]) * 12, (Number(closed[2]) + 1) * 12];
    const open = /^(\d+)\+$/.exec(band);
    return open ? [Number(open[1]) * 12, Infinity] : null;
  });
  return ranges.every(Boolean) && ranges.some((range) => range && months >= range[0] && months < range[1]);
}

/** One call-time policy for lists, detail/actions, Search, Today and coach seeds. */
export function hardMomentPublication(card: HardMomentCard, context: HardMomentContext): ContentPublicationKind | null {
  const { locale, ageMonths, now = new Date(), release = HARD_MOMENT_PILOT } = context;
  if (!Number.isFinite(now.getTime()) || (locale !== "en" && locale !== "he")) return null;
  if (card.reviewStatus === "retired" || !fitsHardMomentAge(card, ageMonths)) return null;
  if (!Array.isArray(card.locales) || !card.locales.includes(locale) || !card.locales.includes("en") || !card.locales.includes("he")) return null;
  const filled = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  if (COPY_FIELDS.some((key) => !filled(card[key]?.en) || !filled(card[key]?.he))) return null;
  // Withdrawal wins even if a caller supplies a formerly reviewed copy.
  if (release.withdrawnIds.includes(card.id)) return null;
  const inPilot = Object.hasOwn(HARD_MOMENT_PILOT.entries, card.id);
  if (inPilot && release.status !== "active") return null;
  if (isPublishableContent(card, now)) return "clinical-review";
  if (card.reviewStatus !== "draft" || card.reviewedBy || card.reviewedAt || card.contentHash) return null;
  if (release.id !== HARD_MOMENT_PILOT.id || release.kind !== "editorial-pilot" || release.status !== "active") return null;
  const starts = new Date(release.availableFrom).getTime();
  const expires = new Date(release.expiresAt).getTime();
  if (release.expiresAt !== HARD_MOMENT_PILOT.expiresAt || !Number.isFinite(expires) || expires <= starts || now.getTime() >= expires) return null;
  if (release.availableFrom !== HARD_MOMENT_PILOT.availableFrom || !Number.isFinite(starts) || now.getTime() < starts) return null;
  if (!inPilot || !Object.hasOwn(release.entries, card.id)) return null;
  const digest = HARD_MOMENT_PILOT.entries[card.id];
  if (release.entries[card.id] !== digest) return null;
  return digest === computePilotDigest(card) ? "editorial-pilot" : null;
}
