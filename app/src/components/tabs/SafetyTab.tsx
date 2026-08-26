import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { Skeleton } from "../ui/Skeleton";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { track } from "../../lib/analytics";
import { fmtDay } from "../../lib/formatDate";
import {
  FIND_A_HELPLINE_URL,
  HELPLINE_DIRECTORY,
  type HelplineRegion,
} from "../../safety/escalation";
import { PageHeader, SectionCard, cardCls, PASTEL, PastelKey } from "../ui/kit";

type Contact = { id: string; name: string; role: string; phone: string; notes: string };

/** Warning-sign checklist rows — i18n key suffixes (elev.safety.sign.N); the
 *  numeric index doubles as the persisted-checkbox key, matching the legacy
 *  localStorage shape. */
const WARNING_SIGN_KEYS = [1, 2, 3, 4, 5, 6] as const;

/** Render order for the helpline directory groups. */
const HELPLINE_GROUPS: readonly HelplineRegion[] = ["il", "eu", "nl", "be", "us"];

/** Reduce a free-typed phone to a dialable tel: target (digits and + only). */
const dialable = (phone: string) => phone.replace(/[^\d+]/g, "");

const inputCls = "rounded-lg px-3 py-2 text-sm focus:outline-none";
const inputStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" };

export default function SafetyTab() {
  const { childProfile, approvedMemoryItems, handleMemoryDecision, isMemoryUpdating } = useArbor();
  const { t, uiLang } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  const reviewedKey = useMemo(() => `arbor.safetyReviewed.${childProfile.id}`, [childProfile.id]);
  const checklistKey = useMemo(() => `arbor.safetyChecklist.${childProfile.id}`, [childProfile.id]);

  // Saved contacts persist to Firestore (per child); checklist + last-reviewed
  // are lightweight device-local notes.
  const contactsCol = useChildCollection<Contact>(childProfile.id, "contacts");
  const contacts = contactsCol.items;
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [lastReviewed, setLastReviewed] = useState<string | null>(null);
  const [form, setForm] = useState<Contact>({ id: "", name: "", role: "", phone: "", notes: "" });

  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem(checklistKey) || "{}"));
      setLastReviewed(localStorage.getItem(reviewedKey));
    } catch {
      setChecked({});
    }
  }, [reviewedKey, checklistKey]);

  const toggleSign = (i: number) => {
    const next = { ...checked, [i]: !checked[i] };
    setChecked(next);
    try { localStorage.setItem(checklistKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const addContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    void contactsCol.upsert({ ...form, id: `c-${Date.now()}` });
    setForm({ id: "", name: "", role: "", phone: "", notes: "" });
  };

  const markReviewed = () => {
    const now = new Date().toISOString();
    setLastReviewed(now);
    try { localStorage.setItem(reviewedKey, now); } catch { /* ignore */ }
  };

  const reviewStale = !lastReviewed || Date.now() - new Date(lastReviewed).getTime() > 30 * 86_400_000;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        title={t("elev.safety.header.title")}
        subtitle={t("elev.safety.header.sub")}
      />

      {/* Pinned crisis-language card */}
      <div className="rounded-2xl p-6 space-y-2" style={{ background: "var(--arbor-pink-soft)" }}>
        <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-pink-ink)" }}>
          <Icon name="warning" size={16} /> {t("elev.safety.crisis.kicker")}
        </span>
        <p className="text-sm leading-relaxed italic" style={{ color: "var(--arbor-ink)" }}>
          {t("elev.safety.crisis.script")}
        </p>
        <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.safety.crisis.danger")}</p>
      </div>

      {/* Crisis helplines — real numbers, one tap to call */}
      <SectionCard title={t("elev.safety.helplines.title")} icon={<Icon name="call" size={20} />} tone="pink">
        <p className="text-xs mb-4" style={{ color: "var(--arbor-muted)" }}>{t("elev.safety.helplines.sub")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-5">
          {HELPLINE_GROUPS.map((region) => (
            <div key={region}>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider mb-2" style={{ color: "var(--arbor-muted)" }}>
                {t(`elev.safety.helplines.group.${region}`)}
              </h3>
              <div className="space-y-2">
                {HELPLINE_DIRECTORY.filter((h) => h.region === region).map((h) => (
                  <a
                    key={h.id}
                    href={`tel:${h.tel}`}
                    onClick={() => track("safety_helpline_tel_tap", { code: h.tel })}
                    className={`${cardCls} flex items-center gap-3 px-3.5 py-2 min-h-[44px] text-xs font-bold transition hover:shadow-[var(--shadow-xs)]`}
                    style={{ color: "var(--arbor-ink)" }}
                  >
                    <span className="flex-1 min-w-0">{t(`elev.safety.helpline.${h.id}`)}</span>
                    <span dir="ltr" className="text-sm font-extrabold whitespace-nowrap" style={{ color: "var(--arbor-pink-ink)" }}>{h.number}</span>
                    <Icon name="call" size={16} style={{ color: "var(--arbor-pink-ink)" }} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <a
          href={FIND_A_HELPLINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 min-h-[44px] mt-2 text-xs font-bold"
          style={{ color: "var(--arbor-sky-ink)" }}
        >
          <Icon name="public" size={15} /> {t("elev.safety.helplines.findLocal")}
        </a>
      </SectionCard>

      {/* Warning-sign checklist + review cadence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title={t("elev.safety.checklist.title")} icon={<Icon name="warning" size={20} />} tone="coral">
          <div className="space-y-2">
            {WARNING_SIGN_KEYS.map((n, i) => (
              <label key={n} className={`${cardCls} flex items-start gap-3 p-2.5 transition cursor-pointer text-xs`}>
                <input type="checkbox" checked={!!checked[i]} onChange={() => toggleSign(i)} className="mt-0.5" style={{ accentColor: "var(--arbor-pink-ink)" }} />
                <span style={{ color: checked[i] ? "var(--arbor-pink-ink)" : "var(--arbor-ink)", fontWeight: checked[i] ? 700 : 400 }}>{t(`elev.safety.sign.${n}`)}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--arbor-muted)" }}>{t("elev.safety.checklist.note")}</p>
        </SectionCard>

        <SectionCard title={t("elev.safety.review.title")} icon={<Icon name="event_available" size={20} />} tone="sky"
          action={
            <button onClick={markReviewed} className="font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>{t("elev.safety.review.mark")}</button>
          }
        >
          <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.safety.review.last")} <strong>{lastReviewed ? fmtDay(lastReviewed, uiLang) : t("elev.safety.review.never")}</strong>
          </p>
          {reviewStale && (
            <div className="text-xs rounded-xl px-3 py-2 mt-3" style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)" }}>
              {t("elev.safety.review.stale")}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Saved contacts (per-child, Firestore) */}
      <SectionCard title={t("elev.safety.contacts.title")} icon={<Icon name="call" size={20} />} tone="mint">
        {!contactsCol.loaded ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : contacts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {contacts.map((c) => (
              <div key={c.id} className={`${cardCls} p-3 flex items-start justify-between gap-2`}>
                <div className="text-xs">
                  <strong className="block" style={{ color: "var(--arbor-ink)" }}>{c.name}</strong>
                  <span style={{ color: "var(--arbor-muted)" }}>{c.role}</span>
                  {c.phone && (
                    <a
                      href={`tel:${dialable(c.phone)}`}
                      onClick={() => track("safety_contact_tel_tap")}
                      className="flex items-center gap-1.5 min-h-[44px] font-extrabold"
                      style={{ color: "var(--arbor-green-ink)" }}
                    >
                      <Icon name="call" size={14} /> <span dir="ltr">{c.phone}</span>
                    </a>
                  )}
                  {c.notes && <p className="text-[10px] mt-1" style={{ color: "var(--arbor-muted)" }}>{c.notes}</p>}
                </div>
                <button onClick={() => void contactsCol.remove(c.id)} className="transition" style={{ color: "var(--arbor-muted)" }} aria-label={t("aria.removeContact")}>
                  <Icon name="delete" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addContact} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("elev.safety.contacts.name")} className={inputCls} style={inputStyle} />
          <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder={t("elev.safety.contacts.role")} className={inputCls} style={inputStyle} />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t("elev.safety.contacts.phone")} className={inputCls} style={inputStyle} />
          <div className="flex gap-2">
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("elev.safety.contacts.notes")} className={`flex-1 ${inputCls}`} style={inputStyle} />
            <button type="submit" aria-label={t("aria.addContact")} className="text-white font-extrabold px-3 rounded-lg flex items-center" style={{ background: "var(--arbor-clay)" }}><Icon name="add" size={16} /></button>
          </div>
        </form>
      </SectionCard>

      {/* Approved memory */}
      <SectionCard title={t("elev.safety.memory.title", { name: first })} icon={<Icon name="neurology" size={20} />} tone="lav">
        <p className="text-xs mb-3" style={{ color: "var(--arbor-muted)" }}>{t("elev.safety.memory.sub")}</p>
        {approvedMemoryItems.length === 0 ? (
          <p className={`${cardCls} text-xs p-3`} style={{ color: "var(--arbor-muted)" }}>{t("elev.safety.memory.empty")}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {approvedMemoryItems.map((item) => (
              <div key={item.memoryId} className={`${cardCls} p-3 flex items-start justify-between gap-2`}>
                <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{item.fact}</p>
                <button
                  onClick={() => handleMemoryDecision(item.memoryId, "deleted")}
                  disabled={isMemoryUpdating === item.memoryId}
                  className="text-[10px] font-bold flex-shrink-0 disabled:opacity-50"
                  style={{ color: "var(--arbor-pink-ink)" }}
                >
                  {t("elev.safety.memory.forget")}
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Static safeguards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {[
          { icon: <Icon name="stethoscope" size={20} />, tone: "yellow" as PastelKey, key: "medical" },
          { icon: <Icon name="lock" size={20} />, tone: "sky" as PastelKey, key: "gdpr" },
          { icon: <Icon name="group" size={20} />, tone: "mint" as PastelKey, key: "handoff" },
        ].map((s) => (
          <div key={s.key} className={`${cardCls} p-5 space-y-3`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: PASTEL[s.tone].soft, color: PASTEL[s.tone].ink }}>{s.icon}</div>
            <h3 className="font-extrabold text-sm" style={{ color: "var(--arbor-ink)" }}>{t(`elev.safety.guard.${s.key}.title`)}</h3>
            <p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t(`elev.safety.guard.${s.key}.body`)}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
