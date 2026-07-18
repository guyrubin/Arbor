import React, { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "../ui/Icon";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { Avatar } from "../ui/Avatar";
import AddChildModal from "../profile/AddChildModal";

/**
 * AP-047: Topbar kid-switcher chip.
 *
 * NEW ENTRY POINT ONLY — delegates entirely to the existing ProfileContext
 * actions (setActiveChild, addChild) and the existing AddChildModal.
 * No new data model, no new child-data write path.
 *
 * The Profile-tab ProfileSwitcher is unchanged and remains the fallback.
 *
 * RTL: all directional layout uses logical CSS properties so the chip and
 * popover render correctly under dir=rtl (Hebrew). No raw hex values.
 */
export default function TopbarKidSwitcher() {
  const { profiles, activeChild, setActiveChild } = useProfile();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click / focus-out.
  const handleOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleOutside);
    } else {
      document.removeEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, handleOutside]);

  // Close popover on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Chip button — active child avatar + chevron */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("aria.activeChildSwitch", { name: activeChild.name })}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          height: "40px",
          padding: "0 10px",
          borderRadius: "12px",
          background: "var(--arbor-paper-elevated)",
          border: "1px solid var(--arbor-rule)",
          cursor: "pointer",
          color: "var(--arbor-muted)",
          minWidth: "44px",      /* WCAG AA touch target */
          minHeight: "44px",
          maxWidth: "180px",
          boxSizing: "border-box",
        }}
      >
        <Avatar name={activeChild.name} photoURL={activeChild.photoUrl} size={24} />
        {/* UC-1: inline child name (avatar + name + chevron) */}
        <span
          dir="auto"
          style={{
            fontSize: "var(--t-sm)",
            fontWeight: 700,
            color: "var(--arbor-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {activeChild.name}
        </span>
        <Icon
          name="expand_more"
          size={16}
          style={{
            transition: "transform 150ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Popover */}
      {open && (
        <>
          {/* Scrim — catches outside clicks; z-index below popover */}
          <div
            aria-hidden="true"
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label={t("aria.switchChild")}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              /* logical property: aligns end-edge under both LTR and RTL */
              insetInlineEnd: 0,
              zIndex: 50,
              minWidth: "200px",
              borderRadius: "16px",
              padding: "6px",
              background: "var(--arbor-paper-elevated)",
              border: "1px solid var(--arbor-rule)",
              boxShadow: "0 12px 32px color-mix(in srgb, var(--arbor-ink) 12%, transparent)",
            }}
          >
            {/* Child list */}
            {profiles.map((p) => (
              <button
                key={p.id}
                role="option"
                aria-selected={p.id === activeChild.id}
                onClick={() => {
                  setActiveChild(p.id);   // ← ProfileContext.setActiveChild (no data write)
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  textAlign: "start",
                  background: p.id === activeChild.id ? "var(--arbor-paper-deep)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  minHeight: "44px",
                }}
              >
                <Avatar name={p.name} photoURL={p.photoUrl} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    dir="auto"
                    style={{
                      display: "block",
                      fontSize: "var(--t-sm)",
                      fontWeight: 700,
                      color: "var(--arbor-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--arbor-muted)" }}>
                    {t("profile.ageLine", { age: p.age })}
                  </span>
                </div>
                {p.id === activeChild.id && (
                  <Icon
                    name="check"
                    size={16}
                    style={{ color: "var(--arbor-primary)", flexShrink: 0 }}
                  />
                )}
              </button>
            ))}

            {/* Add child — opens the existing AddChildModal (uses ProfileContext.addChild internally) */}
            <button
              onClick={() => {
                setOpen(false);
                setShowAdd(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                borderRadius: "10px",
                textAlign: "start",
                background: "transparent",
                border: "none",
                borderTop: "1px solid var(--arbor-rule)",
                marginBlockStart: "4px",
                cursor: "pointer",
                color: "var(--arbor-green-ink)",
                minHeight: "44px",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "var(--arbor-green-soft)",
                  flexShrink: 0,
                }}
              >
                <Icon name="add" size={16} />
              </span>
              <span style={{ fontSize: "var(--t-sm)", fontWeight: 700 }}>{t("ac.add")}</span>
            </button>
          </div>
        </>
      )}

      {/* Existing AddChildModal — no logic change, just wired to local open state */}
      <AddChildModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
