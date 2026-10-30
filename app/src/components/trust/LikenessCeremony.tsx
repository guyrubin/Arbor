/**
 * Parent register only. The host lives on the shell and portals above the
 * hand-back card. Kid Mode resolves the wait as "keep private" and draws
 * nothing here — the child never sees this choice.
 */
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { isKidModeActive, subscribeKidMode } from "../../lib/kidModeGate";
import {
  answerLikenessCeremony,
  currentLikenessPreview,
  subscribeLikenessCeremony,
} from "../../lib/likenessCeremony";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function LikenessCeremonyView({
  dir,
  src,
  title,
  body,
  useLabel,
  keepLabel,
  alt,
  label,
  onUse,
  onKeep,
}: {
  dir: "ltr" | "rtl";
  src: string;
  title: string;
  body: string;
  useLabel: string;
  keepLabel: string;
  alt: string;
  label: string;
  onUse: () => void;
  onKeep: () => void;
}) {
  return (
    <div
      role="presentation"
      data-testid="likeness-ceremony-backdrop"
      onClick={onKeep}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(20, 34, 90, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="likeness-ceremony-title"
        aria-label={label}
        data-testid="likeness-ceremony"
        tabIndex={-1}
        dir={dir}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-[420px] flex-col gap-3 p-4"
        style={{
          background: "var(--arbor-paper-elevated)",
          color: "var(--arbor-ink)",
          border: "1px solid var(--arbor-rule)",
          borderRadius: "var(--r-lg, 18px)",
          boxShadow: "var(--arbor-shadow-card, var(--shadow-xs))",
          maxHeight: "min(640px, calc(100vh - 32px))",
          overflow: "auto",
        }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}>
            <Icon name="face" size={18} />
          </span>
          <h2 id="likeness-ceremony-title" className="font-bold" style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: "var(--t-title, 22px)", lineHeight: 1.25, margin: 0 }}>
            {title}
          </h2>
        </div>
        <img
          data-testid="likeness-preview"
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          style={{ display: "block", width: "100%", maxHeight: 280, objectFit: "contain", background: "var(--arbor-paper-deep)", borderRadius: 12 }}
        />
        <p dir="auto" style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: "var(--arbor-ink-soft, var(--arbor-ink))" }}>{body}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-testid="likeness-use"
            onClick={onUse}
            className="min-h-11 w-full rounded-xl px-3 text-sm font-bold"
            style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)", border: "1px solid var(--arbor-clay)" }}
          >
            {useLabel}
          </button>
          <button
            type="button"
            data-testid="likeness-keep"
            onClick={onKeep}
            className="min-h-11 w-full rounded-xl px-3 text-sm font-bold"
            style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
          >
            {keepLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function likenessCeremonyCopy(t: Translate, name: string | undefined) {
  const first = (name ?? "").split(" ")[0];
  return {
    title: first ? t("companion.likeness.title", { name: first }) : t("companion.likeness.titleNoName"),
    alt: first ? t("companion.likeness.alt", { name: first }) : t("companion.likeness.altNoName"),
    body: t("companion.likeness.body"),
    useLabel: t("companion.likeness.use"),
    keepLabel: t("companion.likeness.keep"),
    label: t("companion.likeness.label"),
  };
}

export default function LikenessCeremonyHost() {
  const preview = useSyncExternalStore(subscribeLikenessCeremony, currentLikenessPreview, () => null);
  const kidMode = useSyncExternalStore(subscribeKidMode, isKidModeActive, () => false);
  const { t, uiLang } = useLanguage();

  useEffect(() => {
    if (kidMode && preview) answerLikenessCeremony(false);
  }, [kidMode, preview]);

  useEffect(() => {
    if (!preview || kidMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") answerLikenessCeremony(false);
    };
    window.addEventListener("keydown", onKey);
    const node = document.querySelector("[data-testid=likeness-ceremony]");
    if (node instanceof HTMLElement) node.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, kidMode]);

  if (!preview || kidMode || typeof document === "undefined") return null;
  const copy = likenessCeremonyCopy(t, preview.name);
  return createPortal(
    <LikenessCeremonyView
      dir={uiLang === "he" ? "rtl" : "ltr"}
      src={preview.src}
      title={copy.title}
      body={copy.body}
      useLabel={copy.useLabel}
      keepLabel={copy.keepLabel}
      alt={copy.alt}
      label={copy.label}
      onUse={() => answerLikenessCeremony(true)}
      onKeep={() => answerLikenessCeremony(false)}
    />,
    document.body,
  );
}
