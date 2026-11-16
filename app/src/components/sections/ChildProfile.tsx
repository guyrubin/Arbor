import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import ProfileEditDrawer from "../profile/ProfileEditDrawer";
// B-GROWTH-05 — physical measurements (spine domain 7) live here, under the child's tile.
import PhysicalGrowthCard from "./PhysicalGrowthCard";
// B-CAREPRO-06: memory text renders through the same plain-words scrub the
// Story queue uses — the parent never reads a fact in an assessment register.
import { scrubMemoryProposals, toParentWords } from "../../server/parentWordsScrub";
import { useHashQuery, useHashRouteKey } from "../../hooks/useHashQuery";
// v3 F-CHILD-3 — the eight areas and the ONE guided conversation.
import { asAspectId, buildAspects, toldSummary, type AspectId } from "../../lib/aboutAspects";
import AspectCard from "../about/AspectCard";
import { PendingNote, RememberedNote, SHOWN_PENDING, StageCard, aboutAskedPendingIds, useAboutNotebook } from "../about/AboutAnswer";
import AboutChildTile from "../about/AboutChildTile";
import { LEDGER_ID, useLedgerArrival } from "../about/useLedgerArrival";
import TellArborMore from "../describe/TellArborMore";
import KeptDescription from "../describe/KeptDescription";
import CoachDataContract from "../coach/CoachDataContract";
import { Icon } from "../ui/Icon";
import { DsRoot, Fig, Guide, LivingForm, MoreLink, Route, Scene, Snap, SnapDots, StartHere, Token, TokenLegend, type GuideStop } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { aboutCopy } from "../about/aboutViewCopy";
import "../about/aboutV10.css";

/**
 * v3 F-CHILD-3 → design v10.1 — My child › About (#/profile): Arbor's notebook
 * about the child, and the parent's own words. The N-About boards' route:
 *  1. Answer Arbor — the stage: the notebook's heading, how many notes wait
 *     and how many are remembered (counts of notes, never of the child), and
 *     the next proposal as a card with its thread and Remember / Not this /
 *     Edit (the notebook's ONE approval home, the same write the ledger uses);
 *  2. Waiting, and remembered — "Tell Arbor by voice" / "Write" (the route's
 *     ONE primary move, capture-moment, rendered once in every state), the
 *     next proposals, the newest remembered fact with Edit / Forget and the day
 *     it forgets;
 *  3. What you told Arbor, what the coach sees — the parent's own description
 *     (Edit / Remove / Tell Arbor more), the coach's view with the weekly
 *     consent switch (always here: a consent control never waits on a ledger
 *     read), and the child's tile (Edit details, Create hero, Measurements, the
 *     last visit as one line, Moments and keepsakes);
 *  4. What Arbor knows — the eight areas as one notebook (told words with a
 *     day, or the question Arbor would ask; a proposal waits in its area with
 *     Confirm / No; "Tell more" opens the conversation on that area), the door
 *     to everything Arbor remembers (the ledger, in place) and How Arbor works.
 * `?aspect=<id>` opens the conversation on that area (#/language and
 * #/strengths land here). Nothing on the page grades the child: no share, no
 * fill, no "of 8". Desktop and phone are two compositions of the same objects;
 * ONE tree renders, so each control exists once in the DOM.
 */
/** B-CAREPRO-38 — the full ledger ("Everything Arbor remembers"), loaded when
 *  the parent opens it (or arrives on a retired #/memory link). */
const ChildMemoryLedger = React.lazy(() => import("./ChildMemory"));

/** The route's ONE primary move (B-SHELL-26): capture-moment, on "Tell Arbor
 *  by voice" — telling Arbor one thing, rendered once in every state. */
const CAPTURE_MOVE = { "data-primary-move": "capture-moment" } as const;

