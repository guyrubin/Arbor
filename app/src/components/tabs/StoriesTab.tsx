import React from "react";
import { motion } from "motion/react";
import { Sparkles, RefreshCw, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";

export default function StoriesTab() {
  const {
    storyTopic,
    setStoryTopic,
    storyMoral,
    setStoryMoral,
    handleGenerateStory,
    isStoryGenerating,
    currentStory,
    activeStoryPage,
    setActiveStoryPage,
    storyReadingProgress,
  } = useArbor();

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">AI Bedtime & Transition Stories</h2>
        <p className="text-sm text-[#a8a093] mt-1">Generate supportive transition stories to ease separation concerns or build self-soothing behaviors.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-8">
        {/* Form generator parameters */}
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4 text-xs">
          <h3 className="text-base font-extrabold text-white pb-2 border-b border-white/5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#d7aa55]" />
            Compose Story Parameters
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
              <button type="button" onClick={() => setStoryMoral((m) => m + " (Add dual Hebrew and English code-switching calming words)")} className="bg-white/5 hover:bg-[#d7aa55]/20 hover:text-[#f4d991] px-2 py-1 rounded text-[10px] text-gray-350 transition cursor-pointer">
                + Bilingual Code-Switching
              </button>
              <button type="button" onClick={() => setStoryMoral((m) => m + " (Include his comforting red toy truck named 'Little Climber')")} className="bg-white/5 hover:bg-[#d7aa55]/20 hover:text-[#f4d991] px-2 py-1 rounded text-[10px] text-gray-350 transition cursor-pointer">
                + Red Toy Truck Security
              </button>
              <button type="button" onClick={() => setStoryMoral((m) => m + " (Pause during page 2 to guide five deep abdominal rabbit breaths)")} className="bg-white/5 hover:bg-[#d7aa55]/20 hover:text-[#f4d991] px-2 py-1 rounded text-[10px] text-gray-350 transition cursor-pointer">
                + Somatic Abdominal Breaths
              </button>
            </div>
          </div>

          <button onClick={handleGenerateStory} disabled={isStoryGenerating} className="w-full py-3.5 bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 disabled:text-[#a8a093] text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-2">
            {isStoryGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Weaving bunny lore...
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" /> Weave Bedtime Book
              </>
            )}
          </button>
        </div>

        {/* Simulated physical bedtime book view */}
        <div className="bg-gradient-to-br from-[#12141c] to-[#04060c] border border-white/15 rounded-3xl p-6 md:p-8 flex flex-col justify-between gap-6 min-h-[440px] text-white relative shadow-2xl overflow-hidden shadow-black">
          <div className="absolute top-4 right-4 text-amber-300 opacity-20 text-5xl">✨</div>
          <div className="absolute bottom-6 left-6 text-2xl opacity-10">🌙</div>

          <div className="border-b border-white/5 pb-3 flex items-center justify-between text-[11px] text-amber-200">
            <span className="font-bold tracking-wider uppercase">Co-Regulation bedtime module selection</span>
            <span>Page {activeStoryPage + 1} of {currentStory.pages.length + 1}</span>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-4 py-4">
            {activeStoryPage < currentStory.pages.length ? (
              <div className="space-y-4">
                <em className="text-xs text-[#a8a093] block">Section {activeStoryPage + 1} of Alek rabbit story</em>
                <p className="text-sm md:text-base leading-relaxed text-gray-200 indent-4 font-medium italic">
                  "{currentStory.pages[activeStoryPage]}"
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <span className="text-xs font-bold text-[#f4d991] tracking-widest block uppercase">Parenting Discussion Prompts:</span>
                <div className="space-y-2 text-xs text-gray-300">
                  {currentStory.discussionQuestions.map((q, qI) => (
                    <div key={qI} className="p-2.5 bg-white/5 rounded-xl border border-white/5">{q}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#d7aa55] h-full" style={{ width: `${storyReadingProgress}%` }} />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button onClick={() => setActiveStoryPage((p) => Math.max(0, p - 1))} disabled={activeStoryPage === 0} className="text-[#a8a093] disabled:opacity-20 flex items-center gap-1 hover:text-white">
                <ChevronLeft className="w-4 h-4" /> Previous page
              </button>
              <button onClick={() => setActiveStoryPage((p) => Math.min(currentStory.pages.length, p + 1))} disabled={activeStoryPage === currentStory.pages.length} className="text-[#f4d991] disabled:opacity-20 flex items-center gap-1 hover:text-white">
                {activeStoryPage === currentStory.pages.length - 1 ? "Discussion questions" : "Save and flip"} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Reading Companion & Sensory Guide */}
      <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3 text-xs text-left">
        <h4 className="text-sm font-extrabold text-[#f4d991] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" />
          AI Parent Co-Reading & Somatic Calibration Companion
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 leading-relaxed text-[#a8a093]">
          <div className="space-y-1 p-3 bg-white/[0.01] border border-white/5 rounded-xl">
            <span className="font-bold text-white block text-[11px] uppercase tracking-wider text-[#f4d991] mr-1">1. Vocal Amplitude (Piagetian)</span>
            <p>Read bunny dialogues in a low, warm whispering hum. This drops the child’s auditory arousal, encouraging deep emotional receptivity.</p>
          </div>
          <div className="space-y-1 p-3 bg-white/[0.01] border border-white/5 rounded-xl">
            <span className="font-bold text-white block text-[11px] uppercase tracking-wider text-[#f4d991] mr-1">2. Somatic Mimicry (Bowlby)</span>
            <p>At Page 2, put the child’s hand on your ribcage. Breathe slowly together so Dylan mimics your vagus nerve calming rhythm directly.</p>
          </div>
          <div className="space-y-1 p-3 bg-white/[0.01] border border-white/5 rounded-xl">
            <span className="font-bold text-white block text-[11px] uppercase tracking-wider text-[#f4d991] mr-1">3. Vygotskian Prompts</span>
            <p>When clicking the Story Questions at the end, prompt the child in both English and Hebrew to bridge transition confidence.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
