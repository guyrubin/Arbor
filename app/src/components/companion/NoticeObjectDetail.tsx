import { useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useNoticeActions } from "../../hooks/useNoticeActions";
import { goToRoute } from "../../hooks/useHashQuery";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { PRACTICES } from "../../content/practices";
import { keepsakeDoc, keepsakeMapFromDocs, localDayKey, upsertKeepsake, type FirstKeepsake, type KeepsakeDoc, type KeepsakeDraft } from "../../lib/firstsKeepsake";
import { fmtDay } from "../../lib/formatDate";
import { practiceTryTitle, shelfPractice } from "../../lib/journal/shelfView";
import { parentWritten } from "../../lib/kept/parentWritten";
import { keptDay } from "../../lib/kept/keptThings";
import { milestoneText } from "../../lib/milestoneData";
import { shelfCoverage, shelfOfMilestone } from "../../lib/milestones/selectByShelf";
import type { Observation } from "../../lib/observations";
import { openNoticeMoment, type NoticeTarget } from "../../lib/noticeNavigation";
import { openNoticeTalk, openNoticeCare } from "../../lib/noticeHandoff";
import { recentPracticeIds, todayDose } from "../../lib/practice/choosePractice";
import { readTodayPin, writeTodayPin } from "../../lib/practice/todayPin";
import { shelfLabel } from "../../lib/shelves/registry";
import type { BehaviorLog } from "../../types";
import NoticeCard from "../loop/NoticeCard";
import { practiceText } from "../loop/PracticeCard";
import FirstKeepsakeSheet from "../milestones/FirstKeepsakeSheet";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { PendingLine, Receipt } from "../ui/Receipt";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import { NOTICE_DETAIL_COPY } from "./noticeDetailCopy";
import "./noticeObjectDetail.css";

/** B-GROWTH-44: the same object opens from Now, My child and the kept record.
 * The target carries identity only. Every render resolves the current source,
 * so a changed answer or removed moment cannot survive as a cached preview.
 * A neutral answer never becomes an observed-event count. */
