import { translate as inputText } from "../../lib/i18n";
import React, { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useDialog } from "../../hooks/useDialog";
import { useVisualViewportInset } from "../../hooks/useVisualViewportInset";
import { COMPANION_CONVERSATION_EVENT, requestCompanionConversation, type CompanionConversationRequest } from "../../lib/companionConversation";
import { trackCompanionPanelOpen } from "../../lib/kpiEvents";
import { isKidModeActive } from "../../lib/kidModeGate";
import Icon from "../ui/Icon";
import { ArborMark } from "../ui/ArborMark";
import { ErrorBoundary } from "../ErrorBoundary";
import { availableHardMomentCards } from "../../content/selectCards";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { NOW_COPY } from "./nowViewCopy";
import { openFamilyTopicSheet } from "./familyTopicEvents";
import CompanionPanelMenu, { type CompanionPanelAction } from "./CompanionPanelMenu";
import "./companionWorkspace.css";

const CoachTab = lazy(() => import("../tabs/CoachTab"));

/** The route segment of a place address: "#/language/said?x=1" -> "language".
 *  A sub-route (lib/routes SUB_ROUTES) is that route's own address, so it is
 *  kept and given back whole, not cut to the bare route. */
const placeKey = (hash: string) => hash.replace(/^#\/?/, "").split("?")[0].split("/")[0];

/** Mounted above routes: changing a view must not restart a draft, turn or microphone session. */
export default function CompanionWorkspace({ children, kidLocked }: { children: React.ReactNode; kidLocked: boolean }) {
  const { activeTab, setActiveTab, childProfile, activeFamilyTopic, setChatInput, chatInput, openCaptureSheet, openHardMomentNow, newConversation } = useArbor();
  const { uiLang } = useLanguage();
  // B-ASKJB-39: the hard-moment sheet is one tap from every parent screen. Same gate
  // as Now's door (a pilot guide fits this child and language); Now keeps its own door.
  const hardMomentDoor = useMemo(() => {
    const at = new Date();
    return availableHardMomentCards({ now: at, ageMonths: ageMonthsFromProfile(childProfile, at), locale: uiLang === "he" ? "he" : "en" }).length > 0;
  }, [childProfile, uiLang]);
  // F-TALK-1: Talk is a panel, never a page. A conversation route (#/coach,
  // #/scholar and their aliases) opens the panel over the last place and the
  // address goes back to that place; at >= 1280 px the panel docks beside it.
  const routeIsConversation = activeTab === "coach" || activeTab === "scholar";
  // Under Kid Mode a conversation route is held, never opened (see below).
  const [open, setOpen] = useState(routeIsConversation && !kidLocked);
  const [mounted, setMounted] = useState(routeIsConversation && !kidLocked);
  const [expanded, setExpanded] = useState(false);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches);
  const previousChild = useRef(childProfile.id);
  const returnTab = useRef<"overview" | typeof activeTab>("overview");
  // The place under the panel: its page stays rendered while a conversation
  // route is replaced by it (no blank frame, no remount), and its own address,
  // query included, comes back.
  const placeChildren = useRef<React.ReactNode>(undefined);
  const placeHash = useRef<string | null>(null);
  const redirectTo = useRef<typeof activeTab | null>(null);
  // A conversation route that arrived while Kid Mode froze navigation.
  const heldByKid = useRef(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  if (!routeIsConversation) placeChildren.current = children;
  const launchRef = useRef<HTMLButtonElement>(null);
  const closeFocus = useRef<{ childId: string; tab: typeof activeTab } | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDetailsElement>(null);
  const captureLabelRef = useRef<HTMLElement>(null);
  const copy = NOW_COPY[uiLang === "he" ? "he" : "en"];
  const capture = (mode: "text" | "voice" | "photo") => {
    if (captureRef.current) captureRef.current.open = false;
    // The sheet must return focus to a visible control after it closes.
    captureLabelRef.current?.focus();
    openCaptureSheet({ mode });
  };
  const visible = open && !kidLocked;
  const modal = visible && (!wide || expanded);
  const close = () => {
    closeFocus.current = { childId: childProfile.id, tab: activeTab };
    setOpen(false);
  };
  // Replaces the conversation address with the place's own (replaceState, so
  // Back never lands on a conversation route again). A place address that is
  // more than the bare route (a query, #/development?view=program, or a
  // sub-route, #/language/said) is re-read by the app's own hash listener; a
  // plain one moves through setActiveTab.
  const returnToPlace = () => {
    const place = returnTab.current;
    redirectTo.current = place;
    const hash = placeHash.current;
    if (hash && hash !== `#/${place}`) {
      try {
        window.history.replaceState(window.history.state, "", hash);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        return;
      } catch { /* no history API: the plain path below still moves the route */ }
    }
    try { window.history.replaceState(window.history.state, "", `#/${place}`); } catch { /* no history API */ }
    setActiveTab(place);
  };
  // FEAT-01: the header menu reaches existing controls only. New conversation
  // is the history row's own handler (the question stays); history and tone
  // belong to the conversation, so they go through its one door.
  const panelAction = (action: CompanionPanelAction) => {
    if (action === "new") newConversation();
    else if (action === "history" || action === "tone") requestCompanionConversation({ panel: action, source: "panel-menu" });
    else if (action === "remembers") {
      // "What Arbor remembers" is a page, so the panel closes at every width
      // (thread and draft stay mounted; the launcher brings them back) and
      // focus lands on the launcher once the memory page has committed.
      closeFocus.current = { childId: childProfile.id, tab: "memory" };
      setOpen(false);
      setActiveTab("memory");
    }
    else setExpanded(value => !value);
  };
  // The active question rides on the launcher as one quiet line, "On: <question>"
  // (never with a draft). The words sit in their own bdi so a long question ends
  // in an ellipsis and a Latin title keeps its order inside Hebrew.
  const launcherTopic = !chatInput.trim() ? activeFamilyTopic?.title.trim() ?? "" : "";
  const [topicBefore, topicAfter = ""] = inputText(uiLang, "companion.launcher.topic").split("{title}");
  // F-TALK-1: the bar names its three ways in, "Ask Arbor - text, photo or
  // voice"; its accessible name is the visible words (a draft names the draft).
  const launchLabel = chatInput.trim() ? inputText(uiLang, "companion.input.continue-your-draft") : inputText(uiLang, "companion.launcher.label");
  // Direct Coach/Scholar entry has no mounted launcher until close commits.
  // Restore only an explicit close, after route/dialog cleanup; newer context
  // owns focus and cancels this return rather than moving or scrolling it.
  // Layout timing keeps an older opening effect from consuming a newer close.
  useLayoutEffect(() => {
    const request = closeFocus.current;
    if (!request) return;
    if (open || kidLocked || childProfile.id !== request.childId || activeTab !== request.tab) {
      closeFocus.current = null;
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (closeFocus.current !== request) return;
      closeFocus.current = null;
      if (!isKidModeActive()) launchRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, kidLocked, childProfile.id, activeTab]);
  const { ref: panelRef } = useDialog<HTMLElement>({ open: modal, onClose: close, returnFocusRef: launchRef, persistentLayer: true });
  // F-TALK-2 / MOB-03: full-screen on a phone, the composer stays above the keyboard.
  useVisualViewportInset(modal);
  useEffect(() => {
    if (visible && !modal) panelRef.current?.focus();
  }, [visible, modal, panelRef]);
  // A ref, not `open`: the seed listener's closure can be a render behind.
  const openRef = useRef(open);
  openRef.current = open;
  const show = (via: "launcher" | "seed" | "route") => {
    if (captureRef.current) captureRef.current.open = false;
    if (!openRef.current) trackCompanionPanelOpen(via);
    openRef.current = true;
    setMounted(true); setOpen(true);
  };
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  // Layout timing: the conversation route is replaced before paint, so the
  // address and the page underneath never show a conversation "page".
  // F-TALK-1 (review r1): Kid Mode freezes parent navigation (setActiveTab and
  // the hash listener are both gated), so a conversation route that arrives
  // under it (a reload on #/coach with Kid Mode still open) is held, not half
  // converted; the unlock effect below returns it to the place. The gate is
  // read too, because it can lead the kidLocked prop by a commit.
  useLayoutEffect(() => {
    if (captureRef.current) captureRef.current.open = false;
    if (routeIsConversation) { if (kidLocked || isKidModeActive()) heldByKid.current = true; else { show("route"); setExpanded(false); returnToPlace(); } }
    else {
      returnTab.current = activeTab; setExpanded(false);
      try {
        const hash = window.location.hash;
        placeHash.current = placeKey(hash) === activeTab ? hash : null;
      } catch { placeHash.current = null; }
      // Arriving back at the place from a conversation route keeps the panel open.
      const arrived = redirectTo.current === activeTab;
      redirectTo.current = null;
      // An answer's own action (Plan, Teacher note, Specialist, Manage memory)
      // moved the page. Below 1280px the panel is full-screen and would hide
      // the page the parent just asked for, so it steps aside; the draft and
      // thread stay mounted and the launcher brings them back. Wide screens
      // keep it docked beside the page.
      if (!arrived && !wide) setOpen(false);
    }
  }, [activeTab]);
  // A query change inside the same place (#/development to ?view=program) is
  // the place's address too.
  useEffect(() => {
    const remember = () => {
      try {
        const hash = window.location.hash;
        if (placeKey(hash) === activeTabRef.current) placeHash.current = hash;
      } catch { /* no location */ }
    };
    window.addEventListener("hashchange", remember);
    return () => window.removeEventListener("hashchange", remember);
  }, []);
  useEffect(() => {
    const receive = (event: Event) => {
      if (kidLocked) return;
      const detail = (event as CustomEvent<CompanionConversationRequest>).detail;
      if (typeof detail?.prompt === "string") setChatInput(current => current.trim() && current.trim() !== detail.prompt?.trim() ? `${current}\n\n${detail.prompt}` : detail.prompt ?? current);
      show("seed");
    };
    window.addEventListener(COMPANION_CONVERSATION_EVENT, receive);
    return () => window.removeEventListener(COMPANION_CONVERSATION_EVENT, receive);
  }, [kidLocked, setChatInput]);
  useEffect(() => {
    if (previousChild.current === childProfile.id) return;
    previousChild.current = childProfile.id;
    if (captureRef.current) captureRef.current.open = false;
    setOpen(false); setMounted(false); setExpanded(false);
  }, [childProfile.id]);
  useEffect(() => { if (kidLocked) setOpen(false); }, [kidLocked]);
  // The parent is back: a held conversation route goes quietly to the place
  // (the launcher is there; nothing opens on the child's last screen).
  useLayoutEffect(() => {
    if (kidLocked || !heldByKid.current) return;
    heldByKid.current = false;
    if (activeTabRef.current === "coach" || activeTabRef.current === "scholar") returnToPlace();
  }, [kidLocked]);

  // The launcher owns an intrinsic-height row outside the main scrollport.
  // Measure translated/wrapped chrome for keyboard clearance and the actual
  // fixed mobile nav (its buttons can be taller than the old --mobile-nav-h).
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const launcher = launcherRef.current;
    const navigation = workspace.closest(".arbor-app")?.querySelector<HTMLElement>(":scope > nav");
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && captureRef.current && !captureRef.current.contains(event.target)) captureRef.current.open = false;
    };
    const measure = () => {
      workspace.style.setProperty("--companion-launcher-height", `${launcher?.getBoundingClientRect().height ?? 0}px`);
      if (navigation) workspace.style.setProperty("--companion-navigation-height", `${navigation.getBoundingClientRect().height}px`);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (launcher) observer?.observe(launcher);
    if (navigation) observer?.observe(navigation);
    window.addEventListener("resize", measure);
    document.addEventListener("pointerdown", closeOutside);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); document.removeEventListener("pointerdown", closeOutside); };
  }, [visible, kidLocked, uiLang, activeTab, chatInput]);

  const openQuestion = () => openFamilyTopicSheet();
  const topicTitle = activeFamilyTopic?.title ?? "";
  return <div ref={workspaceRef} className={`companion-workspace${visible ? " is-open" : ""}${expanded ? " is-expanded" : ""}`}>
    {routeIsConversation && placeChildren.current !== undefined ? placeChildren.current : children}
    <div className="companion-panel-layer" data-arbor-dialog-layer>
    {modal && <button type="button" tabIndex={-1} className="companion-workspace-backdrop" aria-label={inputText(uiLang, "companion.input.close-conversation")} onClick={close} />}
    {mounted && !kidLocked && <aside ref={panelRef} tabIndex={-1} hidden={!visible} className="arbor-parent companion-conversation" role={modal ? "dialog" : "complementary"} aria-modal={modal || undefined} aria-labelledby="companion-conversation-title">
      <header className="companion-conversation-heading">
        <ArborMark size={30} />
        <div className="companion-conversation-identity">
          <h2 id="companion-conversation-title">Arbor</h2>
          {/* FEAT-05 / F-TALK-1: the active question opens the question sheet; text
              only, never a count or dot. Beside a wide page it is the chip alone;
              below 1280 px it is one muted line, "<child> · <question>". Without
              a question the header names the child. */}
          <div className="companion-conversation-context">
            {!activeFamilyTopic ? <span className="companion-conversation-name"><bdi dir="auto">{childProfile.name}</bdi></span>
              : wide ? <button type="button" className="companion-topic-chip" data-testid="conversation-topic-chip" aria-haspopup="dialog" aria-label={inputText(uiLang, "companion.topic-chip.open", { value0: topicTitle })} onClick={openQuestion}>
                <span className="companion-topic-chip-pill"><Icon name="bookmark" size={16} className="companion-topic-chip-icon" /><span className="companion-topic-chip-text" dir="auto">{topicTitle}</span></span>
              </button>
              : <button type="button" className="companion-topic-line" data-testid="conversation-topic-chip" aria-haspopup="dialog" aria-label={inputText(uiLang, "companion.topic-chip.open", { value0: topicTitle })} onClick={openQuestion}>
                <span className="companion-topic-line-text"><bdi dir="auto">{childProfile.name}</bdi> · <bdi dir="auto">{topicTitle}</bdi></span>
              </button>}
          </div>
        </div>
        <CompanionPanelMenu uiLang={uiLang === "he" ? "he" : "en"} panelVisible={visible} wide={wide} expanded={expanded} onSelect={panelAction} />
        <button type="button" className="companion-chrome-button" onClick={close} aria-label={inputText(uiLang, "companion.input.close-conversation-and-return-to-the-page")}><Icon name="close" size={22} /></button>
      </header>
      <ErrorBoundary><Suspense fallback={<p className="companion-loading" role="status">{inputText(uiLang, "companion.input.opening-your-conversation")}</p>}>
        <CoachTab key={childProfile.id} embedded visible={visible} />
      </Suspense></ErrorBoundary>
    </aside>}
    </div>
    {!visible && !kidLocked && <div className="arbor-parent companion-launcher-rail" data-testid="companion-launcher-rail"><div ref={launcherRef} className="arbor-parent companion-launcher" data-testid="companion-launcher">
      <button ref={launchRef} type="button" className="companion-launch-main" onClick={() => show("launcher")} aria-haspopup="dialog" aria-label={launchLabel} aria-describedby={launcherTopic ? "companion-launch-topic" : undefined}>
        <ArborMark size={24} /><span className="companion-launch-copy">{launchLabel}{launcherTopic && <span id="companion-launch-topic" className="companion-launch-topic">{topicBefore}<bdi dir="auto" className="companion-launch-topic-text">{launcherTopic}</bdi>{topicAfter || null}</span>}</span><Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
      </button>
      {hardMomentDoor && activeTab !== "overview" && <button type="button" className="companion-launch-save companion-launch-hard" data-testid="launcher-hard-moment" onClick={() => openHardMomentNow()} aria-label={inputText(uiLang, "companion.input.hard-moment-aria")}><Icon name="volunteer_activism" size={21} /><span className="companion-launch-save-label">{inputText(uiLang, "companion.input.hard-moment")}</span></button>}
      <details ref={captureRef} className="companion-capture-menu" onKeyDown={event => {
        if (event.key === "Escape" && captureRef.current?.open) { event.stopPropagation(); captureRef.current.open = false; captureLabelRef.current?.focus(); }
      }} onBlur={event => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}>
        <summary ref={captureLabelRef} className="companion-launch-save" aria-label={inputText(uiLang, "companion.input.just-keep-a-moment")}><Icon name="edit_note" size={21} /><span className="companion-launch-save-label">{copy.captureShort}</span></summary>
        <div className="companion-capture-options" role="group" aria-labelledby="companion-capture-heading">
          <p id="companion-capture-heading" className="companion-capture-heading">{copy.quickSave}</p>
          <button type="button" onClick={() => capture("text")}><Icon name="edit_note" size={21} />{copy.write}</button>
          <button type="button" onClick={() => capture("voice")}><Icon name="mic" size={21} />{copy.dictate}</button>
          <button type="button" onClick={() => capture("photo")}><Icon name="photo_camera" size={21} />{copy.photo}</button>
        </div>
      </details>
    </div></div>}
  </div>;
}
