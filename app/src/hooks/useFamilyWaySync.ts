import { useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { FAMILY_WAY_EVENT, familyWayPath, familyWaySyncOn, readLocalFamilyWay, syncFamilyWay, type FamilyWayIO } from "../lib/familyWay";

/** B-PLAY-21 (dark): the account's family way, read on sign-in and written
 *  when the parent changes the charter or the tone (lib/familyWay.ts). Runs
 *  only for a real signed-in account with the device flag on. */
export function useFamilyWaySync(applyLens: (lens: string) => void): void {
  const { user } = useAuth();
  const uid = user?.uid;
  const apply = useRef(applyLens);
  apply.current = applyLens;
  useEffect(() => {
    if (!uid || uid === "local-sandbox" || !firebaseEnabled || !db || !familyWaySyncOn()) return undefined;
    const ref = doc(db, familyWayPath(uid));
    const io: FamilyWayIO = {
      read: async () => { const snap = await getDoc(ref); return snap.exists() ? snap.data() : null; },
      write: async (way) => { await setDoc(ref, way); },
    };
    let alive = true;
    void syncFamilyWay(io).then((applied) => { if (alive && applied?.lens) apply.current(applied.lens); }).catch(() => undefined);
    const onChange = () => { void io.write(readLocalFamilyWay()).catch(() => undefined); };
    window.addEventListener(FAMILY_WAY_EVENT, onChange);
    return () => { alive = false; window.removeEventListener(FAMILY_WAY_EVENT, onChange); };
  }, [uid]);
}
