/**
 * Arbor Firebase client — initializes once, exports auth and provider.
 * Config is injected from VITE_FIREBASE_* env vars at build time.
 * When the env vars are absent (local demo mode), auth is disabled.
 */
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;

export const firebaseEnabled = Boolean(apiKey);

const app = firebaseEnabled && !getApps().length
  ? initializeApp({
      apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
      appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
    })
  : (getApps()[0] ?? null);

export const auth = firebaseEnabled && app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
