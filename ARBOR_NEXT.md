# Arbor — Next-Level Enhancement Instructions
**For:** Claude Code / LLM coding session  
**Branch off:** `codex/arbor-v2-architecture-foundation`  
**Repo:** `C:\Users\dguyr\ROS\.workspace\PPPPtherapy-\app`  
**Date:** 2026-05-28

---

## 0. Context — What Arbor Is

Arbor is a **parent development support app** for a single parent (Guy) raising a child named **Dylan**, age ~4–5, bilingual (Hebrew/English), navigating school transition. The app is not a consumer product — it is a personal AI-powered parenting OS.

**Current stack:**
- React 18 + TypeScript + Vite + Tailwind CSS v4
- `motion/react` (Framer Motion v11) for animations
- Express.js backend at `/api`
- Google Gemini API (via `@google/genai`) for all AI features
- Firebase Admin SDK already installed (Firestore, Auth ready to wire up)
- Single monolithic `src/App.tsx` (2,588 lines) — needs decomposition
- Design system: warm parchment theme (`--arbor-paper`, `--arbor-clay`, `--arbor-ink`) defined in `src/index.css`

**Current nav tabs:** Overview · Parent Coach · Behavior Logs · Milestones · Action Plans · Bedtime Stories · Scholar Hub · School Handoff · Safety

---

## 1. Mandatory First Steps

```bash
cd C:\Users\dguyr\ROS\.workspace\PPPPtherapy-\app
git checkout -b feat/arbor-next
npm install
```

Before touching any feature, **refactor the monolith**:

### 1.1 Component decomposition

Split `src/App.tsx` into focused components under `src/components/`:

```
src/
  components/
    layout/
      Sidebar.tsx          # Nav + child profile summary
      AiRail.tsx           # Right-side AI engine panel
      Shell.tsx            # App shell wrapper
    tabs/
      OverviewTab.tsx
      CoachTab.tsx
      BehaviorsTab.tsx
      MilestonesTab.tsx
      PlansTab.tsx
      StoriesTab.tsx
      ScholarTab.tsx
      HandoffTab.tsx
      SafetyTab.tsx
    ui/
      Button.tsx           # Design-system button variants
      Card.tsx             # Parchment card with shadow
      Badge.tsx
      Modal.tsx
      ProgressRing.tsx
      EmptyState.tsx
      Spinner.tsx
      MarkdownBlock.tsx    # Renders AI markdown output
    auth/
      LoginScreen.tsx
      OnboardingFlow.tsx
  hooks/
    useChat.ts
    useChildProfile.ts
    useBehaviorLogs.ts
    useMilestones.ts
    useAuth.ts
  lib/
    firebase.ts            # Firebase client init
    api.ts                 # Typed fetch wrappers
  context/
    AuthContext.tsx
    ProfileContext.tsx
```

Keep `App.tsx` as a thin router shell (< 100 lines) that renders the correct tab.

---

## 2. User Authentication

### 2.1 Firebase Auth setup

The Firebase Admin SDK is already a dev dependency. Add the **Firebase client SDK**:

```bash
npm install firebase
```

