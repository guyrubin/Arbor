import { translate as inputText } from "../../lib/i18n";
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useDialog } from "../../hooks/useDialog";
import { COMPANION_CONVERSATION_EVENT, type CompanionConversationRequest } from "../../lib/companionConversation";
import { trackCompanionPanelOpen } from "../../lib/kpiEvents";
import Icon from "../ui/Icon";
import { ArborMark } from "../ui/ArborMark";
import { ErrorBoundary } from "../ErrorBoundary";
import { availableHardMomentCards } from "../../content/selectCards";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { NOW_COPY } from "./nowViewCopy";
import "./companionWorkspace.css";

const CoachTab = lazy(() => import("../tabs/CoachTab"));

/** Mounted above routes: changing a view must not restart a draft, turn or microphone session. */
export default function CompanionWorkspace({ children, kidLocked }: { children: React.ReactNode; kidLocked: boolean }) {
  const { activeTab, setActiveTab, childProfile, activeFamilyTopic, setChatInput, chatInput, openCaptureSheet, openHardMomentNow } = useArbor();
  const { uiLang } = useLanguage();
  // B-ASKJB-39: the hard-moment sheet is one tap from every parent screen. Same gate
  // as Now's door (a pilot guide fits this child and language); Now keeps its own door.
  const hardMomentDoor = useMemo(() => {
    const at = new Date();
    return availableHardMomentCards({ now: at, ageMonths: ageMonthsFromProfile(childProfile, at), locale: uiLang === "he" ? "he" : "en" }).length > 0;
  }, [childProfile, uiLang]);
  const routeIsConversation = activeTab === "coach" || activeTab === "scholar";
  const [open, setOpen] = useState(routeIsConversation);
  const [mounted, setMounted] = useState(routeIsConversation);
  const [expanded, setExpanded] = useState(routeIsConversation);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches);
  const previousChild = useRef(childProfile.id);
  const returnTab = useRef<"overview" | typeof activeTab>("overview");
  const launchRef = useRef<HTMLButtonElement>(null);
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
    setOpen(false);
    if (routeIsConversation) setActiveTab(returnTab.current);
    else requestAnimationFrame(() => launchRef.current?.focus());
  };
  const { ref: panelRef } = useDialog<HTMLElement>({ open: modal, onClose: close, returnFocusRef: launchRef, persistentLayer: true });
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
  useEffect(() => {
    if (captureRef.current) captureRef.current.open = false;
    if (routeIsConversation) { show("route"); setExpanded(true); }
    else {
      returnTab.current = activeTab; setExpanded(false);
      // An answer's own action (Plan, Teacher note, Specialist, Manage memory)
      // moved the page. Below 1280px the panel is full-screen and would hide
      // the page the parent just asked for, so it steps aside; the draft and
      // thread stay mounted and the launcher brings them back. Wide screens
      // keep it docked beside the page.
      if (!wide) setOpen(false);
    }
  }, [activeTab]);
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
    if (routeIsConversation) setActiveTab("overview");
  }, [childProfile.id]);
  useEffect(() => { if (kidLocked) setOpen(false); }, [kidLocked]);

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

  return <div ref={workspaceRef} className={`companion-workspace${visible ? " is-open" : ""}${expanded ? " is-expanded" : ""}`}>
    {children}
    <div className="companion-panel-layer" data-arbor-dialog-layer>
    {modal && <button type="button" tabIndex={-1} className="companion-workspace-backdrop" aria-label={inputText(uiLang, "companion.input.close-conversation")} onClick={close} />}
    {mounted && !kidLocked && <aside ref={panelRef} tabIndex={-1} hidden={!visible} className="arbor-parent companion-conversation" role={modal ? "dialog" : "complementary"} aria-modal={modal || undefined} aria-labelledby="companion-conversation-title">
      <header className="companion-conversation-heading">
        <ArborMark size={30} />
        <div className="companion-conversation-identity">
          <h2 id="companion-conversation-title">Arbor</h2>
          <span><bdi dir="auto">{childProfile.name}{activeFamilyTopic ? ` · ${activeFamilyTopic.title}` : ""}</bdi></span>
        </div>
        {wide && <button type="button" className="companion-chrome-button" onClick={() => setExpanded(value => !value)} aria-label={expanded ? (inputText(uiLang, "companion.input.show-beside-the-page")) : (inputText(uiLang, "companion.input.expand-conversation"))}><Icon name={expanded ? "expand_less" : "fullscreen"} size={20} /></button>}
        <button type="button" className="companion-chrome-button" onClick={close} aria-label={inputText(uiLang, "companion.input.close-conversation-and-return-to-the-page")}><Icon name="close" size={22} /></button>
      </header>
      <ErrorBoundary><Suspense fallback={<p className="companion-loading" role="status">{inputText(uiLang, "companion.input.opening-your-conversation")}</p>}>
        <CoachTab key={childProfile.id} embedded visible={visible} />
      </Suspense></ErrorBoundary>
    </aside>}
    </div>
    {!visible && !kidLocked && <div className="arbor-parent companion-launcher-rail" data-testid="companion-launcher-rail"><div ref={launcherRef} className="arbor-parent companion-launcher" data-testid="companion-launcher">
      <button ref={launchRef} type="button" className="companion-launch-main" onClick={() => show("launcher")} aria-haspopup="dialog" aria-label={inputText(uiLang, "companion.input.talk-with-arbor-text-photo-or-voice")}>
        <ArborMark size={24} /><span className="companion-launch-copy">{chatInput.trim() ? (inputText(uiLang, "companion.input.continue-your-draft")) : copy.talk}</span><Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" />
      </button>
      {hardMomentDoor && activeTab !== "overview" && <button type="button" className="companion-launch-save companion-launch-hard" data-testid="launcher-hard-moment" onClick={() => openHardMomentNow()} aria-label={inputText(uiLang, "companion.input.hard-moment-aria")}><Icon name="volunteer_activism" size={21} /><span className="companion-launch-save-label">{inputText(uiLang, "companion.input.hard-moment")}</span></button>}
      <details ref={captureRef} className="companion-capture-menu" onKeyDown={event => {
        if (event.key === "Escape" && captureRef.current?.open) { event.stopPropagation(); captureRef.current.open = false; captureLabelRef.current?.focus(); }
      }} onBlur={event => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}>
        <summary ref={captureLabelRef} className="companion-launch-save" aria-label={inputText(uiLang, "companion.input.just-keep-a-moment")}><Icon name="edit_note" size={21} /><span className="companion-launch-save-label">{copy.captureShort}</span></summary>
        <div className="companion-capture-options" role="group" aria-label={copy.quickSave}>
          <button type="button" onClick={() => capture("text")}><Icon name="edit_note" size={21} />{copy.write}</button>
          <button type="button" onClick={() => capture("voice")}><Icon name="mic" size={21} />{copy.dictate}</button>
          <button type="button" onClick={() => capture("photo")}><Icon name="photo_camera" size={21} />{copy.photo}</button>
        </div>
      </details>
    </div></div>}
  </div>;
}
