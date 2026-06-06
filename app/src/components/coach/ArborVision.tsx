import React, { useRef, useState } from "react";
import {
  Camera, FileText, Eye, Sparkles, RefreshCw, ListChecks, Ban, BookMarked,
  MessageSquare, Send, Copy, Check, AlertTriangle, Upload,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { api, type VisionResult, type VisionObserve, type VisionDocument } from "../../lib/api";
import { fileToThumbnail } from "../../lib/image";
import type { ChildProfile } from "../../types";

/**
 * Arbor Vision (VIS-2 + DOC-1): the parent shows Arbor a photo of a moment / the
 * environment / a drawing (observe) or a school report / form (document). The
 * image is downscaled on-device, sent to the multimodal model, and the result is
 * rendered as actionable cards that feed the rest of the app.
 */

const List = ({ icon, title, tint, items }: { icon: React.ReactNode; title: string; tint: string; items: string[] }) =>
  items?.length ? (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: tint }}>{icon} {title}</span>
      <ul className="space-y-1 text-[12.5px] text-gray-200 leading-snug list-disc pl-4">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  ) : null;

export default function ArborVision({ open, mode, onClose, childProfile, onSeedCoach, onGoHandoff, onGoBehaviors }: {
  open: boolean;
  mode: "observe" | "document";
  onClose: () => void;
  childProfile: ChildProfile;
  onSeedCoach: (prompt: string) => void;
  onGoHandoff: (note: string) => void;
  onGoBehaviors: (note: string) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setDataUrl(""); setNote(""); setResult(null); setError(null); setLoading(false); };
  const close = () => { reset(); onClose(); };

  const onPick = async (file?: File) => {
    if (!file) return;
    setError(null); setResult(null);
    try {
      const url = await fileToThumbnail(file, mode === "document" ? 1280 : 800, 0.82);
      setDataUrl(url);
    } catch {
      setError("Could not read that image — try another photo.");
    }
  };

  const analyze = async () => {
    if (!dataUrl) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await api.vision({ image: { dataUrl }, mode, note: note.trim() || undefined, childProfile });
      setResult(r);
    } catch (e: any) {
      setError(e?.message || "Arbor could not analyze this image.");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const isDoc = mode === "document";
  const title = isDoc ? "Scan a document" : "Show Arbor a photo";

  return (
    <Modal open={open} onClose={close} title={title} maxWidth="max-w-xl">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        {...(!isDoc ? { capture: "environment" as const } : {})}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />

      <p className="text-xs text-[#a8a093] mb-3">
        {isDoc
          ? "Photograph or upload a school report, daycare note or form. Arbor reads it and pulls out what matters — privately, on your device first."
          : "Show Arbor the moment, the room, or your child's drawing. Arbor describes what it sees and offers gentle, non-diagnostic next steps."}
      </p>

      {!dataUrl ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-white/15 hover:border-[#d7aa55]/50 rounded-2xl py-10 flex flex-col items-center gap-2 text-[#a8a093] hover:text-[#f4d991] transition"
        >
          {isDoc ? <Upload className="w-7 h-7" /> : <Camera className="w-7 h-7" />}
          <span className="text-sm font-bold">{isDoc ? "Upload or photograph a document" : "Take or choose a photo"}</span>
          <span className="text-[10px]">Resized on your device before sending</span>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <img src={dataUrl} alt="To analyze" className="w-full max-h-56 object-contain rounded-2xl border border-white/10 bg-black/30" />
            <button onClick={() => { setDataUrl(""); setResult(null); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-lg px-2 py-1 text-[10px] font-bold hover:bg-black/80">Change</button>
          </div>
          {!isDoc && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional: what's going on here? (e.g. 'bedtime, she won't settle in this room')"
              className="w-full bg-[#08090c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d7aa55]/50 resize-none"
              rows={2}
            />
          )}
          {!result && (
            <button
              onClick={analyze}
              disabled={loading}
              className="w-full bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold text-sm py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Arbor is looking…</> : <><Sparkles className="w-4 h-4" /> {isDoc ? "Read this document" : "Ask Arbor to look"}</>}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {result && result.offTopic && (
        <div className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/10 text-[12.5px] text-[#a8a093]">
          Arbor keeps to children's development and care. This image doesn't look like something it can help with — try a photo of a moment, the environment, a drawing, or a child-related document.
        </div>
      )}

      {result && !result.offTopic && result.mode === "observe" && (
        <div className="mt-3 space-y-2.5">
          <List icon={<Eye className="w-3 h-3" />} title="What Arbor sees" tint="#a89bd6" items={(result as VisionObserve).observations} />
          <List icon={<Sparkles className="w-3 h-3" />} title="What it may mean" tint="#f4d991" items={(result as VisionObserve).possibleMeanings} />
          <List icon={<ListChecks className="w-3 h-3" />} title="Try today" tint="#6f9e6f" items={(result as VisionObserve).tryToday} />
          <List icon={<Ban className="w-3 h-3" />} title="Avoid" tint="#cf8a6f" items={(result as VisionObserve).avoid} />
          {(result as VisionObserve).nonDiagnosticNote && (
            <p className="text-[11px] text-[#a8a093] italic px-1">{(result as VisionObserve).nonDiagnosticNote}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => { onSeedCoach(`About the photo I showed you${note ? ` (${note})` : ""}: ${(result as VisionObserve).observations?.[0] || ""}. What's one thing to try this week?`); close(); }}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#d7aa55]/10 text-[#f4d991] border border-[#d7aa55]/25 px-2.5 py-1.5 rounded-lg">
              <MessageSquare className="w-3.5 h-3.5" /> Discuss in Arbor
            </button>
            <button onClick={() => { onGoBehaviors((result as VisionObserve).observations?.join(". ") || note); close(); }}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/5 text-[#a8a093] hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg">
              <BookMarked className="w-3.5 h-3.5" /> Log this moment
            </button>
          </div>
        </div>
      )}

      {result && !result.offTopic && result.mode === "document" && (
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#7aa7d0] inline-flex items-center gap-1.5"><FileText className="w-3 h-3" /> {(result as VisionDocument).documentType || "Document"}</span>
          </div>
          <p className="text-[13px] text-gray-100 leading-relaxed">{(result as VisionDocument).summary}</p>
          <List icon={<ListChecks className="w-3 h-3" />} title="Key points" tint="#6f9e6f" items={(result as VisionDocument).keyPoints} />
          <List icon={<BookMarked className="w-3 h-3" />} title="Worth remembering" tint="#f4d991" items={(result as VisionDocument).suggestedMemory} />
          <List icon={<MessageSquare className="w-3 h-3" />} title="Ask the professional" tint="#a89bd6" items={(result as VisionDocument).questionsForProfessional} />
          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => { const n = (result as VisionDocument).handoffNote || (result as VisionDocument).summary; copy(n); onGoHandoff(n); close(); }}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#d7aa55]/10 text-[#f4d991] border border-[#d7aa55]/25 px-2.5 py-1.5 rounded-lg">
              <Send className="w-3.5 h-3.5" /> Use in a handoff
            </button>
            <button onClick={() => { onSeedCoach(`Here's what a ${(result as VisionDocument).documentType || "document"} from my child's school/clinic says: ${(result as VisionDocument).summary}. What should I take from this and do next?`); close(); }}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/5 text-[#a8a093] hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg">
              <MessageSquare className="w-3.5 h-3.5" /> Discuss in Arbor
            </button>
            <button onClick={() => copy((result as VisionDocument).summary)}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/5 text-[#a8a093] hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg">
              {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
