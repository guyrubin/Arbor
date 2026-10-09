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
    setOpen(false); setMounted(false); setExpanded(false);
    if (routeIsConversation) setActiveTab("overview");
  }, [childProfile.id]);
  useEffect(() => { if (kidLocked) setOpen(false); }, [kidLocked]);

  return <div className={`companion-workspace${visible ? " is-open" : ""}${expanded ? " is-expanded" : ""}`}>
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
    {!visible && !kidLocked && <div className="arbor-parent companion-launcher" data-testid="companion-launcher">
      <button ref={launchRef} type="button" className="companion-launch-main" onClick={() => show("launcher")} aria-haspopup="dialog" aria-label={inputText(uiLang, "companion.input.talk-with-arbor-text-photo-or-voice")}>
        <ArborMark size={27} /><span className="companion-launch-copy">{chatInput.trim() ? (inputText(uiLang, "companion.input.continue-your-draft")) : (inputText(uiLang, "companion.input.what-would-you-like-to-share"))}<small>{inputText(uiLang, "companion.input.write-show-talk")}</small></span><Icon name="arrow_forward" size={20} className="rtl:-scale-x-100" />
      </button>
      {hardMomentDoor && activeTab !== "overview" && <button type="button" className="companion-launch-save companion-launch-hard" data-testid="launcher-hard-moment" onClick={() => openHardMomentNow()} aria-label={inputText(uiLang, "companion.input.hard-moment-aria")}><Icon name="volunteer_activism" size={21} /><span className="companion-launch-save-label">{inputText(uiLang, "companion.input.hard-moment")}</span></button>}
      <button type="button" className="companion-launch-save" onClick={() => openCaptureSheet({ mode: "text" })} aria-label={inputText(uiLang, "companion.input.just-keep-a-moment")}><Icon name="add_a_photo" size={21} /><span className="companion-launch-save-label">{inputText(uiLang, "companion.input.keep-a-moment")}</span></button>
    </div>}
  </div>;
}
