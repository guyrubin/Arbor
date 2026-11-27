import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { Avatar } from "../ui/Avatar";
import AddChildModal from "../profile/AddChildModal";
import ProfileEditDrawer from "../profile/ProfileEditDrawer";
// B-INF-10: the ONE child-age formatter (months under 3, years from 3).
import { formatChildAge } from "../../lib/age/format";
import { childPicture } from "../../lib/childPicture";
import type { ChildProfile } from "../../types";

/**
 * B-DIST-01: the quiet "Demo" tag beside the demo family's child (invented
 * data). Parent register, neutral tokens only — a label, never a colour verdict.
 */
function DemoChip({ t }: { t: (key: string) => string }) {
  return (
    <span
      data-demo-chip
      aria-label={t("elev.demo.chipAria")}
      style={{
        flexShrink: 0,
        fontSize: "12px",
        fontWeight: 600,
        lineHeight: "16px",
        paddingInline: "6px",
        borderRadius: "999px",
        color: "var(--arbor-muted)",
        background: "var(--arbor-paper-deep)",
        border: "1px solid var(--arbor-rule)",
      }}
    >
      {t("elev.demo.chip")}
    </span>
  );
}

/**
 * P5-LOOP critic c2 r1 (overview design + product P1, carried r1 P1-2): in
 * the closed trigger the Demo tag is a 6 px dot (named for screen readers
 * and on hover) — the full "Demo" chip crossed the switcher border at 375
 * and took the width the child's name needed at 1280. The chip itself stays
 * in the open family list (SwitcherChildOption).
 */
function DemoDot({ t }: { t: (key: string) => string }) {
  return (
    <span
      data-demo-chip="dot"
      role="img"
      aria-label={t("elev.demo.chipAria")}
      title={t("elev.demo.chip")}
      style={{ flex: "0 0 auto", width: "6px", height: "6px", borderRadius: "999px", background: "var(--arbor-muted)" }}
    />
  );
}

/**
 * B-INF-10 — one child in the switcher list: picture · name · her own age
 * ("22 months" under three, "5 years" from three — lib/age/format, the one
 * formatter). Exported so the age line renders in a static test.
 */
export function SwitcherChildOption({
  p,
  active,
  t,
  onPick,
}: {
  p: ChildProfile;
  active: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onPick: () => void;
}) {
  return (
    <button
      role="option"
      aria-selected={active}
      onClick={onPick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "8px 10px",
        borderRadius: "10px",
        textAlign: "start",
        background: active ? "var(--arbor-paper-deep)" : "transparent",
        border: "none",
        cursor: "pointer",
        minHeight: "44px",
      }}
    >
      <Avatar name={p.name} photoURL={childPicture(p).url} size={28} />
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
        {p.demo === true && <DemoChip t={t} />}
        <span data-switcher-age dir="auto" style={{ display: "block", fontSize: "12px", color: "var(--arbor-muted)" }}>
          {formatChildAge(p, t)}
        </span>
      </div>
      {active && (
        <Icon
          name="check"
          size={16}
          style={{ color: "var(--arbor-clay)", flexShrink: 0 }}
        />
      )}
    </button>
  );
}

/**
 * B-SHELL-38 — the ONE identity line: name · the child's own age ("22
 * months" under three, "5 years" from three — lib/age/format), ON ONE LINE
 * (P5 r1 pass A8, 6 Oct). On a child switch the line crossfades in 200 ms
 * (keyed on the child id): the one motion this item allows. Exported so the
 * line renders in a static test.
 *
 * P5-LOOP critic c2 r1 (P1, the render still showed "D.. · 3 yea"): the NAME
 * has priority. The line is a wrapping row clipped to its first line: the
 * name is the first item and keeps its whole width (it ellipsizes only when
 * the name alone is wider than the line, never under 4 characters); "· age"
 * is ONE nowrap unit that drops to the hidden second line when there is no
 * room, so it is either whole or absent — never clipped mid-word. Below lg
 * the age is not in the switcher at all (`max-lg:hidden`: the phone strip;
 * the page H1 carries it).
 */
