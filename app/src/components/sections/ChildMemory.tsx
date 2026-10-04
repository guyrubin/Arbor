import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import type { MemoryReviewItem } from "../../types";
import { PageHeader, SectionCard, Chip, cardCls } from "../ui/kit";
import { ErrorState } from "../ui/ErrorState";
import { learnCardById } from "../../learn/learnCards";
import { learnCategoryById, type LearnCard } from "../../learn/learnLibrary";
import { fmtDay } from "../../lib/formatDate";
import { PASTEL } from "../../lib/tokens";
// GP-13 — the flagship trust mechanic let a parent DELETE but not CORRECT
// ("she is 3" → "she is 4"), and coloured the safest property the ledger has
// (it forgets on its own) in the delete tone with no date attached.
import { authHeaders } from "../../lib/api";
import {
  RETENTION_CHOICES,
  forgetsOnIso,
  isPermanentRetention,
  nearestRetentionChoice,
} from "../../lib/memoryExpiry";
// The same scanner the share egress fails closed on, run here so the parent who
// writes the word hears about it instead of a co-parent hitting a blank wall.
import { findClinicalDiagnosisTerm } from "../../lib/clinicalScan";
// B-CAREPRO-06: memory text renders through the same plain-words scrub the
// Story queue uses (server/parentWordsScrub is client-safe and pure).
import { scrubMemoryProposals, toParentWords } from "../../server/parentWordsScrub";
// GP-22 — the memory queue is a why-line surface too: every pending row is a
// claim about the child, and nothing said where it came from.
import { ContentWhyLine } from "../ui/ContentActionBar";
import ArborKnowsTile from "./ArborKnowsTile";
import FirstsMoment from "./FirstsMoment";
import MonthKeepsake from "../weekly/MonthKeepsake";
// B-CAREPRO-25: the pending queue reads as one group per topic (G6: no bulk approve).
import { groupPendingMemory, dismissGroup, type PendingMemoryGroup } from "../../lib/memoryGroups";
import { domainName } from "../../lib/domains/registry";

const pick = (he: boolean, txt: { en: string; he: string }) => (he ? txt.he : txt.en);

/** Child Intelligence › Child Memory — parent-approved facts, wired to the real
 *  append-only memory service (/api/memory). A core moat: source-linked,
 *  time-stamped, editable via approve/forget, time-boxed when sensitive. */
