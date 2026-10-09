import { translate as inputText } from "../../lib/i18n";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useDialog } from "../../hooks/useDialog";
import { COMPANION_CONVERSATION_EVENT, type CompanionConversationRequest } from "../../lib/companionConversation";
import Icon from "../ui/Icon";
import { ArborMark } from "../ui/ArborMark";
import { ErrorBoundary } from "../ErrorBoundary";
import "./companionWorkspace.css";

const CoachTab = lazy(() => import("../tabs/CoachTab"));

/** Mounted above routes: changing a view must not restart a draft, turn or microphone session. */
export default function CompanionWorkspace({ children, kidLocked }: { children: React.ReactNode; kidLocked: boolean }) {
  const { activeTab, setActiveTab, childProfile, activeFamilyTopic, setChatInput, chatInput, openCaptureSheet } = useArbor();
  const { uiLang } = useLanguage();
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
  const show = () => { setMounted(true); setOpen(true); };
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (routeIsConversation) { show(); setExpanded(true); }
    else { returnTab.current = activeTab; setExpanded(false); }
  }, [activeTab]);
  useEffect(() => {
    const receive = (event: Event) => {
      if (kidLocked) return;
      const detail = (event as CustomEvent<CompanionConversationRequest>).detail;
      if (typeof detail?.prompt === "string") setChatInput(current => current.trim() && current.trim() !== detail.prompt?.trim() ? `${current}\n\n${detail.prompt}` : detail.prompt ?? current);
      show();
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
          <span dir="auto">{childProfile.name}{activeFamilyTopic ? ` · ${activeFamilyTopic.title}` : ""}</span>
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
      <button ref={launchRef} type="button" className="companion-launch-main" onClick={show} aria-haspopup="dialog" aria-label={inputText(uiLang, "companion.input.talk-with-arbor-text-photo-or-voice")}>
        <ArborMark size={27} /><span className="companion-launch-copy">{chatInput.trim() ? (inputText(uiLang, "companion.input.continue-your-draft")) : (inputText(uiLang, "companion.input.what-would-you-like-to-share"))}<small>{inputText(uiLang, "companion.input.write-show-talk")}</small></span><Icon name="arrow_forward" size={20} className="rtl:-scale-x-100" />
      </button>
      <button type="button" className="companion-launch-save" onClick={() => openCaptureSheet({ mode: "text" })} aria-label={inputText(uiLang, "companion.input.just-keep-a-moment")}><Icon name="add_a_photo" size={21} /><span className="companion-launch-save-label">{inputText(uiLang, "companion.input.keep-a-moment")}</span></button>
    </div>}
  </div>;
}
