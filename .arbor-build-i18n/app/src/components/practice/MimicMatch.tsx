import React, { useEffect, useRef, useState } from "react";
import { Camera, ShieldCheck, SkipForward, Sparkles, Star } from "lucide-react";
import { usePracticeData } from "../../practice/usePracticeData";
import { MIMIC_FACES, scoreFaceMatch, matchToStars, blendshapesToMap } from "../../practice/faceMatch";
import { getFaceLandmarker } from "../../lib/faceLandmarker";
import { useLanguage } from "../../context/LanguageContext";
import type { MimicSession } from "../../types";
import { track } from "../../lib/analytics";

/**
 * Face Match — on-device MediaPipe expression mimicry. The child copies a target
 * face; we score the GEOMETRY of the expression (blendshapes), never an inference
 * about their feelings or ability. Camera frames are processed locally and never
 * leave the device; only the resulting star rating is saved. Falls back gracefully
 * to the parent-led mirror above when the camera or model is unavailable.
 */
// A win must always earn the full 3 stars (matchToStars >= 0.8) so the celebration
// and the star count agree — no "win" that quietly reads as a 2-star near-miss.
const SUCCESS_AT = 0.8;

export default function MimicMatch({ childId, name }: { childId: string; name: string }) {
  const data = usePracticeData(childId);
  const { t } = useLanguage();
  const [status, setStatus] = useState<"idle" | "loading" | "live" | "unavailable">("idle");
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [won, setWon] = useState<1 | 2 | 3 | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const idxRef = useRef(0);
  const wonRef = useRef(false);
  const lastVideoTime = useRef(-1);
  const stoppedRef = useRef(false);

  const face = MIMIC_FACES[idx % MIMIC_FACES.length];
  useEffect(() => { idxRef.current = idx; }, [idx]);

  const stop = () => {
    stoppedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };
  useEffect(() => () => stop(), []);

  const onSuccess = (s: number) => {
    wonRef.current = true;
    const rating = matchToStars(s);
    const session: MimicSession = {
      id: `mm-face-${Date.now()}`,
      packId: "face-match",
      promptId: MIMIC_FACES[idxRef.current % MIMIC_FACES.length].id,
      rating,
      timestamp: new Date().toISOString(),
    };
    void data.mimic.upsert(session);
    track("mimic_face_match", { face: session.promptId, rating });
    setWon(rating);
    window.setTimeout(() => {
      setWon(null);
      setScore(0);
      wonRef.current = false;
      setIdx((i) => (i + 1) % MIMIC_FACES.length);
    }, 1400);
  };

  const start = async () => {
    setStatus("loading");
    stoppedRef.current = false;
    wonRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      const landmarker = await getFaceLandmarker();
      if (stoppedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play().catch(() => {});
      setStatus("live");

      const loop = () => {
        if (stoppedRef.current) return;
        const vid = videoRef.current;
        if (vid && vid.readyState >= 2 && vid.currentTime !== lastVideoTime.current) {
          lastVideoTime.current = vid.currentTime;
          try {
            const res = landmarker.detectForVideo(vid, performance.now());
            const cats = res.faceBlendshapes?.[0]?.categories ?? [];
            if (cats.length) {
              const target = MIMIC_FACES[idxRef.current % MIMIC_FACES.length].targets;
              const s = scoreFaceMatch(blendshapesToMap(cats as any), target);
              setScore(s);
              if (s >= SUCCESS_AT && !wonRef.current) onSuccess(s);
            } else {
              setScore(0);
            }
          } catch { /* skip this frame */ }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      stop();
      setStatus("unavailable");
    }
  };

  // Let a child move on from any face — no expression can ever trap them, however
  // stubborn its blendshape is from the camera. Resets the meter for the next face.
  const skipFace = () => {
    setWon(null);
    setScore(0);
    wonRef.current = false;
    setIdx((i) => (i + 1) % MIMIC_FACES.length);
  };

  const pct = Math.round(Math.min(1, score) * 100);

  return (
    <div className="rounded-[var(--play-radius-lg,24px)] p-5 bg-white shadow-[0_4px_20px_rgba(41,51,63,0.06)]">
      <div className="flex items-center gap-3 mb-2">
        <span className="grid place-items-center w-11 h-11 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
          <Sparkles className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("prac.mimic.face.title")}</h3>
          <p className="text-[12px] font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("prac.mimic.face.sub", { name })}</p>
        </div>
      </div>

      <div className="rounded-2xl p-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] mb-4" style={{ background: "var(--arbor-green-soft)" }}>
        <span className="font-extrabold inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}><ShieldCheck className="w-3.5 h-3.5" /> {t("prac.mimic.face.privacyTag")}</span>
        <span style={{ color: "var(--arbor-muted)" }}>{t("prac.mimic.face.privacy")}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Target face */}
        <div className="rounded-2xl p-6 text-center flex flex-col items-center justify-center" style={{ background: "var(--arbor-paper-deep)", minHeight: 240 }}>
          <span className="text-6xl">{face.emoji}</span>
          <p className="text-lg font-extrabold mt-3" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{face.label}</p>
          <p className="text-sm mt-1.5 max-w-xs" style={{ color: "var(--arbor-ink)" }}>{face.cue}</p>
        </div>

        {/* Camera + live match */}
        <div className="rounded-2xl overflow-hidden relative flex items-center justify-center" style={{ minHeight: 240, background: "#1c222b" }}>
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover absolute inset-0" style={{ transform: "scaleX(-1)", display: status === "live" ? "block" : "none" }} />

          {status === "live" && (
            <>
              {/* skip — never trap a child on a stubborn face */}
              {!won && (
                <button
                  onClick={skipFace}
                  className="play-pressable absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 text-[12px] font-extrabold px-3 py-2 rounded-xl text-white"
                  style={{ background: "rgba(28,34,43,0.6)", backdropFilter: "blur(4px)", minHeight: 44 }}
                >
                  <SkipForward className="w-4 h-4" /> {t("prac.mimic.face.skip")}
                </button>
              )}
              {/* live match meter */}
              <div className="absolute left-3 right-3 bottom-3 z-10" role="progressbar" aria-label={t("prac.mimic.face.meterLabel")} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.25)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= SUCCESS_AT * 100 ? "#5fce97" : "var(--arbor-yellow)" }} />
                </div>
              </div>
              {won && (
                <div className="absolute inset-0 z-20 grid place-items-center" style={{ background: "rgba(28,34,43,0.55)" }}>
                  <div className="text-center">
                    <div className="flex justify-center gap-1 mb-1">
                      {[1, 2, 3].map((n) => <Star key={n} className="w-7 h-7" style={{ color: n <= won ? "var(--arbor-yellow)" : "rgba(255,255,255,0.35)", fill: n <= won ? "var(--arbor-yellow)" : "transparent" }} />)}
                    </div>
                    <p className="text-white font-extrabold" style={{ fontFamily: "var(--font-display)" }}>{t("prac.mimic.face.win")}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {status !== "live" && (
            <div className="text-center p-6 relative z-10">
              <Camera className="w-8 h-8 mx-auto mb-3" style={{ color: "#a8a093" }} />
              {status === "idle" && (
                <button onClick={start} className="play-pressable inline-flex items-center gap-2 text-sm font-extrabold px-5 py-2.5 rounded-xl text-white" style={{ background: "var(--arbor-lav-ink)" }}>
                  <Sparkles className="w-4 h-4" /> {t("prac.mimic.face.start")}
                </button>
              )}
              {status === "loading" && <p className="text-xs" style={{ color: "#a8a093" }}>{t("prac.mimic.face.warming")}</p>}
              {status === "unavailable" && (
                <p className="text-xs max-w-[260px] mx-auto" style={{ color: "#a8a093" }}>
                  {t("prac.mimic.face.unavailable")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
