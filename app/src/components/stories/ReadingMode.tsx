import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX, Play, Pause } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { StoryIllustration } from "./StoryIllustration";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";

export default function ReadingMode({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { currentStory, activeStoryPage, setActiveStoryPage } = useArbor();
  const [speaking, setSpeaking] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);

  const isCover = activeStoryPage >= currentStory.pages.length;
  const pageText = isCover ? "" : currentStory.pages[activeStoryPage];

  // Auto-advance pages when enabled.
  useEffect(() => {
    if (!open || !autoScroll || isCover) return;
    const t = setTimeout(() => setActiveStoryPage((p) => Math.min(currentStory.pages.length, p + 1)), 12_000);
    return () => clearTimeout(t);
  }, [open, autoScroll, activeStoryPage, isCover, currentStory.pages.length, setActiveStoryPage]);

  // Stop speech when leaving a page or closing.
  useEffect(() => {
    if (!open) {
      stopSpeaking();
      setSpeaking(false);
    }
  }, [open]);

  useEffect(() => {
    stopSpeaking();
    setSpeaking(false);
  }, [activeStoryPage]);

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else if (pageText) {
      speak(pageText, () => setSpeaking(false));
      setSpeaking(true);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] bg-[#06070a] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-4 text-[#a8a093]">
            <span className="text-xs font-bold tracking-wider uppercase">{currentStory.title}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setAutoScroll((a) => !a)} title="Auto-scroll" className={`flex items-center gap-1.5 text-xs font-bold transition ${autoScroll ? "text-[#f4d991]" : "hover:text-white"}`}>
                {autoScroll ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} Auto
              </button>
              {ttsSupported() && (
                <button onClick={toggleSpeak} title="Read aloud" className={`flex items-center gap-1.5 text-xs font-bold transition ${speaking ? "text-[#f4d991]" : "hover:text-white"}`}>
                  {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />} {speaking ? "Stop" : "Read"}
                </button>
              )}
              <button onClick={onClose} className="hover:text-white" aria-label="Exit reading mode">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Page body */}
          <div className="flex-1 overflow-y-auto flex items-center justify-center px-6">
            <div className="max-w-2xl w-full text-center space-y-8 py-10">
              <div className="w-40 h-40 mx-auto rounded-3xl overflow-hidden shadow-2xl">
                <StoryIllustration seed={`${currentStory.title}-${activeStoryPage}`} className="w-full h-full" />
              </div>
              {isCover ? (
                <div className="space-y-4">
                  <h2 className="text-[#f4d991] text-sm uppercase tracking-widest font-bold">Discussion prompts</h2>
                  <div className="space-y-3">
                    {currentStory.discussionQuestions.map((q, i) => (
                      <p key={i} className="text-2xl md:text-3xl leading-relaxed text-gray-100" style={{ fontFamily: "var(--font-display, Georgia), serif" }}>{q}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p dir="auto" className="text-2xl md:text-4xl leading-relaxed text-gray-100" style={{ fontFamily: "var(--font-display, Georgia), serif" }}>
                  {pageText}
                </p>
              )}
            </div>
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-between px-6 py-5">
            <button onClick={() => setActiveStoryPage((p) => Math.max(0, p - 1))} disabled={activeStoryPage === 0} className="text-[#a8a093] disabled:opacity-20 hover:text-white flex items-center gap-1 text-sm">
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>
            <span className="text-xs text-[#a8a093]">Page {activeStoryPage + 1} of {currentStory.pages.length + 1}</span>
            <button onClick={() => setActiveStoryPage((p) => Math.min(currentStory.pages.length, p + 1))} disabled={activeStoryPage === currentStory.pages.length} className="text-[#f4d991] disabled:opacity-20 hover:text-white flex items-center gap-1 text-sm">
              Next <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
