/**
 * E0: WowOnboarding — the hero-comic front door. A 2-minute chain for a NEW
 * family that ORCHESTRATES existing capabilities (no new AI, no new pipelines):
 *
 *   1. add child      → the EXISTING AddChildModal (imported and driven)
 *   2. comic avatar   → the EXISTING AvatarCreator (/generate-avatar; the
 *                       face_processing consent gate lives INSIDE it, untouched;
 *                       SKIP path = Sprout fallback via HeroAvatar)
 *   3. first comic    → the EXISTING /api/generate-comic path, ONE page for the
 *                       first canon story spine (HERO_STORIES[0]); calm
 *                       preparing state while it draws; on ANY failure fall
 *                       back to a pre-composed page via the heroAvatarCanvas
 *                       template registry — the wow never 404s
 *   4. closing card   → the page + parent-mediated ShareButton (existing share
 *                       pipeline w/ referral code, ≤1 share prompt per session)
 *                       + "Enter Arbor" → localStorage done, land on Today
 *
 * VISIBILITY: brand-new accounts only — children.length === 0, or the explicit
 * localStorage flag "arbor.wowPending" === "1". Accounts that already have
 * children default to SEEN (the flag is written once and the flow never shows).
 * Every step is dismissible (X / Escape → marks done, lands on Today).
 *
 * REGISTER: full-screen calm overlay in the PARENT register (.arbor-parent) —
 * parent tones only, token-only styling, logical props for RTL, 44px targets,
 * all motion gated on prefers-reduced-motion, keyboard focus-trapped.
 * CLINICAL FIREWALL: no numbers besides the plain step counter.
 * CHILD DATA: zero new capture — every child-data touch goes through the
 * existing gated components/paths listed above.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles, UserPlus, BookOpen } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import { track } from "../../lib/analytics";
import { HERO_STORIES } from "../../lib/heroJourneys";
import { renderHeroAvatarCanvas } from "../../lib/heroAvatarCanvas";
import { prefersReducedMotion } from "../../lib/devscore";
import { PASTEL } from "../../lib/tokens";
import AddChildModal from "../profile/AddChildModal";
import AvatarCreator from "../profile/AvatarCreator";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { ShareButton } from "../ui/ShareButton";

type WowStep = "child" | "avatar" | "comic" | "closing";
const STEP_ORDER: readonly WowStep[] = ["child", "avatar", "comic", "closing"];

const LS_KEY = "arbor.wowPending";

function readFlag(): string | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(LS_KEY) : "done";
  } catch {
    return "done"; // storage unavailable → behave as seen, never trap the user
  }
}

function writeFlag(value: string): void {
  try {
    window.localStorage.setItem(LS_KEY, value);
  } catch {
    /* storage unavailable — the flow simply won't persist its done state */
  }
}

/**
 * First-story comic prompt copy (EN+HE). This is AI-PROMPT PAYLOAD for the
 * existing /api/generate-comic path — mirrored from the canonical
 * "david-and-goliath" entry of HeroComicsTab's STORY_COMIC registry (that
 * registry is module-private and HeroComicsTab is not owned by this
 * workstream, so the single needed entry is mirrored here as data).
 */
const FIRST_STORY_COMIC = {
  theme: "a small but mighty young hero standing fearlessly before a towering giant, slingshot raised high, glowing with courage",
  themeHe: "גיבור קטן ואדיר עומד ללא פחד מול ענק מתנשא, רוגטקה מורמת גבוה, זוהר באומץ",
  dialogue: "I'm small but I'm brave!",
  dialogueHe: "אני קטן אבל אמיץ!",
  sfx: ["BOOM!", "WHOOSH!", "ZING!"],
  sfxHe: ["בום!", "ואוש!", "זינג!"],
} as const;

