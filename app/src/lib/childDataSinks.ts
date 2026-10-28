/**
 * B-GA-09 / B-BOOK-20 — every place Arbor keeps data about ONE child, beyond
 * the per-child Firestore subcollections, and how export and erase reach it.
 *
 * The subcollections stay where the rule puts them: CHILD_SUBCOLLECTIONS in
 * lib/childData.ts alone drives the export and the erase of
 * users/{uid}/children/{childId}/*. This module names everything else: the
 * profile document, the server ledger and grants, the Storage prefixes, and
 * the stores on the parent's own device. With it,
 *  - the erase receipt lists every sink (DeletionReceipt.sinks),
 *  - the DPIA register (docs/compliance/child-data-register.md) has one line
 *    per sink, and
 *  - childDataSinks.guard.test.ts fails the build when a Firestore collection,
 *    a Storage path, an IndexedDB database, a Cache Storage cache or a device
 *    key appears that nothing here accounts for.
 *
 * A new file because nothing existing fits: childData.ts imports the Firebase
 * client SDK (the server routes and the guard cannot import it cleanly), and
 * childDataGroups.ts is the Science page's display grouping, not storage.
 * Pure: no Firebase, no React.
 */

/** `cloud-storage`, hyphenated on purpose: the bare quoted word is a Material
 *  Symbols ligature to the icon-font subsetter (scripts/build-icon-font.mjs). */
export type ChildSinkKind = "profile" | "server" | "cloud-storage" | "device";

export interface ChildDataSink {
  /** Stable id: the erase receipt's key and the DPIA register's row. */
  id: string;
  kind: ChildSinkKind;
  /** Where it lives: a path template, an IndexedDB database or a key shape. */
  where: string;
  /** How the Art. 15/20 export carries it. */
  exportedAs: string;
  /** What removes it when the parent erases the child (Art. 17). */
  erasedBy: string;
}

/** Receipt key of one registered subcollection: `firestore:<name>`. */
export const subcollectionSinkId = (name: string): string => `firestore:${name}`;

/** The registered sinks outside users/{uid}/children/{childId}/<subcollection>. */
export const OTHER_CHILD_SINKS = [
  {
    id: "profile",
    kind: "profile",
    where: "users/{uid}/children/{childId} (sandbox: localStorage arbor.children)",
    exportedAs: "profile",
    erasedBy: "wipeClientChildData deletes the document; sandbox: ProfileContext.deleteChild drops the row",
  },
  {
    id: "server:memoryEvents",
    kind: "server",
    where: "children/{childId} and children/{childId}/memoryEvents/*",
    exportedAs: "serverData.memoryEvents",
    erasedBy: "/privacy/erase memoryStore.eraseChild (counts.memoryEvents)",
  },
  {
    id: "server:familyChildRef",
    kind: "server",
    where: "families/{familyId}/childRefs/{childId} (the child and family ids only)",
    exportedAs: "not exported: it holds only the ids the profile already carries",
    erasedBy: "/privacy/erase memoryStore.eraseChild",
  },
  {
    id: "server:shares",
    kind: "server",
    where: "shares/* where ownerUid and childId match",
    exportedAs: "serverData.shares",
    erasedBy: "/privacy/erase shareStore.eraseByChild (counts.shares)",
  },
  {
    id: "server:consents",
    kind: "server",
    where: "consents/* where childId matches",
    exportedAs: "serverData.consents",
    erasedBy: "/privacy/erase consentStore.eraseByChild (counts.consents)",
  },
  {
    id: "server:consultRequests",
    kind: "server",
    where: "consultRequests/* where childId matches (filed by the parent or a co-parent)",
    exportedAs: "serverData.consultRequests (the exporting parent's own)",
    erasedBy: "/privacy/erase consultStore.eraseByChild, every request naming the child (counts.consultRequests)",
  },
  {
    id: "storage:photos",
    kind: "cloud-storage",
    where: "users/{uid}/children/{childId}/ (profile and keepsake photos)",
    exportedAs: "by reference: the download URL in profile.photoUrl and keepsakes[].photoUrl",
    erasedBy: "/privacy/erase deletes the prefix (storage.photos, in counts.storageFiles)",
  },
  {
    id: "storage:books",
    kind: "cloud-storage",
    where: "children/{childId}/books/ (hero sheet, prints, narration in the child's name; sandbox: app/.data/book-assets/, git-ignored)",
    exportedAs: "privateBookAssets (bytes and a per-file receipt)",
    erasedBy: "/privacy/erase eraseChildBookAssets (storage.books, in counts.storageFiles)",
  },
  {
    id: "device:webStorage",
    kind: "device",
    where: "localStorage and sessionStorage keys arbor.<ns>.<childId>[.<variant>]",
    exportedAs: "sandbox: the registered collections; the rest is this device's display state (seen markers, drafts)",
    erasedBy: "clearChildLocalState (counts.clientDocs)",
  },
  {
    id: "device:comicPages",
    kind: "device",
    where: "IndexedDB arbor-comic-pages",
    exportedAs: "not exported: a device copy of generated pages; savedComics holds the shelf",
    erasedBy: "purgeComicPages(childId)",
  },
  {
    id: "device:heroRenders",
    kind: "device",
    where: "IndexedDB arbor-hero-renders",
    exportedAs: "heroRenders (the account copy of the same text)",
    erasedBy: "purgeHeroRenders(childId)",
  },
  {
    id: "device:bookAssets",
    kind: "device",
    where: "IndexedDB arbor-book-assets",
    exportedAs: "privateBookAssets (the Storage originals)",
    erasedBy: "purgeBookAssets(childId)",
  },
  {
    id: "device:firestoreCache",
    kind: "device",
    where: "IndexedDB firestore/[DEFAULT]/{project}/main (the Firestore SDK's offline cache)",
    exportedAs: "the registered documents themselves",
    erasedBy: "each deleteDoc in wipeClientChildData removes the cached copy",
  },
] as const satisfies readonly ChildDataSink[];

