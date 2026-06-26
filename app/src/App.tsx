import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProfileProvider, useProfile } from "./context/ProfileContext";
import { ArborProvider } from "./context/ArborContext";
import { ToastProvider } from "./context/ToastContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import Shell from "./components/layout/Shell";
import LoginScreen from "./components/auth/LoginScreen";
import OnboardingFlow from "./components/auth/OnboardingFlow";
import { firebaseClientMisconfigured, missingFirebaseClientConfig } from "./lib/firebase";
import { refreshEntitlement } from "./hooks/useEntitlement";
import { recordBillingTransition } from "./lib/billingTransition";

/**
 * Gates the app behind authentication. When Firebase is configured, unauthenticated
 * users only ever see the LoginScreen. In sandbox mode (no Firebase config) the
 * AuthProvider supplies a synthetic local user, so the gate passes through.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  if (firebaseClientMisconfigured) return <ProductionAuthConfigError />;

  if (loading) {
    return (
      <div
        className="arbor-app min-h-screen flex items-center justify-center"
        style={{ color: "var(--arbor-muted)" }}
        role="status"
        aria-label={t("aria.loading")}
      >
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--arbor-clay)" }} />
      </div>
    );
  }

  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

function ProductionAuthConfigError() {
  return (
    <div className="arbor-app min-h-screen flex items-center justify-center px-6" style={{ background: "var(--arbor-paper)" }}>
      <div className="w-full max-w-xl rounded-2xl p-6 shadow-sm" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl p-2" style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)" }}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>Arbor sign-in is not configured</h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              This production build is missing Firebase client configuration, so Arbor cannot attach the required sign-in token to AI requests.
            </p>
            <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              Missing: {missingFirebaseClientConfig.join(", ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Routes a signed-in user to onboarding (new account, no children) or the app.
 */
function ProfileGate({ children }: { children: React.ReactNode }) {
  const { loading, needsOnboarding } = useProfile();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div
        className="arbor-app min-h-screen flex items-center justify-center"
        style={{ color: "var(--arbor-muted)" }}
        role="status"
        aria-label={t("aria.loading")}
      >
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--arbor-clay)" }} />
      </div>
    );
  }
  if (needsOnboarding) return <OnboardingFlow />;
  return <>{children}</>;
}

/**
 * Pay-funnel instrumentation (P0-4). Runs once for a signed-in user: if we
 * returned from a hosted checkout (`?billing=success`), refresh the cached
 * entitlement and strip the param; then re-read the entitlement and let
 * recordBillingTransition() fire `trial_start`/`paid` exactly once per real
 * transition (deduped in localStorage, beta/comp excluded). Driving off the
 * entitlement transition — not the query param — means native RevenueCat
 * upgrades fire correctly too, since they never see the web redirect.
 */
function BillingReturnWatcher() {
  React.useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const returnedFromCheckout = params.get("billing") === "success";

    if (returnedFromCheckout) {
      params.delete("billing");
      const qs = params.toString();
      const clean = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
      try { window.history.replaceState({}, "", clean); } catch { /* ignore */ }
    }

    // Always evaluate the transition on boot — refreshEntitlement() forces a
    // fresh fetch, which covers both the web checkout redirect-back and native
    // RevenueCat upgrades (no web redirect). The localStorage dedup makes the
    // unconditional boot read cheap and idempotent.
    void refreshEntitlement().then((e) => { if (alive) recordBillingTransition(e); });

    return () => { alive = false; };
  }, []);
  return null;
}

/** Thin application shell: auth gate → profile gate → state provider → layout. */
export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <BillingReturnWatcher />
            <ProfileProvider>
              <ProfileGate>
                <ArborProvider>
                  <Shell />
                </ArborProvider>
              </ProfileGate>
            </ProfileProvider>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
