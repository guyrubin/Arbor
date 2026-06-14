import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { setAiLanguage } from "../lib/api";
import { translate, type UiLang } from "../lib/i18n";

export type AiLang = "en" | "he";

type LanguageContextValue = {
  /** Language used for AI-generated content (guidance, scripts, stories, insights). */
  aiLang: AiLang;
  setAiLang: (l: AiLang) => void;
  /** Language used for the Arbor interface (labels, buttons). Drives RTL. */
  uiLang: UiLang;
  /** Set the whole-app language (UI + AI together). */
  setUiLang: (l: UiLang) => void;
  /** Translate a UI key in the current uiLang, interpolating {var} tokens. */
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const LS_AI = "arbor.aiLang";
const LS_UI = "arbor.uiLang";

const readLang = (key: string): UiLang => {
  try {
    return (localStorage.getItem(key) as UiLang) || "en";
  } catch {
    return "en";
  }
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [uiLang, setUiLangState] = useState<UiLang>(() => readLang(LS_UI));
  const [aiLang, setAiLangState] = useState<AiLang>(() => readLang(LS_AI) || uiLang);

  // Keep the API layer's language in sync so prompt builders localize output.
  useEffect(() => {
    setAiLanguage(aiLang);
    try { localStorage.setItem(LS_AI, aiLang); } catch { /* ignore */ }
  }, [aiLang]);

  // Drive document direction + lang so the whole UI mirrors and picks the right
  // font stack (see index.css html[lang="he"]). RTL is a document-level concern.
  useEffect(() => {
    try {
      document.documentElement.lang = uiLang;
      document.documentElement.dir = uiLang === "he" ? "rtl" : "ltr";
      localStorage.setItem(LS_UI, uiLang);
    } catch { /* ignore */ }
  }, [uiLang]);

  const setAiLang = useCallback((l: AiLang) => setAiLangState(l), []);
  // Choosing a UI language localizes content too — one switch for the whole app.
  const setUiLang = useCallback((l: UiLang) => { setUiLangState(l); setAiLangState(l); }, []);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(uiLang, key, vars), [uiLang]);

  return (
    <LanguageContext.Provider value={{ aiLang, setAiLang, uiLang, setUiLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
