import React from "react";
import { ArborProvider } from "./context/ArborContext";
import Shell from "./components/layout/Shell";

/**
 * Thin application shell. All state lives in ArborProvider; the active tab,
 * layout, and AI rail are composed inside <Shell />.
 */
export default function App() {
  return (
    <ArborProvider>
      <Shell />
    </ArborProvider>
  );
}