export type OtherChildSinkId = (typeof OTHER_CHILD_SINKS)[number]["id"];

/** What the erase receipt says about one sink: how many records or files it
 *  removed, `cleared` when the store gives no count, `not-reached` when the
 *  erase of that sink failed or could not run (the receipt never claims it). */
export type SinkErasure = number | "cleared" | "not-reached";

/** Every receipt key, in register order: the subcollections, then the rest. */
export function childSinkIds(subcollections: readonly string[]): string[] {
  return [...subcollections.map(subcollectionSinkId), ...OTHER_CHILD_SINKS.map((s) => s.id)];
}

/** What the receipt shows as "Saved records erased": the subcollection
 *  documents and the profile (the server-held categories, consult requests
 *  included, have rows of their own). */
export function erasedRecordCount(sinks: Readonly<Record<string, SinkErasure>> | undefined): number {
  if (!sinks) return 0;
  let n = 0;
  for (const [id, v] of Object.entries(sinks)) {
    if ((id === "profile" || id.startsWith("firestore:")) && typeof v === "number") n += v;
  }
  return n;
}

/* ── What the guard checks the source against ───────────────────────────── */

/** Every Firestore collection name used outside CHILD_SUBCOLLECTIONS: the
 *  sink that accounts for it, or why it holds no per-child data. */
export const OTHER_FIRESTORE_COLLECTIONS: Readonly<Record<string, OtherChildSinkId | `account: ${string}` | `aggregate: ${string}`>> = {
  children: "server:memoryEvents",
  memoryEvents: "server:memoryEvents",
  childRefs: "server:familyChildRef",
  shares: "server:shares",
  consents: "server:consents",
  consultRequests: "server:consultRequests",
  users: "account: the parent's own tree; children/* below it is the profile and the subcollections",
  families: "account: family membership; recursively deleted with the last member",
  members: "account: family membership",
  entitlements: "account: billing state per uid",
  aiQuota: "account: usage counters per uid",
  events: "account: first-party analytics events per uid (no child content)",
  referralCodes: "account: referral code per uid",
  referralGrants: "account: referral ledger per uid",
  waitlist: "account: email waitlist",
  pushTokens: "account: device push tokens per uid",
  pushTokenIndex: "account: push token index",
  retentionRollups: "account: per-family counts for the cohort report",
  digestOptIn: "account: weekly digest mailing consent",
  erasedChildren: "account: the family's erase record, keyed by the erased child's id (ids and dates only, no child data) so a retried erase and account deletion can finish it; removed by account deletion and a 30-day TTL (firestore.indexes.json)",
  usageRollup: "aggregate: daily token spend, no uid or child",
};

