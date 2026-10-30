import React, { useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { ArborMark as ArborMarkIcon } from "../ui/ArborMark";
import { LegalLinks } from "../billing/LegalLinks";
import { appleSignInOffered } from "../../lib/nativeSignIn";
import { readTrialEntry } from "../../lib/trialEntry";
import { SignInSituation } from "./SituationFirst";

function ArborMark() {
  return <ArborMarkIcon size={56} />;
}

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, resetPassword, error } = useAuth();
  // B-GA-19: dark until the Apple provider is configured (and, in a native shell, until iOS ships the plugin).
  const offerApple = appleSignInOffered();
  const { t } = useLanguage();
  const [trialEntry] = useState(() => readTrialEntry());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  // B-RESID-05: one e-mail form, two modes. A new family creates its account
  // here (Google stays); there is no invite-only gate and no access request.
  const [mode, setMode] = useState<"signin" | "signup">(trialEntry ? "signup" : "signin");
  const [busy, setBusy] = useState<"google" | "apple" | "email" | null>(null);
  const [resetMsg, setResetMsg] = useState("");

  const handleReset = async () => {
    if (!email.trim()) {
      setResetMsg(t("auth.resetNeedEmail"));
      return;
    }
    try {
      await resetPassword(email.trim());
      setResetMsg(t("auth.resetSent"));
    } catch {
      setResetMsg(t("auth.resetFail"));
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

  const handleApple = async () => {
    setBusy("apple");
    try {
      await signInWithApple();
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
      if (mode === "signup") {
        // B-RESID-05: the account exists and this screen unmounts; the
        // confirmation-link line is said where the parent lands (lib/signupNotice).
        await signUpWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch {
      /* surfaced via context error */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="arbor-app min-h-screen flex items-center justify-center px-6 py-10 antialiased text-sans relative overflow-hidden">
      <div className="w-full max-w-5xl grid md:grid-cols-[1fr_minmax(0,28rem)] gap-10 md:gap-14 items-center relative z-10">
        {/* The value promise — the pre-wow front door says WHY before HOW.
            (The auth card alone answered nothing; blind-test F7/F10.) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center md:text-start space-y-5"
        >
          <h2
            className="text-3xl md:text-4xl font-black tracking-tight text-balance"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {trialEntry ? t("elev.auth.trial.headline") : t("elev.auth.headline")}
          </h2>
          <ul className="space-y-2.5 text-sm font-semibold inline-block text-start" style={{ color: "var(--arbor-muted)" }}>
            {(["elev.auth.p1", "elev.auth.p2", "elev.auth.p3"] as const).map((k) => (
              <li key={k} className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: "var(--arbor-clay)" }} />
                {t(k)}
              </li>
            ))}
          </ul>
          {trialEntry ? <div data-testid="trial-entry-context" className="rounded-2xl p-5 text-start space-y-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
            <p className="text-sm font-semibold">{t("elev.auth.trial.promise")}</p>
            <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.auth.trial.steps")}</p>
            <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.auth.trial.existing")}</p>
          </div> : <p className="text-[11px] font-bold" style={{ color: "var(--arbor-faint)" }}>{t("elev.auth.evidence")}</p>}
        </motion.div>

        {/* B-SHELL-15: the card and the legal links under it share one column. */}
        <div className="w-full max-w-md mx-auto space-y-3 relative z-10">
        <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 md:p-10 space-y-7 relative z-10 mx-auto"
        style={{ border: "1px solid var(--arbor-rule)", boxShadow: "0 24px 60px rgba(41,51,63,0.12)" }}
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <ArborMark />
          <div>
            <h1 className="text-3xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>Arbor</h1>
            <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>{t("auth.tagline")}</p>
          </div>
        </div>

        {trialEntry?.moment && <SignInSituation moment={trialEntry.moment} kept={trialEntry.kept} />}

        {error && (
          <div role="alert" className="text-xs rounded-xl px-4 py-2.5" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
            {/* MOB-03: AuthContext hands an i18n KEY (lib/i18nElevation/storeShell
                authErrorKey); t() resolves it in the parent's language and passes
                any legacy literal through unchanged (missing key → the string). */}
            {t(error)}
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={busy !== null}
          className="w-full text-white font-extrabold text-sm px-5 py-3.5 rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60"
          style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
        >
          {busy === "google" ? (
            <Icon name="refresh" size={16} className="animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.3-.1-2.3-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 39.3 44 32.5 44 24c0-1.3-.1-2.3-.4-3.5z" />
            </svg>
          )}
          {t("auth.continueGoogle")}
        </button>

        {offerApple && (
          <button
            type="button"
            data-testid="auth-apple"
            onClick={handleApple}
            disabled={busy !== null}
            className="w-full min-h-11 font-bold text-sm px-5 py-3 rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60"
            style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-ink)", color: "var(--arbor-ink)" }}
          >
            {busy === "apple" ? (
              <Icon name="refresh" size={16} className="animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M16.37 12.5c-.02-2.1 1.72-3.11 1.8-3.16-.98-1.43-2.5-1.63-3.04-1.65-1.29-.13-2.52.76-3.17.76-.66 0-1.67-.74-2.74-.72-1.41.02-2.71.82-3.44 2.08-1.47 2.55-.38 6.32 1.05 8.39.7 1.01 1.53 2.15 2.62 2.11 1.05-.04 1.45-.68 2.72-.68 1.27 0 1.63.68 2.74.66 1.13-.02 1.85-1.03 2.54-2.05.8-1.17 1.13-2.31 1.15-2.37-.03-.01-2.2-.84-2.23-3.37zM14.29 6.33c.58-.7.97-1.68.86-2.65-.83.03-1.84.55-2.44 1.25-.53.62-1 1.61-.88 2.57.93.07 1.88-.47 2.46-1.17z" />
              </svg>
            )}
            {t("auth.continueApple")}
          </button>
        )}

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest" style={{ color: "var(--arbor-muted)" }}>
          <span className="flex-1 h-px" style={{ background: "var(--arbor-rule)" }} />
          {t("auth.or")}
          <span className="flex-1 h-px" style={{ background: "var(--arbor-rule)" }} />
        </div>

        {!showEmail ? (
          <button
            onClick={() => setShowEmail(true)}
            className="w-full font-bold text-sm px-5 py-3 rounded-2xl transition flex items-center justify-center gap-2 bg-white"
            style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
          >
            <Icon name="mail" size={16} style={{ color: "var(--arbor-green-ink)" }} /> {t("auth.continueEmail")}
          </button>
        ) : (
          <form onSubmit={handleEmail} className="space-y-3">
            <div className="relative">
              <Icon name="mail" size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--arbor-muted)" }} />
              <input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-xl ps-10 pe-4 py-3 text-sm focus:outline-none transition"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
            </div>
            <div className="relative">
              <Icon name="lock" size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--arbor-muted)" }} />
              <input
                type="password"
                name="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? 6 : undefined}
                aria-describedby={mode === "signup" ? "login-password-hint" : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                className="w-full rounded-xl ps-10 pe-4 py-3 text-sm focus:outline-none transition"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
            </div>
            {mode === "signup" && <p id="login-password-hint" className="px-1 t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.auth.signup.passwordHint")}</p>}
            <button
              type="submit"
              data-testid="login-email-submit"
              disabled={busy !== null}
              className="w-full text-white font-extrabold text-sm px-5 py-3 rounded-2xl transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--arbor-gradient-primary)" }}
            >
              {busy === "email" ? <Icon name="refresh" size={16} className="animate-spin" /> : null}
              {mode === "signup" ? t("elev.auth.signup.cta") : t("auth.signIn")}
            </button>
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              {mode === "signin" && <button type="button" data-testid="login-forgot" onClick={handleReset} className="inline-flex items-center min-h-11 t-sm transition" style={{ color: "var(--arbor-muted)" }}>
                {t("auth.forgot")}
              </button>}
              <button type="button" data-testid="login-mode-switch" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setResetMsg(""); }}
                className="inline-flex items-center min-h-11 min-w-11 t-base font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
                {mode === "signin" ? t("elev.auth.signup.toSignup") : t("elev.auth.signup.toSignin")}
              </button>
              {resetMsg && <span role="status" className="t-sm" style={{ color: "var(--arbor-green-ink)" }}>{resetMsg}</span>}
            </div>
          </form>
        )}

      </motion.div>
      {/* B-SHELL-15 / MOB-01: Privacy · Terms · Support before sign-in too —
          the fourth LegalLinks mount (44 px rows). */}
      <LegalLinks align="center" />
      </div>
      </div>
    </div>
  );
}
