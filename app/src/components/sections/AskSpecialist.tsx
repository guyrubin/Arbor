import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import { Stethoscope, ShieldCheck, Copy, Download, Send, Check, FileText, ChevronDown, NotebookPen } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { buildConsultPacket, serializePacket, countIncluded } from "../../consult/packet";
import { trackShareInitiated, trackShareCompleted } from "../../lib/loopEvents";
import { Modal } from "../ui/Modal";
import { REPORTS, useReportExport } from "./Reports";
import FindProfessional from "./FindProfessional";

/* Care › Consult — the single "get expert input" flow (b3).
   One spine (a parent-redacted packet from the child's record) and one honest
   action bar with four verbs: Copy / Download / Export as PDF / Send to a
   professional. No HubTabs facets, no hidden handoff door, no triple "share"
   buttons. Safety L3: nothing leaves the device until the parent exports. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

export default function AskSpecialist() {
  const { childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems, setActiveTab } = useArbor();
  const { toast } = useToast();
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const exportReport = useReportExport();
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Export-as-PDF popover state + a11y refs.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Send-to-a-professional modal.
  const [sendOpen, setSendOpen] = useState(false);

  const packet = useMemo(
    () => buildConsultPacket({
      profile: {
        name: childProfile.name, age: childProfile.age, languages: childProfile.languages,
        schoolContext: childProfile.schoolContext, strengths: childProfile.strengths, challenges: childProfile.challenges,
      },
      logs: behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, intensity: l.intensity, timestamp: l.timestamp, resolved: l.resolved })),
      milestones: milestones.map((m) => ({ domain: m.domain, title: m.title, checked: m.checked })),
      plans: actionPlans.map((p) => ({ title: p.title, issue: p.issue })),
      memory: approvedMemoryItems.map((m) => ({ fact: m.fact, status: m.status })),
      nowMs: Date.now(),
    }),
    [childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems]
  );

  const isEmpty = packet.sections.length === 0;
  const includedCount = countIncluded(packet, excluded);
  const noneSelected = includedCount === 0;
  const toggle = (id: string) =>
    setExcluded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const markdown = useCallback(() => serializePacket(packet, excluded), [packet, excluded]);

  const copy = async () => {
    // Growth loop (P0-4): the consult packet is a `story` artifact shared to a
    // professional — reuse the existing union value, don't mint a new one here.
    trackShareInitiated("story", "ask_specialist");
    try {
      await navigator.clipboard.writeText(markdown());
      trackShareCompleted("story", "clipboard");
      toast("Packet copied. Paste it to your professional.", "success");
    }
    catch { toast("Could not copy. Try Download instead.", "error"); }
  };
  const download = () => {
    const blob = new Blob([markdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${firstName}-arbor-handoff-${packet.generatedAt}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Downloaded. Bring it to your appointment.", "success");
  };

  const runExport = (type: typeof REPORTS[number]["type"]) => {
    setMenuOpen(false);
    menuTriggerRef.current?.focus();
    toast(t("consult.opening"), "info");
    try { exportReport(type); }
    catch { toast(t("consult.exportError"), "error"); }
  };

  // Popover: outside-click closes; Esc/arrow handled per-item below.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (menuTriggerRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    // Focus the first menu item when opened.
    const id = window.setTimeout(() => itemRefs.current[0]?.focus(), 0);
    return () => { document.removeEventListener("mousedown", onDoc); window.clearTimeout(id); };
  }, [menuOpen]);

  const onMenuKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Escape") { e.preventDefault(); setMenuOpen(false); menuTriggerRef.current?.focus(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); itemRefs.current[(idx + 1) % REPORTS.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); itemRefs.current[(idx - 1 + REPORTS.length) % REPORTS.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); itemRefs.current[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); itemRefs.current[REPORTS.length - 1]?.focus(); }
  };

  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2 } };

  return (
    <motion.div {...motionProps} className="space-y-5 max-w-[760px]">
      <header>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
          <Stethoscope className="w-3.5 h-3.5" /> {t("consult.eyebrow")}
        </span>
        <h1 className="text-[1.6rem] font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
          {t("consult.title")}
        </h1>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
          {t("consult.subtitle", { name: firstName })}
        </p>
      </header>

      {/* Trust line (Safety L3) — the GDPR/COPPA promise, kept above the fold. */}
      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: GREEN_SOFT }}>
        <ShieldCheck className="w-5 h-5 flex-shrink-0" style={{ color: GREEN }} />
        <p className="text-[13px] leading-relaxed" style={{ color: GREEN }}>
          {t("consult.trust")}
        </p>
      </div>

      {isEmpty ? (
        /* Empty state — new profile with nothing to summarise yet. */
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mx-auto" style={{ background: GREEN_SOFT, color: GREEN }}>
            <NotebookPen className="w-6 h-6" />
          </span>
          <h2 className="text-[17px] font-extrabold mt-3" style={{ color: INK }}>{t("consult.empty.title")}</h2>
          <p className="text-sm mt-1.5 leading-relaxed max-w-[420px] mx-auto" style={{ color: MUTED }}>{t("consult.empty.body")}</p>
          <button
            onClick={() => setActiveTab("behaviors")}
            className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-5 py-3 mt-4"
            style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
          >
            {t("consult.empty.cta")}
          </button>
        </div>
      ) : (
        <>
          {/* Redactable packet sections (the moat read). */}
          <div className="space-y-3">
            {packet.sections.map((section) => (
              <section key={section.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
                <div className="px-5 pt-4 pb-2">
                  <h2 className="text-[15px] font-extrabold" style={{ color: INK }}>{section.title}</h2>
                  {section.note && <p className="text-[12px] mt-0.5" style={{ color: "var(--arbor-faint)" }}>{section.note}</p>}
                </div>
                <ul className="px-5 pb-3">
                  {section.items.map((it) => {
                    const on = !excluded.has(it.id);
                    return (
                      <li key={it.id}>
                        <button
                          onClick={() => toggle(it.id)}
                          aria-pressed={on}
                          aria-label={`Include: ${it.text}`}
                          className="w-full flex items-start gap-3 py-2 text-start transition"
                        >
                          <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-md flex items-center justify-center transition"
                            style={on ? { background: "var(--arbor-clay)", color: "#fff" } : { background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}>
                            {on && <Check className="w-3.5 h-3.5" />}
                          </span>
                          <span className="text-[14px] leading-relaxed" style={{ color: on ? INK : "var(--arbor-faint)", textDecoration: on ? "none" : "line-through" }}>
                            {it.text}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {/* Export & send bar (sticky) — the single transactional control. */}
          <div className="sticky bottom-2 rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-md)" }}>
            <span className="text-[13px] font-bold me-auto" style={{ color: MUTED }} aria-live="polite">
              {t("consult.selected", { n: includedCount })}
            </span>
            <button onClick={copy} disabled={noneSelected}
              className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
              style={{ background: GREEN_SOFT, color: GREEN }}>
              <Copy className="w-4 h-4" /> {t("consult.copy")}
            </button>
            <button onClick={download} disabled={noneSelected}
              className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
              style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}>
              <Download className="w-4 h-4" /> {t("consult.download")}
            </button>

            {/* Export as PDF ▾ — menu replacing the standalone Reports grid. */}
            <div className="relative">
              <button
                ref={menuTriggerRef}
                onClick={() => setMenuOpen((o) => !o)}
                disabled={noneSelected}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
                style={{ background: "var(--arbor-paper-sunk)", color: INK, border: `1px solid ${RULE}` }}>
                <FileText className="w-4 h-4" /> {t("consult.exportPdf")} <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    ref={menuRef}
                    role="menu"
                    aria-label={t("consult.exportPdf")}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                    transition={{ duration: reduceMotion ? 0 : 0.15 }}
                    className="absolute bottom-full mb-2 w-[260px] rounded-2xl overflow-hidden p-1.5 z-20 end-0"
                    style={{ transformOrigin: "bottom", background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-md)" }}>
                    {REPORTS.map((r, idx) => (
                      <button
                        key={r.type}
                        ref={(el) => { itemRefs.current[idx] = el; }}
                        role="menuitem"
                        onClick={() => runExport(r.type)}
                        onKeyDown={(e) => onMenuKey(e, idx)}
                        className="w-full text-start rounded-xl px-3 py-2.5 text-[13px] font-semibold transition hover:brightness-95 min-h-[44px] flex items-center"
                        style={{ color: INK }}>
                        {r.title}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Send to a professional — the real directory + consult request,
                prefilled from the selected packet. Replaces the dead "soon" stub. */}
            <button
              onClick={() => setSendOpen(true)}
              disabled={noneSelected}
              className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
              style={{ background: "var(--arbor-paper-sunk)", color: GREEN, border: "1px solid rgba(52,178,119,0.30)" }}>
              <Send className="w-4 h-4" /> {t("consult.send")}
            </button>
          </div>
        </>
      )}

      {/* Send modal — hosts the verified directory + consult-request flow with the
          selected packet handed in as the prefilled note. */}
      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title={t("consult.send")} maxWidth="max-w-3xl">
        <FindProfessional embedded incomingNote={markdown()} />
      </Modal>
    </motion.div>
  );
}
