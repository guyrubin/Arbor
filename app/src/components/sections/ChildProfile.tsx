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
import { ASPECT_ICONS, asAspectId, aspectOfKept, aspectOfWords, buildAspects, isTold, toldSummary, type AspectId } from "../../lib/aboutAspects";
import { keptItemsFromProfile } from "../../lib/describeChild";
import AspectCard from "../about/AspectCard";
import { PendingNote, RememberedNote, SHOWN_PENDING, StageCard, aboutAskedPendingIds, useAboutNotebook } from "../about/AboutAnswer";
import AboutChildTile from "../about/AboutChildTile";
import AboutAreaIndex from "../about/AboutAreaIndex";
import { useShellRowEnd } from "../../lib/shellSlots";
import AboutHowToRead from "../about/AboutHowToRead";
import AboutLastVisit from "../about/AboutLastVisit";
import NowWorthKnowing from "../companion/now10/NowWorthKnowing";
import { milestonesV10Copy } from "../companion/milestonesV10Copy";
import { NOW_COPY } from "../companion/nowViewCopy";
import { useNowClock } from "../companion/useNowClock";
import { ageYearsFromProfile } from "../../lib/childAge";
import { LEDGER_ID, useLedgerArrival } from "../about/useLedgerArrival";
import TellArborMore from "../describe/TellArborMore";
import KeptDescription from "../describe/KeptDescription";
import CoachDataContract from "../coach/CoachDataContract";
import { Icon } from "../ui/Icon";
import { DsRoot, Fig, Guide, Route, Scene, Snap, StartHere, Token, TokenLegend, type GuideStop } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { aboutCopy } from "../about/aboutViewCopy";
import "../about/aboutV10.css";

/**
 * v3 F-CHILD-3 → design v10.3 (the My child frame) — My child › About
 * (#/profile): Arbor's notebook about the child, and the parent's own words.
 * The N-About boards' route:
 *  1. The notebook — one header band (kicker, the h1, one line, "Tell Arbor by
 *     voice" / "Write" — the route's ONE primary move, capture-moment, in every
 *     state — and one figure: notes waiting, with the remembered count under
 *     it), then the index: the eight areas as one row of segments, each with
 *     what was told there (a count of the parent's record, never a share) and
 *     whether something waits;
 *  2. That area — the next proposal as a card with its thread and Remember /
 *     Not this / Edit (the notebook's ONE approval home, the same write the
 *     ledger uses), the others waiting, then what the parent told Arbor about
 *     the selected area (their lines with Edit / Remove, the "Still true?"
 *     prompt, a proposal placed in the area with Confirm / No, Tell more, Open
 *     the moments). Beside it: how to read the page, what the coach sees (the
 *     weekly consent switch: a consent control never waits on a ledger read),
 *     the newest remembered fact (Edit / Forget, the day it forgets) and the
 *     last visit as one line;
 *  3. The child — Edit details, Create hero, Measurements, Moments and
 *     keepsakes, Everything Arbor remembers (the ledger, in place), How Arbor
 *     works — and the lines that name no area, with the door to tell more.
 * `?aspect=<id>` opens the conversation on that area and selects it (#/language
 * and #/strengths land here). Nothing on the page grades the child: no share,
 * no fill, no "of 8". Desktop and phone are two compositions of the same
 * objects; ONE tree renders, so each control exists once in the DOM.
 */
/** B-CAREPRO-38 — the full ledger ("Everything Arbor remembers"), loaded when
 *  the parent opens it (or arrives on a retired #/memory link). */
const ChildMemoryLedger = React.lazy(() => import("./ChildMemory"));

/** The route's ONE primary move (B-SHELL-26): capture-moment, on "Tell Arbor
 *  by voice" — telling Arbor one thing, rendered once in every state. */
const CAPTURE_MOVE = { "data-primary-move": "capture-moment" } as const;

/** Stop 1, "Answer Arbor": the route's first module (desktop: the stage and the rail; phone: the scene and the tell box). */
type SheetMode = "write" | "voice";
type SheetOpen = { aspect: AspectId | null; mode: SheetMode };

