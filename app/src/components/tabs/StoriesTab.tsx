import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, RefreshCw, BookOpen, ChevronLeft, ChevronRight, Maximize2, Volume2, VolumeX, Save, Check, Library } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { StoryIllustration } from "../stories/StoryIllustration";
import ReadingMode from "../stories/ReadingMode";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";
import { useToast } from "../../context/ToastContext";
import { BedtimeStory } from "../../types";

type SavedStory = { story: BedtimeStory; savedAt: string };

export default function StoriesTab() {
  const {
    storyTopic,
    setStoryTopic,
    storyMoral,
    setStoryMoral,
    handleGenerateStory,
    isStoryGenerating,
    currentStory,
    setCurrentStory,
    activeStoryPage,
    setActiveStoryPage,
    storyReadingProgress,
    childProfile,
  } = useArbor();

  const { toast } = useToast();
  const [reading, setReading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [discussed, setDiscussed] = useState<Record<number, boolean>>({});
  const [library, setLibrary] = useState<SavedStory[]>([]);

  const libKey = useMemo(() => `arbor.stories.${childProfile.id}`, [childProfile.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(libKey);
      setLibrary(raw ? (JSON.parse(raw) as SavedStory[]) : []);
    } catch {
      setLibrary([]);
    }
  }, [libKey]);

  const persist = (next: SavedStory[]) => {
    setLibrary(next);
    try {
      localStorage.setItem(libKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const saveCurrent = () => {
    if (library.some((s) => s.story.title === currentStory.title)) {
      toast("Already in your library", "info");
      return;
    }
    persist([{ story: currentStory, savedAt: new Date().toISOString() }, ...library]);
    toast("Saved to story library", "success");
  };

  const isCover = activeStoryPage >= currentStory.pages.length;
  const pageText = isCover ? "" : currentStory.pages[activeStoryPage];

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else if (pageText) {
      speak(pageText, () => setSpeaking(false));
      setSpeaking(true);
    }
  };

  useEffect(() => {
    stopSpeaking();
    setSpeaking(false);
  }, [activeStoryPage, currentStory]);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">AI Bedtime & Transition Stories</h2>
        <p className="text-sm text-[#a8a093] mt-1">Generate supportive transition stories to ease separation concerns or build self-soothing behaviors.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8">
        {/* Form generator parameters */}
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4 text-xs self-start">
          <h3 className="text-base font-extrabold text-white pb-2 border-b border-white/5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#d7aa55]" /> Compose Story Parameters
          </h3>

          <div className="space-y-1.5">
            <label className="font-bold text-[#a8a093]">Focus Challenge Topic</label>
            <select value={storyTopic} onChange={(e) => setStoryTopic(e.target.value)} className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2.5 text-white">
              <option value="Fear of starting school">Fear of leaving burrow (Meadow & school anxiety)</option>
              <option value="Losing tablet bedroom boundaries">Tablet farewell boundaries (The digital tree leaves)</option>
              <option value="Sibling sharing dispute">Sharing carrot crops (Sibling negotiations)</option>
              <option value="Trying new crunchy foods">Trying crunchy foods (Selective eating exposure)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-[#a8a093]">Target moral or soothing action</label>
            <input type="text" value={storyMoral} onChange={(e) => setStoryMoral(e.target.value)} className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2.5 text-white" />
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="font-bold text-[#a8a093] block text-[10px] uppercase tracking-wider">🪄 AI Co-Pilot Story Enhancors:</span>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => setStoryMoral((m) => m + " (Add dual Hebrew and English code-switching calming words)")} className="bg-white/5 hover:bg-[#d7aa55]/20 hover:text-[#f4d991] px-2 py-1 rounded text-[10px] text-gray-350 transition cursor-pointer">+ Bilingual Code-Switching</button>
              <button type="button" onClick={() => setStoryMoral((m) => m + " (Include his comforting red toy truck named 'Little Climber')")} className="bg-white/5 hover:bg-[#d7aa55]/20 hover:text-[#f4d991] px-2 py-1 rounded text-[10px] text-gray-350 transition cursor-pointer">+ Red Toy Truck Security</button>
              <button type="button" onClick={() => setStoryMoral((m) => m + " (Pause during page 2 to guide five deep abdominal rabbit breaths)")} className="bg-white/5 hover:bg-[#d7aa55]/20 hover:text-[#f4d991] px-2 py-1 rounded text-[10px] text-gray-350 transition cursor-pointer">+ Somatic Abdominal Breaths</button>
            </div>
          </div>

          <button onClick={handleGenerateStory} disabled={isStoryGenerating} className="w-full py-3.5 bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-[0.98]">
            {isStoryGenerating ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Weaving bunny lore...</>) : (<><BookOpen className="w-4 h-4" /> Weave Bedtime Book</>)}
          </button>
        </div>

        {/* Book viewer */}
        <div className="bg-gradient-to-br from-[#12141c] to-[#04060c] border border-white/15 rounded-3xl p-6 md:p-8 flex flex-col justify-between gap-6 min-h-[440px] text-white relative shadow-2xl overflow-hidden">
          <div className="border-b border-white/5 pb-3 flex items-center justify-between text-[11px] text-amber-200">
            <span className="font-bold tracking-wider uppercase">Co-Regulation bedtime module</span>
            <div className="flex items-center gap-3">
              {ttsSupported() && (
                <button onClick={toggleSpeak} className={`flex items-center gap-1 transition ${speaking ? "text-[#f4d991]" : "hover:text-white"}`}>
                  {speaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />} {speaking ? "Stop" : "Read"}
                </button>
              )}
              <button onClick={() => setReading(true)} className="flex items-center gap-1 hover:text-white"><Maximize2 className="w-3.5 h-3.5" /> Reading mode</button>
              <span>Page {activeStoryPage + 1} of {currentStory.pages.length + 1}</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-4 py-4">
            <div className="w-24 h-24 rounded-2xl overflow-hidden self-center shadow-xl">
              <StoryIllustration seed={`${currentStory.title}-${activeStoryPage}`} className="w-full h-full" />
            </div>
            {!isCover ? (
              <div className="space-y-3">
                <em className="text-xs text-[#a8a093] block text-center">Section {activeStoryPage + 1}</em>
                <p className="text-sm md:text-base leading-relaxed text-gray-200 indent-4 font-medium italic text-center">"{pageText}"</p>
              </div>
            ) : (
              <div className="space-y-4">
                <span className="text-xs font-bold text-[#f4d991] tracking-widest block uppercase text-center">Parenting Discussion Prompts</span>
                <div className="space-y-2 text-xs text-gray-300">
                  {currentStory.discussionQuestions.map((q, qI) => (
                    <button
                      key={qI}
                      onClick={() => setDiscussed((d) => ({ ...d, [qI]: !d[qI] }))}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2 ${discussed[qI] ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-white/5 border-white/5 hover:border-white/15"}`}
                    >
                      <span className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${discussed[qI] ? "bg-emerald-500/30" : "bg-white/10"}`}>
                        {discussed[qI] && <Check className="w-3 h-3" />}
                      </span>
                      <span>{q}{discussed[qI] && <span className="text-emerald-400 font-bold"> · We talked about this ✓</span>}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#d7aa55] h-full transition-all duration-500" style={{ width: `${storyReadingProgress}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <button onClick={() => setActiveStoryPage((p) => Math.max(0, p - 1))} disabled={activeStoryPage === 0} className="text-[#a8a093] disabled:opacity-20 flex items-center gap-1 hover:text-white">
                <ChevronLeft className="w-4 h-4" /> Previous page
              </button>
              <button onClick={saveCurrent} className="text-[#f4d991] hover:text-white flex items-center gap-1 font-bold"><Save className="w-3.5 h-3.5" /> Save to library</button>
              <button onClick={() => setActiveStoryPage((p) => Math.min(currentStory.pages.length, p + 1))} disabled={activeStoryPage === currentStory.pages.length} className="text-[#f4d991] disabled:opacity-20 flex items-center gap-1 hover:text-white">
                {activeStoryPage === currentStory.pages.length - 1 ? "Discussion" : "Next"} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Story library */}
      <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4">
        <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
          <Library className="w-3.5 h-3.5 text-[#d7aa55]" /> Story library ({library.length})
        </span>
        {library.length === 0 ? (
          <p className="text-xs text-[#a8a093]">No saved stories yet. Generate a story and tap “Save to library”.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {library.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentStory(s.story);
                  setActiveStoryPage(0);
                }}
                className="text-left bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden hover:border-[#d7aa55]/40 transition group"
              >
                <div className="h-20 w-full">
                  <StoryIllustration seed={s.story.title} className="w-full h-full" />
                </div>
                <div className="p-3 space-y-0.5">
                  <span className="text-xs font-bold text-white block leading-tight line-clamp-2 group-hover:text-[#f4d991]">{s.story.title}</span>
                  <span className="text-[10px] text-[#a8a093]">{new Date(s.savedAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <ReadingMode open={reading} onClose={() => setReading(false)} />
    </motion.div>
  );
}
