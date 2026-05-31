import React, { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled } from "../lib/firebase";
import { setAuthTokenProvider } from "../lib/api";

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
      setError(err?.message || "Google sign-in failed.");
      throw err;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    if (!firebaseEnabled || !auth) return;
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err?.message || "Email sign-in failed. Check your credentials.");
      throw err;
    }
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
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    firebaseEnabled,
    error,
    signInWithGoogle,
    signInWithEmail,
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
