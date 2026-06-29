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

  it("allows admin SDK bypass in test setup sanity path", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await expect(setDoc(doc(db, "children/admin-created"), { familyId: "f-admin" })).resolves.toBeUndefined();
    });
  });
});
