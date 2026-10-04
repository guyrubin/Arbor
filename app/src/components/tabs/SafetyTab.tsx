import React, { useEffect, useMemo, useRef, useState } from "react";
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
  HELPLINE_EXPANDED_GROUPS,
  helplineOrderFor,
  dangerLineFor,
  HELPLINES_REVIEWED_ON,
  type HelplineRegion,
} from "../../safety/escalation";
import { loadAttribution } from "../../lib/attribution";
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

// R13: every contact field measured 308x38 at 390. The floor belongs on the
// SHARED recipe, not on four call sites, so a fifth field cannot miss it.
const inputCls = "rounded-lg px-3 py-2 min-h-11 text-sm focus:outline-none";
const inputStyle: React.CSSProperties = { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" };

export default function SafetyTab() {
  const { childProfile, requestConsultPrefill, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();

  // LC-14: the family's market decides which helplines come first. The
  // attribution market (il / nl / be) is the strongest signal; otherwise the
  // UI language ("he" → il, else EU-first). Groups outside the rendered set
  // are dropped defensively; the first group's primary number becomes the
  // full-width call button above the crisis card.
  const helplineOrder = useMemo(() => {
    let market: string | null = null;
    try { market = loadAttribution()?.market ?? null; } catch { market = null; }
    const hint = market && ["il", "nl", "be"].includes(market) ? market : uiLang;
    return helplineOrderFor(hint).filter((r) => HELPLINE_GROUPS.includes(r));
  }, [uiLang]);
  const primaryHelpline = HELPLINE_DIRECTORY.find((h) => h.region === helplineOrder[0]) ?? HELPLINE_DIRECTORY[0];
  // W2-CAREPRO r1: the crisis card's second call (emergency ↔ emotional line).
  const dangerLine = dangerLineFor(helplineOrder, primaryHelpline);
  // W2-CAREPRO r2: "Find the line for your country" opens the disclosure at
  // the helpline groups (no foreign number is ever offered in its place).
  const moreRef = useRef<HTMLDetailsElement>(null);
  const openHelplines = () => {
    const el = moreRef.current;
    if (!el) return;
    el.open = true;
    el.scrollIntoView?.({ block: "start", behavior: "smooth" });
  };
  // B-CAREPRO-NEW-1n: the crisis card names the child; the family's own first
  // contact sits under the one tap (only when the parent saved one with a phone).
  const crisisFirstName = (childProfile.name || "").trim().split(" ")[0];
  const expandedGroups = helplineOrder.slice(0, HELPLINE_EXPANDED_GROUPS);
  const foldedGroups = helplineOrder.slice(HELPLINE_EXPANDED_GROUPS);

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

  const anySignTicked = WARNING_SIGN_KEYS.some((_, i) => !!checked[i]);

  // B-CAREPRO-03 + B-CAREPRO-13: "Prepare a conversation" hands the ticked
  // signs to Consult as the REASON for the visit (editable there; nothing
  // leaves without the reviewed gate).
  const prepareConversation = () => {
    const labels = WARNING_SIGN_KEYS.filter((_, i) => !!checked[i]).map((n) => t(`elev.safety.sign.${n}`)).join("; ");
    requestConsultPrefill({ reason: t("elev.safety.signs.consultReason", { labels }) });
    setActiveTab("consult");
  };

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

  // B-CAREPRO-14: the "it's been a while" nudge is for a review that went
  // stale, never for a parent who has not reviewed yet — first visit reads
  // neutrally ("Not reviewed yet").
  const reviewStale = !!lastReviewed && Date.now() - new Date(lastReviewed).getTime() > 30 * 86_400_000;

  /** One helpline group: heading + every directory entry as a tel: link. */
  const renderHelplineGroup = (region: HelplineRegion) => (
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
  );

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        title={t("elev.safety.header.title")}
        subtitle={t("elev.safety.header.sub")}
      />

      {/* LC-14: ONE tap reaches a human — the family-market primary number as a
          full-width call button, above everything else on the screen. */}
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
      {/* W2-CAREPRO r2: at lg the fold is two columns — the one-tap call (a
          taller block) + the family's first call on the start side, the crisis
          card at its 60ch measure on the end side; the disclosure spans both
          below. Below lg it is the same single column as before. */}
      <div data-testid="safety-fold" className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div className="flex flex-col gap-3">
      <a
        data-module="safety-one-tap"
        data-primary-move="call-helpline"
        href={`tel:${primaryHelpline.tel}`}
        onClick={() => track("safety_helpline_tel_tap", { code: primaryHelpline.tel, primary: true })}
        // W2-CAREPRO r1: a start-aligned two-line stack — "Call {n}" never
        // wraps, and the line that says WHO answers wraps instead of being
        // truncated (it was cut to "Emergency services (EU-wide; also f…" at
        // 375). The fill is the page's one CTA gradient (pink-ink is a text
        // ink, not a fill); no opacity hierarchy (CR-01).
        className="w-full flex items-start gap-3 rounded-2xl min-h-[56px] lg:min-h-[120px] px-5 py-3 lg:py-5 text-start transition hover:brightness-105"
        style={{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)", boxShadow: "var(--shadow-md)" }}
      >
        <Icon name="call" size={22} fill={1} className="mt-0.5 flex-shrink-0" />
        <span className="min-w-0 flex flex-col">
          <span className="t-lg lg:t-xl font-extrabold whitespace-nowrap">{t("elev.carehonesty.safety.callPrimary", { number: primaryHelpline.number })}</span>
          <span className="t-sm font-bold">{t(`elev.safety.helpline.${primaryHelpline.id}`)}</span>
        </span>
      </a>
      {contacts[0]?.phone && dialable(contacts[0].phone) && (
        <a
          data-testid="safety-first-contact"
          href={`tel:${dialable(contacts[0].phone)}`}
          onClick={() => track("safety_contact_tel_tap")}
          className="flex items-center gap-2 rounded-xl px-4 min-h-[44px] t-sm font-bold"
          style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="person" size={16} /> {t("elev.safety.firstContact", { name: crisisFirstName || t("elev.safety.yourChild"), contact: contacts[0].name })}
          <bdi className="ms-auto" dir="ltr">{contacts[0].phone}</bdi>
        </a>
      )}

      </div>

      {/* Pinned crisis-language card */}
      <div data-module="safety-crisis-language" className="rounded-2xl p-6 space-y-2" style={{ background: "var(--arbor-pink-soft)" }}>
        <span className={`text-xs font-extrabold flex items-center gap-1.5 ${uiLang === "he" ? "" : "uppercase tracking-wider"}`} style={{ color: "var(--arbor-pink-ink)" }}>
          <Icon name="warning" size={16} /> <span>{crisisFirstName ? t("elev.safety.crisis.kickerNamed", { name: `⁨${crisisFirstName}⁩` }) : t("elev.safety.crisis.kicker")}</span>
        </span>
        {/* B-CAREPRO-NEW-1n: the script names the child (kicker) and reads as
            something to say, in the editorial face, at a readable measure. */}
        {/* W2-CAREPRO r2: Hebrew has no italic convention and the editorial
            face has no Hebrew glyphs (the browser faked an oblique) — HE reads
            upright in the display face; EN keeps the editorial italic. */}
        <p
          data-testid="safety-crisis-script"
          className={`t-base leading-relaxed max-w-[60ch] ${uiLang === "he" ? "" : "italic"}`}
          style={{ color: "var(--arbor-ink)", fontFamily: uiLang === "he" ? "var(--font-display)" : "var(--font-editorial)" }}
        >
          {t("elev.safety.crisis.script")}
        </p>
        {/* W2-CAREPRO r1: the danger sentence is itself a 44 px call — to the
            market's emergency number when the one tap dials an emotional line
            (HE: ער״ן), or naming the emotional line when the one tap already
            is the emergency number (EN: 112). No second stamp, no new module. */}
        {dangerLine?.kind === "emergency" ? (
          <a
            data-testid="safety-danger-call"
            href={`tel:${dangerLine.entry.tel}`}
            onClick={() => track("safety_helpline_tel_tap", { code: dangerLine.entry.tel, primary: false })}
            className="inline-flex items-center gap-2 min-h-[44px] t-sm font-bold underline underline-offset-2"
            style={{ color: "var(--arbor-ink)" }}
          >
            <Icon name="call" size={16} /> {t("elev.safety.crisis.dangerCall", { number: dangerLine.entry.number, name: t(`elev.safety.helpline.${dangerLine.entry.id}`) })}
          </a>
        ) : (
          <>
            <p className="t-xs" style={{ color: "var(--arbor-muted)" }}>{t("elev.safety.crisis.danger")}</p>
            {dangerLine?.kind === "find" && (
              <button
                type="button"
                data-testid="safety-find-line"
                onClick={openHelplines}
                className="inline-flex items-center gap-2 min-h-[44px] t-sm font-bold underline underline-offset-2 text-start"
                style={{ color: "var(--arbor-ink)" }}
              >
                <Icon name="public" size={16} /> {t("elev.safety.crisis.findLine")}
              </button>
            )}
            {dangerLine?.kind === "talk" && (
              <a
                data-testid="safety-danger-call"
                href={`tel:${dangerLine.entry.tel}`}
                onClick={() => track("safety_helpline_tel_tap", { code: dangerLine.entry.tel, primary: false })}
                className="inline-flex items-center gap-2 min-h-[44px] t-sm font-bold underline underline-offset-2"
                style={{ color: "var(--arbor-ink)" }}
              >
                <Icon name="call" size={16} /> {t("elev.safety.crisis.talkLine", { number: dangerLine.entry.number, name: t(`elev.safety.helpline.${dangerLine.entry.id}`) })}
              </a>
            )}
          </>
        )}
        {/* B-CAREPRO-NEW-1m: the B-07 review date, visible — trust the parent can see. */}
        <p data-testid="safety-numbers-checked" className="t-xs" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.safety.numbersChecked", { date: fmtDay(HELPLINES_REVIEWED_ON, uiLang) })}
        </p>
      </div>

      </div>

      {/* R25 (item 11) — #/safety rendered 7 top-level modules against a declared
          moduleBudget of 2. The tail below is DEMOTED, never removed: one
          collapsed disclosure on the pattern components/practice/SpeechCoachTab.tsx
          `speech-more` already ships, so every capability keeps its door (law 6)
          while the fold belongs to the primary move. Demoted modules keep their
          own `data-module` stamp and add `data-module-demoted`, which is what
          makes the budget rule countable: top-level = stamps minus demoted. */}
      <details ref={moreRef} id="safety-more" data-module-disclosure="safety-more" className={`${cardCls} p-0 overflow-hidden`}>
        <summary className="cursor-pointer list-none px-6 py-4 min-h-[44px] flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
            <Icon name="call" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.safety.more.title")}</span>
            <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.safety.more.sub")}</span>
          </span>
          <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
        </summary>
        <div className="px-4 pb-4 space-y-4">
      {/* Crisis helplines — real numbers, one tap to call. LC-14: market group
          first, EU second; the remaining regions fold under "Other countries". */}
      <div data-module="safety-helplines" data-module-demoted style={{ display: "contents" }}>
      <SectionCard title={t("elev.safety.helplines.title")} icon={<Icon name="call" size={20} />} tone="pink">
        <p className="text-xs mb-4" style={{ color: "var(--arbor-muted)" }}>{t("elev.safety.helplines.sub")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
          {expandedGroups.map((region) => renderHelplineGroup(region))}
        </div>
        {foldedGroups.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 min-h-[44px] text-xs font-extrabold" style={{ color: "var(--arbor-muted)" }}>
              <Icon name="expand_more" size={16} /> {t("elev.carehonesty.safety.otherCountries")}
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-5 mt-3">
              {foldedGroups.map((region) => renderHelplineGroup(region))}
            </div>
          </details>
        )}
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
      </div>

      {/* Warning-sign checklist + review cadence */}
      <div data-module="safety-checklist" data-module-demoted className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title={t("elev.safety.checklist.title")} icon={<Icon name="warning" size={20} />} tone="coral">
          <div className="space-y-2">
            {WARNING_SIGN_KEYS.map((n, i) => (
              <label key={n} data-touch-shell="checklist-row" className={`${cardCls} flex items-start gap-3 p-2.5 min-h-11 transition cursor-pointer text-xs`}>
                {/* B-CAREPRO-03 (law 1): a ticked sign goes bold in ink — never a
                    colour change on a row about the child. */}
                <input type="checkbox" checked={!!checked[i]} onChange={() => toggleSign(i)} className="mt-0.5 w-5 h-5 flex-shrink-0" style={{ accentColor: "var(--arbor-ink)" }} />
                <span style={{ color: "var(--arbor-ink)", fontWeight: checked[i] ? 700 : 400 }}>{t(`elev.safety.sign.${n}`)}</span>
              </label>
            ))}
          </div>
          {/* B-CAREPRO-03: a ticked warning sign gets a door, directly under the
              checklist — the page's primary helpline (same number and markup
              family as the one-tap call above). */}
          {anySignTicked && (
            <a
              data-testid="safety-sign-call-row"
              href={`tel:${primaryHelpline.tel}`}
              onClick={() => track("safety_helpline_tel_tap", { code: primaryHelpline.tel, from: "warning_sign" })}
              className={`${cardCls} flex items-center gap-3 px-3.5 py-2 mt-3 min-h-[44px] text-xs font-bold transition hover:shadow-[var(--shadow-xs)]`}
              style={{ color: "var(--arbor-ink)" }}
            >
              <Icon name="call" size={16} fill={1} style={{ color: "var(--arbor-pink-ink)" }} />
              <span className="flex-1 min-w-0">{t("elev.safety.signs.callRow")}</span>
              <span dir="ltr" className="text-sm font-extrabold whitespace-nowrap" style={{ color: "var(--arbor-pink-ink)" }}>{primaryHelpline.number}</span>
            </a>
          )}
          {anySignTicked && (
            <button
              type="button"
              data-testid="safety-sign-prepare"
              onClick={prepareConversation}
              className={`${cardCls} w-full flex items-center gap-3 px-3.5 py-2 mt-2 min-h-[44px] text-xs font-bold text-start transition hover:shadow-[var(--shadow-xs)]`}
              style={{ color: "var(--arbor-green-ink)" }}
            >
              <Icon name="forum" size={16} />
              <span className="flex-1 min-w-0">{t("elev.safety.signs.prepare")}</span>
              <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
            </button>
          )}
          <p className="text-[11px] mt-3" style={{ color: "var(--arbor-muted)" }}>{t("elev.safety.checklist.note")}</p>
        </SectionCard>

        <SectionCard title={t("elev.safety.review.title")} icon={<Icon name="event_available" size={20} />} tone="sky"
          action={
            <button onClick={markReviewed} className="inline-flex items-center font-extrabold text-[11px] px-3 min-h-11 rounded-lg transition" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>{t("elev.safety.review.mark")}</button>
          }
        >
          <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.safety.review.last")} <strong>{lastReviewed ? fmtDay(lastReviewed, uiLang) : t("elev.safety.review.notYet")}</strong>
          </p>
          {reviewStale && (
            <div className="text-xs rounded-xl px-3 py-2 mt-3" style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)" }}>
              {t("elev.safety.review.stale")}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Saved contacts (per-child, Firestore) */}
      <div data-module="safety-contacts" data-module-demoted style={{ display: "contents" }}>
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
                <button onClick={() => void contactsCol.remove(c.id)} className="touch-target flex-shrink-0 transition" style={{ color: "var(--arbor-muted)" }} aria-label={t("aria.removeContact")}>
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
            <button type="submit" aria-label={t("aria.addContact")} className="touch-target text-white font-extrabold px-3 rounded-lg" style={{ background: "var(--arbor-clay)" }}><Icon name="add" size={16} /></button>
          </div>
        </form>
      </SectionCard>
      </div>

      {/* B-CAREPRO-14: the memory ledger has one home (Child Memory, Profile
          hub). Safety keeps a door to it, not a second list with its own
          unconfirmed Forget. */}
      <button
        type="button"
        data-testid="safety-memory-link"
        onClick={() => setActiveTab("memory")}
        className={`${cardCls} w-full flex items-center gap-3 px-4 py-2 min-h-[44px] text-sm font-bold text-start transition hover:shadow-[var(--shadow-xs)]`}
        style={{ color: "var(--arbor-ink)" }}
      >
        <Icon name="neurology" size={18} style={{ color: "var(--arbor-muted)" }} />
        <span className="flex-1 min-w-0">{t("elev.safety.memory.link")}</span>
        <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
      </button>

      {/* Static safeguards */}
      <div data-module="safety-safeguards" data-module-demoted className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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
        </div>
      </details>
    </motion.div>
  );
}