/** The registered Storage prefixes (path templates). */
export const STORAGE_PREFIXES: Readonly<Record<"storage:photos" | "storage:books", string>> = {
  "storage:photos": "users/{uid}/children/{childId}/",
  "storage:books": "children/{childId}/books/",
};

/** Every module that reads or writes Firebase Storage, with what it touches.
 *  `account` = the whole users/{uid}/ prefix on account deletion. */
export const STORAGE_MODULES: Readonly<Record<string, readonly ("storage:photos" | "storage:books" | "account" | "init")[]>> = {
  "lib/firebase.ts": ["init"],
  "lib/storage.ts": ["storage:photos"],
  "server/accountDeletion.ts": ["account"],
  "server/childErase.ts": ["storage:photos", "storage:books"],
  "server/bookAssets.ts": ["storage:books"],
  "server/bookAssetExport.ts": ["storage:books"],
  "server/bookSheet.ts": ["storage:books"],
  "server/bookNarration.ts": ["storage:books"],
};

/** Every IndexedDB database the app opens (by name) and the sink for it. The
 *  Firestore SDK's own cache is device:firestoreCache. */
export const INDEXED_DB_DATABASES: Readonly<Record<string, OtherChildSinkId>> = {
  "arbor-comic-pages": "device:comicPages",
  "arbor-hero-renders": "device:heroRenders",
  "arbor-book-assets": "device:bookAssets",
};

/** Cache Storage caches (public/sw.js), by name prefix. None holds child data:
 *  the worker never caches /api, and the private book files are served
 *  `Cache-Control: private, no-store` (server/bookAssets.ts). */
export const CACHE_STORAGE_CACHES: Readonly<Record<string, string>> = {
  "arbor-shell-": "public shell only: /index.html, the icon font and same-origin public GETs",
  "arbor-kid-art-": "public art only: /visuals/*.webp (isKidArt)",
};

/**
 * Device keys (localStorage / sessionStorage) that do NOT carry a child id as
 * a dot segment, with what each holds. Account deletion removes every `arbor*`
 * key. A key that holds data about one child must carry the child id as a dot
 * segment instead (lib/childLocalState.childScopedKey), so the child's erase
 * sweeps it; that rule is guarded by childLocalStateSweep.guard.test.ts.
 * The one key that names a child is `arbor.pendingErase`, and only a child
 * whose erase has already run: the id the retry must erase again and the
 * receipt so far, never the child's name or content. It cannot be
 * child-scoped (the erase it finishes would sweep it), so it is scoped to the
 * account instead: only that uid reads it back, across its own sign-outs.
 */
