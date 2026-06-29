import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { useProfile } from "../../context/ProfileContext";
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
        aria-label={`Active child: ${activeChild.name}. Switch child`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          width: "40px",
          height: "40px",
          padding: "0 6px",
          borderRadius: "12px",
          background: "var(--arbor-paper-elevated)",
          border: "1px solid var(--arbor-rule)",
          cursor: "pointer",
          color: "var(--arbor-muted)",
          minWidth: "44px",      /* WCAG AA touch target */
          minHeight: "44px",
          boxSizing: "border-box",
        }}
      >
        <Avatar name={activeChild.name} photoURL={activeChild.photoUrl} size={24} />
        <ChevronDown
          aria-hidden="true"
          style={{
            width: "12px",
            height: "12px",
            transition: "transform 150ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
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
            aria-label="Switch child"
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
                    Age {p.age}
                  </span>
                </div>
                {p.id === activeChild.id && (
                  <Check
                    aria-hidden="true"
                    style={{ width: "14px", height: "14px", color: "var(--arbor-clay)", flexShrink: 0 }}
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
                <Plus style={{ width: "14px", height: "14px" }} />
              </span>
              <span style={{ fontSize: "var(--t-sm)", fontWeight: 700 }}>Add child</span>
            </button>
          </div>
        </>
      )}

      {/* Existing AddChildModal — no logic change, just wired to local open state */}
      <AddChildModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