export function ChildIdentity({ child, t }: { child: ChildProfile; t: (key: string, vars?: Record<string, string | number>) => string }) {
  const age = formatChildAge(child, t);
  return (
    <motion.span
      key={child.id}
      data-child-identity={child.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: "4px", rowGap: "24px", height: "20px", minWidth: 0, overflow: "hidden", textAlign: "start", lineHeight: "20px" }}
    >
      <span
        dir="auto"
        data-identity-name
        style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--arbor-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: "4ch", maxWidth: "100%", flex: "0 1 auto" }}
      >
        {child.name}
      </span>
      {age && (
        <span data-age-unit className="max-lg:hidden" style={{ fontSize: "12px", color: "var(--arbor-muted)", whiteSpace: "nowrap", flex: "0 0 auto" }}>
          <span aria-hidden="true">·</span>{" "}
          <span dir="auto" data-identity-age>{age}</span>
        </span>
      )}
    </motion.span>
  );
}

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
export default function TopbarKidSwitcher({ maxWidth = "180px", fullWidth = false, shrink = false }: { maxWidth?: string; fullWidth?: boolean; /** In a flex row (the phone strip): take the natural width, shrink when the row is full — no fixed cap (c2 r1). */ shrink?: boolean } = {}) {
  const { profiles, activeChild, setActiveChild } = useProfile();
  const { t } = useLanguage();
  // B-SHELL-42 r3: the switcher's Hebrew names no child in a slash form ("ילד/ה פעיל/ה",
  // "החלפת ילד/ה"), whatever the profile says about gender: the strings are written
  // slash-free and neutral (the profile is active; you move between the children), so a
  // known gender never meets an intake-form slash and an unknown one needs none.
  const switchChild = t("aria.switchChild");
  const activeChildLabel = t("aria.activeChildSwitch", { name: activeChild.name });
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  // v10 (canvas V77): the sidebar card is the switcher alone; editing the child's
  // profile moved from a separate pencil into this menu (desktop and phone alike).
  const [showEdit, setShowEdit] = useState(false);
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
    <div ref={containerRef} style={shrink ? { position: "relative", flex: "0 1 auto", minWidth: 0 } : { position: "relative" }}>
      {/* Chip button — active child avatar + chevron */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={activeChildLabel}
        style={{
          display: fullWidth ? "flex" : "inline-flex",
          width: fullWidth ? "100%" : undefined,
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          borderRadius: "12px",
          background: "var(--arbor-paper-elevated)",
          border: "1px solid var(--arbor-rule)",
          cursor: "pointer",
          color: "var(--arbor-muted)",
          minWidth: "44px",      /* WCAG AA touch target */
          minHeight: "44px",
          maxWidth: shrink ? "100%" : maxWidth,
          boxSizing: "border-box",
        }}
      >
        <Avatar name={activeChild.name} photoURL={childPicture(activeChild).url} size={fullWidth ? 32 : 24} />
        {/* B-SHELL-38: the identity line — picture · name · her own age, once per screen. */}
        <span data-identity-slot style={{ flex: "1 1 auto", minWidth: "4ch", overflow: "hidden", display: "flex" }}>
          <ChildIdentity child={activeChild} t={t} />
        </span>
        {activeChild.demo === true && <DemoDot t={t} />}
        <Icon
          name="expand_more"
          size={16}
          chrome
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
            aria-label={switchChild}
            data-testid="switcher-list"
            style={SWITCHER_LIST_STYLE}
          >
            {/* Child list */}
            {profiles.map((p) => (
              <SwitcherChildOption
                key={p.id}
                p={p}
                active={p.id === activeChild.id}
                t={t}
                onPick={() => {
                  setActiveChild(p.id);   // ← ProfileContext.setActiveChild (no data write)
                  setOpen(false);
                }}
              />
            ))}

            {/* Edit the active child's profile — the drawer the sidebar pencil used to open. */}
            <button
              onClick={() => {
                setOpen(false);
                setShowEdit(true);
              }}
              title={t("aria.editChildProfile")}
              data-testid="switcher-edit-profile"
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
                color: "var(--arbor-ink)",
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
                  borderRadius: "10px",
                  background: "var(--arbor-paper-deep)",
                  color: "var(--arbor-ink-soft)",
                  flexShrink: 0,
                }}
              >
                <Icon name="edit" size={15} />
              </span>
              <span style={{ fontSize: "var(--t-sm)", fontWeight: 600 }}>{t("aria.editChildProfile")}</span>
            </button>

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
      <ProfileEditDrawer open={showEdit} onClose={() => setShowEdit(false)} />
    </div>
  );
}

/**
 * B-SHELL-42 r3 — the open family list fits the phone (390 HE). Both mounts sit at the
 * START of their row (the phone strip: gutter · mark · switcher; the sidebar: full width),
 * so the list hangs from the chip's START edge and grows toward the row's free side. The
 * old end-edge anchor (from the old top-right chip) pushed a 200 px list past the
 * screen edge from a narrow chip at the start: off the right edge in Hebrew, the left in
 * English. The max width keeps it inside the 16 px gutters whatever the chip's width.
 * Exported so the layout guard reads the shipped style, not a copy.
 */
export const SWITCHER_LIST_MIN_WIDTH_PX = 200;
export const SWITCHER_LIST_STYLE: React.CSSProperties = Object.freeze({
  position: "absolute",
  top: "calc(100% + 8px)",
  /* logical property: hangs from the chip's start edge under both LTR and RTL */
  insetInlineStart: 0,
  zIndex: 50,
  minWidth: `${SWITCHER_LIST_MIN_WIDTH_PX}px`,
  maxWidth: "calc(100vw - 32px)",
  boxSizing: "border-box",
  borderRadius: "16px",
  padding: "6px",
  background: "var(--arbor-paper-elevated)",
  border: "1px solid var(--arbor-rule)",
  boxShadow: "0 12px 32px color-mix(in srgb, var(--arbor-ink) 12%, transparent)",
});
