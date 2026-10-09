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
  const he = uiLang === "he";
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
  const { ref: panelRef } = useDialog<HTMLElement>({ open: modal, onClose: close, returnFocusRef: launchRef });
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
    {modal && <button type="button" tabIndex={-1} className="companion-workspace-backdrop" aria-label={he ? "סגירת השיחה" : "Close conversation"} onClick={close} />}
    {mounted && !kidLocked && <aside ref={panelRef} hidden={!visible} className="arbor-parent companion-conversation" role={modal ? "dialog" : "complementary"} aria-modal={modal || undefined} aria-labelledby="companion-conversation-title">
      <header className="companion-conversation-heading">
        <ArborMark size={30} />
        <div className="companion-conversation-identity">
          <h2 id="companion-conversation-title">Arbor</h2>
          <span dir="auto">{childProfile.name}{activeFamilyTopic ? ` · ${activeFamilyTopic.title}` : ""}</span>
        </div>
        {wide && <button type="button" className="companion-chrome-button" onClick={() => setExpanded(value => !value)} aria-label={expanded ? (he ? "חזרה לצד המסך" : "Show beside the page") : (he ? "הרחבת השיחה" : "Expand conversation")}><Icon name={expanded ? "close_fullscreen" : "open_in_full"} size={20} /></button>}
        <button type="button" className="companion-chrome-button" onClick={close} aria-label={he ? "סגירת השיחה וחזרה למסך" : "Close conversation and return to the page"}><Icon name="close" size={22} /></button>
      </header>
      <ErrorBoundary><Suspense fallback={<p className="companion-loading" role="status">{he ? "פותחים את השיחה…" : "Opening your conversation…"}</p>}>
        <CoachTab key={childProfile.id} embedded visible={visible} />
      </Suspense></ErrorBoundary>
    </aside>}
    </div>
    {!visible && !kidLocked && <div className="arbor-parent companion-launcher" data-testid="companion-launcher">
      <button ref={launchRef} type="button" className="companion-launch-main" onClick={show} aria-haspopup="dialog" aria-label={he ? "לדבר עם Arbor — טקסט, תמונה או קול" : "Talk with Arbor — text, photo or voice"}>
        <ArborMark size={27} /><span>{chatInput.trim() ? (he ? "להמשיך את הטיוטה" : "Continue your draft") : (he ? "מה תרצו לשתף?" : "What would you like to share?")}<small>{he ? "לכתוב, להראות, לדבר" : "Write, show, talk"}</small></span><Icon name="arrow_forward" size={20} className="rtl:-scale-x-100" />
      </button>
      <button type="button" className="companion-launch-save" onClick={() => openCaptureSheet({ mode: "text" })} aria-label={he ? "רק לשמור רגע" : "Just keep a moment"}><Icon name="add_a_photo" size={21} /><span>{he ? "לשמור רגע" : "Keep a moment"}</span></button>
    </div>}
  </div>;
}
