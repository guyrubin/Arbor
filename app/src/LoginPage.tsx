import React, { useState } from "react";
import { useAuth } from "./AuthContext";

export const LoginPage: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e.message ?? "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "sign-in") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (e: any) {
      setError(e.message ?? "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4">
      {/* Logo block */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-2.5 mb-3">
          <div className="w-9 h-9 bg-[#d7aa55] rounded-lg flex items-center justify-center">
            <span className="text-black font-black text-lg">A</span>
          </div>
          <span className="text-2xl font-black tracking-tight text-white">Arbor</span>
        </div>
        <p className="text-xs text-[#a8a093] tracking-widest uppercase font-semibold">
          Parent Development Support — Private Beta
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-[#141821] border border-white/10 rounded-2xl p-8 space-y-5">
        <div>
          <h1 className="text-lg font-black text-white">
            {mode === "sign-in" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-xs text-[#a8a093] mt-1">
            {mode === "sign-in"
              ? "Sign in to access your family dashboard and child memory."
              : "Start your Arbor journey. Private beta access only."}
          </p>
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] text-white text-sm font-semibold transition disabled:opacity-40"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#d7aa55]/50 transition"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#d7aa55]/50 transition"
          />
          {error && (
            <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/15 rounded-lg px-3 py-2 leading-relaxed">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/10 text-black font-black text-sm py-2.5 rounded-xl transition"
          >
            {loading
              ? "Please wait…"
              : mode === "sign-in"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-xs text-slate-500">
          {mode === "sign-in" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(null); }}
            className="text-[#d7aa55] hover:text-[#f4d991] font-semibold transition"
          >
            {mode === "sign-in" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>

      <p className="mt-8 text-[10px] text-slate-600 text-center max-w-xs leading-relaxed">
        Arbor is a private beta. Your child data is end-to-end scoped to your account and never shared without explicit consent.
      </p>
    </div>
  );
};
