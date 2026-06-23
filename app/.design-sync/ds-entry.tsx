// Design-system entry for claude.ai/design (design-sync).
// Explicit re-export of the Arbor "Soft Daylight" UI kit (src/components/ui).
// Hand-authored (not synth `export *`) so default-only components survive and
// no unrelated app code / React context is pulled into the bundle.
// HeroAvatar/useHeroAvatar are intentionally omitted — they read ArborContext.

// ── Primitives ──────────────────────────────────────────────────────────────
export { Button } from "../src/components/ui/Button";
export { Card } from "../src/components/ui/Card";
export { Badge } from "../src/components/ui/Badge";
export { Avatar } from "../src/components/ui/Avatar";
export { Modal } from "../src/components/ui/Modal";
export { EmptyState } from "../src/components/ui/EmptyState";
export { Spinner } from "../src/components/ui/Spinner";
export { Skeleton } from "../src/components/ui/Skeleton";
export { ProgressRing } from "../src/components/ui/ProgressRing";
export { Sparkline } from "../src/components/ui/Sparkline";
export { AnimatedNumber } from "../src/components/ui/AnimatedNumber";
export { MarkdownBlock } from "../src/components/ui/MarkdownBlock";
export { TypewriterMarkdown } from "../src/components/ui/TypewriterMarkdown";
export { default as HubTabs } from "../src/components/ui/HubTabs";

// ── Brand & illustration ────────────────────────────────────────────────────
export { ArborMark } from "../src/components/ui/ArborMark";
export { ArborMascot } from "../src/components/ui/ArborMascot";
export { EmotionAvatar } from "../src/components/ui/EmotionAvatar";
export { ParentChildIllustration } from "../src/components/ui/ParentChildIllustration";
export { default as HeroCrest } from "../src/components/ui/HeroCrest";

// ── Layout kit (kit.tsx) ────────────────────────────────────────────────────
export { Chip } from "../src/components/ui/kit";
export { IconBadge } from "../src/components/ui/kit";
export { PageHeader } from "../src/components/ui/kit";
export { SectionCard } from "../src/components/ui/kit";
export { TrustSafetyBar } from "../src/components/ui/kit";
export { ComingSoon } from "../src/components/ui/kit";

// ── PlayKit (playkit.tsx — child-facing play surfaces) ───────────────────────
export { PlayShell } from "../src/components/ui/playkit";
export { PlayPanel } from "../src/components/ui/playkit";
export { PlayHeader } from "../src/components/ui/playkit";
export { PlayButton } from "../src/components/ui/playkit";
export { MascotSay } from "../src/components/ui/playkit";
export { ChoiceTile } from "../src/components/ui/playkit";
export { ProgressPips } from "../src/components/ui/playkit";
export { StatBubble } from "../src/components/ui/playkit";
export { Celebrate } from "../src/components/ui/playkit";
