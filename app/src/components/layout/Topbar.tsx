import React from "react";
import TopbarKidSwitcher from "./TopbarKidSwitcher";
import TopbarSearch from "../search/TopbarSearch";
import TopbarBell from "./TopbarBell";
import KidModeButton from "./KidModeButton";
import OfflineChip from "../ui/OfflineChip"; // W0.6: renders only while offline
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { sectionForTab } from "../../lib/navigation";

/**
 * Desktop topbar — the wireframe's lean control band (md+). Hidden on mobile,
 * where the in-content accessories strip + bottom MobileNav cover the same jobs.
 *
 * Left zone = page TITLE + SUBTITLE keyed off the active section (nav.title.* /
 * nav.sub.*): the topbar tells you WHERE you are, on the sapphire-tinted band.
 *
 * Right zone mirrors the wireframe: search field → Kid Mode → "how Arbor helps"
 * rail toggle → notification bell → child switcher. Ask Arbor is a first-class
 * sidebar nav row, so it is NOT duplicated here (removed the redundant topbar
 * button). The AI rail is off by default; this toggle is its single, discoverable
 * desktop entry point. All tokens are sourced from index.css; no raw hex.
 */
export default function Topbar() {
  const { activeTab, childProfile, showAiRail, setShowAiRail } = useArbor();
  const { t } = useLanguage();
  const section = sectionForTab(activeTab);

  return (
    <header
      className="hidden lg:flex items-center gap-4 px-5 xl:px-7 flex-none min-w-0"
      style={{
        height: "74px",
        background: "var(--arbor-topbar-band)",
        borderBottom: "1px solid var(--arbor-rule)",
      }}
      aria-label={t("aria.applicationTopbar")}
    >
      {/* Left zone: page title + subtitle stack (orientation).
          UC-8: the title zone owns a hard minimum. It used to be a pure
          `flex-1 min-w-0` against a `flex-shrink-0` control band, so on wide
          desktops with the AI rail open the band (≈740px) ate the header and
          left the title 68px — "One Big Thing Today" rendered as "One …". The
          minimum is what the truncation is allowed to eat into; the control
          band below now shrinks (search first) instead of the title. */}
      <div
        className="flex flex-col justify-center flex-1"
        /* A length (not `auto`) keeps `truncate` working. 11rem is what the
           worst case can actually afford — at 2xl with the rail open the
           header is 880px and the non-shrinking controls (Kid Mode with its
           xl safety line ≈305px, rail toggle, bell, child switcher) already
           claim ~543px — and it is enough for the full section title plus a
           readable slice of the subtitle. min() keeps it proportionate if the
           header is ever narrower still. */
        style={{ minInlineSize: "min(11rem, 22%)" }}
      >
        <span
          className="text-[18px] font-extrabold leading-tight truncate"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {t("nav.title." + section.id)}
        </span>
        <span className="text-[12px] truncate" style={{ color: "var(--arbor-muted)" }}>
          {t("nav.sub." + section.id, { name: childProfile.name })}
        </span>
      </div>

      {/* Right zone: lean desktop control band (search → Kid Mode → rail toggle →
          bell → child switcher). Ask Arbor lives in the sidebar, not here. */}
      <div className="flex min-w-0 shrink items-center gap-2.5">
        {/* W0.6: subtle offline chip — self-hides while online, RTL-safe. It is
            the only other flexible box here: when it appears it must not shove
            the child switcher off the header, so it clips instead. */}
        <div className="min-w-0 overflow-hidden" style={{ flex: "0 1 auto" }}>
          <OfflineChip />
        </div>
        {/* The band's shock absorber: search gives up width first, down to a
            floor that is still a 44px tap target (and still focusable/typeable;
            Ctrl/Cmd+K remains the full-modal path). Every other control keeps
            its intrinsic size, so no control can be squeezed out of reach — the
            wide-desktop title starvation is paid for here, not by dropping a
            control. TopbarSearch's own container is `max-width: 100%`, so this
            box governs its width — and no `overflow: hidden` here, or it would
            clip the search results overlay that hangs below the input. */}
        <div
          className="hidden lg:block"
          style={{ flex: "0 1 230px", minInlineSize: "2.75rem" }}
        >
          <TopbarSearch />
        </div>
        <div className="hidden lg:block flex-shrink-0">
          <KidModeButton />
        </div>
        {/* PLAT-3: the rail toggle's visibility breakpoint must match AiRail's
            (2xl) and Shell's third grid column (2xl) — at xl widths (1280-1535px)
            the rail never renders, so a visible toggle there was a silent no-op
            (aria-pressed flipped with no layout change). Guarded by
            layoutTokens.test.ts breakpoint-alignment test. */}
        <button
          onClick={() => setShowAiRail(!showAiRail)}
          aria-label={t("top.howHelps")}
          aria-pressed={showAiRail}
          title={t("top.howHelps")}
          className="hidden 2xl:inline-flex items-center justify-center w-11 h-11 rounded-xl transition flex-shrink-0"
          style={showAiRail
            ? { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }
            : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="verified_user" size={18} />
        </button>
        <div className="flex-shrink-0">
          <TopbarBell />
        </div>
        <div className="flex-shrink-0 min-w-0">
          <TopbarKidSwitcher />
        </div>
      </div>
    </header>
  );
}