export function WowOnboarding() {
  const { setActiveTab } = useArbor();
  const { profiles, activeChild, updateChild } = useProfile();
  const { t, aiLang } = useLanguage();
  const hero = useHeroAvatar();

  // ── Visibility gate — resolved ONCE at mount. ──────────────────────────────
  // "1" → show; "done" → never; absent → show only for a childless account,
  // and for accounts WITH children write the default-seen flag immediately.
  const [visible, setVisible] = useState<boolean>(() => {
    const flag = readFlag();
    if (flag === "1") return true;
    if (flag !== null) return false;
    return profiles.length === 0;
  });
  useEffect(() => {
    if (!visible && readFlag() === null && profiles.length > 0) writeFlag("done");
    // Existing users NEVER see the flow: absent flag + children = seen.
  }, [visible, profiles.length]);

  // ── Step state — start at the first step the account hasn't done. ─────────
  const [step, setStep] = useState<WowStep>(() =>
    profiles.length === 0 ? "child" : !hero.hasHero ? "avatar" : "comic"
  );
  const [addOpen, setAddOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [comic, setComic] = useState<{ url: string | null; fallback: boolean } | null>(null);
  // The avatar created INSIDE this flow, held locally: updateChild's profile
  // patch lands async (Firestore write first), so the comic step must not
  // depend on context propagation to star the fresh hero.
  const [freshAvatar, setFreshAvatar] = useState<string | undefined>();
  const comicStarted = useRef(false);
  const startedTracked = useRef(false);
  const initialChildCount = useRef(profiles.length);

  const he = aiLang === "he";
  const firstStory = HERO_STORIES[0];
  const storyTitle = he ? firstStory.titleHe : firstStory.title;
  const savedHeroUrl = hero.url && hero.url.startsWith("data:") ? hero.url : undefined;
  const heroDataUrl = freshAvatar ?? savedHeroUrl;
  const name = hero.name;

  useEffect(() => {
    if (visible && !startedTracked.current) {
      startedTracked.current = true;
      track("wow_onboarding_started", { entry: step });
    }
  }, [visible, step]);

  // ── Finish (both "Enter Arbor" and every dismiss path): mark done forever,
  // land on Today. ────────────────────────────────────────────────────────────
  const finish = useCallback(
    (reason: "completed" | "dismissed") => {
      writeFlag("done");
      track(reason === "completed" ? "wow_onboarding_completed" : "wow_onboarding_dismissed", { step });
      setActiveTab("overview");
      setVisible(false);
    },
    [setActiveTab, step]
  );

  // ── Step 1 → 2: AddChildModal closes on BOTH cancel and success, so success
  // is detected from the profile list growing (the modal already saved). ──────
  useEffect(() => {
    if (visible && step === "child" && profiles.length > initialChildCount.current) {
      setAddOpen(false);
      setStep("avatar");
    }
  }, [visible, step, profiles.length]);

  // ── Step 3: generate ONE page via the existing /generate-comic path; on any
  // failure (paywall, network, quota) pre-compose a branded Sprout/hero page
  // through the heroAvatarCanvas template registry. Never 404s, never nags. ───
  useEffect(() => {
    if (!visible || step !== "comic" || comicStarted.current) return;
    comicStarted.current = true;
    let alive = true;
    void (async () => {
      let result: { url: string | null; fallback: boolean };
      try {
        const res = await api.generateComic({
          ...(heroDataUrl ? { avatar: { dataUrl: heroDataUrl } } : {}),
          heroName: name,
          theme: he ? FIRST_STORY_COMIC.themeHe : FIRST_STORY_COMIC.theme,
          dialogue: he ? FIRST_STORY_COMIC.dialogueHe : FIRST_STORY_COMIC.dialogue,
          sfx: he ? [...FIRST_STORY_COMIC.sfxHe] : [...FIRST_STORY_COMIC.sfx],
          style: "comichero",
        });
        result = { url: res.dataUrl, fallback: false };
      } catch {
        // Calm fallback — a pre-composed branded page via the shared template
        // registry (no new compositing code). A PaywallError lands here too:
        // the front door never opens onto a paywall.
        try {
          const card = await renderHeroAvatarCanvas("comic", {
            imageUrl: heroDataUrl,
            name,
            title: storyTitle,
          });
          result = { url: card.dataUrl, fallback: true };
        } catch {
          result = { url: null, fallback: true }; // final DOM fallback below
        }
      }
      if (!alive) return;
      setComic(result);
      setStep("closing");
      track("wow_comic_shown", { fallback: result.fallback });
    })();
    return () => {
      alive = false;
    };
  }, [visible, step, heroDataUrl, name, he, storyTitle]);

  // ── Keyboard: Escape dismisses, Tab is trapped — but ONLY while no reused
  // sub-modal is open on top (AddChildModal/AvatarCreator own their keys). ────
  const dialogRef = useRef<HTMLDivElement>(null);
  const subModalOpen = addOpen || avatarOpen;
  useEffect(() => {
    if (!visible || subModalOpen) return;
    const node = dialogRef.current;
    node?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish("dismissed");
        return;
      }
      if (e.key === "Tab" && node) {
        const focusables = Array.from(
          node.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !node.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, subModalOpen, finish, step]);

  // Entrance rise-fade — collapses to an instant render under reduced motion.
  const [entered, setEntered] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (!visible || entered) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [visible, entered]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const mint = PASTEL.mint;
  const lav = PASTEL.lav;
  const pink = PASTEL.pink;

  const primaryBtn: React.CSSProperties = {
    background: mint.ink,
    color: "var(--arbor-on-accent)",
    boxShadow: "var(--shadow-sm)",
  };
  const ghostBtn: React.CSSProperties = {
    background: "var(--arbor-paper-elevated)",
    color: "var(--arbor-muted)",
    border: "1px solid var(--arbor-rule)",
  };

  const body = useMemo(() => {
    switch (step) {
      case "child":
        return (
          <>
            <StepHeading tone={mint.ink} title={t("elev.wow.child.title")} sub={t("elev.wow.child.sub")} />
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-6 py-3 text-[var(--t-sm)] font-extrabold transition active:scale-[0.97]"
              style={primaryBtn}
            >
              <UserPlus aria-hidden="true" style={{ width: 16, height: 16 }} />
              {t("elev.wow.child.cta")}
            </button>
          </>
        );
      case "avatar":
        return (
          <>
            <StepHeading
              tone={lav.ink}
              title={t("elev.wow.avatar.title", { name })}
              sub={t("elev.wow.avatar.sub", { name })}
            />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAvatarOpen(true)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-6 py-3 text-[var(--t-sm)] font-extrabold transition active:scale-[0.97]"
                style={{ ...primaryBtn, background: lav.ink }}
              >
                <Sparkles aria-hidden="true" style={{ width: 16, height: 16 }} />
                {t("elev.wow.avatar.cta")}
              </button>
              <button
                type="button"
                onClick={() => setStep("comic")}
                className="inline-flex min-h-[44px] items-center rounded-2xl px-5 py-3 text-[var(--t-sm)] font-bold transition"
                style={ghostBtn}
              >
                {t("elev.wow.avatar.skip")}
              </button>
            </div>
          </>
        );
      case "comic":
        return (
          <div role="status" aria-live="polite" className="flex flex-col items-center text-center gap-4 py-4">
            <HeroAvatar size={110} mood="cheer" decorative />
            <p
              className="text-xl leading-tight"
              style={{ fontFamily: "var(--font-display)", fontWeight: 900, color: "var(--arbor-ink)" }}
            >
              {t("elev.wow.comic.preparing", { name })}
            </p>
            <p className="text-[var(--t-sm)] max-w-sm" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.wow.comic.preparingSub")}
            </p>
          </div>
        );
      case "closing":
        return (
          <div className="flex flex-col items-center text-center gap-4">
            {comic?.url ? (
              <img
                src={comic.url}
                alt={t("elev.wow.done.alt", { name })}
                className="w-full max-w-sm rounded-[22px] object-cover"
                style={{ border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-sm)" }}
              />
            ) : (
              // Final never-404 fallback: a composed DOM page — the hero (or
              // Sprout) inside the story's world, no image pipeline required.
              <div
                className="w-full max-w-sm rounded-[22px] flex flex-col items-center justify-center gap-3 py-10"
                style={{ background: pink.soft, border: "1px solid var(--arbor-rule)" }}
              >
                <HeroAvatar size={120} mood="cheer" decorative />
                <p className="text-lg px-6" style={{ fontFamily: "var(--font-display)", fontWeight: 900, color: "var(--arbor-ink)" }} dir="auto">
                  {storyTitle}
                </p>
              </div>
            )}
            <StepHeading
              tone={pink.ink}
              title={t("elev.wow.done.title", { name })}
              sub={t("elev.wow.done.sub", { name })}
              center
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Parent-mediated share ONLY — the existing pipeline (branded
                  card + referral code). This is the flow's single share prompt. */}
              <ShareButton
                artifact="story"
                surface="wow_onboarding"
                childName={name}
                getCardOpts={() => ({ imageUrl: comic?.url ?? heroDataUrl, name, title: storyTitle })}
              />
              <button
                type="button"
                onClick={() => finish("completed")}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-6 py-3 text-[var(--t-sm)] font-extrabold transition active:scale-[0.97]"
                style={{ ...primaryBtn, background: pink.ink }}
              >
                <BookOpen aria-hidden="true" style={{ width: 16, height: 16 }} />
                {t("elev.wow.done.enter")}
              </button>
            </div>
          </div>
        );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, comic, name, storyTitle, heroDataUrl, t, finish]);

  if (!visible) return null;

  return (
    // z-[45]: above the app chrome (sidebar/topbar/MobileNav z-40), BELOW the
    // reused Modal (z-50) and AvatarCreator (z-60) so they open on top of the
    // overlay. Parent register: .arbor-parent scopes the calm clinical tokens.
    <div
      className="arbor-app arbor-parent fixed inset-0 z-[45] overflow-y-auto"
      style={{
        background: "var(--arbor-paper)",
        opacity: entered ? 1 : 0,
        transition: "opacity 0.45s ease",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wow-onboarding-title"
        tabIndex={-1}
        className="relative min-h-full flex flex-col items-center justify-center px-5 py-10 text-start focus:outline-none"
      >
        {/* Dismiss — at EVERY step: marks done, lands on Today. */}
        <button
          type="button"
          onClick={() => finish("dismissed")}
          aria-label={t("elev.wow.dismiss")}
          className="absolute top-4 flex items-center justify-center w-11 h-11 rounded-xl transition"
          style={{ insetInlineEnd: "1rem", color: "var(--arbor-muted)", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <X aria-hidden="true" style={{ width: 20, height: 20 }} />
        </button>

        <div className="w-full max-w-xl">
          <div
            id="wow-onboarding-title"
            className="text-[11px] font-extrabold uppercase text-center"
            style={{ color: mint.ink, letterSpacing: "0.14em" }}
          >
            {t("elev.wow.eyebrow")}
          </div>

          {/* Calm step dots — plain progress only (firewall-safe). */}
          <div className="mt-3 mb-8 flex items-center justify-center gap-2" aria-hidden="true">
            {STEP_ORDER.map((s, i) => (
              <span
                key={s}
                className="rounded-full transition-all"
                style={{
                  width: i === stepIndex ? 22 : 8,
                  height: 8,
                  background: i <= stepIndex ? mint.ink : "var(--arbor-rule-strong)",
                }}
              />
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            {t("elev.wow.stepOf", { step: stepIndex + 1, total: STEP_ORDER.length })}
          </span>

          <div
            className="rounded-[22px] p-6 md:p-8"
            style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
          >
            {body}
          </div>

          {/* E8 science moment — research-anchored line, truthful-claims rule. */}
          <p className="mt-4 text-center text-[var(--t-xs)] font-bold" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.wow.evidence")}
          </p>
          {/* EU AI Act Art. 50 — one-time AI transparency note where the AI
              features are first introduced (avatar + comic + coaching). */}
          <p className="mt-1.5 text-center text-[var(--t-xs)]" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.wow.aiNote")}
          </p>
        </div>
      </div>

      {/* ── Reused surfaces, driven — NOT rebuilt. ──────────────────────────── */}
      {/* Step 1: the existing add-child flow (entitlement limit handling included). */}
      <AddChildModal open={addOpen} onClose={() => setAddOpen(false)} />
      {/* Step 2: the existing avatar creator — face_processing consent gating and
          the /generate-avatar call stay entirely inside it. Persisting the result
          uses the SAME patch shape as ProfileEditDrawer (photoUrl + avatar meta). */}
      {step === "avatar" && (
        <AvatarCreator
          open={avatarOpen}
          childId={activeChild.id}
          childName={name}
          onClose={() => setAvatarOpen(false)}
          onCreated={({ dataUrl, style, source }) => {
            setAvatarOpen(false);
            setFreshAvatar(dataUrl);
            void updateChild(activeChild.id, {
              photoUrl: dataUrl,
              avatar: { style, source, createdAt: new Date().toISOString() },
            });
            setStep("comic");
          }}
        />
      )}
    </div>
  );
}

/** Shared calm heading block for the step cards. */
function StepHeading({
  tone,
  title,
  sub,
  center = false,
}: {
  tone: string;
  title: string;
  sub: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "text-center" : "text-start"}>
      <span
        aria-hidden="true"
        className={`block h-1 w-7 rounded-full mb-3 ${center ? "mx-auto" : ""}`}
        style={{ background: tone }}
      />
      <h2
        className="text-xl md:text-2xl leading-[1.15]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 900, color: "var(--arbor-ink)" }}
      >
        {title}
      </h2>
      <p className="mt-2 text-[var(--t-sm)] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
        {sub}
      </p>
    </div>
  );
}

export default WowOnboarding;
