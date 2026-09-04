/**
 * Learn Library editorial-pilot release (LL-B4).
 *
 * The batch-4 cards were authored and then held dark behind a blanket guard
 * pending clinical review. That guard proved nothing about the cards: it only
 * asserted they were unreachable. This module replaces it with a release
 * contract that actually constrains what reaches a parent.
 *
 * An editorial pilot is NOT a clinical review. Nothing here stamps a card as
 * clinician-approved, and no reviewer is named in shipped code. The pilot only
 * records that a fixed, checksummed set of copy was released for a bounded
 * window and can be withdrawn.
 */
import type { LocalizedText } from "../content/governance";
import type { LearnCard } from "./learnLibrary";

export interface LearnPilotRelease {
  readonly id: string;
  readonly kind: "editorial-pilot";
  readonly status: "active" | "withdrawn";
  readonly availableFrom: string;
  readonly expiresAt: string;
  /** Card id → frozen release digest. Membership AND integrity in one map. */
  readonly entries: Readonly<Record<string, string>>;
  readonly withdrawnIds: readonly string[];
}

export const LEARN_PILOT: LearnPilotRelease = Object.freeze({
  id: "arbor-learn-pilot-2026-09-04",
  kind: "editorial-pilot",
  status: "active",
  // Local midnight of the release date (Europe/Brussels), i.e. the instant the
  // release was cut — NOT a future activation. The registry is assembled when
  // the module loads, so a not-yet-open window would make the catalogue depend
  // on the wall clock at import. Expiry stays a real lever: if the pilot is not
  // renewed, these cards go dark on the next load.
  availableFrom: "2026-09-04T00:00:00.000+02:00",
  expiresAt: "2026-12-03T00:00:00.000+02:00",
  entries: Object.freeze({
    // batch 4a — minds · language · feelings · behavior
    "cognitive-flexibility": "fnv1a64:05af7a650390d9c0",
    "early-number-sense": "fnv1a64:538a31769970e39b",
    "metacognition-learning": "fnv1a64:c30daf9ad87715cc",
    "storytelling-development": "fnv1a64:9cb3cec0e4916571",
    "childhood-disfluency": "fnv1a64:9931499455c32f14",
    "frustration-tolerance": "fnv1a64:b71ff7aee27def6e",
    "childhood-jealousy": "fnv1a64:fb8ea3a8d8878691",
    "handling-disappointment": "fnv1a64:66533fdad5d967b2",
    "logical-consequences": "fnv1a64:541a4ca29e2a1383",
    // batch 4b — behavior · sleep · play · screens
    "boundary-testing": "fnv1a64:38813a4bb4eecbb3",
    "chores-by-development": "fnv1a64:dc88f1aedc9b68cd",
    "sleep-environment": "fnv1a64:ffbdbf255d802259",
    "travel-sleep": "fnv1a64:73a1d18e45f22a9d",
    "rough-and-tumble-play": "fnv1a64:0646cfe0d9d5d998",
    "board-games-learning": "fnv1a64:c72d8f325747512a",
    "nature-play": "fnv1a64:c30b759d08081654",
    "creative-screen-use": "fnv1a64:44540e2fe3869764",
    "child-digital-privacy": "fnv1a64:508bb176dc111743",
  }),
  withdrawnIds: Object.freeze([] as string[]),
});

const localized = (value: LocalizedText | undefined) => [value?.en ?? null, value?.he ?? null];

/**
 * Versioned canonical serialization binding EVERY localized string a parent can
 * read together with the applicability metadata that decides who is shown the
 * card. Editing a body paragraph, a key point, or the age window changes the
 * digest and drops the card from the pilot until the manifest is re-cut.
 *
 * FNV-1a64 is an editorial change checksum — not a signature, not a clinical
 * stamp, and not a security control.
 */
export function computeLearnDigest(card: LearnCard): string {
  const canonical = JSON.stringify([
    "learn-pilot-v1", card.id, card.category, card.domains,
    card.ageMin, card.ageMax, card.minutes, card.concerns ?? null,
    localized(card.title), localized(card.hook),
    card.keyPoints.map(localized), localized(card.body),
    localized(card.tryToday), localized(card.ask),
  ]);
  let digest = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonical)) {
    digest = BigInt.asUintN(64, (digest ^ BigInt(byte)) * 0x100000001b3n);
  }
  return "fnv1a64:" + digest.toString(16).padStart(16, "0");
}

const filled = (value: LocalizedText | undefined): boolean =>
  typeof value?.en === "string" && value.en.trim().length > 0 &&
  typeof value?.he === "string" && value.he.trim().length > 0;

/**
 * Fail-closed publication decision for ONE batch-4 card. Every consumer of the
 * Learn registry gets the same answer because the registry itself is assembled
 * through this function — there is no second code path that could disagree.
 */
export function isLearnPilotPublishable(
  card: LearnCard,
  now: Date = new Date(),
  release: LearnPilotRelease = LEARN_PILOT,
): boolean {
  if (!Number.isFinite(now.getTime())) return false;
  // Withdrawal outranks everything, including a caller-supplied release.
  if (release.withdrawnIds.includes(card.id) || LEARN_PILOT.withdrawnIds.includes(card.id)) return false;
  if (release.id !== LEARN_PILOT.id || release.kind !== "editorial-pilot" || release.status !== "active") return false;

  const starts = Date.parse(release.availableFrom);
  const expires = Date.parse(release.expiresAt);
  if (release.availableFrom !== LEARN_PILOT.availableFrom || release.expiresAt !== LEARN_PILOT.expiresAt) return false;
  if (!Number.isFinite(starts) || !Number.isFinite(expires) || expires <= starts) return false;
  if (now.getTime() < starts || now.getTime() >= expires) return false;

  // Membership is the manifest's, never the caller's.
  if (!Object.hasOwn(LEARN_PILOT.entries, card.id) || !Object.hasOwn(release.entries, card.id)) return false;
  const pinned = LEARN_PILOT.entries[card.id];
  if (release.entries[card.id] !== pinned) return false;

  // Bilingual completeness — a half-translated card never reaches a parent.
  if (!filled(card.title) || !filled(card.hook) || !filled(card.body)) return false;
  if (!filled(card.tryToday) || !filled(card.ask)) return false;
  if (card.keyPoints.length !== 5 || !card.keyPoints.every(filled)) return false;

  // Applicability sanity — a malformed window must not silently match everyone.
  if (!Number.isInteger(card.ageMin) || !Number.isInteger(card.ageMax)) return false;
  if (card.ageMin < 0 || card.ageMax > 18 || card.ageMin > card.ageMax) return false;

  return pinned === computeLearnDigest(card);
}

/** The batch-4 cards currently cleared for release, in authored order. */
export function publishedLearnPilotCards(
  cards: LearnCard[],
  now: Date = new Date(),
  release: LearnPilotRelease = LEARN_PILOT,
): LearnCard[] {
  return cards.filter((card) => isLearnPilotPublishable(card, now, release));
}

/** True when this id ships under the pilot, so the UI can label it honestly. */
export const isLearnPilotCard = (id: string): boolean => Object.hasOwn(LEARN_PILOT.entries, id);

const pilotText = {
  en: {
    status: "Pilot read",
    note: "This read has not had individual clinical review. It is general parenting information, not advice about your child.",
  },
  he: {
    status: "קריאה בפיילוט",
    note: "הקריאה הזו לא עברה בדיקה קלינית פרטנית. זהו מידע הורי כללי, לא ייעוץ על הילד או הילדה שלכם.",
  },
} as const;

export function learnPilotText(locale: "en" | "he") {
  return pilotText[locale];
}
