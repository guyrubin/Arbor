import React, { useState } from "react";
import { motion } from "motion/react";
import { Mail, Lock, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ArborMark as ArborMarkIcon } from "../ui/ArborMark";

function ArborMark() {
  return <ArborMarkIcon size={56} />;
}

export default function LoginScreen() {
  const { signInWithGoogle, signInWithEmail, resetPassword, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [resetMsg, setResetMsg] = useState("");

  const handleReset = async () => {
    if (!email.trim()) {
      setResetMsg("Enter your email above first.");
      return;
    }
    try {
      await resetPassword(email.trim());
      setResetMsg("Password reset email sent — check your inbox.");
    } catch {
      setResetMsg("Couldn't send a reset email for that address.");
    }
  };

  const handleGoogle = async () => {
    setBusy("google");
    try {
      await signInWithGoogle();
    } catch {
      /* surfaced via context error */
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy("email");
    try {
      await signInWithEmail(email.trim(), password);
    } catch {
      /* surfaced via context error */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="arbor-app min-h-screen flex items-center justify-center px-6 antialiased text-sans relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-[#141821] border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl space-y-7 relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <ArborMark />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Arbor</h1>
            <p className="text-sm text-[#a8a093] mt-1">Your child&apos;s development, thoughtfully guided.</p>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={busy !== null}
          className="w-full bg-[#e2562d] hover:bg-[#cf4d27] disabled:opacity-60 text-white font-extrabold text-sm px-5 py-3.5 rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-[#e2562d]/15"
        >
          {busy === "google" ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.3-.1-2.3-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 39.3 44 32.5 44 24c0-1.3-.1-2.3-.4-3.5z" />
            </svg>
          )}
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#a8a093]">
          <span className="flex-1 h-px bg-white/10" />
          or
          <span className="flex-1 h-px bg-white/10" />
        </div>

        {!showEmail ? (
          <button
            onClick={() => setShowEmail(true)}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-sm px-5 py-3 rounded-2xl transition flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4 text-[#d7aa55]" /> Continue with email
          </button>
        ) : (
          <form onSubmit={handleEmail} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-[#a8a093] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#08090c] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#d7aa55]/50 transition"
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#a8a093] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-[#08090c] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#d7aa55]/50 transition"
              />
            </div>
            <button
              type="submit"
              disabled={busy !== null}
              className="w-full bg-[#d7aa55] hover:bg-[#c39947] disabled:opacity-60 text-black font-extrabold text-sm px-5 py-3 rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {busy === "email" ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Sign in
            </button>
            <div className="flex items-center justify-between">
              <button type="button" onClick={handleReset} className="text-[11px] text-[#a8a093] hover:text-[#f4d991] transition">
                Forgot password?
              </button>
              {resetMsg && <span className="text-[10px] text-[#f4d991]">{resetMsg}</span>}
            </div>
          </form>
        )}

        <p className="text-center text-[11px] text-[#a8a093]">
          Invite-only for now.{" "}
          <a
            href="mailto:hello@arbor.app?subject=Arbor%20access%20request"
            className="text-[#f4d991] font-bold hover:underline"
          >
            Request access
          </a>
        </p>
      </motion.div>
    </div>
  );
}