export const ACCOUNT_DEVICE_KEYS: Readonly<Record<string, string>> = {
  "arbor.": "the namespace root the sweep matches on",
  "arbor.actionLoop.carryOverSkipped": "a dismissed carry-over id",
  "arbor.activation.reported": "an analytics stamp",
  "arbor.activeChildId": "which child is selected (an id; reset when that child is deleted)",
  "arbor.activeTab": "UI state",
  "arbor.aiLang": "language preference",
  "arbor.analytics.optOut": "analytics preference",
  "arbor.attribution": "first-touch campaign source",
  "arbor.bell.read": "notification read marker",
  "arbor.billingReturn": "checkout return marker",
  "arbor.children": "sandbox profile list: the profile sink; ProfileContext.deleteChild drops the child's row",
  "arbor.coachSeed": "legacy onboarding marker (read once, then removed)",
  "arbor.coachVote.": "prefix: a parent's thumbs on one answer id",
  "arbor.consultExportAudience": "the parent's last export audience choice",
  "arbor.demoFamily.seeded": "sandbox demo marker",
  "arbor.elev.celebrate.shown": "UI marker",
  "arbor.familyCharter": "family-level values, deliberately not per child (lib/familyCharter.ts)",
  "arbor.familyRituals.practised": "family ritual ids and times, not per child",
  "arbor.firstPlanTracked": "an analytics stamp",
  "arbor.firstSteps": "legacy onboarding marker (read once, then removed)",
  "arbor.flags.guidedTier": "feature flag",
  "arbor.flags.homeProgramLink": "feature flag",
  "arbor.flags.sneakFreeze": "feature flag",
  "arbor.gate.mathExit": "parent gate state",
  "arbor.gate.pinNudgeShown": "parent gate marker",
  "arbor.installed": "an analytics stamp",
  "arbor.jitai.prefs": "nudge preferences",
  "arbor.journey": "onboarding progress per device",
  "arbor.kidmode.active": "kid mode open flag and view id",
  "arbor.kidmode.heroStepOffered": "session marker",
  "arbor.kidmode.session": "session start time and an activity count (no content)",
  "arbor.lastBilledPlan": "billing transition marker",
  "arbor.learnFeedback": "feedback on library cards",
  "arbor.lens": "tone preference",
  "arbor.masterclasses.done": "course progress (the parent's)",
  "arbor.masterclasses.reflection": "the parent's own course reflections",
  "arbor.nudge.shown.": "prefix: a nudge shown on a day",
  "arbor.ownershipProvisioned.": "prefix: session marker per account",
  "arbor.parentPin": "the parent gate PIN",
  "arbor.pendingErase": "an erase still to finish (lib/pendingErase.ts), per account: the uid that started it, the erased child's id and the receipt so far (counts and per-place ledger); read back only by that uid, kept across its sign-out, cleared when a retry completes",
  "arbor.plan.previewDismissed": "UI marker",
  "arbor.purchaseIntent.v1": "the plan a parent chose before checkout",
  "arbor.recap.emailOptIn": "mailing preference",
  "arbor.referralActivated": "referral marker",
  "arbor.retentionRollup": "session counter for the cohort report",
  "arbor.sessionClose": "session marker",
  "arbor.sessionOpen": "session marker",
  "arbor.sneakFreeze.art": "which public art set to use",
  "arbor.sneakFreeze.demoSeen": "UI marker",
  "arbor.storyOpen": "a catalogue story id to open once (lib/storyOpenRequest.ts)",
  "arbor.tonightMode": "a one-shot UI request",
  "arbor.trialNotice.dismissed": "UI marker",
  "arbor.uiLang": "language preference",
  "arbor.voiceDoor.dataUseSeen": "UI marker",
  "arbor.wowPending": "legacy onboarding marker (read once, then removed)",
  "arbor.agefilter.showAll.${surface}": "per-surface filter preference",
  "arbor.syncBanner.dismissed.${kind}": "per-banner dismissal",
};

/** Key prefixes that are about one child: every key built on them appends the
 *  child id as a dot segment (`<prefix>.<childId>[.<variant>]`), so the
 *  child's erase sweeps them. */
export const CHILD_DEVICE_KEY_PREFIXES: readonly string[] = [
  "arbor.screen.draft", // lib/screeningDraft.ts: `${PREFIX}.${childId}.${bandId}` (sessionStorage)
  "arbor.screen.watch", // lib/screeningWatch.ts: `${PREFIX}.${childId}`
  "arbor.${name}.${id}", // lib/demoFamilyHydrate.ts: a registered collection of a demo child
];

/* ── The receipt the parent reads (B-BOOK-20, critic r1) ────────────────── */

/** The rows of the erase receipt, in display order. */
export type ReceiptRowId = "records" | "memoryEvents" | "shares" | "consents" | "consultRequests" | "storageFiles" | "clientDocs";
export const RECEIPT_ROWS: readonly ReceiptRowId[] = ["records", "memoryEvents", "shares", "consents", "consultRequests", "storageFiles", "clientDocs"];

