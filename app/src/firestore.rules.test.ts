import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const describeRules = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

describeRules("Firestore security rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "arbor-rules-test",
      firestore: {
        rules: fs.readFileSync(path.join(process.cwd(), "..", "firestore.rules"), "utf8")
      }
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "families/f1"), { familyId: "f1" });
      await setDoc(doc(db, "families/f1/members/u1"), { userId: "u1", role: "parent" });
      await setDoc(doc(db, "children/c1"), { childId: "c1", familyId: "f1" });
      // N1-05 / N1-07: one family's rollup and one family's mailing consent,
      // seeded through the admin bypass so the cross-user denials below are
      // testing the RULES and not the absence of a document.
      await setDoc(doc(db, "retentionRollups/u1"), { firstSeen: "2026-09-01", activeDays: ["2026-09-01"] });
      await setDoc(doc(db, "digestOptIn/u1"), { email: "u1@example.com", language: "en", optedInAt: "2026-09-01T00:00:00.000Z", lastSentAt: null });
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  it("allows a logged-in family member to read a child document", async () => {
    const db = testEnv.authenticatedContext("u1").firestore();
    await assertSucceeds(getDoc(doc(db, "children/c1")));
  });

  it("denies a logged-in non-member from reading a child document", async () => {
    const db = testEnv.authenticatedContext("u2").firestore();
    await assertFails(getDoc(doc(db, "children/c1")));
  });

  /* ── N1-05: the cohort read lane's own collections ───────────────────── */

  it("allows a user to read and write their OWN retention rollup", async () => {
    const db = testEnv.authenticatedContext("u1").firestore();
    await assertSucceeds(getDoc(doc(db, "retentionRollups/u1")));
    await assertSucceeds(setDoc(doc(db, "retentionRollups/u1"), { firstSeen: "2026-09-01", activeDays: ["2026-09-02"] }));
  });

  it("DENIES user B reading user A's retention rollup", async () => {
    const db = testEnv.authenticatedContext("u2").firestore();
    await assertFails(getDoc(doc(db, "retentionRollups/u1")));
    await assertFails(setDoc(doc(db, "retentionRollups/u1"), { firstSeen: "2020-01-01", activeDays: [] }));
  });

  it("denies an UNAUTHENTICATED read of any retention rollup", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "retentionRollups/u1")));
  });

  /* ── N1-07: the mailing consent ──────────────────────────────────────── */

  it("allows a user to read their own digest opt-in but NEVER to write one", async () => {
    const db = testEnv.authenticatedContext("u1").firestore();
    await assertSucceeds(getDoc(doc(db, "digestOptIn/u1")));
    // The address is set by the server from the VERIFIED identity. A client
    // write is how an arbitrary address would otherwise reach the sender.
    await assertFails(setDoc(doc(db, "digestOptIn/u1"), { email: "attacker@evil.example" }));
  });

  it("DENIES user B reading user A's digest opt-in", async () => {
    const db = testEnv.authenticatedContext("u2").firestore();
    await assertFails(getDoc(doc(db, "digestOptIn/u1")));
  });

  it("allows admin SDK bypass in test setup sanity path", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await expect(setDoc(doc(db, "children/admin-created"), { familyId: "f-admin" })).resolves.toBeUndefined();
    });
  });
});
