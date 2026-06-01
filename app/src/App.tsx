import React from "react";
import { RefreshCw } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProfileProvider } from "./context/ProfileContext";
import { ArborProvider } from "./context/ArborContext";
import { ToastProvider } from "./context/ToastContext";
import { LanguageProvider } from "./context/LanguageContext";
import Shell from "./components/layout/Shell";
import LoginScreen from "./components/auth/LoginScreen";

/**
 * Gates the app behind authentication. When Firebase is configured, unauthenticated
 * users only ever see the LoginScreen. In sandbox mode (no Firebase config) the
 * AuthProvider supplies a synthetic local user, so the gate passes through.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="arbor-app min-h-screen flex items-center justify-center text-[#a8a093]">
        <RefreshCw className="w-5 h-5 animate-spin text-[#d7aa55]" />
      </div>
    );
  }

  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

/** Thin application shell: auth gate → state provider → layout. */
export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <ProfileProvider>
              <ArborProvider>
                <Shell />
              </ArborProvider>
            </ProfileProvider>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}
