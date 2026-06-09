import React from "react";
import { Languages, Sparkles, LogOut, ShieldCheck } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";

/** Lightweight app settings — wired to real app state (AI language, AI Engines
 *  panel, account). Replaces the previously dead "Settings" sidebar button. */
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { aiLang, setAiLang } = useLanguage();
  const { showAiRail, setShowAiRail, setActiveTab } = useArbor();
  const { user, signOut, firebaseEnabled } = useAuth();

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="space-y-5 text-sm">
        {/* AI response language */}
        <Row icon={<Languages className="w-4 h-4" />} title="AI response language" sub="The language Arbor writes guidance, stories and reports in.">
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            {([["en", "EN"], ["he", "עב"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setAiLang(k)} className="px-3 py-1 rounded-lg text-xs font-bold transition"
                style={aiLang === k ? { background: "#34b277", color: "#fff" } : { color: "var(--arbor-muted)" }}>
                {label}
              </button>
            ))}
          </div>
        </Row>

        {/* AI Engines panel */}
        <Row icon={<Sparkles className="w-4 h-4" />} title="AI Engines panel" sub="Show the right-hand panel that explains what Arbor is doing.">
          <button onClick={() => setShowAiRail(!showAiRail)} aria-pressed={showAiRail} className="w-11 h-6 rounded-full transition relative" style={{ background: showAiRail ? "#34b277" : "var(--arbor-rule-strong)" }}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${showAiRail ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </Row>

        {/* Data & privacy → profile editor (export / delete live there) */}
        <Row icon={<ShieldCheck className="w-4 h-4" />} title="Child profile & data" sub="Edit the profile, export data, or delete a child.">
          <button onClick={() => { onClose(); setActiveTab("profile"); }} className="text-xs font-bold rounded-xl px-3 py-2" style={{ background: "#e4f4ec", color: "#1f8a5a" }}>
            Open profile
          </button>
        </Row>

        {firebaseEnabled && user && (
          <div className="pt-4" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{user.displayName || "Signed in"}</p>
                {user.email && <p className="text-xs truncate" style={{ color: "var(--arbor-muted)" }}>{user.email}</p>}
              </div>
              <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2" style={{ background: "#fce2ec", color: "#bd4f74" }}>
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Row({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: "#e4f4ec", color: "#1f8a5a" }}>{icon}</span>
        <div className="min-w-0">
          <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>{title}</p>
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{sub}</p>
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
