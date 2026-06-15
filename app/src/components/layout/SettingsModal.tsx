import React from "react";
import { Languages, Sparkles, LogOut, ShieldCheck } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useEntitlement } from "../../hooks/useEntitlement";

/** Lightweight app settings — wired to real app state (AI language, AI Engines
 *  panel, account). Replaces the previously dead "Settings" sidebar button. */
export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { aiLang, setAiLang, t } = useLanguage();
  const { showAiRail, setShowAiRail, setActiveTab } = useArbor();
  const { user, signOut, firebaseEnabled } = useAuth();
  const { toast } = useToast();
  const { entitlement } = useEntitlement();
  const isPlus = entitlement.plan === "plus";
  const coachLimit = entitlement.limits.coachMessagesPerDay;

  return (
    <Modal open={open} onClose={onClose} title={t("set.title")}>
      <div className="space-y-5 text-sm">
        {/* Plan — read from the real entitlement endpoint (MON-1) */}
        <div className="rounded-2xl p-4" style={{ background: "linear-gradient(120deg,#eef6f1,var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: "#fff", color: "var(--arbor-green-ink)" }}><Sparkles className="w-4 h-4" /></span>
              <div className="min-w-0">
                <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>
                  {t("set.plan.your", { plan: isPlus ? (entitlement.enforced ? t("set.plan.plus") : t("set.plan.beta")) : t("set.plan.free") })}
                </p>
                <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>
                  {isPlus ? t("set.plan.plusDesc") : t("set.plan.freeDesc")}
                </p>
              </div>
            </div>
          </div>
          {!isPlus && (
            <>
              {coachLimit !== null && (
                <p className="text-xs mt-2" style={{ color: "var(--arbor-muted)" }}>
                  {t("set.plan.coachToday", { used: entitlement.usage.coachMessagesToday, limit: coachLimit })}
                </p>
              )}
              <p className="text-xs leading-relaxed mt-3" style={{ color: "var(--arbor-muted)" }}>
                {t("set.plan.plusPitch")}
              </p>
              <button onClick={() => toast(t("set.plan.notifyToast"), "success")} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-clay)", color: "#fff" }}>
                {t("set.plan.notify")}
              </button>
            </>
          )}
        </div>

        {/* AI response language */}
        <Row icon={<Languages className="w-4 h-4" />} title={t("set.aiLang.title")} sub={t("set.aiLang.sub")}>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            {([["en", "EN"], ["he", "עב"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setAiLang(k)} className="px-3 py-1 rounded-lg text-xs font-bold transition"
                style={aiLang === k ? { background: "var(--arbor-clay)", color: "#fff" } : { color: "var(--arbor-muted)" }}>
                {label}
              </button>
            ))}
          </div>
        </Row>

        {/* AI Engines panel */}
        <Row icon={<Sparkles className="w-4 h-4" />} title={t("set.rail.title")} sub={t("set.rail.sub")}>
          <button onClick={() => setShowAiRail(!showAiRail)} aria-pressed={showAiRail} className="w-11 h-6 rounded-full transition relative" style={{ background: showAiRail ? "var(--arbor-clay)" : "var(--arbor-rule-strong)" }}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${showAiRail ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </Row>

        {/* Data & privacy → profile editor (export / delete live there) */}
        <Row icon={<ShieldCheck className="w-4 h-4" />} title={t("set.data.title")} sub={t("set.data.sub")}>
          <button onClick={() => { onClose(); setActiveTab("profile"); }} className="text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            {t("set.data.open")}
          </button>
        </Row>

        {firebaseEnabled && user && (
          <div className="pt-4" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "var(--arbor-ink)" }}>{user.displayName || t("set.signedIn")}</p>
                {user.email && <p className="text-xs truncate" style={{ color: "var(--arbor-muted)" }}>{user.email}</p>}
              </div>
              <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
                <LogOut className="w-3.5 h-3.5" /> {t("set.signOut")}
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
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>{icon}</span>
        <div className="min-w-0">
          <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>{title}</p>
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{sub}</p>
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