export default function ChildProfile() {
  const { childProfile, approvedMemoryItems, pendingMemoryItems, activeTab, memoryReviewError, retryMemoryReview, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const copy = aboutCopy(uiLang);
  const now = useNowClock();
  // V77 (N-About-D): the pill row ends "Monday 16 November · nothing is remembered without your approval".
  useShellRowEnd({ suffix: copy.rowEndSuffix });
  const composition = useComposition();
  const desk = composition === "desk";
  const first = childProfile.name.split(" ")[0] || childProfile.name;
  const [editingProfile, setEditingProfile] = useState(false);
  const [keepsakesOpen, setKeepsakesOpen] = useState(false);
  const [picked, setPicked] = useState<AspectId | null>(null);

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

  // v10.3: the index picks ONE area for the panel — the tapped one, else the
  // area of `?aspect=`, else the first with a proposal waiting, else the first told.
  const waitingAreas = new Set(aspects.filter((a) => a.pending).map((a) => a.id));
  const selectedId: AspectId = picked ?? queryAspect ?? aspects.find((a) => a.pending)?.id ?? aspects.find(isTold)?.id ?? aspects[0].id;
  const selected = aspects.find((a) => a.id === selectedId) ?? aspects[0];
  // Each of the parent's kept lines has one place: its area's panel, or (no area) the tile in stop 3.
  const keptAll = keptItemsFromProfile(childProfile);
  const keptHere = new Set(keptAll.filter((item) => aspectOfKept(item) === selectedId).map((item) => item.words.trim().toLowerCase()));
  const anyUnplaced = keptAll.some((item) => aspectOfKept(item) === null);

  const nb = useAboutNotebook(aspects);
  const stage = nb.waiting[0] ?? null;
  const alsoWaiting = nb.waiting.slice(1, SHOWN_PENDING);
  const newest = nb.remembered[0] ?? null;
  const openKeepsakes = () => {
    setKeepsakesOpen(true);
    if (!ledgerOpen) toggleLedger();
    setTimeout(() => document.getElementById("memory-keepsakes")?.scrollIntoView({ block: "start" }), 300);
  };

  const stops: GuideStop[] = desk
    ? [
        { id: "areas", title: copy.guideNotebook, sub: copy.guideNotebookSub },
        { id: "area", title: copy.guideArea, sub: copy.guideAreaSub },
        { id: "child", title: first, sub: copy.guideChildSub },
      ]
    : [
        { id: "areas", title: copy.guideNotebookShort },
        { id: "area", title: copy.guideAreaShort },
        { id: "child", title: copy.guideNotesShort },
      ];

  /* ── stop 1: the header band and the index ─────────────────────────────── */

  const tellButtons = (
    <div className="line about-tell-btns" data-testid="profile-hub-hero" role="group" aria-label={t("companion.about.title", { name: first })}>
      <button type="button" className={`btn sm nowrap about-btn-tint touch-target${desk ? "" : " grow"}`} data-testid="about-voice" {...CAPTURE_MOVE} onClick={() => openSheet(null, "voice")}>
        <Icon name="graphic_eq" size={18} />{t("companion.about.voice")}
      </button>
      <button type="button" className={`btn sm ghost nowrap about-btn-card touch-target${desk ? "" : " grow"}`} data-testid="about-write" onClick={() => openSheet(null, "write")}>
        <Icon name="edit" size={18} />{t("companion.about.write")}
      </button>
    </div>
  );
  // A count of notes in the notebook, with its unit in words; no figure for zero.
  // V77: one remembered fact names the real area it is kept under.
  const rememberedArea = nb.approved.length === 1 ? (aspects.find((a) => a.known?.memoryId === nb.approved[0].memoryId)?.id ?? aspectOfWords(nb.approved[0].fact)) : null;
  const rememberedSub = nb.approved.length === 0 ? undefined
    : rememberedArea ? copy.figRememberedUnder(nb.approved.length, t(`companion.about.aspect.${rememberedArea}`)) : copy.figRemembered(nb.approved.length);
  const fig = nb.pending.length > 0
    ? <Fig size="md" n={nb.pending.length} unit={copy.figWaiting} sub={rememberedSub} />
    : nb.approved.length > 0 ? <Fig size="md" n={nb.approved.length} unit={copy.figRemembered(nb.approved.length)} /> : null;

  const band = (
    <section className="rsec" id="areas" data-module="about-aspects" aria-labelledby="about-title">
      <span className="rstop on" style={{ top: 14 }} aria-hidden="true">1</span>
      <Scene field="now" orbs={desk ? [{ size: 440, left: -230, bottom: -290, opacity: 0.65 }, { size: 380, right: -190, top: -250, opacity: 0.65, b: true }] : [{ size: 250, left: -150, bottom: -160, opacity: 0.6 }, { size: 220, right: -130, top: -140, opacity: 0.6, b: true }]} className="about-band">
        <div className={desk ? "mch" : "mch m"}>
          <div className="mcl">
            <span className="line about-kick">
              <span className="kicker">{t("nav.child")} · {t("nav.pill.profile.named", { name: first })}</span>
              <StartHere>{copy.startHere}</StartHere>
            </span>
            {/* No dir on the h1: it keeps text-align:start in the PAGE direction; t() isolates the name. */}
            <h1 id="about-title" className="hero">{t("companion.about.memory.title", { name: first })}</h1>
            <p>{t("companion.about.memory.sub")}</p>
          </div>
          <div className="mcr">
            <div className="mcf">
              {desk ? <>{tellButtons}{fig}</> : <>{fig}</>}
            </div>
            {!desk && tellButtons}
          </div>
        </div>
        <AboutAreaIndex aspects={aspects} selected={selectedId} waiting={waitingAreas} onSelect={setPicked} phone={!desk} />
        <div className="mcap">
          {/* N-About-M draws no legend on the phone. */}
          {desk && <TokenLegend items={[
            { token: <Token kind="neutral" className="told" size="sm" label={copy.tokenToldOne} />, label: copy.tokenTold },
            { token: <Token kind="neutral" state="ai" size="sm" label={copy.tokenWaitingOne} />, label: copy.tokenWaiting },
          ]} />}
          {desk && <span data-testid="about-told-line">{toldLine}</span>}
        </div>
      </Scene>
      {!desk && <span className="small about-told-line" data-testid="about-told-line">{toldLine}</span>}
    </section>
  );

  /* ── stop 2: the selected area — what waits, what you told ─────────────── */

  const answer = memoryReviewError ? (
    <p className="about-note" role="status" data-testid="about-memory-error">
      {t("companion.about.memory.loadFailed")}{" "}
      <button type="button" className="ds-link touch-target" onClick={retryMemoryReview}>{t("err.retry")}</button>
    </p>
  ) : stage ? (
    <StageCard m={stage} stored={nb.storedOf(stage)} index={0} queueLength={nb.waiting.length} compact={!desk} onEdited={retryMemoryReview} />
  ) : (
    nb.pending.length > 0
      ? <p className="about-note" data-testid="about-memory-in-areas">{t("companion.about.memory.inAreas")}</p>
      : <p className="about-note" data-testid="about-memory-empty">{nb.approved.length > 0 ? t("companion.about.memory.allChecked") : t("companion.about.memory.empty")}</p>
  );
  const also = alsoWaiting.length > 0 && (
    <>
      <div className="line between about-also"><h3 className="lab">{copy.alsoWaiting}</h3>{!desk && <span className="small">{copy.position(1, alsoWaiting.length)}</span>}</div>
      {desk
        ? <div className="about-also-grid">{alsoWaiting.map((m) => <PendingNote key={m.memoryId} m={m} />)}</div>
        : <Snap label={copy.alsoWaiting} className="about-snap">{alsoWaiting.map((m) => <PendingNote key={m.memoryId} m={m} />)}</Snap>}
    </>
  );

  const panel = (
    <div className="mcst about-panel" aria-labelledby="about-area-title">
      <div className="mcsh">
        <i className="tg" aria-hidden="true"><Icon name={ASPECT_ICONS[selectedId]} size={20} /></i>
        <h2 className="tt" id="about-area-title">{t(`companion.about.aspect.${selectedId}`)}</h2>
      </div>
      <h3 className="lab">{copy.waitingForYou}</h3>
      {answer}
      {also}
      <AspectCard
        key={selectedId}
        state={selected}
        name={first}
        onTell={(id) => openSheet(id, "write")}
        onEditDetails={() => setEditingProfile(true)}
        keptWords={keptHere}
        kept={<KeptDescription bare testId={`about-kept-${selectedId}`} filter={(item) => aspectOfKept(item) === selectedId} />}
      />
    </div>
  );

  const rememberedNote = newest && !memoryReviewError
    ? <RememberedNote m={newest} stored={nb.storedOf(newest)} onEdited={retryMemoryReview} />
    : null;
  // V77 (N-About-D): "Worth knowing at three" closes the desk rail — the shared
  // card bound to today's reviewed Learn pick (My child's same card and kicker
  // rule); no new developmental sentence. The phone board does not draw it.
  const msCopy = milestonesV10Copy(uiLang);
  const years = Math.floor(ageYearsFromProfile(childProfile) ?? 0);
  const worthKicker = years >= 1 && years < msCopy.ageWords.length ? msCopy.worthKnowingAt.replace("{age}", msCopy.ageWords[years]) : msCopy.worthKnowing;
  const rail = (
    <>
      <AboutHowToRead compact={!desk} />
      <CoachDataContract ledgerUnreadable={memoryReviewError} />
      {rememberedNote}
      {desk && <AboutLastVisit className="mbtn about-visit-link" />}
      {desk && (
        <div className="about-know" data-testid="about-worth-knowing">
          <NowWorthKnowing lang={uiLang === "he" ? "he" : "en"} kicker={worthKicker} readMinutes={NOW_COPY[uiLang === "he" ? "he" : "en"].readMinutes}
            composition="phone" now={now} source="about-worth-knowing" />
        </div>
      )}
    </>
  );

  /* ── stop 3: the child, and the lines that name no area ─────────────────── */

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

  const ledger = ledgerOpen && (
    <div id={LEDGER_ID} data-testid="about-memory-ledger" className="about-memory-ledger" style={{ scrollMarginBlockStart: "calc(var(--sticky-offset, 0px) + 12px)" }}>
      <React.Suspense fallback={<p role="status" className="small">{t("aria.loading")}</p>}>
        <ChildMemoryLedger hidePendingIds={askedHere} focusFactId={factId} keepsakesOpen={keepsakesOpen} />
      </React.Suspense>
    </div>
  );

  const childRow = (
    <div className={desk ? "bento about-child-row" : "about-told-stack"} data-module="about-told">
      <AboutChildTile compact={!desk} onEditDetails={() => setEditingProfile(true)} measurements={measurements} onKeepsakes={openKeepsakes}
        onLedger={toggleLedger} ledgerOpen={ledgerOpen} onHowItWorks={() => setActiveTab("science")} />
      {/* The door to the ONE guided conversation, and the lines that name no area. */}
      <KeptDescription testId="memory-describe" filter={(item) => aspectOfKept(item) === null} title={anyUnplaced ? copy.otherTold : undefined} placedNote={copy.keptInAreas} />
    </div>
  );

  const sheets = (
    <>
      {sheet && <TellArborMore key={`${sheet.aspect ?? "all"}-${sheet.mode}`} aspect={sheet.aspect} mode={sheet.mode} onClose={closeSheet} />}
      <ProfileEditDrawer open={editingProfile} onClose={() => setEditingProfile(false)} />
    </>
  );

  return (
    <DsRoot composition={composition} className="ds-about" data-testid="profile-about" aria-labelledby="about-title">
      <Guide stops={stops} mini={!desk} label={copy.onThisPage} />
      <Route composition={composition}>
        {band}
        <section className="rsec" id="area" data-module="about-answer" aria-labelledby="about-area-title">
          <span className="rstop" aria-hidden="true">2</span>
          {desk ? (
            <div className="rowa">
              <div className="stg">{panel}</div>
              <div className="rlc">{rail}</div>
            </div>
          ) : panel}
        </section>
        <section className="rsec" id="child" aria-labelledby="about-child-title">
          <span className="rstop" aria-hidden="true">3</span>
          {!desk && rail}
          {childRow}
          {ledger}
        </section>
      </Route>
      {sheets}
    </DsRoot>
  );
}
