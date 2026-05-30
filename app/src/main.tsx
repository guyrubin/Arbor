import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import App from "./App.tsx";
import "./index.css";

const Root = () => {
  const { user, loading, firebaseEnabled } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#a8a093] text-sm">
          <div className="w-4 h-4 border-2 border-[#d7aa55]/40 border-t-[#d7aa55] rounded-full animate-spin" />
          Loading Arbor…
        </div>
      </div>
    );
  }

  // When Firebase Auth is configured and user is not signed in → show login gate.
  // In local/demo mode (firebaseEnabled=false) → skip auth entirely.
  if (firebaseEnabled && !user) {
    return <LoginPage />;
  }

  return <App />;
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>
);
