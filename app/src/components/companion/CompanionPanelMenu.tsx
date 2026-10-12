import React, { useEffect, useId, useRef, useState } from "react";
import { translate as inputText } from "../../lib/i18n";
import Icon from "../ui/Icon";

/**
 * FEAT-01 — the conversation header's one options menu (more_horiz). It
 * gathers what was scattered across the panel: a new conversation, the
 * history row, how Arbor talks with you, what Arbor remembers and, beside a
 * wide page, expand / show beside the page. Every item reaches a control that
 * already exists; the menu holds no state of its own beyond being open.
 * Text only — never a count, dot or badge.
 */
export type CompanionPanelAction = "new" | "history" | "tone" | "remembers" | "widen";

type Item = { id: CompanionPanelAction; icon: string; labelKey: string; subKey?: string };

/** The items, in order. Expand appears only where the panel can dock (≥ 1280 px).
 *  F-TALK-1: three items carry a quiet second line saying what they keep or
 *  show (words only, never a count). */
export function companionPanelItems({ wide, expanded }: { wide: boolean; expanded: boolean }): Item[] {
  const items: Item[] = [
    { id: "new", icon: "add_comment", labelKey: "companion.panel.new", subKey: "companion.panel.new.sub" },
    { id: "history", icon: "history", labelKey: "companion.panel.history", subKey: "companion.panel.history.sub" },
    { id: "tone", icon: "record_voice_over", labelKey: "companion.panel.tone" },
    { id: "remembers", icon: "shield", labelKey: "companion.panel.remembers", subKey: "companion.panel.remembers.sub" },
  ];
  if (wide) items.push(expanded
    ? { id: "widen", icon: "expand_less", labelKey: "companion.input.show-beside-the-page" }
    : { id: "widen", icon: "fullscreen", labelKey: "companion.input.expand-conversation" });
  return items;
}

export default function CompanionPanelMenu({ uiLang, panelVisible, wide, expanded, onSelect }: {
  uiLang: "en" | "he";
  panelVisible: boolean;
  wide: boolean;
  expanded: boolean;
  onSelect: (action: CompanionPanelAction) => void;
}) {
  const [open, setOpen] = useState(false);
  // Which item takes focus when the menu opens (Arrow Up opens on the last).
  const [entry, setEntry] = useState<"first" | "last">("first");
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const items = companionPanelItems({ wide, expanded });
  const entries = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const dismiss = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  // A hidden panel never keeps a menu open behind it.
  useEffect(() => { if (!panelVisible) setOpen(false); }, [panelVisible]);
  useEffect(() => {
    if (!open) return;
    const list = entries();
    (entry === "last" ? list[list.length - 1] : list[0])?.focus();
    // A press anywhere else closes the menu; focus that sat inside it goes
    // back to the trigger, so it is never stranded on a removed item.
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || wrapRef.current?.contains(event.target)) return;
      dismiss(!!wrapRef.current?.contains(document.activeElement));
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const choose = (action: CompanionPanelAction) => {
    // Focus returns to the trigger first; an action that owns focus next
    // (the tone sheet, the history row) moves it from there.
    dismiss(true);
    onSelect(action);
  };
  const onMenuKey = (event: React.KeyboardEvent) => {
    const list = entries();
    const at = list.indexOf(document.activeElement as HTMLElement);
    const move = (index: number) => { event.preventDefault(); list[(index + list.length) % list.length]?.focus(); };
    if (event.key === "Escape") {
      // Owns its first Escape: the panel (a dialog below 1280 px) stays open.
      event.preventDefault();
      event.stopPropagation();
      dismiss(true);
    } else if (event.key === "ArrowDown") move(at + 1);
    else if (event.key === "ArrowUp") move(at - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(list.length - 1);
    else if (event.key === "Tab") setOpen(false);
  };

  return <div ref={wrapRef} className="companion-panel-menu-wrap" onBlur={event => {
    if (open && event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={triggerRef} type="button" className="companion-chrome-button" data-testid="companion-panel-menu"
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      aria-label={inputText(uiLang, "companion.panel.menu")}
      onClick={() => { setEntry("first"); setOpen(value => !value); }}
      onKeyDown={event => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        setEntry(event.key === "ArrowUp" ? "last" : "first");
        setOpen(true);
      }}>
      <Icon name="more_horiz" size={22} />
    </button>
    {open && <div ref={listRef} id={menuId} role="menu" className="companion-panel-menu" aria-label={inputText(uiLang, "companion.panel.menu")} onKeyDown={onMenuKey}>
      {items.map(item => <button key={item.id} type="button" role="menuitem" tabIndex={-1} className="companion-panel-menu-item"
        data-testid={`companion-panel-menu-${item.id}`} onClick={() => choose(item.id)}>
        <Icon name={item.icon} size={20} className="companion-panel-menu-icon" />
        <span className="companion-panel-menu-text">
          <span className="companion-panel-menu-label">{inputText(uiLang, item.labelKey)}</span>
          {item.subKey && <span className="companion-panel-menu-sub">{inputText(uiLang, item.subKey)}</span>}
        </span>
      </button>)}
    </div>}
  </div>;
}
