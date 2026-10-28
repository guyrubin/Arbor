/**
 * child-ownership-census — B-DATA-15. A ZERO-WRITE census of child ownership:
 * every parent profile doc users/{uid}/children/{id} against the ownership doc
 * children/{id}.familyId and the family's members (families/{f}/members/{uid}),
 * the docs requireChildOwnership authorizes against.
 *
 *   node app/scripts/child-ownership-census.mjs [--json]
 *
 * Prints COUNTS only — no ids, no names, no child data. It reads document
 * paths and two ownership fields (select()), never profile contents, and it
 * holds no write method at all: the db handle is wrapped so only
 * collection/collectionGroup → select → get exist. Runs on Application
 * Default Credentials against FIREBASE_PROJECT_ID / FIRESTORE_DATABASE_ID.
 * Production read and any repair are Guy's (repair needs his explicit go and
 * a dated receipt; this script never repairs). The goal after repair:
 * `mismatches 0`.
 *
 * Open until that repair runs: a legacy `child-<timestamp>` id whose ownership
 * doc still says 'default-family' (or has no family) can be claimed by the
 * FIRST caller who posts it to /api/onboarding/family-child — ensureChild
 * still re-parents such docs so their real parents heal on sign-in. The
 * `legacy owner` count below is exactly that exposure; new ids are
 * server-issued (/api/onboarding/child-id) and never land there.
 */
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LEGACY_FAMILY_ID = "default-family";

/** The only Firestore surface the census can reach: reads, nothing else. */
export function readOnly(db) {
  const query = (q) => ({ select: (...fields) => query(q.select(...fields)), get: () => q.get() });
  return {
    collection: (name) => query(db.collection(name)),
    collectionGroup: (name) => query(db.collectionGroup(name)),
  };
}

const segments = (doc) => String(doc.ref?.path ?? "").split("/");

/** Read the three ownership sources: paths and two fields only. */
export async function loadOwnership(db) {
  const ro = readOnly(db);
  const [profileSnap, childSnap, memberSnap] = await Promise.all([
    ro.collectionGroup("children").select().get(),
    ro.collection("children").select("familyId", "issuedAt").get(),
    ro.collectionGroup("members").select().get(),
  ]);
  const profiles = profileSnap.docs.map(segments)
    .filter((s) => s.length === 4 && s[0] === "users" && s[2] === "children")
    .map((s) => ({ uid: s[1], childId: s[3] }));
  const children = childSnap.docs.map((d) => ({ childId: d.id, familyId: d.get("familyId"), issued: d.get("issuedAt") !== undefined }));
  const members = memberSnap.docs.map(segments)
    .filter((s) => s.length === 4 && s[0] === "families" && s[2] === "members")
    .map((s) => ({ familyId: s[1], uid: s[3] }));
  return { profiles, children, members };
}

/** Pure: counts of every way a parent's profile and its ownership doc disagree. */
export function census({ profiles, children, members }) {
  const childById = new Map(children.map((c) => [c.childId, c]));
  const membersOf = new Map();
  for (const m of members) {
    if (!membersOf.has(m.familyId)) membersOf.set(m.familyId, new Set());
    membersOf.get(m.familyId).add(m.uid);
  }
  const holders = new Map();
  for (const p of profiles) {
    if (!holders.has(p.childId)) holders.set(p.childId, new Set());
    holders.get(p.childId).add(p.uid);
  }
  const out = {
    profiles: profiles.length,
    childDocs: children.length,
    owned: 0,            // profile → child doc → a family the parent belongs to
    unprovisioned: 0,    // profile with no children/{id} doc yet (first caller could claim it)
    legacyOwner: 0,      // children/{id} with no family or the shared 'default-family'
    lockedOut: 0,        // owned by a real family this parent is not a member of (403s their own child)
    sharedIds: 0,        // one child id held by profiles of two or more accounts
    issuedUnused: 0,     // a server-issued id whose profile write never landed (harmless)
    orphanChildDocs: 0,  // any other children/{id} with no parent profile anywhere
  };
  for (const p of profiles) {
    const child = childById.get(p.childId);
    if (!child) { out.unprovisioned++; continue; }
    const family = typeof child.familyId === "string" ? child.familyId : "";
    if (!family || family === LEGACY_FAMILY_ID) { out.legacyOwner++; continue; }
    if (membersOf.get(family)?.has(p.uid)) out.owned++;
    else out.lockedOut++;
  }
  for (const uids of holders.values()) if (uids.size > 1) out.sharedIds++;
  for (const child of children) {
    if (holders.has(child.childId)) continue;
    if (child.issued) out.issuedUnused++;
    else out.orphanChildDocs++;
  }
  out.mismatches = out.unprovisioned + out.legacyOwner + out.lockedOut + out.sharedIds + out.orphanChildDocs;
  return out;
}

export function renderCensus(c) {
  return [
    "child-ownership-census · READ-ONLY — counts only, writes nothing",
    `  parent profiles ${c.profiles} · ownership docs ${c.childDocs} · owned ${c.owned}`,
    `  unprovisioned ${c.unprovisioned} · legacy owner ${c.legacyOwner} (claimable by the first caller until repaired) · locked out ${c.lockedOut} · shared ids ${c.sharedIds}`,
    `  orphan ownership docs ${c.orphanChildDocs} · issued, unused ${c.issuedUnused}`,
    `  mismatches ${c.mismatches}`,
  ].join("\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { applicationDefault, getApps, initializeApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID });
    const counts = census(await loadOwnership(getFirestore(process.env.FIRESTORE_DATABASE_ID || "(default)")));
    console.log(renderCensus(counts));
    if (process.argv.includes("--json")) console.log(JSON.stringify(counts, null, 2));
  } catch (error) {
    console.error(`child-ownership-census: ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}