/** Which receipt row a registered sink belongs to. Each row's state comes
 *  only from its own places (critic r2: consult requests are server-held and
 *  have their own row, so a server failure never marks the saved records). */
export function receiptRowOf(sinkId: string): ReceiptRowId {
  if (sinkId === "profile" || sinkId.startsWith("firestore:")) return "records";
  if (sinkId === "server:memoryEvents" || sinkId === "server:familyChildRef") return "memoryEvents";
  if (sinkId === "server:shares") return "shares";
  if (sinkId === "server:consents") return "consents";
  if (sinkId === "server:consultRequests") return "consultRequests";
  if (sinkId.startsWith("storage:")) return "storageFiles";
  return "clientDocs";
}

export interface ReceiptView {
  /** True only when every registered sink was reached. A receipt without a
   *  sink ledger proves nothing, so it is not finished either. */
  finished: boolean;
  /** Each row's count, or "not-reached" when any sink of that row failed. */
  rows: Record<ReceiptRowId, number | "not-reached">;
  /** How many registered places each row stands for, and how many of them
   *  were not reached: the sheet's plain-language summary of the ledger (the
   *  raw per-place ids live only in the saved receipt file). */
  places: Record<ReceiptRowId, { total: number; unreached: number }>;
}

/**
 * The receipt as the parent reads it. The counts are the receipt's own
 * (`counts`, the server's and the device sweep's); the sink ledger decides
 * whether each row was reached and counts the saved records.
 */
export function receiptView(
  sinks: Readonly<Record<string, SinkErasure>> | undefined,
  counts: Readonly<Record<Exclude<ReceiptRowId, "records">, number>>,
): ReceiptView {
  const unreached = new Set<ReceiptRowId>();
  const places = Object.fromEntries(RECEIPT_ROWS.map((row) => [row, { total: 0, unreached: 0 }])) as ReceiptView["places"];
  for (const [id, v] of Object.entries(sinks ?? {})) {
    const row = receiptRowOf(id);
    places[row].total++;
    if (v === "not-reached") { unreached.add(row); places[row].unreached++; }
  }
  const rows = { records: erasedRecordCount(sinks), ...counts } as Record<ReceiptRowId, number | "not-reached">;
  for (const row of unreached) rows[row] = "not-reached";
  return { finished: !!sinks && Object.keys(sinks).length > 0 && unreached.size === 0, rows, places };
}

/** The title key of the receipt sheet. */
export const receiptTitleKey = (finished: boolean): string =>
  finished ? "sec.sharing.receipt.title" : "elev.learnCare.receipt.unfinishedTitle";

const mergeSink = (a: SinkErasure | undefined, b: SinkErasure | undefined): SinkErasure | undefined => {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (a === "not-reached") return b;
  if (b === "not-reached") return a;
  if (typeof a === "number" && typeof b === "number") return a + b;
  return typeof a === "number" ? a : typeof b === "number" ? b : "cleared";
};

/**
 * A retry's receipt folded into the first one: what either attempt erased is
 * counted once per attempt, and a sink the first attempt could not reach takes
 * the retry's result. The parent keeps ONE receipt for the child.
 */
export function mergeErasureReceipts<R extends { erasedAt: string; counts: Record<string, number | undefined>; sinks?: Record<string, SinkErasure> }>(prev: R, next: R): R {
  const counts: Record<string, number | undefined> = { ...prev.counts };
  for (const [k, v] of Object.entries(next.counts)) counts[k] = typeof v === "number" ? (counts[k] ?? 0) + v : counts[k];
  const ids = [...new Set([...Object.keys(prev.sinks ?? {}), ...Object.keys(next.sinks ?? {})])];
  const sinks = next.sinks || prev.sinks
    ? Object.fromEntries(ids.map((id) => [id, mergeSink(prev.sinks?.[id], next.sinks?.[id]) as SinkErasure]))
    : undefined;
  return { ...next, counts: counts as R["counts"], ...(sinks ? { sinks } : {}) };
}
