import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Firebase client initialization. Reads VITE_FIREBASE_* env vars (exposed to the
 * browser by Vite). When the config is absent — e.g. local sandbox mode — Firebase
 * is left uninitialized and `firebaseEnabled` is false, so the app falls back to an
 * open, local-only experience instead of hard-gating behind a login it cannot serve.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  try {
    storage = getStorage(app);
  } catch {
    storage = undefined;
  }
  // Offline-first: IndexedDB-backed cache so logs/milestones/plans read and write
  // offline and sync when the connection returns (multi-tab safe).
  //
  // ignoreUndefinedProperties is REQUIRED: our domain objects carry optional
  // fields (a behavior log's notes/photoAttachment/resolutionNotes, etc.) that are
  // `undefined` when empty. Without this, setDoc() THROWS on any undefined value
  // and the whole write is rejected — which silently dropped saves in production
  // (Firestore) even though localStorage/sandbox mode worked fine.
  try {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    try {
      db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      db = getFirestore(app);
    }
  }
}

export { app, auth, db, storage };
