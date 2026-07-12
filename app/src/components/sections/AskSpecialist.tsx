import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { buildConsultPacket, serializePacket, countIncluded } from "../../consult/packet";
import { trackShareInitiated, trackShareCompleted } from "../../lib/loopEvents";
import { Modal } from "../ui/Modal";
import { InitialsTile, InsetRow, PASTEL } from "../ui/kit";
import type { PastelKey } from "../ui/kit";
import type { Professional } from "../../services/professionals";
import { ARBOR_PROFESSIONALS } from "../../services/professionals";
import { authHeaders } from "../../lib/api";
import { REPORTS, useReportExport } from "./Reports";
import FindProfessional from "./FindProfessional";

/* Care › Consult — the single "get expert input" flow (b3).
   One spine (a parent-redacted packet from the child's record) and one honest
   action bar with four verbs: Copy / Download / Export as PDF / Send to a
   professional. No HubTabs facets, no hidden handoff door, no triple "share"
   buttons. Safety L3: nothing leaves the device until the parent exports.

   UC-1: two-column reconcile — live redactable packet card (left) +
   verified-pros rail (right). The packet is built from the LIVE child record
   (buildConsultPacket), never a static design array; each section's items
   render as label/value inset rows with a per-item include-toggle. The
   GDPR/COPPA trust row lives INSIDE the summary card in green tokens. */

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
  const [reviewed, setReviewed] = useState(false);

  // Export-as-PDF popover state + a11y refs.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Send-to-a-professional modal. `sendPro` carries the pro chosen from the rail
  // so FindProfessional can open its consult request directly on that pro.
  const [sendOpen, setSendOpen] = useState(false);

  // Verified-pros rail — same live source/fallback as the FindProfessional tab
  // (curated, Arbor-verified). The rail is a preview; the full filterable
  // directory + consult transaction still lives in FindProfessional, which we
  // host in the Send modal so no transaction logic is duplicated here.
  const [pros, setPros] = useState<Professional[]>(ARBOR_PROFESSIONALS);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/professionals", { headers: await authHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (alive && Array.isArray(data.professionals) && data.professionals.length) setPros(data.professionals);
        }
      } catch { /* keep fallback */ }
    })();
    return () => { alive = false; };
  }, []);
  const railPros = useMemo(() => pros.filter((p) => p.verified).slice(0, 3), [pros]);
  // Pro `tone` is a free string from the directory; clamp it to a valid layout-kit
  // pastel so InitialsTile never renders blank on an unexpected value.
  const proTone = (tone: string): PastelKey => (tone in PASTEL ? (tone as PastelKey) : "sky");

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
  const noneSelected = includedCount === 0 || !reviewed;
  const toggle = (id: string) =>
    setExcluded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const markdown = useCallback(() => serializePacket(packet, excluded), [packet, excluded]);

  useEffect(() => { setReviewed(false); }, [excluded, childProfile.id]);

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

  // Right-rail verified-pros card. Tapping "Request consult" opens the Send
  // modal (FindProfessional embedded), prefilled with the selected packet — the
  // existing consult transaction is reused, not re-implemented.
  const ProsRail = (
    <aside className="space-y-3.5">
      <h2 className="text-[15px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("care.pros.title")}</h2>
      <div className="flex flex-col gap-3.5">
        {railPros.map((p) => (
          <div
            key={p.id}
            className="rounded-[18px] p-4 flex items-center gap-3.5"
            style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}
          >
            <InitialsTile name={p.name} tone={proTone(p.tone)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-extrabold truncate" style={{ color: INK }}>{p.name}</span>
                {p.verified && <Icon name="verified" size={16} fill={1} style={{ color: GREEN }} aria-label="Verified by Arbor" />}
              </div>
              <div className="text-[12px] font-bold mt-px" style={{ color: GREEN }}>{p.role}</div>
              <div className="text-[11px] font-semibold mt-0.5 inline-flex items-center gap-1.5" style={{ color: MUTED }}>
                <span>{p.langs?.split(" · ")[0] || p.langs}</span>
                <span aria-hidden="true">·</span>
                <span>{/online|remote/i.test(`${p.mode} ${p.city}`) ? "Online" : p.mode}</span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-0.5" style={{ color: "var(--arbor-yellow-ink)" }}><Icon name="star" size={13} fill={1} /> {p.rating}</span>
              </div>
            </div>
            <button
              onClick={() => setSendOpen(true)}
              className="inline-flex items-center font-extrabold text-[12px] rounded-[11px] px-4 py-2.5 whitespace-nowrap min-h-[44px]"
              style={{ background: "var(--arbor-ink)", color: "#fff", boxShadow: "0 8px 18px -6px rgba(20,34,90,0.5)" }}
            >
              {t("care.request")}
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setActiveTab("find-pro")}
        className="w-full text-center text-[12px] font-bold rounded-[13px] py-2.5 transition hover:brightness-95"
        style={{ background: "var(--arbor-paper-deep)", color: GREEN }}
      >
        {t("sec.findpro.title")}
      </button>
    </aside>
  );

  return (
    <motion.div {...motionProps} className="space-y-5 max-w-[1180px]">
      <header>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
          <Icon name="stethoscope" size={15} /> {t("consult.eyebrow")}
        </span>
        <h1 className="text-[1.6rem] font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
          {t("consult.title")}
        </h1>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
          {t("consult.subtitle", { name: firstName })}
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { icon: "visibility", title: t("consult.contract.review"), body: t("consult.contract.reviewBody") },
          { icon: "tune", title: t("consult.contract.control"), body: t("consult.contract.controlBody") },
          { icon: "verified_user", title: t("consult.contract.share"), body: t("consult.contract.shareBody") },
        ] as const).map((item) => (
          <div key={item.icon} className="rounded-[18px] p-4" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
            <span className="inline-flex items-center gap-2 text-[12px] font-extrabold" style={{ color: GREEN }}>
              <Icon name={item.icon} size={16} /> {item.title}
            </span>
            <p className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: MUTED }}>{item.body}</p>
          </div>
        ))}
      </section>

      {isEmpty ? (
        /* Empty state — new profile with nothing to summarise yet. */
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mx-auto" style={{ background: GREEN_SOFT, color: GREEN }}>
            <Icon name="edit_note" size={26} />
          </span>
          <h2 className="text-[17px] font-extrabold mt-3" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("consult.empty.title")}</h2>
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
          {/* Two-column: live redactable packet (left) + verified-pros rail (right). */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-5 items-start">
            {/* Left: the summary card (the moat read). Section titles mirror the
                child record (incl. the 7 Development-Map domains in the dev
                snapshot); each item is a label/value inset row with an
                include-toggle. The GDPR/COPPA trust row lives inside the card. */}
            <section className="rounded-[22px] p-5" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-sm)" }}>
              <h2 className="text-[15px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: INK }}>{t("care.packet.title")}</h2>
              <p className="text-[12px] font-semibold mt-1.5 leading-relaxed" style={{ color: MUTED }}>{t("care.lead", { name: firstName })}</p>

              <div className="flex flex-col gap-2.5 mt-4">
                {packet.sections.map((section) => (
                  <div key={section.id} className="flex flex-col gap-2">
                    {section.items.map((it) => {
                      const on = !excluded.has(it.id);
                      return (
                        <InsetRow
                          key={it.id}
                          label={section.title}
                          value={it.text}
                          excluded={!on}
                          check={
                            <button
                              onClick={() => toggle(it.id)}
                              aria-pressed={on}
                              aria-label={`Include: ${it.text}`}
                              className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition self-start mt-0.5"
                              style={on ? { background: GREEN, color: "#fff" } : { background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}
                            >
                              {on && <Icon name="check" size={14} weight={600} />}
                            </button>
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Trust row (Safety L3) — the GDPR/COPPA promise, INSIDE the card,
                  green tokens (never the design's blue). */}
              <div className="flex items-start gap-2.5 rounded-[13px] p-3 mt-3.5" style={{ background: GREEN_SOFT }}>
                <Icon name="verified_user" size={19} fill={1} style={{ color: GREEN }} />
                <span className="text-[11.5px] font-semibold leading-relaxed" style={{ color: GREEN }}>{t("care.trust")}</span>
              </div>
            </section>

            {/* Right: verified-pros rail. */}
            {ProsRail}
          </div>

          {/* Export & send bar (sticky) — the single transactional control. */}
          <div className="sticky bottom-2 rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-md)" }}>
            <span className="text-[13px] font-bold me-auto" style={{ color: MUTED }} aria-live="polite">
              {t("consult.selected", { n: includedCount })}
            </span>
            <label className="flex items-start gap-2 min-w-[220px] text-[11.5px] font-bold leading-snug" style={{ color: MUTED }}>
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0"
              />
              <span>{t("consult.reviewed")}</span>
            </label>
            <button onClick={copy} disabled={noneSelected}
              className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
              style={{ background: GREEN_SOFT, color: GREEN }}>
              <Icon name="content_copy" size={17} /> {t("consult.copy")}
            </button>
            <button onClick={download} disabled={noneSelected}
              className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-3 transition disabled:opacity-50 min-h-[44px]"
              style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}>
              <Icon name="download" size={18} /> {t("consult.download")}
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
                <Icon name="description" size={17} /> {t("consult.exportPdf")} <Icon name="expand_more" size={15} />
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
              <Icon name="send" size={17} /> {t("consult.send")}
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