export default function ChildMemory() {
  const { childProfile, approvedMemoryItems, pendingMemoryItems, handleMemoryDecision, isMemoryUpdating, memoryReviewError, memoryReviewErrorKind, retryMemoryReview, savedLearnIds, requestLearnRead, setActiveTab } = useArbor();
  const { t, aiLang } = useLanguage();
  const he = aiLang === "he";
  const first = childProfile.name.split(" ")[0];
  // B-CAREPRO-06: the pending queue is what survives the plain-words scrub —
  // a proposal the scrub drops is not shown and stays in the ledger. The rows
  // keep their STORED text so the Edit box opens on the parent's own record;
  // MemoryRow displays the scrubbed wording.
  const pendingQueue = useMemo(() => {
    const kept = new Set(scrubMemoryProposals(pendingMemoryItems).map((p) => p.memoryId));
    return pendingMemoryItems.filter((m) => kept.has(m.memoryId));
  }, [pendingMemoryItems]);
  const pendingGroups = useMemo(() => groupPendingMemory(pendingQueue), [pendingQueue]);
  const soleOther = pendingGroups.length === 1 && pendingGroups[0].topic === "other";
  // Saved Learn Library reads, newest first; stale bookmarks (removed cards) are dropped.
  const savedLearnCards = savedLearnIds
    .map((id) => learnCardById(id))
    .filter((c): c is LearnCard => c !== undefined);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6 max-w-[920px]">
      <PageHeader eyebrow={t("elev.childmem.eyebrow")} title={t("sec.mem.title")} subtitle={t("sec.mem.sub", { name: first })} />

      {/* AI-11: this is the surface where a parent APPROVES or FORGETS what
          Arbor may remember about their child. Its titles, its empty state and
          — worst — its three decision buttons were hard-coded English, so a
          Hebrew-reading parent was asked to make a privacy decision in a
          language the app had promised not to use on them. */}
      {/* W2-CAREPRO r1: ONE quiet trust band, not three layers (the green
          TrustSafetyBar with clinical chips that say nothing about memory, plus
          the why-line) ahead of the decision the parent came to make. */}
      <div className="flex flex-col gap-1">
        <p data-testid="memory-trust-line" className="t-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.childmem.trustNote")}</p>
        <ContentWhyLine why={t("elev.waveR.why.memory")} trustLink surface="child-memory" />
      </div>

      {/* OWN-1: a failed ledger read renders an honest error + retry card (the
          TrustedSharing twin) INSTEAD of the pending/approved lists — an
          unreadable ledger must never masquerade as "No memory yet". */}
      {memoryReviewError && (
        <ErrorState
          surface="child-memory"
          headline={t("err.memory.title", { name: first })}
          // OBJ-PROFILE-04 residue: a 429 is a queue on our side, not the
          // parent's wifi, and "Something interrupted the connection" blamed
          // them for it. The back-off + classification landed in ff5bebaf and
          // exposed memoryReviewErrorKind; this is the surface reading it.
          body={memoryReviewErrorKind === "rate_limited" ? t("elev.memory.catchingUp") : t("err.memory.body")}
          onRetry={retryMemoryReview}
          retryLabel={t("err.retry")}
        />
      )}

      {/* The parent's action queue, and this hub's primary move. It used to
          sit BELOW the firsts moment, the knows-count tile and the month
          keepsake, which put Approve at roughly y 1100 on a phone — three
          celebrations ahead of the decision the parent came to make. The
          celebrations still render; they render after. */}
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
      {!memoryReviewError && pendingQueue.length > 0 && (
        <div data-module="memory-pending" style={{ display: "contents" }}>
        {/* B-CAREPRO-25: one group per topic (newest fact shown, "See all N",
            "Dismiss all N"); the heading counts groups; neutral lav tone. */}
        <SectionCard
          // W2-CAREPRO r1: a sole catch-all group is not "1 topic" — it is notes waiting.
          title={soleOther
            ? t(pendingQueue.length === 1 ? "elev.childmem.pending.notes.one" : "elev.childmem.pending.notes", { count: pendingQueue.length })
            : t(pendingGroups.length === 1 ? "elev.childmem.pending.groups.one" : "elev.childmem.pending.groups", { count: pendingGroups.length })}
          icon={<Icon name="verified_user" size={20} />}
          tone="lav"
        >
          <div className="space-y-3">
            {pendingGroups.map((g, gi) => (
              <PendingGroupCard
                key={g.topic}
                group={g}
                lead={gi === 0}
                hideLabel={soleOther}
                isMemoryUpdating={isMemoryUpdating}
                onDecide={(id, status) => handleMemoryDecision(id, status)}
                onEdited={retryMemoryReview}
              />
            ))}
          </div>
        </SectionCard>
        </div>
      )}

      {/* R25 (item 11) — #/memory rendered 6 top-level modules against a declared
          moduleBudget of 3. The tail below is DEMOTED, never removed: one
          collapsed disclosure on the pattern components/practice/SpeechCoachTab.tsx
          `speech-more` already ships, so every capability keeps its door (law 6)
          while the fold belongs to the primary move. Demoted modules keep their
          own `data-module` stamp and add `data-module-demoted`, which is what
          makes the budget rule countable: top-level = stamps minus demoted. */}
      <details data-module-disclosure="memory-more" className={`${cardCls} p-0 overflow-hidden`}>
        <summary className="cursor-pointer list-none px-6 py-4 min-h-[44px] flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
            <Icon name="bookmark" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.childmem.more.title")}</span>
            <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.childmem.more.sub")}</span>
          </span>
          <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
        </summary>
        <div className="px-4 pb-4 space-y-4">
        {/* demotionTarget: "profile" — the hub the contract sends these to. */}
        <button onClick={() => setActiveTab("profile")} className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-bold" style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}>
          <span>{t("elev.childmem.more.door")}</span>
          <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
        </button>
      {/* ENG-13 · the week-1 "first", at a threshold of ONE. Renders at most
          once ever per kind and returns null the rest of the time. */}
      <div data-module="memory-firsts" data-module-demoted style={{ display: "contents" }}><FirstsMoment /></div>

      {/* ENG-14(a) · what Arbor knows, as a COUNT — answerable on day 0 from
          the profile alone, which is exactly what nothing else in the app
          could do. Never a completeness score: see lib/keepsakeCounts. */}
      <div data-module="memory-knows" data-module-demoted style={{ display: "contents" }}><ArborKnowsTile /></div>

      {/* ENG-14(b) · the month keepsake, offered once on the first open of a
          new month and never for a month the family is still living in. */}
      <div data-module="memory-keepsake" data-module-demoted style={{ display: "contents" }}><MonthKeepsake /></div>

        </div>
      </details>

      {!memoryReviewError && (
      <div data-module="memory-approved" style={{ display: "contents" }}>
      <SectionCard title={t("elev.childmem.approved.title")} icon={<Icon name="bookmark" size={20} />} tone="lav">
        {approvedMemoryItems.length > 0 ? (
          <div className="space-y-3">
            {approvedMemoryItems.map((m: MemoryReviewItem) => (
              <MemoryRow
                key={m.memoryId}
                m={m}
                busy={isMemoryUpdating === m.memoryId}
                onForget={() => handleMemoryDecision(m.memoryId, "deleted")}
                onEdited={retryMemoryReview}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
              <Icon name="bookmark" size={24} />
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.childmem.empty.title")}</p>
            <p className="text-xs mt-1 max-w-sm mx-auto" dir="auto" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.childmem.empty.body", { name: first })}
            </p>
          </div>
        )}
      </SectionCard>
      </div>
      )}

      {/* Learning trail — the parent's saved Learn Library reads, part of the
          child's longitudinal picture. Renders only when something is saved;
          the Library's own Saved tab teaches the empty state. */}
      {savedLearnCards.length > 0 && (
        <div data-module="memory-learning-trail" className={`${cardCls} p-5`}>
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}
            >
              <Icon name="local_library" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("learn.trailTitle")}</h2>
                <Chip tone="lav">{savedLearnCards.length}</Chip>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("learn.trailSub")}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            {savedLearnCards.slice(0, 6).map((card) => {
              const cat = learnCategoryById(card.category);
              const tone = PASTEL[cat.tone];
              return (
                <button
                  key={card.id}
                  onClick={() => requestLearnRead({ cardId: card.id, source: "child-memory" })}
                  className="w-full flex items-center gap-3 min-h-[48px] px-2.5 py-2 rounded-xl transition hover:bg-[var(--arbor-paper-deep)] text-start"
                >
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: tone.soft, color: tone.ink }}
                  >
                    <Icon name={cat.msIcon} size={16} />
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[13.5px] font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                    {pick(he, card.title)}
                  </span>
                  <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--arbor-muted)" }}>
                    {t("learn.minutes", { n: card.minutes })}
                  </span>
                  <span className="shrink-0" style={{ color: "var(--arbor-muted)" }}>
                    <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
                  </span>
                </button>
              );
            })}
          </div>
          {savedLearnCards.length > 6 && (
            <button
              onClick={() => requestLearnRead({ source: "child-memory" })}
              className="w-full mt-1 min-h-11 rounded-xl text-xs font-bold transition hover:bg-[var(--arbor-paper-deep)]"
              style={{ color: "var(--arbor-lav-ink)" }}
            >
              {t("learn.trailAll")}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

/** B-CAREPRO-25 — one topic of the pending queue. The newest fact renders as
 *  a full MemoryRow (its own Approve / Dismiss / Edit — approval is always one
 *  fact at a time, G6); "See all N" expands the rest, each with its own
 *  controls; "Dismiss all N" asks once, then writes one reject per fact. */
export function PendingGroupCard({ group, isMemoryUpdating, onDecide, onEdited, lead, hideLabel }: {
  group: PendingMemoryGroup;
  /** W2-CAREPRO r1: the first group's newest row carries the route's ONE primary move. */
  lead?: boolean;
  /** W2-CAREPRO r1: the sole group is the catch-all — no "Other notes" junk-drawer label. */
  hideLabel?: boolean;
  isMemoryUpdating: string | null | undefined;
  onDecide: (memoryId: string, status: "approved" | "rejected") => Promise<unknown> | unknown;
  onEdited?: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const n = group.items.length;
  const label = group.topic === "other" ? t("elev.childmem.group.other") : domainName(group.topic, t);
  const shown = open ? group.items : group.items.slice(0, 1);
  return (
    <div data-testid="memory-group" data-topic={group.topic} className="rounded-2xl p-3 space-y-2" style={{ border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-elevated)" }}>
      {(!hideLabel || n > 1) && (
      <p className="t-xs font-extrabold" style={{ color: "var(--arbor-lav-ink)" }}>
        {!hideLabel && label}
        {n > 1 && <span className="font-bold" style={{ color: "var(--arbor-muted)" }}>{!hideLabel && " · "}{t("elev.childmem.group.similar", { n })}</span>}
      </p>
      )}
      {shown.map((m, i) => (
        <MemoryRow
          key={m.memoryId}
          m={m}
          primary={lead && i === 0}
          busy={isMemoryUpdating === m.memoryId || dismissing}
          onApprove={() => onDecide(m.memoryId, "approved")}
          onReject={() => onDecide(m.memoryId, "rejected")}
          onEdited={onEdited}
        />
      ))}
      {n > 1 && !confirming && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="memory-group-see-all"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="touch-target px-3 rounded-xl text-[12px] font-bold"
            style={{ color: "var(--arbor-lav-ink)", border: "1px solid var(--arbor-rule)" }}
          >
            {open ? t("elev.childmem.group.seeLess") : t("elev.childmem.group.seeAll", { n })}
          </button>
          <button
            type="button"
            data-testid="memory-group-dismiss-all"
            onClick={() => setConfirming(true)}
            disabled={dismissing}
            className="touch-target px-3 rounded-xl text-[12px] font-bold disabled:opacity-60"
            style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
          >
            {t("elev.childmem.group.dismissAll", { n })}
          </button>
        </div>
      )}
      {n > 1 && confirming && (
        <div role="group" data-testid="memory-group-dismiss-confirm" className="rounded-xl p-3 space-y-2" style={{ background: "var(--arbor-paper-sunk)" }}>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{t("elev.childmem.group.dismissConfirm", { n })}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="memory-group-dismiss-yes"
              disabled={dismissing}
              onClick={async () => {
                setDismissing(true);
                try { await dismissGroup(group, (id) => onDecide(id, "rejected")); } finally { setDismissing(false); setConfirming(false); }
              }}
              className="touch-target px-3 rounded-xl text-[12px] font-bold disabled:opacity-60"
              style={{ color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}
            >
              {t("elev.childmem.group.dismissYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={dismissing}
              className="touch-target px-3 rounded-xl text-[12px] font-bold"
              style={{ color: "var(--arbor-muted)" }}
            >
              {t("elev.childmem.group.cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Item 9 (touch floor): Edit / Approve / Dismiss / Forget are the Profile
 *  hub's declared primary move and rendered at 17 px — the smallest control on
 *  a primary-move path in the parent app. The glyph and the 11 px type are
 *  unchanged; only the hit box grows to `--touch-min` via `.touch-target`
 *  (index.css:436). Row gaps tighten so the visual rhythm survives the taller
 *  boxes. */
const ROW_ACTION_CLS = "touch-target gap-1 px-2 font-bold";

export function MemoryRow({ m, busy, onApprove, onReject, onForget, onEdited, primary }: {
  m: MemoryReviewItem;
  /** W2-CAREPRO r1: this row's Approve is the route's ONE primary move
   *  (data-primary-move="approve-memory-fact"): the page's single gradient,
   *  44 px, "Remember this"; Edit and Dismiss go quiet beside it. */
  primary?: boolean;
  busy?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onForget?: () => void;
  /** GP-13 — supplied by the surface that owns the ledger read: enables the
   *  inline edit and is called once the corrected row has been written, so the
   *  list re-reads. Surfaces that only DISPLAY a row (the Story timeline
   *  overlay) omit it and keep exactly the controls they had. */
  onEdited?: () => void;
}) {
  const { t, uiLang } = useLanguage();
  const dated = m.createdAt ? fmtDay(m.createdAt, uiLang) : null;
  // GP-13 — the expiry was a raw retention string in a PINK chip. Pink is this
  // row's delete tone, so the one property that protects the parent (the fact
  // forgets itself) read as danger; and "Time-boxed · 90 days" is not a date.
  // Now: a neutral lav chip carrying the day it actually forgets.
  const permanent = isPermanentRetention(m.retention);
  const forgetsOn = forgetsOnIso({ retention: m.retention, createdAt: m.createdAt });
  // …and the chip is rendered ONLY on an approved row. Server retention is
  // enforced on read and drops `status === "approved"` only
  // (memory/memoryService.enforceMemoryRetention + isMemoryExpired), so a
  // PENDING proposal is never expired by anything. This row is used for BOTH
  // the pending queue and the approved list, and it used to promise every
  // pending row a forget-date that nothing would ever honour — a queue item
  // left unreviewed sat there displaying a date already in the past.
  //
  // NOTE for whoever touches the edit path: client `forgetsOnIso` and server
  // `isMemoryExpired` read the SAME anchor, `createdAt`, which
  // `foldMemoryEvents` takes from the LATEST ledger event. Every transition —
  // including a pure text correction — appends an event with a fresh
  // `createdAt`, so editing a fact restarts its retention clock. That is the
  // shipped behaviour on both sides; the date shown stays true, it simply moves.
  const showsExpiry = m.status === "approved";
  const [editing, setEditing] = useState(false);
  const [factDraft, setFactDraft] = useState(m.fact ?? "");
  const [retentionDraft, setRetentionDraft] = useState(() => nearestRetentionChoice(m.retention));
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  /* The edit box writes parent prose straight into the approved ledger, and the
     approved ledger is an EGRESS input: `buildSharedScopePacket`
     (consult/packet.ts) runs `findClinicalDiagnosisTerm` over the assembled
     packet for every NON-clinician recipient, so one word like "delay" in a
     memory fact makes a co-parent's or viewer's shared view fail closed with
     `422 — This share cannot be displayed`. That guard is right and stays
     exactly as it is. What was wrong is that it was silent and unattributable:
     the parent who typed the word saw a successful save, and the co-parent saw
     a wall with no cause and no way to reach one.

     So run the SAME scanner here, at the moment the word is typed. This is
     ADVICE, not a second guard: the save stays enabled, because a memory fact
     is the parent's own record of their own child, clinician shares are exempt
     by policy, and blocking the correction would be a worse trade than the
     share they may never make. Fail-closed enforcement stays where it belongs,
     at the egress. */
  const clinicalTerm = editing ? findClinicalDiagnosisTerm(factDraft) : null;
  // B-CAREPRO-06: what the parent READS is the plain-words wording; the Edit
  // box (factDraft) still opens on the stored text — the parent's own record.
  const shownFact = toParentWords(m.fact);

  const openEdit = () => {
    setFactDraft(m.fact ?? "");
    setRetentionDraft(nearestRetentionChoice(m.retention));
    setSaveFailed(false);
    setEditing(true);
  };

  /** The server has accepted { fact, retention, source } on this transition
   *  since the ledger was written (memory/memoryService.transitionMemory) —
   *  the UI simply never sent them. Editing keeps the row's CURRENT status, so
   *  correcting an approved fact does not silently re-queue it. */
  const saveEdit = async () => {
    const fact = factDraft.trim();
    if (!fact) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(m.memoryId)}`, {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ status: m.status, fact, retention: retentionDraft }),
      });
      if (!res.ok) throw new Error("edit failed");
      setEditing(false);
      onEdited?.();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardCls} p-4 ${busy ? "opacity-60" : ""}`} data-testid="memory-row">
      {editing ? (
        <div className="space-y-2.5">
          <label className="block text-[11px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.waveR.mem.edit.factLabel")}
            <textarea
              autoFocus
              rows={3}
              dir="auto"
              value={factDraft}
              onChange={(e) => setFactDraft(e.target.value)}
              data-testid="memory-edit-fact"
              className="mt-1 w-full rounded-xl px-3 py-2 text-sm font-normal focus:outline-none"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            />
          </label>
          <label className="block text-[11px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.waveR.mem.edit.retentionLabel")}
            <select
              value={retentionDraft}
              onChange={(e) => setRetentionDraft(e.target.value)}
              data-testid="memory-edit-retention"
              className="mt-1 block w-full rounded-xl px-3 py-2 text-xs font-normal"
              style={{ minHeight: 44, background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            >
              {RETENTION_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
              ))}
            </select>
          </label>
          {clinicalTerm && (
            <p
              data-testid="memory-edit-clinical-note"
              dir="auto"
              className="text-[11px] font-bold leading-snug"
              style={{ color: "var(--arbor-clay-ink)" }}
            >
              {t("elev.waveR.mem.clinicalNote", { term: clinicalTerm })}
            </p>
          )}
          {saveFailed && (
            <p className="text-[11px] font-bold" style={{ color: "var(--arbor-pink-ink)" }}>{t("elev.waveR.mem.saveFailed")}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={saving || !factDraft.trim()}
              data-testid="memory-edit-save"
              // The row is a quiet ledger row and its other controls are token-ink
              // text buttons; a solid white-on-clay button would shout, and a
              // white label inside the row's busy-opacity wrapper has no
              // white-label proof (CR-01 ratchet). Soft-fill + ink instead.
              className="rounded-xl px-4 text-xs font-extrabold transition disabled:opacity-60"
              style={{ minHeight: 44, background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}
            >
              {t("elev.waveR.mem.save")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 text-xs font-bold"
              style={{ minHeight: 44, color: "var(--arbor-muted)" }}
            >
              {t("elev.waveR.mem.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm" dir="auto" style={{ color: shownFact ? "var(--arbor-ink)" : "var(--arbor-muted)" }}>{shownFact || t("elev.childmem.fact.unshown")}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[11px]" style={{ color: "var(--arbor-muted)" }}>
        {/* W2-CAREPRO r1: no "source" link icon over raw model text with no
            destination (an unkeepable "Source-linked" claim, English in HE). */}
        {dated && <span className="inline-flex items-center gap-1"><Icon name="schedule" size={12} /> {dated}</span>}
        {showsExpiry && (
          <span data-testid="memory-expiry-chip">
            <Chip tone="lav">
              {permanent || !forgetsOn
                ? t("elev.waveR.mem.keptUntilForget")
                : t("elev.waveR.mem.forgetsOn", { date: fmtDay(forgetsOn, uiLang) })}
            </Chip>
          </span>
        )}
        <span className="flex-1" />
        {busy && <Icon name="progress_activity" size={14} className="animate-spin" />}
        {onEdited && !busy && !editing && (
          <button
            onClick={openEdit}
            aria-label={t("elev.waveR.mem.edit.aria")}
            data-testid="memory-edit-open"
            className={ROW_ACTION_CLS}
            style={{ color: primary ? "var(--arbor-muted)" : "var(--arbor-lav-ink)" }}
          >
            <Icon name="edit" size={14} /> {t("elev.waveR.mem.edit")}
          </button>
        )}
        {onApprove && !busy && primary && (
          <button
            type="button"
            data-primary-move="approve-memory-fact"
            onClick={onApprove}
            className="touch-target inline-flex items-center gap-1.5 rounded-xl px-4 t-sm font-extrabold"
            style={{ minHeight: 44, background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }}
          >
            <Icon name="check" size={16} /> {t("elev.childmem.action.remember")}
          </button>
        )}
        {onApprove && !busy && !primary && (
          <button onClick={onApprove} className={ROW_ACTION_CLS} style={{ color: "var(--arbor-green-ink)" }}>
            <Icon name="check" size={14} /> {t("elev.childmem.action.approve")}
          </button>
        )}
        {onReject && !busy && (
          <button onClick={onReject} className={ROW_ACTION_CLS} style={{ color: "var(--arbor-muted)" }}>
            <Icon name="close" size={14} /> {t("elev.childmem.action.dismiss")}
          </button>
        )}
        {onForget && !busy && (
          <button onClick={onForget} className={ROW_ACTION_CLS} style={{ color: "var(--arbor-pink-ink)" }}>
            <Icon name="delete" size={14} /> {t("elev.childmem.action.forget")}
          </button>
        )}
      </div>
    </div>
  );
}