export default function NoticeObjectDetail({ target, onClose, editEvidence = false, observations = [] }: {
  target: NoticeTarget; onClose: () => void; editEvidence?: boolean; observations?: readonly Observation[];
}) {
  const { childProfile, milestones, actionLoop, openCaptureSheet, requestJournalFocus, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = NOTICE_DETAIL_COPY[lang];
  const notices = useNoticeActions();
  const Surface = useCompactSurface() ? Sheet : Modal;
  const active = target.childId === childProfile.id;
  const milestone = active ? milestones.find((m) => m.id === target.milestoneId) : undefined;
  const shelf = milestone ? shelfOfMilestone(milestone) : null;
  const keepsakes = notices.keepsakes;
  const keptDocument = active && keepsakes.loaded && !keepsakes.error && keepsakes.confirmed
    ? keepsakes.items.find((item) => item.kind !== "quote" && item.id === target.milestoneId && item.milestoneId === target.milestoneId) : undefined;
  const kept = keptDocument ? keepsakeMapFromDocs([keptDocument])[target.milestoneId] ?? null : null;
  const parentKept = kept && parentWritten(kept) ? kept : null;
  const momentKept = parentKept && keptDay(parentKept.noticedOn) ? parentKept : null;
  const linkedId = notices.confirmed ? milestone?.observationProvenance : undefined;
  // The full current collection is only opened when this one detail names a
  // confirmed original. Metadata/permission errors hide the old quote.
  const linkedLogs = useChildCollection<BehaviorLog>(linkedId ? childProfile.id : "", "behaviorLogs", { trackConfirmation: true });
  const linked = linkedId && linkedLogs.loaded && linkedLogs.confirmed && !linkedLogs.error
    ? linkedLogs.items.find((log) => log.id === linkedId) : undefined;
  const [editing, setEditing] = useState(editEvidence);
  // The editor owns its original seed until it closes. A pending snapshot
  // withdraws read confirmation without unmounting the parent's draft.
  const editorSeed = useRef<FirstKeepsake | null | undefined>(undefined);
  const evidenceAttempt = useRef<{ kind: "save"; doc: KeepsakeDoc } | { kind: "remove" } | null>(null);
  const editorScope = useRef(notices.scopeKey);
  if (editorScope.current !== notices.scopeKey) {
    editorScope.current = notices.scopeKey;
    editorSeed.current = undefined;
    evidenceAttempt.current = null;
  }
  if (editing && editorSeed.current === undefined && keepsakes.loaded && keepsakes.confirmed && !keepsakes.error) editorSeed.current = kept;
  const [removal, setRemoval] = useState<"idle" | "saving" | "queued" | "failed" | "removed" | "restoring" | "restore_queued" | "restore_failed">("idle");
  const [pinFailed, setPinFailed] = useState(false);
  const mounted = useRef(true);
  const scope = useRef(notices.scopeKey);
  scope.current = notices.scopeKey;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const owns = () => mounted.current && scope.current === notices.scopeKey && active;

  const now = useMemo(() => new Date(), [target.childId, target.milestoneId]);
  const comparisonMonths = comparisonMonthsOf(childProfile, now);
  const related = useMemo(() => shelf && active ? shelfPractice({
    childId: childProfile.id, milestones, comparisonMonths, practices: PRACTICES,
    today: now, coverage: shelfCoverage(observations, now), recentPracticeIds: recentPracticeIds(actionLoop, childProfile.id, now),
  }, shelf) : null, [shelf, active, childProfile.id, milestones, comparisonMonths, now, actionLoop, observations]);
  const dose = todayDose(actionLoop, childProfile.id, now);
  const currentPracticeId = dose?.practiceId ?? readTodayPin(childProfile.id, now);
  const sourceTitle = milestone ? milestoneText(milestone, "title", t, { gender: childProfile.gender ?? null }) : copy.title;
  const answer = notices.confirmed ? milestone?.observationStatus ?? (milestone?.checked ? "yes" : null) : null;
  const recordedAt = notices.confirmed ? milestone?.observationUpdatedAt : undefined;
  const validDate = (value?: string | null) => !!value && !!keptDay(value);

  const saveEvidence = async (draft: KeepsakeDraft) => {
    const attempt = evidenceAttempt.current;
    const ownRetry = attempt?.kind === "save" && attempt.doc.milestoneId === draft.milestoneId;
    if (!owns() || draft.milestoneId !== target.milestoneId || keepsakes.error || (!keepsakes.isCurrent() && !ownRetry)) throw new Error("The observation source changed");
    const existing = keepsakes.isCurrent() ? keepsakes.items.filter((item) => item.id === target.milestoneId && item.milestoneId === target.milestoneId) : ownRetry ? [attempt.doc] : [];
    const next = upsertKeepsake(keepsakeMapFromDocs(existing), draft, new Date().toISOString());
    const doc = keepsakeDoc(next[draft.milestoneId]);
    evidenceAttempt.current = { kind: "save", doc };
    await keepsakes.upsert(doc, { requireAcknowledgement: true });
    if (!owns()) throw new Error("The active observation changed");
    evidenceAttempt.current = null;
  };
  const removeEvidence = async () => {
    if (!owns() || keepsakes.error || (!keepsakes.isCurrent() && evidenceAttempt.current?.kind !== "remove")) throw new Error("The observation source changed");
    evidenceAttempt.current = { kind: "remove" };
    await keepsakes.remove(target.milestoneId, { requireAcknowledgement: true });
    if (!owns()) throw new Error("The active observation changed");
    evidenceAttempt.current = null;
  };
  const removeAnswer = async () => {
    if (!milestone || removal === "saving" || removal === "restoring" || !owns()) return;
    setRemoval("saving");
    try {
      await notices.clearAnswer(milestone);
      if (owns()) setRemoval("removed");
    } catch (error) { if (owns()) setRemoval(error instanceof Error && /write (?:needs an online confirmation|was not confirmed)/.test(error.message) ? "queued" : "failed"); }
  };
  const undoRemoval = async () => {
    if (!milestone || removal === "restoring" || !owns()) return;
    const undo = notices.forMilestone(milestone).onUndo;
    if (!undo) return;
    setRemoval("restoring");
    try {
      await undo();
      if (owns()) setRemoval("idle");
    } catch (error) { if (owns()) setRemoval(error instanceof Error && /write (?:needs an online confirmation|was not confirmed)/.test(error.message) ? "restore_queued" : "restore_failed"); }
  };
  const chooseToday = () => {
    if (!related || !owns()) return;
    if (currentPracticeId !== related.practice.id && !writeTodayPin(childProfile.id, related.practice.id)) { setPinFailed(true); return; }
    goToRoute("overview");
  };
  const openJournal = () => {
    if (!milestone || !milestone.checked || !owns()) return;
    requestJournalFocus(`milestone-${milestone.id}`);
    setActiveTab("journal");
  };

  return <Surface open={active} onClose={onClose} title={copy.title} maxWidth="max-w-3xl">
    <article className="notice-object-detail" dir={lang === "he" ? "rtl" : "ltr"} data-testid="notice-object-detail" data-observation-id={`milestones:${target.milestoneId}`} data-child-id={target.childId}>
      {!milestone || !shelf ? <p role="status">{copy.missing}</p> : <>
        <NoticeCard
          milestone={milestone} shelf={shelf} gender={childProfile.gender} childName={childProfile.name?.split(" ")[0]}
          variant="detail" answers="segmented" {...notices.forMilestone(milestone)}
          // One editor below owns existing words, date and photo; no second
          // inline draft that could overwrite an existing keepsake's date.
          savedWords={undefined} onKeepQuote={undefined} onKeepPhoto={undefined}
          onOpen={undefined} onDetails={undefined}
          onAnswer={async (status) => { await notices.forMilestone(milestone).onAnswer(status); if (owns()) setRemoval("idle"); }}
        />

        <dl className="notice-object-meta" data-testid="notice-object-source">
          <div><dt>{copy.storedIn}</dt><dd>{shelfLabel(shelf, t)}</dd></div>
          {validDate(recordedAt) && <div><dt>{copy.updated}</dt><dd><time dateTime={recordedAt}>{fmtDay(recordedAt!, lang)}</time></dd></div>}
          {answer === "yes" && milestone.observedWhen && <div><dt>{copy.dateRange}</dt><dd>{milestone.observedWhen === "today" ? copy.today : milestone.observedWhen === "this_week" ? copy.thisWeek : copy.earlierWhen}</dd></div>}
          <div><dt>{copy.source}</dt><dd>{!notices.confirmed ? copy.unconfirmed : !answer ? copy.notAnswered : milestone.observationSource === "ai_proposed_parent_confirmed" ? copy.sourceConfirmed : copy.sourceParent}</dd></div>
        </dl>

        <section className="notice-object-evidence" aria-label={parentKept || !kept ? copy.keptWords : copy.attachedWords}>
          {!keepsakes.loaded && <p role="status" className="notice-object-note">{copy.loading}</p>}
          {keepsakes.loaded && (keepsakes.error || !keepsakes.confirmed) && <p role="status" className="notice-object-note">{copy.loadFailed}</p>}
          {kept && <figure data-testid="notice-object-keepsake" className={kept.photoUrl ? "notice-object-keepsake has-photo" : "notice-object-keepsake"}>
            {kept.photoUrl && <img src={kept.photoUrl} alt={t("companion.portrait.photo")} loading="lazy" />}
            <figcaption><span className="notice-object-kicker">{parentKept ? copy.keptWords : copy.attachedWords}</span><blockquote dir="auto">{kept.note}</blockquote>
              {!parentKept && <p>{copy.otherSource}</p>}
              {validDate(kept.noticedOn) && <p>{copy.keptOn} · <time dateTime={kept.noticedOn}>{fmtDay(`${kept.noticedOn}T12:00:00`, lang)}</time></p>}
            </figcaption>
          </figure>}
          {!kept && keepsakes.confirmed && <p className="notice-object-note">{copy.noEvidence}</p>}
          {keepsakes.confirmed && !keepsakes.error && <button type="button" className="notice-object-action" data-testid="notice-object-edit-evidence" onClick={() => { editorSeed.current = kept; evidenceAttempt.current = null; setEditing(true); }}>
            <Icon name={kept ? "edit_note" : "bookmark_add"} size={18} /><span>{kept ? copy.editEvidence : copy.addEvidence}</span>
          </button>}
          {kept && <p className="notice-object-note">{copy.separate}</p>}
        </section>

        {linkedId && <section className="notice-object-linked" data-testid="notice-object-linked">
          <h3>{copy.linked}</h3>
          {linked ? <>
            <p className="notice-object-note">{copy.confirmedLink}{validDate(linked.timestamp) && <> · <time dateTime={linked.timestamp}>{fmtDay(linked.timestamp, lang)}</time></>}</p>
            <p className="notice-object-linked-words" dir="auto">{linked.trigger || linked.notes}</p>
            <button type="button" className="notice-object-action" onClick={() => { if (owns() && linkedLogs.isCurrent()) { onClose(); openCaptureSheet({ editLogId: linked.id, editLog: linked }); } }}><Icon name="open_in_new" size={18} /><span>{copy.original}</span></button>
          </> : <p role="status" className="notice-object-note">{linkedLogs.loaded ? copy.linkedMissing : copy.loading}</p>}
        </section>}

        <div className="notice-object-record-doors">
          {(answer === "yes" || momentKept) && <button type="button" className="notice-object-action" data-testid="notice-object-moments" onClick={() => { if (owns()) openNoticeMoment(childProfile.id, `${momentKept ? "keepsakes" : "milestones"}:${milestone.id}`); }}><Icon name="photo_library" size={18} /><span>{copy.moments}</span></button>}
          {answer === "yes" && <button type="button" className="notice-object-action" onClick={openJournal}><Icon name="auto_stories" size={18} /><span>{copy.journal}</span></button>}
        </div>

        {related && <section className="notice-object-related" data-testid="notice-object-related">
          <span className="notice-object-kicker">{copy.related}</span>
          <h3 dir="auto">{practiceTryTitle(related.practice, lang, childProfile.name?.split(" ")[0] ?? "", childProfile.gender)}</h3>
          <p className="notice-object-note">{copy.relatedWhy}</p>
          <p dir="auto">{practiceText(related.practice, "do", lang, childProfile.gender)}</p>
          {(!dose || dose.practiceId === related.practice.id) ? <button type="button" className="notice-object-primary" onClick={chooseToday}>
            <Icon name="wb_sunny" size={18} /><span>{currentPracticeId === related.practice.id ? copy.chosen : copy.tryToday}</span><Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
          </button> : <p className="notice-object-note">{copy.alreadyToday}</p>}
          {pinFailed && <p role="alert" className="notice-object-note">{copy.pinFailed}</p>}
        </section>}

        <details className="notice-object-controls">
          <summary>{copy.more}<Icon name="expand_more" size={18} /></summary>
          {answer && <div className="notice-object-record-doors">
            <button type="button" className="notice-object-action" data-testid="notice-object-talk" onClick={() => { if (owns()) { onClose(); openNoticeTalk(childProfile.id, milestone.id); } }}><Icon name="chat_bubble" size={18} /><span>{copy.talk}</span></button>
            <button type="button" className="notice-object-action" data-testid="notice-object-care" onClick={() => { if (owns()) openNoticeCare(childProfile.id, milestone.id); }}><Icon name="medical_services" size={18} /><span>{copy.care}</span></button>
          </div>}
          {(answer || removal === "queued" || removal === "failed") && <button type="button" className="notice-object-action" data-testid="notice-object-remove-answer" disabled={removal === "saving" || removal === "restoring"} aria-busy={removal === "saving" || undefined} onClick={() => void removeAnswer()}><Icon name="delete" size={18} /><span>{removal === "saving" ? copy.removing : copy.remove}</span></button>}
          {removal === "failed" && <p role="alert">{copy.removeFailed}</p>}
          {removal === "queued" && <p role="status">{copy.pending}</p>}
          {removal === "removed" && notices.confirmed && <Receipt undo={{ label: t("elev.loop.notice.undo"), onUndo: () => void undoRemoval(), testId: "notice-object-undo-remove" }}>{copy.removed}</Receipt>}
          <PendingLine active={removal === "restoring"}>{copy.restoring}</PendingLine>
          {(removal === "restore_failed" || removal === "restore_queued") && <>
            <p role={removal === "restore_queued" ? "status" : "alert"}>{removal === "restore_queued" ? copy.pending : copy.restoreFailed}</p>
            <button type="button" className="notice-object-action" data-testid="notice-object-undo-remove" onClick={() => void undoRemoval()}><Icon name="undo" size={18} /><span>{t("elev.loop.notice.undo")}</span></button>
          </>}
        </details>
      </>}
    </article>
    {editing && active && milestone && editorSeed.current !== undefined && <FirstKeepsakeSheet
      key={`${notices.scopeKey}:${milestone.id}`} open milestoneId={milestone.id} milestoneTitle={sourceTitle}
      childId={childProfile.id} childName={childProfile.name?.split(" ")[0] ?? ""} keepsake={editorSeed.current}
      initialNoticedOn={milestone.observedWhen === "today" && validDate(milestone.observedAt) ? localDayKey(new Date(milestone.observedAt!)) : ""}
      pendingAcknowledgementMessage={copy.pending}
      canShare={false} beforeShare={() => false} onSave={saveEvidence} onRemove={removeEvidence} onClose={() => { editorSeed.current = undefined; evidenceAttempt.current = null; setEditing(false); }}
    />}
  </Surface>;
}