Create `src/lib/firebase.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Read from import.meta.env.VITE_FIREBASE_* 
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

Add to `.env.example`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

### 2.2 Auth flows to implement

**LoginScreen.tsx** — full-screen warm parchment login:
- Google OAuth ("Continue with Google") — primary CTA in clay (#e2562d)
- Email + password — secondary option
- Logo mark centered (use the existing SVG from Sidebar)
- Tagline: *"Your child's development, thoughtfully guided."*
- No sign-up form — invite-only for now (show "Request access" link)

**AuthContext.tsx:**
```typescript
// Provides: user, loading, signInWithGoogle(), signOut()
// On sign-in → check Firestore /users/{uid} exists → if not, trigger onboarding
// Wrap entire app, show LoginScreen if !user
```

**Protected routes:** Every tab requires auth. Unauthenticated users see only LoginScreen.

**Server-side:** All `/api/*` routes must verify Firebase ID token in `Authorization: Bearer <token>` header. Add middleware in `src/server/authMiddleware.ts` using Firebase Admin `verifyIdToken()`.

---

## 3. Child Profiles

### 3.1 Multi-profile architecture

Replace hardcoded `defaultChildProfile` with Firestore-backed profiles.

**Firestore schema:**
```
/users/{uid}/
  profile: { email, displayName, createdAt }
  children/{childId}/
    profile: ChildProfile
    behaviorLogs/{logId}: BehaviorLog
    milestones/{milestoneId}: Milestone
    actionPlans/{planId}: ActionPlan
    memories/{memoryId}: MemoryReviewItem
```

**ProfileContext.tsx:**
```typescript
// Provides: children[], activeChild, setActiveChild(), addChild(), updateChild()
// Loads from Firestore on mount
// activeChild persists to localStorage
```

### 3.2 Child profile UI

**Profile switcher in Sidebar** — above nav items:
- Avatar circle with child's initial + clay ring
- Name + age badge
- Click → dropdown showing all children + "Add child" option

**Add Child flow** (modal, 3 steps):
1. Name + age + photo upload
2. Languages (multi-select pills: Hebrew, English, Arabic, Russian, French, Other)
3. Key strengths + current challenges (free text, optional)

**Profile editing:** Clicking the active profile opens an edit drawer (slide in from right), no separate page needed.

### 3.3 Wire existing features to active profile

Every AI call, behavior log, milestone, and action plan must be scoped to `activeChild.id`. Replace all hardcoded `childProfile` state references with `useChildProfile()` hook that reads from ProfileContext.

---

## 4. Feature Enhancements

### 4.1 Overview tab — full redesign

Current: static cards. Replace with a **live dashboard**:

**Top row — 3 KPI cards** (animated numbers on mount):
- 🔴 Behavior intensity trend (7-day rolling avg, arrow up/down)
- ✅ Milestone progress (X of Y checked, domain breakdown ring)
- 💬 Coach sessions this week (count)

**Middle — Weekly Pattern Chart** using `recharts`:
- Bar chart: behavior events by day of week (last 4 weeks)
- Color-coded by intensity (1–5: sage → clay)
- Click a bar → filters behavior log tab to that day

**Bottom row:**
- "Today's focus" card — AI-generated each morning from recent logs (cache 24h in Firestore)
- "Active action plans" — progress bars for each plan's step completion
- Quick-log button floating bottom-right (opens behavior log modal without leaving overview)

### 4.2 Parent Coach — streaming improvements

Current: full response then render. Enhance:
- **Token streaming** — render text word-by-word as it arrives (use `ReadableStream` from fetch response, already set up for SSE)
- **Conversation history** — persist last 10 messages to Firestore per child, restore on load
- **Message actions** — hover over any AI message → show: "Save to Action Plan", "Log this", "Copy"
- **Suggested follow-ups** — after each AI response, show 3 clickable chips with follow-up questions
- **Scholar lens indicator** — show active lens as a pill in chat header, pulse animation when AI is responding with that lens

### 4.3 Behavior Logs — pattern intelligence

**Log entry enhancements:**
- Add `context` field: where did it happen? (Home / School / Transit / Public)
- Add `resolved` boolean + `resolutionNotes`
- Add `photoAttachment` (optional Firebase Storage URL)

**Log list improvements:**
- Filter bar: by type, intensity, date range, resolved status
- Group by week with collapsible sections
- Intensity sparkline per behavior type (show trend over last 30 days)
- Export to PDF button (generates a clean behavior summary for therapist)

**Inline co-regulation script** (already exists): keep but improve UI — show as an expandable card below each log entry with smooth animation, not a modal.

### 4.4 Milestones — interactive tracker

- Add domain filter tabs at top (Attachment · Language · Cognition · Social · Independence · Sensory · Ecosystem)
- Progress ring per domain (checked / total) in the filter tab
- Milestone cards: add estimated age range text, link to 1–2 research references
- "Celebrate" button on newly checked milestone → confetti animation (use `canvas-confetti`)
- Add custom milestone option: "+ Add milestone" → free text, assign domain

### 4.5 Action Plans — project board feel

Current: list of plans with phases. Redesign as a **Kanban-style tracker**:
- Columns: Not Started · In Progress · Completed
- Drag-and-drop steps between phases (use `@dnd-kit/core`)
- Each plan card shows: title, issue summary, completion ring, days active
- Step completion auto-saves to Firestore
- "Generate new plan" keeps existing modal flow but improves the AI prompt to be more specific

### 4.6 Bedtime Stories — reading experience

Current: page viewer with prev/next. Enhance:
- **Reading mode**: full-screen, dark background, large serif text, auto-scroll option
- **Illustration placeholder**: show a warm geometric illustration per page (SVG patterns derived from story theme — no external image API needed)
- **Text-to-speech button**: use browser `SpeechSynthesis` API, read aloud in selected voice
- **Story library**: save generated stories to Firestore, show a library grid with cover title + date
- **Discussion questions**: show after last page as interactive cards, parent can tap "We talked about this ✓"

### 4.7 Weekly Intelligence Report (NEW feature)

Add a new tab: **"Weekly Report"** (icon: `BarChart2`).

Every Sunday, auto-generate (or on-demand generate) a structured weekly report:

```
Weekly Report — Week of [date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Behavior summary: X events, avg intensity Y, top trigger Z
🎯 Milestone wins: [list newly checked this week]
💡 AI insight: [1 paragraph from Gemini analyzing patterns]
📋 Action plan progress: [step completions this week]
🎓 Scholar spotlight: [1 developmental concept relevant to this week]
📬 Ready to share: [generate school brief button]
```

Store reports in Firestore `/users/{uid}/children/{childId}/weeklyReports/{weekId}`.

### 4.8 Safety tab — escalation clarity

Current: static safety information. Make it more actionable:
- **Risk level indicator**: pull from `childProfile.riskLevel` → show colored banner (Low: sage, Moderate: ochre, High: clay)
- **Escalation checklist**: interactive checkboxes for warning signs
- **Emergency contacts**: add/edit list of professionals (name, role, phone, notes) — stored in Firestore
- **Crisis script card**: pinned card with exact language to use in a crisis moment
- **Last reviewed date**: show when safety info was last updated, prompt to review monthly

---

## 5. Design System Upgrades

### 5.1 Foundational rules (do not break)

The warm parchment theme in `src/index.css` is intentional and must be preserved:
- Background: `--arbor-paper: #e9e2d0`
- Accent: `--arbor-clay: #e2562d`
- Text: `--arbor-ink: #14160f`
- Display font: `Instrument Serif` (headings)
- Body font: `Plus Jakarta Sans`

### 5.2 New design patterns to add

**Micro-interactions:**
- All buttons: `scale(0.97)` on press (`active:scale-[0.97]` in Tailwind)
- Cards: `translateY(-2px)` on hover with shadow increase
- Tab switching: `AnimatePresence` with slide direction based on tab order (left/right not fade)
- Number values: animate from 0 to final value on mount using `motion.div` counter

**Empty states:**
- Every tab with no data needs a beautiful empty state: centered illustration (SVG), headline, CTA button
- Style: Instrument Serif headline, muted body, clay CTA

**Loading states:**
- Replace all spinners with skeleton screens matching the content shape
- Skeleton: `bg-[rgba(20,22,15,0.06)]` with `animate-pulse`, matching card dimensions

**Toast notifications:**
- Add a toast system (build lightweight, no library needed)
- Position: top-right, slide in from right
- Types: success (sage), error (clay), info (blue)
- Auto-dismiss: 4 seconds

**Mobile responsiveness:**
- Current layout is desktop-first. Add responsive breakpoints:
  - Mobile (< 768px): sidebar collapses to bottom tab bar (5 main tabs), AI rail hidden
  - Tablet (768–1024px): sidebar visible, AI rail toggle button
  - Desktop (> 1024px): full 3-column layout (current)

### 5.3 Typography scale

Add these classes to `index.css`:
```css
.arbor-display-xl { font: 700 2.5rem/1.1 var(--font-display); }
.arbor-display-lg { font: 700 1.75rem/1.2 var(--font-display); }
.arbor-label { font: 600 0.6875rem/1 var(--font-sans); letter-spacing: 0.1em; text-transform: uppercase; }
.arbor-muted-text { color: var(--arbor-muted); font-size: 0.875rem; }
```

---

## 6. Performance & Code Quality

### 6.1 Code splitting

```typescript
// In App.tsx — lazy load each tab
const OverviewTab = lazy(() => import('./components/tabs/OverviewTab'));
const CoachTab = lazy(() => import('./components/tabs/CoachTab'));
// etc.
// Wrap with <Suspense fallback={<TabSkeleton />}>
```

### 6.2 API layer

Create `src/lib/api.ts` — all fetch calls go through typed wrappers:
```typescript
export const api = {
  chat: (payload: ChatRequest) => post<ChatResponse>('/api/chat', payload),
  generatePlan: (payload: PlanRequest) => post<ActionPlan>('/api/plan', payload),
  generateStory: (payload: StoryRequest) => post<BedtimeStory>('/api/story', payload),
  generateBrief: (payload: BriefRequest) => post<SchoolBrief>('/api/brief', payload),
};
```

### 6.3 Error boundaries

Add `src/components/ErrorBoundary.tsx` — wrap each tab, show friendly error card with retry button.

### 6.4 Data persistence

- All user-generated data (logs, milestones, plans, stories) → Firestore (real-time `onSnapshot`)
- AI-generated content → cache in Firestore with TTL field, refetch if stale
- User preferences (active tab, AI rail visibility, selected lens) → `localStorage`

---

## 7. Environment Variables

Final `.env.example` should have:
```
# AI
GEMINI_API_KEY=
VITE_HAS_GEMINI_API=true

# Firebase Client (exposed to browser)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_APP_ID=

# Firebase Admin (server-side only, never VITE_ prefix)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

---

## 8. Commit Strategy

Work in focused commits on branch `feat/arbor-next`:

```
1. refactor: decompose App.tsx into component tree
2. feat(auth): Firebase Auth + login screen + protected routes
3. feat(profiles): multi-child Firestore-backed profiles
4. feat(overview): live dashboard with charts and KPIs
5. feat(coach): streaming + conversation history + follow-ups
6. feat(behaviors): enhanced logging, filters, export
7. feat(milestones): domain tabs, rings, celebrate animation
8. feat(plans): kanban board with drag-and-drop
9. feat(stories): reading mode, TTS, story library
10. feat(weekly-report): new tab with auto-generated report
11. feat(safety): risk indicator, contacts, escalation tools
12. design: mobile responsive layout, skeleton screens, toasts
13. perf: code splitting, lazy loading, error boundaries
```

---

## 9. Definition of Done

A feature is complete when:
- [ ] Renders correctly on mobile (375px), tablet (768px), desktop (1440px)
- [ ] Firestore reads/writes are real (not mocked state)
- [ ] Auth-gated (no unauthenticated access)
- [ ] Empty state handled
- [ ] Loading state handled (skeleton, not spinner)
- [ ] Error state handled (toast or inline error)
- [ ] No TypeScript errors (`npm run tsc --noEmit`)
- [ ] Design matches Arbor parchment system (no rogue white backgrounds, no dark mode leakage)

---

## 10. What NOT to Do

- Do not introduce a UI library (no shadcn, no MUI, no Radix) — build from the existing design system
- Do not change the color palette or font choices
- Do not make Arbor look like a generic SaaS app — it is personal, warm, and editorial
- Do not add social features, sharing, or multi-user collaboration — this is a single-parent tool
- Do not over-engineer — if a feature needs < 50 lines, keep it inline
- Do not break the existing AI streaming or scholar lens system — enhance around it
- Do not add ads, analytics tracking, or third-party scripts
