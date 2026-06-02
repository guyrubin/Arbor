import React, { createContext, useContext, useEffect, useState } from "react";
import { setAiLanguage } from "../lib/api";

export type AiLang = "en" | "he";

type LanguageContextValue = {
  /** Language used for AI-generated content (guidance, scripts, stories, insights). */
  aiLang: AiLang;
  setAiLang: (l: AiLang) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const LS_KEY = "arbor.aiLang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [aiLang, setAiLangState] = useState<AiLang>(() => {
    try {
      return (localStorage.getItem(LS_KEY) as AiLang) || "en";
    } catch {
      return "en";
    }
  });

  // Keep the API layer's language in sync so prompt builders localize output.
  useEffect(() => {
    setAiLanguage(aiLang);
    try {
      localStorage.setItem(LS_KEY, aiLang);
    } catch {
      /* ignore */
    }
  }, [aiLang]);

  const setAiLang = (l: AiLang) => setAiLangState(l);

  return <LanguageContext.Provider value={{ aiLang, setAiLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
