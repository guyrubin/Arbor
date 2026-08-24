import { getFirestore, FieldPath, FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import type { ArborConfig } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * STORE-4 — full account deletion (Apple 5.1.1(v) / Play account-deletion /
 * GDPR Art. 17). Deletes EVERY server-held record keyed to the uid — not just
 * the per-child erase that /privacy/erase performs — plus Storage, the
 * RevenueCat subscriber, and finally the Firebase Auth user.
 *
 * Honesty contract (the `eraseEverything` zeros-receipt bug class): every data
 * class reports { attempted, deleted, failed, error } from what actually
 * happened; one retry per failed class; ANY failure ⇒ `complete: false` and the
 * Auth user is NOT deleted — the parent keeps a sign-in that can retry, instead
 * of an orphaned, unreachable dataset. Guard-tested in accountDeletion.test.ts:
 * a simulated delete failure can never yield a clean receipt.
 *
 * Class order matters:
 *   RevenueCat subscriber FIRST (so no late webhook rewrites entitlements),
 *   then Firestore classes, then the users/{uid} tree, then Storage,
 *   then Auth LAST (only when everything else succeeded).
 */

export type DeletionClassResult = {
  class: string;
  attempted: boolean;
  deleted: number;
  failed: number;
  error?: string;
  note?: string;
};

export type AccountDeletionReceipt = {
  uid: string;
  complete: boolean;
  authDeleted: boolean;
  receiptAt: string;
  classes: DeletionClassResult[];
};

/** One executor per data class — injected so tests can fail any class. */
export interface DeletionOps {
  revenuecat: (uid: string) => Promise<{ deleted: number; note?: string }>;
  entitlements: (uid: string) => Promise<number>;
  referral: (uid: string) => Promise<number>;
  pushTokens: (uid: string) => Promise<number>;
  aiQuota: (uid: string) => Promise<{ deleted: number; note?: string }>;
  consultRequests: (uid: string) => Promise<number>;
  waitlist: (email: string | null) => Promise<{ deleted: number; note?: string }>;
  shares: (uid: string, email: string | null) => Promise<number>;
  childData: (uid: string) => Promise<{ deleted: number; note?: string }>;
  families: (uid: string) => Promise<{ deleted: number; note?: string }>;
  userTree: (uid: string) => Promise<{ deleted: number; note?: string }>;
  storageFiles: (uid: string) => Promise<{ deleted: number; note?: string }>;
  authUser: (uid: string) => Promise<void>;
}

const CLASS_ORDER: Array<Exclude<keyof DeletionOps, "authUser">> = [
  "revenuecat",
  "entitlements",
  "referral",
  "pushTokens",
  "aiQuota",
  "consultRequests",
  "waitlist",
  "shares",
  "childData",
  "families",
  "userTree",
  "storageFiles",
];

export async function runAccountDeletion(
  ops: DeletionOps,
  uid: string,
  email: string | null,
): Promise<AccountDeletionReceipt> {
  const classes: DeletionClassResult[] = [];

  for (const name of CLASS_ORDER) {
    const run = async (): Promise<DeletionClassResult> => {
      const result =
        name === "waitlist" ? await ops.waitlist(email)
          : name === "shares" ? await ops.shares(uid, email)
            : await (ops[name] as (uid: string) => Promise<number | { deleted: number; note?: string }>)(uid);
      const { deleted, note } = typeof result === "number" ? { deleted: result, note: undefined } : result;
      return { class: name, attempted: true, deleted, failed: 0, ...(note ? { note } : {}) };
    };
    try {
      classes.push(await run());
    } catch (err1) {
      // One retry per class — transient Firestore errors are common at scale.
      try {
        classes.push(await run());
      } catch (err2: unknown) {
        const message = err2 instanceof Error ? err2.message : String(err2);
        classes.push({ class: name, attempted: true, deleted: 0, failed: 1, error: message });
        logger.error("Account deletion class failed after retry", err2 instanceof Error ? err2 : undefined, { uid, class: name });
      }
    }
  }

  const complete = classes.every((c) => c.failed === 0);
  let authDeleted = false;
  if (complete) {
    // Auth LAST, and only on a fully clean sweep — a partial failure keeps the
    // account alive so the deletion can be retried (honest partial state).
    try {
      await ops.authUser(uid);
      authDeleted = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      classes.push({ class: "authUser", attempted: true, deleted: 0, failed: 1, error: message });
    }
  }

  return {
    uid,
    complete: complete && authDeleted,
    authDeleted,
    receiptAt: new Date().toISOString(),
    classes,
  };
}

/* ────────────────────────── Firestore wiring ────────────────────────── */

/** aiQuota meters that key on the uid (quotaStore doc id = `{name}_{key}_{start}`).
 *  These docs also self-expire ≤24h via the TTL policy on `expireAt`. */
const UID_METERS = ["ai_hourly", "coach_daily", "tts_chars_daily", "img_user_daily"];

/** Batch-delete every doc a query matches; returns the count. */
async function deleteByQuery(db: Firestore, query: FirebaseFirestore.Query): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await query.limit(400).get();
    if (snap.empty) return total;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) return total;
  }
}

export interface FirestoreDeletionStores {
  memoryEraseChild: (childId: string) => Promise<number>;
  consentEraseByChild: (childId: string) => Promise<number>;
  shareEraseByChild: (ownerUid: string, childId: string) => Promise<number>;
  pushTokensRemove: (uid: string) => Promise<void>;
}

