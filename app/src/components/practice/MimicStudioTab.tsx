import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, CameraOff, ChevronLeft, ChevronRight, ShieldCheck, Smile, Star } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { PageHeader, SectionCard, cardCls, Chip } from "../ui/kit";
import { MIMIC_PACKS, type MimicPack } from "../../practice/content";
import { usePracticeData } from "../../practice/usePracticeData";
import type { MimicSession } from "../../types";
import { track } from "../../lib/analytics";

/**
 * Mimic Studio — Speech Blubs-style imitation play ("can you do what I do?").
 * The camera is a LOCAL MIRROR only: the stream is rendered, never recorded,
 * never uploaded. Only the parent's rating of each round is stored.
 */
export default function MimicStudioTab() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const data = usePracticeData(childProfile.id);
  const first = childProfile.name.split(" ")[0];

  const [packId, setPackId] = useState<string>(MIMIC_PACKS[0].id);
  const pack: MimicPack = MIMIC_PACKS.find((p) => p.id === packId) ?? MIMIC_PACKS[0];
  const [promptIdx, setPromptIdx] = useState(0);
  useEffect(() => setPromptIdx(0), [packId]);
  const prompt = pack.prompts[Math.min(promptIdx, pack.prompts.length - 1)];

  // ---- Local-only mirror (feature 4) ----
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mirrorOn, setMirrorOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);

  const stopMirror = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setMirrorOn(false);
  };

  const startMirror = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setMirrorOn(true);
      track("mimic_mirror_on", {});
    } catch {
      setCamError("Camera unavailable — the game works just as well face-to-face. You be the mirror!");
    }
  };

  useEffect(() => () => stopMirror(), []);

  // ---- Rating + pack progress (feature 5) ----
  const [justRated, setJustRated] = useState<number | null>(null);
  const ratedPromptIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of data.mimic.items) if (s.packId === pack.id) ids.add(s.promptId);
    return ids;
  }, [data.mimic.items, pack.id]);

  const rate = (rating: 1 | 2 | 3) => {
    const session: MimicSession = {
      id: `mm-${Date.now()}`,
      packId: pack.id,
      promptId: prompt.id,
      rating,
      timestamp: new Date().toISOString(),
    };
    void data.mimic.upsert(session);
    setJustRated(rating);
    track("mimic_round", { pack: pack.id, prompt: prompt.id, rating });
    window.setTimeout(() => {
      setJustRated(null);
      setPromptIdx((i) => (i + 1) % pack.prompts.length);
    }, 900);
  };

  const packDone = (p: MimicPack) => {
    const ids = new Set(data.mimic.items.filter((s) => s.packId === p.id).map((s) => s.promptId));
    return p.prompts.filter((x) => ids.has(x.id)).length;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Practice Studio"
        title={t("prac.mimic.title")}
        subtitle={t("prac.mimic.sub", { name: first })}
      />

      <div className="rounded-2xl p-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-ink)" }}>
        <span className="font-extrabold inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}><ShieldCheck className="w-4 h-4" /> Camera privacy</span>
        <span style={{ color: "var(--arbor-muted)" }}>The mirror is local-only: nothing is recorded, stored, or uploaded — ever. Only your star rating is saved.</span>
      </div>

      {/* Sound packs (feature 5) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {MIMIC_PACKS.map((p) => {
          const on = p.id === packId;
          const done = packDone(p);
          return (
            <button key={p.id} onClick={() => setPackId(p.id)}
              className={`${cardCls} p-4 text-left transition`}
              style={on ? { border: "1px solid var(--arbor-clay)", background: "#f3faf6" } : undefined}>
              <span className="text-2xl">{p.emoji}</span>
              <p className="text-sm font-extrabold mt-1.5" style={{ color: "var(--arbor-ink)" }}>{p.title}</p>
              <p className="text-[10.5px] mt-0.5 leading-snug" style={{ color: "var(--arbor-muted)" }}>{p.blurb}</p>
              <div className="flex items-center gap-1 mt-2">
                {p.prompts.map((_, i) => (
                  <span key={i} className="w-2 h-2 rounded-full" style={{ background: i < done ? "var(--arbor-clay)" : "rgba(41,51,63,0.12)" }} />
                ))}
                {done === p.prompts.length && <Star className="w-3.5 h-3.5 ml-1" style={{ color: "#d7aa55", fill: "#d7aa55" }} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* The round: model card + mirror */}
      <SectionCard title={`${pack.emoji} ${pack.title} — round ${promptIdx + 1} of ${pack.prompts.length}`} icon={<Smile className="w-5 h-5" />} tone="coral">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Model card — the parent demonstrates, big and theatrical */}
          <div className={`${cardCls} p-6 text-center flex flex-col items-center justify-center`} style={{ background: "var(--arbor-paper-deep)", minHeight: 260 }}>
            <motion.span key={prompt.id} initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 16 }} className="text-6xl">
              {prompt.emoji}
            </motion.span>
            <p className="text-lg font-extrabold mt-3" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{prompt.title}</p>
            <p className="text-sm mt-2 max-w-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{prompt.instruction}</p>
            <Chip tone="coral" icon={<Smile className="w-3 h-3" />}>{prompt.focus}</Chip>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setPromptIdx((i) => (i - 1 + pack.prompts.length) % pack.prompts.length)} aria-label="Previous round"
                className="p-2 rounded-xl" style={{ background: "#fff", border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPromptIdx((i) => (i + 1) % pack.prompts.length)} aria-label="Next round"
                className="p-2 rounded-xl" style={{ background: "#fff", border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {ratedPromptIds.has(prompt.id) && <p className="text-[10px] font-bold mt-2" style={{ color: "var(--arbor-clay)" }}>✓ Already played — replays still count</p>}
          </div>

          {/* Mirror — the child watches themselves try it */}
          <div className={`${cardCls} overflow-hidden relative flex items-center justify-center`} style={{ minHeight: 260, background: "#1c222b" }}>
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover absolute inset-0" style={{ transform: "scaleX(-1)", display: mirrorOn ? "block" : "none" }} />
            {!mirrorOn && (
              <div className="text-center p-6 relative z-10">
                <Camera className="w-8 h-8 mx-auto mb-3" style={{ color: "#a8a093" }} />
                <p className="text-xs mb-4 max-w-[260px] mx-auto" style={{ color: "#a8a093" }}>
                  Turn on the mirror so {first} can watch their own mouth while copying you. Local-only — never recorded.
                </p>
                <button onClick={() => void startMirror()} className="font-extrabold text-xs px-4 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-clay)" }}>
                  Turn on mirror
                </button>
                {camError && <p className="text-[11px] mt-3" style={{ color: "#e9a0b6" }}>{camError}</p>}
              </div>
            )}
            {mirrorOn && (
              <button onClick={stopMirror} className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-xl text-white" style={{ background: "rgba(28,34,43,0.75)" }}>
                <CameraOff className="w-3.5 h-3.5" /> Mirror off
              </button>
            )}
          </div>
        </div>

        {/* Rating */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>How did {first}&apos;s copy go?</span>
          {([
            { r: 1 as const, label: "Tried it!", bg: "var(--arbor-pink-soft)", fg: "var(--arbor-pink-ink)" },
            { r: 2 as const, label: "So close", bg: "var(--arbor-yellow-soft)", fg: "var(--arbor-yellow-ink)" },
            { r: 3 as const, label: "Nailed it ⭐", bg: "var(--arbor-green-soft)", fg: "var(--arbor-green-ink)" },
          ]).map((b) => (
            <button key={b.r} onClick={() => rate(b.r)} className="text-xs font-extrabold px-3.5 py-2 rounded-xl transition" style={{ background: b.bg, color: b.fg }}>
              {b.label}
            </button>
          ))}
          {justRated && (
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-base">
              {justRated === 3 ? "🎉 Amazing!" : justRated === 2 ? "👏 Great try!" : "💪 Trying IS the win!"}
            </motion.span>
          )}
        </div>
        <p className="text-[11px] mt-3" style={{ color: "var(--arbor-muted)" }}>
          Every attempt counts — in video-modeling practice, the imitation effort matters more than a perfect copy.
        </p>
      </SectionCard>
    </motion.div>
  );
}
