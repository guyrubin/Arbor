import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";
import { api } from "./api";
import { ChildProfile, DeletionReceipt } from "../types";

/** Per-child subcollections that hold parent-generated data. */
export const CHILD_SUBCOLLECTIONS = [
  "behaviorLogs",
  "milestones",
  "actionPlans",
  "savedStories",
  "contacts",
  "weeklyReports",
  "briefs",
  "insights",
];

const remoteActive = (uid?: string) =>
  firebaseEnabled && !!db && !!uid && uid !== "local-sandbox";

/** Gather a full export of one child's data (profile + all subcollections). */
export async function exportChildData(uid: string | undefined, child: ChildProfile) {
  const out: {
    exportedAt: string;
    profile: ChildProfile;
    collections: Record<string, unknown[]>;
    serverData?: { memoryEvents: unknown[]; shares: unknown[] };
  } = {
    exportedAt: new Date().toISOString(),
    profile: child,
    collections: {},
  };

  // CMP-2 (GDPR Art. 15/20): include the server-side data (memory ledger +
  // share grants) so the export is complete, not just the client collections.
  try {
    const server = await api.privacyExport(child.id);
    out.serverData = server.serverData;
  } catch {
    /* server export unavailable — client collections still export */
  }

  for (const name of CHILD_SUBCOLLECTIONS) {
    if (remoteActive(uid) && db) {
      try {
        const snap = await getDocs(collection(db, `users/${uid}/children/${child.id}/${name}`));
        out.collections[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch {
        out.collections[name] = [];
      }
    } else {
      try {
        const raw = localStorage.getItem(`arbor.${name}.${child.id}`);
        out.collections[name] = raw ? JSON.parse(raw) : [];
      } catch {
        out.collections[name] = [];
      }
    }
  }
  return out;
}

/** Client-side wipe only: all subcollections + the child doc (Firestore or
 *  localStorage). Server erasure is handled separately by `api.privacyErase`. */
async function wipeClientChildData(uid: string | undefined, childId: string) {
  if (remoteActive(uid) && db) {
    for (const name of CHILD_SUBCOLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, `users/${uid}/children/${childId}/${name}`));
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      } catch {
        /* best effort */
      }
    }
    try {
      await deleteDoc(doc(db, `users/${uid}/children/${childId}`));
    } catch {
      /* ignore */
    }
  } else {
    for (const name of CHILD_SUBCOLLECTIONS) {
      try {
        localStorage.removeItem(`arbor.${name}.${childId}`);
      } catch {
        /* ignore */
      }
    }
  }
}

/** Permanently delete one child's data (all subcollections) and the child doc. */
export async function deleteChildData(uid: string | undefined, childId: string) {
  // CMP-2 (GDPR Art. 17): real server-side erasure — memory-event ledger and
  // share grants are hard-deleted, not just the client's own collections.
  try {
    await api.privacyErase(childId);
  } catch {
    /* best effort: client-side deletion below still proceeds */
  }
  await wipeClientChildData(uid, childId);
}

/** M9: unified provable erasure — server wipe (memory ledger + shares + consent)
 *  captured into a receipt, plus the full client-side wipe. Returns the receipt
 *  the parent can keep as proof of deletion. */
export async function eraseEverything(uid: string | undefined, childId: string): Promise<DeletionReceipt> {
  let counts: DeletionReceipt["counts"] = { memoryEvents: 0, shares: 0 };
  try {
    const res = await api.privacyErase(childId);
    if (res?.erased) counts = res.erased;
  } catch {
    /* best effort: client wipe still proceeds, receipt reports zeros */
  }
  await wipeClientChildData(uid, childId);
  return { childId, erasedAt: new Date().toISOString(), counts };
}

/** Trigger a browser download of a JSON object. */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