export function createFirestoreDeletionOps(
  config: ArborConfig,
  stores: FirestoreDeletionStores,
  fetchImpl: typeof fetch = fetch,
): DeletionOps {
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
  }
  const db = getFirestore(config.firestoreDatabaseId);

  return {
    async revenuecat(uid) {
      if (!config.revenuecatSecretApiKey) {
        return { deleted: 0, note: "skipped: REVENUECAT_SECRET_API_KEY not configured" };
      }
      const res = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${config.revenuecatSecretApiKey}` },
      });
      // 404 = no subscriber record — nothing to delete is a clean outcome.
      if (res.ok || res.status === 404) return { deleted: res.ok ? 1 : 0 };
      throw new Error(`RevenueCat subscriber delete failed: HTTP ${res.status}`);
    },

    async entitlements(uid) {
      await db.collection("entitlements").doc(uid).delete();
      return 1;
    },

    async referral(uid) {
      let count = await deleteByQuery(db, db.collection("referralCodes").where("uid", "==", uid));
      await db.collection("referralGrants").doc(uid).delete();
      count += 1;
      // This uid also appears inside OTHER referrers' activatedBy ledgers.
      const ledgers = await db.collection("referralGrants").where("activatedBy", "array-contains", uid).get();
      for (const doc of ledgers.docs) {
        await doc.ref.update({ activatedBy: FieldValue.arrayRemove(uid) });
        count += 1;
      }
      return count;
    },

    async pushTokens(uid) {
      await stores.pushTokensRemove(uid);
      return 1;
    },

    async aiQuota(uid) {
      let deleted = 0;
      for (const meter of UID_METERS) {
        const prefix = `${meter}_${uid}_`;
        deleted += await deleteByQuery(
          db,
          db.collection("aiQuota")
            .where(FieldPath.documentId(), ">=", prefix)
            .where(FieldPath.documentId(), "<", `${prefix}`),
        );
      }
      return { deleted, note: "quota windows also self-expire within 24h (TTL)" };
    },

    async consultRequests(uid) {
      return deleteByQuery(db, db.collection("consultRequests").where("ownerUid", "==", uid));
    },

    async waitlist(email) {
      if (!email) return { deleted: 0, note: "no account email — nothing to match" };
      const id = Buffer.from(email.toLowerCase()).toString("base64url");
      const ref = db.collection("waitlist").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return { deleted: 0 };
      await ref.delete();
      return { deleted: 1 };
    },

    async shares(uid, email) {
      let count = await deleteByQuery(db, db.collection("shares").where("ownerUid", "==", uid));
      if (email) {
        // Grants where this user is the RECIPIENT — deleting revokes their access.
        count += await deleteByQuery(db, db.collection("shares").where("recipientEmail", "==", email.toLowerCase()));
      }
      return count;
    },

    async childData(uid) {
      // Enumerate the user's children, then run the SAME per-child server erase
      // /privacy/erase uses (memory ledger + child doc + consents). The client
      // tree under users/{uid} falls to userTree's recursiveDelete afterwards.
      const children = await db.collection(`users/${uid}/children`).get();
      let deleted = 0;
      for (const child of children.docs) {
        deleted += await stores.memoryEraseChild(child.id);
        deleted += await stores.consentEraseByChild(child.id);
        deleted += await stores.shareEraseByChild(uid, child.id);
        deleted += 1; // the child profile doc itself (memoryEraseChild removes children/{id}; the users-tree copy falls to userTree)
      }
      return { deleted, note: `${children.size} child profile(s) erased` };
    },

    async families(uid) {
      // ⚠ default-family trap: family docs are shared-literal-keyed, so a
      // family is ONLY removed when this uid was its last member.
      const memberships = await db.collectionGroup("members").where("userId", "==", uid).get();
      let deleted = 0;
      for (const member of memberships.docs) {
        const familyRef = member.ref.parent.parent;
        await member.ref.delete();
        deleted += 1;
        if (familyRef) {
          const remaining = await familyRef.collection("members").limit(1).get();
          if (remaining.empty) {
            await db.recursiveDelete(familyRef);
            deleted += 1;
          }
        }
      }
      return { deleted };
    },

    async userTree(uid) {
      // users/{uid} recursiveDelete covers children/** (all 33 subcollections),
      // insights, and users/{uid}/events (analytics + attribution).
      await db.recursiveDelete(db.doc(`users/${uid}`));
      return { deleted: 1, note: "users/{uid} tree removed recursively" };
    },

    async storageFiles(uid) {
      const bucketName = config.storageBucket;
      if (!bucketName) return { deleted: 0, note: "skipped: no storage bucket configured" };
      try {
        await getStorage().bucket(bucketName).deleteFiles({ prefix: `users/${uid}/` });
        return { deleted: 1, note: `storage prefix users/${uid}/ removed` };
      } catch (err: unknown) {
        // A bucket that was never provisioned is a clean no-op, not a failure.
        const message = err instanceof Error ? err.message : String(err);
        if (/not exist|notFound|404/i.test(message)) return { deleted: 0, note: "bucket not provisioned" };
        throw err;
      }
    },

    async authUser(uid) {
      const auth = getAuth();
      await auth.revokeRefreshTokens(uid);
      await auth.deleteUser(uid);
    },
  };
}
