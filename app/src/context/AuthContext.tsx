import React, { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled } from "../lib/firebase";
import { setAuthTokenProvider } from "../lib/api";
import { initNaturalVoice } from "../lib/naturalVoice";
import { setAnalyticsUser } from "../lib/analytics";

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  firebaseEnabled: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

const SANDBOX_USER: AuthUser = {
  uid: "local-sandbox",
  email: null,
  displayName: "Sandbox Parent",
  photoURL: null,
};

const toAuthUser = (u: User): AuthUser => ({
  uid: u.uid,
  email: u.email,
  displayName: u.displayName,
  photoURL: u.photoURL,
});

/** Map raw Firebase auth error codes to calm, parent-friendly copy (handoff P0.1).
 *  Never surface "Firebase: Error (auth/…)" strings to a parent. */
const friendlyAuthError = (err: any): string => {
  switch (err?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/invalid-email":
      return "We couldn't sign you in. Please check your email and password, or request access.";
    case "auth/user-not-found":
      return "No Arbor account found for this email. Request access if you haven't been invited yet.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact hello@arbor.app for help.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again, or reset your password.";
    case "auth/network-request-failed":
      return "We couldn't reach Arbor. Check your connection and try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for Arbor and try again.";
    default:
      return "Something went wrong signing you in. Please try again or request access.";
  }
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // In sandbox mode (no Firebase config) we expose a synthetic local user so the
  // product remains fully usable without an auth backend.
  const [user, setUser] = useState<AuthUser | null>(firebaseEnabled ? null : SANDBOX_USER);
  const [loading, setLoading] = useState<boolean>(firebaseEnabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseEnabled || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u ? toAuthUser(u) : null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    if (!firebaseEnabled || !auth) return;
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") return;
      setError(friendlyAuthError(err));
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!firebaseEnabled || !auth) return;
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(friendlyAuthError(err));
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    if (!firebaseEnabled || !auth) return;
    setError(null);
    await sendPasswordResetEmail(auth, email);
  };

  const signOut = async () => {
    if (!firebaseEnabled || !auth) return;
    await firebaseSignOut(auth);
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!firebaseEnabled || !auth?.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  // Let the API layer attach the current ID token to outgoing requests.
  useEffect(() => {
    setAuthTokenProvider(getIdToken);
    setAnalyticsUser(() => user?.uid);
    // Epic A: activate the neural-voice engine when built with VITE_TTS_PROVIDER
    // and the server reports /api/tts configured. No-op otherwise (browser floor).
    void initNaturalVoice();
  }, [user?.uid]);

  const value: AuthContextValue = {
    user,
    loading,
    firebaseEnabled,
    error,
    signInWithGoogle,
    signInWithEmail,
    resetPassword,
    signOut,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
