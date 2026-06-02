import { promises as fs } from "node:fs";
import path from "node:path";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID;
if (!projectId) throw new Error("Set FIREBASE_PROJECT_ID or GCP_PROJECT_ID before running the Arbor migration.");

if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(process.env.FIRESTORE_DATABASE_ID || "(default)");
const ledgerPath = path.join(process.cwd(), ".data", "memory-ledger.json");
const seedUid = process.env.ARBOR_MIGRATION_UID || "guy-rubin-seed";
const defaultProfile = { name: "Seed child", source: "local-ledger-migration" };

const readLedger = async () => {
  try {
    return JSON.parse(await fs.readFile(ledgerPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

const ensureFamily = async () => {
  const existing = await db.collectionGroup("members").where("userId", "==", seedUid).limit(1).get();
  const existingFamilyId = existing.docs[0]?.ref.parent.parent?.id;
  if (existingFamilyId) return existingFamilyId;
  const familyId = "default-family";
  const now = new Date().toISOString();
  await db.collection("families").doc(familyId).set({ familyId, createdAt: now, updatedAt: now }, { merge: true });
  await db.collection("families").doc(familyId).collection("members").doc(seedUid).set({ userId: seedUid, role: "parent", createdAt: now }, { merge: true });
  return familyId;
};

const ensureChild = async (familyId, childId) => {
  const now = new Date().toISOString();
  await db.collection("children").doc(childId).set({ ...defaultProfile, childId, familyId, updatedAt: now }, { merge: true });
  await db.collection("families").doc(familyId).collection("childRefs").doc(childId).set({ childId, familyId, updatedAt: now }, { merge: true });
};

const main = async () => {
  const events = await readLedger();
  if (!Array.isArray(events) || events.length === 0) {
    console.log("No local Arbor memory ledger events found.");
    return;
  }
  const familyId = await ensureFamily();
  for (const childId of new Set(events.map((event) => event.childId).filter(Boolean))) {
    await ensureChild(familyId, childId);
  }
  for (const event of events) {
    if (!event.eventId || !event.childId) continue;
    await db.collection("children").doc(event.childId).collection("memoryEvents").doc(event.eventId).set({
      ...event,
      familyId: event.familyId || familyId
    }, { merge: true });
  }
  console.log(`Migrated ${events.length} Arbor memory events into Firestore family ${familyId}.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