/** Stop 1, "Answer Arbor": the route's first module (desktop: the stage and the rail; phone: the scene and the tell box). */
function AnswerSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="rsec" id="answer" data-module="about-answer">
      <span className="rstop on" style={{ top: 14 }} aria-hidden="true">1</span>
      {children}
    </section>
  );
}

type SheetMode = "write" | "voice";
type SheetOpen = { aspect: AspectId | null; mode: SheetMode };

export default function ChildProfile() {
  const { childProfile, approvedMemoryItems, pendingMemoryItems, activeTab, memoryReviewError, retryMemoryReview, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const copy = aboutCopy(uiLang);
  const composition = useComposition();
  const desk = composition === "desk";
  const first = childProfile.name.split(" ")[0] || childProfile.name;
  const [editingProfile, setEditingProfile] = useState(false);
  const [keepsakesOpen, setKeepsakesOpen] = useState(false);

  // The query wins: `?aspect=lang` opens the conversation on that area. A tap
  // (or closing) is remembered against the query it was made under, so a new
  // `?aspect=` reopens and the same one does not reopen after Close.
  const hashQuery = useHashQuery();
  const queryAspect = asAspectId(hashQuery.get("aspect"));
  // B-CAREPRO-38: #/memory and #/child-memory retired into this page (one home
  // for approve, correct and forget). Arriving on one — a typed or shared link,
  // or an in-app door that still names "memory" — opens the ledger in place.
  const routeKey = useHashRouteKey();
  const ledgerAsked = activeTab === "memory" || routeKey === "memory" || routeKey === "child-memory";
  // Once per arrival (the query VALUE, never the per-render URLSearchParams); then the toggle owns it.
  // A fact link (`?fact=`) is its own arrival so Correct / Forget can open on that row.
  const factId = hashQuery.get("fact");
  const ledgerSection = hashQuery.get("section") ?? (factId ? `fact:${factId}` : null);
  const [ledgerOpen, toggleLedger] = useLedgerArrival(ledgerAsked, ledgerSection);
  const [tap, setTap] = useState<{ from: AspectId | null; open: SheetOpen | null } | null>(null);
  const sheet: SheetOpen | null = tap && tap.from === queryAspect
    ? tap.open
    : queryAspect ? { aspect: queryAspect, mode: "write" } : null;
  const openSheet = (aspect: AspectId | null, mode: SheetMode) => setTap({ from: queryAspect, open: { aspect, mode } });
  const closeSheet = () => setTap({ from: queryAspect, open: null });

  // B-CAREPRO-06: the areas read the scrubbed lists; a fact the scrub drops
  // is not shown here and stays in the ledger.
  const aspects = useMemo(() => buildAspects({
    profile: childProfile,
    approved: scrubMemoryProposals(approvedMemoryItems),
    pending: scrubMemoryProposals(pendingMemoryItems),
    words: toParentWords,
  }), [childProfile, approvedMemoryItems, pendingMemoryItems]);
  const { told, dated } = toldSummary(aspects);
  // B-CAREPRO-38: the proposals this page already asks about (areas + the cards) — the ledger leaves them out.
  const askedHere = useMemo(() => aboutAskedPendingIds(pendingMemoryItems, aspects), [pendingMemoryItems, aspects]);
  const toldLine = told === 0
    ? t("companion.about.toldNone")
    : told === 1
    ? t(dated ? "companion.about.toldOne" : "companion.about.toldOneUndated")
    : t(dated ? "companion.about.toldMany" : "companion.about.toldManyUndated", { n: told });

  const nb = useAboutNotebook(aspects);
  const stage = nb.waiting[0] ?? null;
  const railPending = nb.waiting.slice(1, SHOWN_PENDING);
  const newest = nb.remembered[0] ?? null;
  const openKeepsakes = () => {
    setKeepsakesOpen(true);
    if (!ledgerOpen) toggleLedger();
    setTimeout(() => document.getElementById("memory-keepsakes")?.scrollIntoView({ block: "start" }), 300);
  };

  const hasWaiting = railPending.length > 0 || (!!newest && !memoryReviewError) || nb.inAreasCount > 0;
  const stops: GuideStop[] = desk
    ? [
        { id: "answer", title: copy.guideAnswer, sub: nb.pending.length ? copy.guideAnswerSub(nb.pending.length) : copy.guideAnswerNone },
        { id: "waiting", title: copy.guideWaiting },
        { id: "tell", title: copy.guideTold, sub: copy.guideToldSub },
        { id: "areas", title: copy.guideKnows, sub: toldLine },
      ]
    : [
        { id: "answer", title: copy.guideAnswerShort },
        ...(hasWaiting ? [{ id: "waiting", title: copy.guideWaitingShort }] : []),
        { id: "areas", title: copy.guideKnows },
      ];

  /* ── the objects, composed twice below ─────────────────────────────────── */

  const heading = (
    <>
      <div className="line between about-kick">
        <span className="kicker">{t("companion.about.kicker", { name: first })}</span>
        <StartHere>{copy.startHere}</StartHere>
      </div>
      <div className="line between top about-head">
        <div className="stack about-head-text">
          {/* No dir on the h1: it keeps text-align:start in the PAGE direction; t() isolates the name. */}
          <h1 id="about-title" className="hero">{t("companion.about.memory.title", { name: first })}</h1>
          {desk && <p className="about-sub">{t("companion.about.memory.sub")}</p>}
        </div>
        <LivingForm src="/visuals/parent/v2/empty-portrait-480.webp" width={desk ? 112 : 84} height={desk ? 100.9 : 75.7}
          crop={desk ? { w: 190, h: 126.6, x: -40.4, y: -14.2 } : { w: 142.5, h: 95, x: -30.3, y: -10.7 }} />
      </div>
    </>
  );

  // Counts of notes in the notebook: no tile for a zero.
  const figs = (nb.pending.length > 0 || nb.approved.length > 0) && (
    <div className="line about-figs">
      {nb.pending.length > 0 && <Fig size={desk ? "base" : "md"} n={nb.pending.length} unit={copy.figWaiting} sub={!desk && nb.approved.length > 0 ? `${nb.approved.length} ${copy.figRemembered(nb.approved.length)}` : undefined} />}
      {(desk || nb.pending.length === 0) && nb.approved.length > 0 && <Fig size="md" n={nb.approved.length} unit={copy.figRemembered(nb.approved.length)} />}
    </div>
  );

  const answer = memoryReviewError ? (
    <p className="about-note" role="status" data-testid="about-memory-error">
      {t("companion.about.memory.loadFailed")}{" "}
      <button type="button" className="ds-link touch-target" onClick={retryMemoryReview}>{t("err.retry")}</button>
    </p>
  ) : stage ? (
    <StageCard m={stage} stored={nb.storedOf(stage)} index={0} queueLength={nb.waiting.length} compact={!desk} onEdited={retryMemoryReview} />
  ) : (
    <p className="about-note" data-testid="about-memory-empty">
      {nb.pending.length > 0 ? t("companion.about.memory.inAreas") : nb.approved.length > 0 ? t("companion.about.memory.allChecked") : t("companion.about.memory.empty")}
    </p>
  );

  const tellBox = (
    <div className={desk ? "cobj about-tell" : "stack about-tell"} data-testid="profile-hub-hero">
      <h2 className="about-tell-title">{t("companion.about.title", { name: first })}</h2>
      <div className="line about-tell-btns">
        <button type="button" className="btn sm grow nowrap about-btn-tint touch-target" data-testid="about-voice" {...CAPTURE_MOVE} onClick={() => openSheet(null, "voice")}>
          <Icon name="graphic_eq" size={18} />{t("companion.about.voice")}
        </button>
        <button type="button" className={`btn sm ghost nowrap about-btn-card${desk ? "" : " grow"} touch-target`} data-testid="about-write" onClick={() => openSheet(null, "write")}>
          <Icon name="edit" size={18} />{t("companion.about.write")}
        </button>
      </div>
    </div>
  );

  const waitingNotes = railPending.map((m) => <PendingNote key={m.memoryId} m={m} />);
  const rememberedNote = newest && !memoryReviewError
    ? <RememberedNote m={newest} stored={nb.storedOf(newest)} onEdited={retryMemoryReview} />
    : null;
  const moreInAreas = nb.inAreasCount > 0 && <p className="about-note small" data-testid="about-memory-in-areas">{t("companion.about.memory.inAreas")}</p>;

  const ledgerDoor = (
    <MoreLink onClick={toggleLedger} className="about-ledger-door">
      <span data-testid="profile-remember-check" aria-expanded={ledgerOpen} aria-controls={LEDGER_ID}>{t("companion.about.memory.open")}</span>
    </MoreLink>
  );

  const areasTile = (
    <section className="vt about-areas" aria-labelledby="about-aspects-title" data-module="about-aspects">
      {desk && (
        <div className="vh">
          <span className="gi" aria-hidden="true"><Icon name="menu_book" size={16} /></span>
          <h2 className="h3" id="about-aspects-title">{t("companion.about.aspectsTitle")}</h2>
          <span className="small" data-testid="about-told-line">{toldLine}</span>
          {ledgerDoor}
        </div>
      )}
      <ul className={desk ? "about-a8 desk" : "about-a8 a8m"} data-testid="about-aspects" role="list">
        {aspects.map((state) => (
          <li key={state.id}>
            <AspectCard state={state} name={first} artSize={desk ? 48 : 36} onTell={(id) => openSheet(id, "write")} onEditDetails={() => setEditingProfile(true)} />
          </li>
        ))}
      </ul>
      <div className="line between about-areas-foot">
        <TokenLegend items={[
          { token: <Token kind="neutral" className="told" size="sm" label={copy.tokenToldOne} />, label: desk ? copy.tokenTold : copy.tokenToldOne },
          { token: <Token kind="neutral" state="ai" size="sm" label={copy.tokenWaitingOne} />, label: copy.tokenWaiting },
        ]} />
        <MoreLink onClick={() => setActiveTab("science")}>{t("nav.view.science")}</MoreLink>
      </div>
    </section>
  );

  // B-GROWTH-05 — Measurements: the parent-logged growthEntries log, the
  // UNCHANGED card, closed by default; the pediatrician packet still reads the
  // same collection. The route's ONE disclosure; the log is the demoted module (R25).
  const measurements = (
    <details data-testid="profile-measurements" data-module-disclosure="about-details" className="about-measurements">
      <summary className="btn sm ghost nowrap about-btn-card">{t("elev.growthTruth.profile.measurements.title")}</summary>
      <div data-module="about-measurements" data-module-demoted className="about-measurements-body">
        <PhysicalGrowthCard embedded />
      </div>
    </details>
  );

  // Section 3's three tiles: one module, laid out as a row (desktop) or a stack (phone).
  const toldTiles = (
    <div className={desk ? "bento about-told-row" : "about-told-stack"} data-module="about-told">
      <KeptDescription testId="memory-describe" />
      <CoachDataContract ledgerUnreadable={memoryReviewError} />
      <AboutChildTile compact={!desk} onEditDetails={() => setEditingProfile(true)} measurements={measurements} onKeepsakes={openKeepsakes} />
    </div>
  );

  const ledger = ledgerOpen && (
    <div id={LEDGER_ID} data-testid="about-memory-ledger" className="about-memory-ledger" style={{ scrollMarginBlockStart: "calc(var(--sticky-offset, 0px) + 12px)" }}>
      <React.Suspense fallback={<p role="status" className="small">{t("aria.loading")}</p>}>
        <ChildMemoryLedger hidePendingIds={askedHere} focusFactId={factId} keepsakesOpen={keepsakesOpen} />
      </React.Suspense>
    </div>
  );

  const sheets = (
    <>
      {sheet && <TellArborMore key={`${sheet.aspect ?? "all"}-${sheet.mode}`} aspect={sheet.aspect} mode={sheet.mode} onClose={closeSheet} />}
      <ProfileEditDrawer open={editingProfile} onClose={() => setEditingProfile(false)} />
    </>
  );

  /* ── desktop: stage (8) + rail (4), then rows of tiles ─────────────────── */
  if (desk) {
    return (
      <DsRoot composition="desk" className="ds-about" data-testid="profile-about" aria-labelledby="about-title">
        <Guide stops={stops} label={copy.onThisPage} />
        <Route composition="desk">
          <AnswerSection>
            <div className="rowa">
              <div className="stg">
                <Scene field="child" orbs={[{ size: 440, left: -230, bottom: -290, opacity: 0.65 }, { size: 380, right: -190, top: -250, opacity: 0.65, b: true }]} className="about-scene">
                  {heading}
                  {figs}
                  {answer}
                </Scene>
              </div>
              <div className="rlc" id="waiting">
                <div className="rhead"><span className="rstop inline" aria-hidden="true">2</span><h2 className="h3">{copy.guideWaiting}</h2></div>
                {tellBox}
                {waitingNotes}
                {rememberedNote}
                {moreInAreas}
              </div>
            </div>
          </AnswerSection>

          <section className="rsec" id="tell" aria-labelledby="about-told-title">
            <span className="rstop" aria-hidden="true">3</span>
            <div className="rhead"><h2 className="h3" id="about-told-title">{copy.toldSection}</h2></div>
            {toldTiles}
          </section>

          <section className="rsec" id="areas">
            <span className="rstop" aria-hidden="true">4</span>
            {areasTile}
            {ledger}
          </section>
        </Route>
        {sheets}
      </DsRoot>
    );
  }

  /* ── phone: scene, the one action, snap row, the notebook, the tiles ───── */
  return (
    <DsRoot composition="phone" className="ds-about" data-testid="profile-about" aria-labelledby="about-title">
      <Guide stops={stops} mini label={copy.onThisPage} />
      <Route composition="phone">
        <AnswerSection>
          <Scene field="child" orbs={[{ size: 250, left: -150, bottom: -160, opacity: 0.6 }, { size: 220, right: -130, top: -140, opacity: 0.6, b: true }]} className="about-scene">
            {heading}
            {figs}
            {answer}
          </Scene>
          {tellBox}
        </AnswerSection>

        {hasWaiting && (
          <section className="rsec" id="waiting" aria-labelledby="about-waiting-title">
            <span className="rstop" aria-hidden="true">2</span>
            {railPending.length > 0 && (
              <>
                <div className="snaphd"><h2 className="h3" id="about-waiting-title">{copy.moreWaiting(railPending.length)}</h2></div>
                <Snap label={copy.moreWaiting(railPending.length)} className="about-snap">{waitingNotes}</Snap>
                {railPending.length > 1 && <SnapDots count={railPending.length} />}
              </>
            )}
            {railPending.length === 0 && <h2 className="h3 about-snap-title" id="about-waiting-title">{copy.guideWaiting}</h2>}
            {rememberedNote}
            {moreInAreas}
          </section>
        )}

        <section className="rsec" id="areas">
          <span className="rstop" aria-hidden="true">{hasWaiting ? 3 : 2}</span>
          <div className="rhead">
            <h2 className="h3" id="about-aspects-title">{t("companion.about.aspectsTitle")}</h2>
            {ledgerDoor}
          </div>
          <span className="small about-told-line" data-testid="about-told-line">{toldLine}</span>
          {areasTile}
          {ledger}
          {toldTiles}
        </section>
      </Route>
      {sheets}
    </DsRoot>
  );
}
