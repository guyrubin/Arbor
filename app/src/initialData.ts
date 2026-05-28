import { ChildProfile, BehaviorLog, Milestone, ActionPlan, BedtimeStory } from "./types";

export const defaultChildProfile: ChildProfile = {
  id: "dylan-demo",
  name: "Dylan",
  age: 5,
  languages: ["Hebrew (Native)", "English (Transition)"],
  schoolContext: "Entering Bilingual Kindergarten in 3 months",
  strengths: [
    "Vibrant imaginative play & world-building",
    "Deep empathy (comforts people and animals)",
    "Asks complex physics questions about light/gravity"
  ],
  challenges: [
    "Severe transition anxiety (refusal to leave the house)",
    "Sensory meltdowns in overcrowded dynamic spaces",
    "English language hesitation when answering elders"
  ],
  riskLevel: "Low"
};

export const sampleBehaviorLogs: BehaviorLog[] = [
  {
    id: "log-1",
    timestamp: "2026-05-23T08:15:00Z",
    behaviorType: "Transition Refusal",
    intensity: 4,
    durationMinutes: 25,
    trigger: "Setting off for preschool in the morning",
    response: "Holding firm on leaving, but naming feelings: 'I know it is hard to say goodbye.'",
    notes: "Protested heavily, sat behind the couch. Leaving took 15 minutes longer."
  },
  {
    id: "log-2",
    timestamp: "2026-05-22T17:30:00Z",
    behaviorType: "Sensory Meltdown",
    intensity: 5,
    durationMinutes: 35,
    trigger: "Busy shopping mall loud sounds and flashing lights",
    response: "Moved to a quiet family room, offered deep pressure hugs, and waited in silence.",
    notes: "Dylan curled into a ball, covers ears. Recovered quickly once stimuli was removed."
  },
  {
    id: "log-3",
    timestamp: "2026-05-21T08:00:00Z",
    behaviorType: "Transition Refusal",
    intensity: 3,
    durationMinutes: 15,
    trigger: "Getting dressed process transition",
    response: "Used a visual routine chart + presented two controlled choices of pants.",
    notes: "Protest was minor. Choice strategy cut tantrum duration from 25m to 10m."
  },
  {
    id: "log-4",
    timestamp: "2026-05-20T19:30:00Z",
    behaviorType: "Sibling Dispute / Screentime Refusal",
    intensity: 4,
    durationMinutes: 20,
    trigger: "Turning off tablet at bedtime limit",
    response: "Used standard count-down timer, but matched with physical transition script.",
    notes: "Cried and threw a cushion, then self-soothed in the reading nook."
  }
];

export const initialMilestones: Milestone[] = [
  // Age 4-5 Milestones
  { id: "m-1", domain: "Emotional", ageGroup: "Age 4-5", title: "Regulates with Prompting", description: "Can calm down within 15 minutes with warm adult co-regulation.", checked: true },
  { id: "m-2", domain: "Language", ageGroup: "Age 4-5", title: "Uses Full Sentences", description: "Speaks in sentences of 5-6 words, sharing clear thoughts on what they did during the day.", checked: true },
  { id: "m-3", domain: "Social", ageGroup: "Age 4-5", title: "Imaginative Cooperative Play", description: "Plays 'makeup' games with other children, successfully negotiating simple rules.", checked: true },
  { id: "m-4", domain: "Independence", ageGroup: "Age 4-5", title: "Dresses Independently", description: "Can button shirts, pull up pants, and arrange shoes with minimal direction.", checked: true },
  { id: "m-5", domain: "Motor", ageGroup: "Age 4-5", title: "Hops on One Foot", description: "Balances and hops comfortably on one foot for 3-4 consecutive bounds.", checked: true },
  
  // Age 5-6 Milestones
  { id: "m-6", domain: "Emotional", ageGroup: "Age 5-6", title: "Articulates Specific Feelings", description: "Can verbally name complex feelings: e.g., 'I am lonely,' 'I feel disappointed.'", checked: false },
  { id: "m-7", domain: "Language", ageGroup: "Age 5-6", title: "Handles Code-Switching", description: "Can comfortably shift phrases between Hebrew and English depending on the listener.", checked: false },
  { id: "m-8", domain: "Social", ageGroup: "Age 5-6", title: "Conflict Resolution Process", description: "Suggests simple compromises when a toy dispute arises ('You play 5 mins, then me').", checked: false },
  { id: "m-9", domain: "Cognitive", ageGroup: "Age 5-6", title: "Time Sequencing", description: "Correctly sequences days, understand 'tomorrow vs yesterday', and basic morning schedule.", checked: true },
  { id: "m-10", domain: "Independence", ageGroup: "Age 5-6", title: "Manages Senses Pre-emptively", description: "Can say 'It is too loud here' and requests headphones or leaving space.", checked: false }
];

export const defaultActionPlans: ActionPlan[] = [
  {
    id: "plan-1",
    title: "Preschool Transition & Morning Arrival Plan",
    scholarBadge: "Bowlby · Winnicott",
    issue: "Transition anxiety triggered by departure pressure and bilingual friction on leaving high-comfort home zone.",
    phases: [
      {
        name: "Phase 1: Safe Home Departure Layout",
        description: "Focus on reducing departure surprises and building predictable routines.",
        steps: [
          { text: "Update visual morning schedule magnets together with Dylan.", completed: true },
          { text: "Present 'Controlled Choices' (Red shirt or blue shirt? Walk to car or hop like a bunny?) to activate the autonomy centers.", completed: true },
          { text: "Implement a 3-minute transitional music block before shoes go on.", completed: false }
        ]
      },
      {
        name: "Phase 2: Transition Ritual Bridge",
        description: "Engage sensory centering and secure attachment checks during the drive.",
        steps: [
          { text: "Hand over the transitional object ('The courage pebble' or pocket plush).", completed: true },
          { text: "Run English language rehearsal game ('Can I play please?').", completed: false }
        ]
      },
      {
        name: "Phase 3: Classroom Handoff Connection",
        description: "Co-regulation handoff from attachment figure to lead teacher.",
        steps: [
          { text: "Apply high-contrast double handshake signature routine on entry.", completed: false },
          { text: "Review the handoff with teacher verbally, signaling safe transfer.", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Dylan sits on the floor refusing to hold shoes",
        say: "I hear you, Dylan. You feel cozy here and want to stay. It is time to leave. Do you want to wear velcro or laces today?",
        avoid: "Yelling 'We are going to be late!' which drives child survival brain into deeper freeze state."
      },
      {
        scenario: "When separating at the classroom door",
        say: "I will go now, and I always, always come back. Miss Linda will keep you safe until lunch. Let's do our lock-and-key hug.",
        avoid: "Sneaking out while they are distracted, which fractures attachment trust."
      }
    ],
    successIndicators: [
      "No physical freeze or hiding during departure shoes sequence.",
      "Crying at separation resolves under 4 minutes with co-regulation.",
      "Actively uses transitional courage pebble object."
    ]
  },

  // ── ROUTINE 2: SLEEP & BEDTIME RITUAL ───────────────────────────────────────
  {
    id: "plan-2",
    title: "Sleep & Bedtime Ritual",
    scholarBadge: "Bowlby · Winnicott",
    issue: "Resistance to sleep onset, separation anxiety at lights-out, and repeated requests to delay the transition to sleep.",
    phases: [
      {
        name: "Phase 1: Environment & Wind-Down Cue",
        description: "Signal the nervous system 45 minutes before sleep that the day is closing. Lower arousal gradually.",
        steps: [
          { text: "Dim all overhead lights and switch to warm lamp light 45 min before sleep.", completed: false },
          { text: "Introduce a consistent bedtime scent (lavender diffuser) as a Pavlovian sleep anchor.", completed: false },
          { text: "No screens within 45 minutes of target sleep time — replace with calm physical play or drawing.", completed: false }
        ]
      },
      {
        name: "Phase 2: Ritual Sequence & Transitional Object",
        description: "Use a fixed 4-step sequence so the child predicts what comes next. Sequence reduces demand-refusal by providing structure.",
        steps: [
          { text: "Run the BBSB sequence nightly: Bath → Brush → Story → Bed (same order, no skipping).", completed: false },
          { text: "Place the transitional comfort object (plush, blanket) into bed before the child arrives — it 'holds' the space.", completed: false },
          { text: "Read one physical book with the child in bed. Narrate slowly; pace naturally slows breath.", completed: false }
        ]
      },
      {
        name: "Phase 3: Secure Goodbye & Night Protocol",
        description: "Execute a warm, confident, and predictable separation so the child's attachment system registers safety.",
        steps: [
          { text: "Give a 'heartbeat hug' — hold for 20 seconds so child feels the parent's calm heartbeat rate.", completed: false },
          { text: "Use the same goodnight phrase every night: 'I love you. I am close. You are safe. Sleep tight.'", completed: false },
          { text: "Leave the room confidently. If the child calls out once, respond briefly from outside the door without re-entering.", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Child says 'I'm not tired' and gets out of bed repeatedly",
        say: "Your body needs sleep even when your brain wants more fun. You can rest — that's all. Close your eyes and let the rest happen.",
        avoid: "Negotiating extra time or starting new activities, which rewards the avoidance loop."
      },
      {
        scenario: "Child cries and says they are scared of the dark or alone",
        say: "Feeling a little scared at night is normal. I am right here in the house. Your [comfort object] is with you. I will check on you in 5 minutes.",
        avoid: "Staying until fully asleep every night, which prevents the child from developing independent sleep onset skills."
      }
    ],
    successIndicators: [
      "Child is in bed within 10 minutes of starting the BBSB sequence.",
      "Sleep onset occurs within 20 minutes of lights-out without parent present.",
      "Child wakes at night but self-settles without calling out within 5 minutes.",
      "Child reports feeling safe and calm at bedtime when asked."
    ]
  },

  // ── ROUTINE 3: MORNING WAKE-UP & BREAKFAST ──────────────────────────────────
  {
    id: "plan-3",
    title: "Morning Wake-Up & Breakfast Routine",
    scholarBadge: "Montessori · Piaget",
    issue: "Slow, resistant morning starts that create stress and conflict before school, often linked to hunger dysregulation and lack of autonomy in the sequence.",
    phases: [
      {
        name: "Phase 1: Prepared Morning Environment",
        description: "Set up the night before so the morning requires zero adult decisions — the environment does the managing (Montessori prepared environment).",
        steps: [
          { text: "Night-before prep: clothes laid out (child chose two options), bag packed, shoes at the door.", completed: false },
          { text: "Set a consistent wake-up time 30 minutes earlier than needed — no rushing.", completed: false },
          { text: "Post a visual morning chart (icons, not words) at child height on the fridge or door.", completed: false }
        ]
      },
      {
        name: "Phase 2: Autonomy-Led Getting Ready",
        description: "Give the child a sense of agency in the sequence. Piaget's preoperational child responds to concrete choice-making, not abstract instruction.",
        steps: [
          { text: "Child dresses independently — parent is nearby but does not intervene unless asked.", completed: false },
          { text: "Child selects their own breakfast from two prepared options (e.g., 'eggs or oats today?').", completed: false },
          { text: "Child checks the visual chart and marks off each step as done using a magnet or sticker.", completed: false }
        ]
      },
      {
        name: "Phase 3: Breakfast Connection Moment",
        description: "Breakfast is not fuel only — it is the first co-regulation event of the day. A calm table sets the emotional tone.",
        steps: [
          { text: "Sit together at the table for breakfast — no phones, no news, no screens.", completed: false },
          { text: "Use the '1 thing I'm looking forward to today' conversation starter at the table.", completed: false },
          { text: "End with a fixed departure ritual: 'Fist-bump → high five → see you later'.", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Child refuses to get out of bed and says they don't want to go to school",
        say: "I know it feels hard to leave the warm bed. Your body will wake up faster once you move. Which do you want first — clothes or bathroom?",
        avoid: "Carrying the child or completing tasks for them, which removes the proprioceptive wake-up signals and reduces independence."
      },
      {
        scenario: "Child says they are not hungry and refuses breakfast",
        say: "Your body might not feel hungry yet — that's normal when we first wake up. Sit with me for 5 minutes and try two bites.",
        avoid: "Forcing full portions or offering alternative snacks that delay the seated breakfast routine."
      }
    ],
    successIndicators: [
      "Child is dressed and ready without physical adult assistance 4 out of 5 mornings.",
      "Family leaves the house without shouting or physical conflict.",
      "Child eats breakfast before departure on most mornings.",
      "Child can describe the morning routine sequence independently."
    ]
  },

  // ── ROUTINE 4: FAMILY MEALTIME & EATING ─────────────────────────────────────
  {
    id: "plan-4",
    title: "Family Mealtime & Eating Routine",
    scholarBadge: "Bronfenbrenner · Montessori",
    issue: "Selective eating, mealtime refusal, food sensory aversions, and loss of the shared family table as a social-regulation anchor.",
    phases: [
      {
        name: "Phase 1: Table Structure & Sensory Safety",
        description: "Build a consistent, low-stimulation mealtime container. Bronfenbrenner: the microsystem table becomes the child's first social governance experience.",
        steps: [
          { text: "Eat at the same table, at approximately the same time, every day — habit formation is biochemical.", completed: false },
          { text: "Reduce sensory load: no TV, no loud music, familiar plates and utensils the child prefers.", completed: false },
          { text: "Serve small portions — overfull plates trigger aversion in sensory-sensitive children.", completed: false }
        ]
      },
      {
        name: "Phase 2: Participation & Autonomy",
        description: "Involve the child in food preparation. Montessori: a child who helped make the food is significantly more likely to try it.",
        steps: [
          { text: "Assign one simple mealtime job per day: stir, set napkins, pour water, wash vegetables.", completed: false },
          { text: "Apply the Division of Responsibility: parent decides what and when; child decides how much and whether.", completed: false },
          { text: "Always include one food the child reliably eats alongside new exposures — safety food reduces meal anxiety.", completed: false }
        ]
      },
      {
        name: "Phase 3: New Food Exposure & Table Ritual",
        description: "Repeated neutral exposure to new foods without pressure. Research shows 10–15 exposures before acceptance — most parents give up at 3.",
        steps: [
          { text: "Introduce one new food item per week on the plate — no pressure to eat, only to see it.", completed: false },
          { text: "Name the meal together: 'This is Tuesday pasta.' Ritual naming reduces novelty anxiety.", completed: false },
          { text: "End with a short connection question: 'What was the best part of today?'", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Child refuses a food and says 'I hate this, it's disgusting'",
        say: "You don't have to eat it today. It just needs to sit on the plate. Maybe next time your taste buds will be curious.",
        avoid: "Forcing the food, bribing with dessert, or removing it immediately — all three increase food aversion over time."
      },
      {
        scenario: "Child leaves the table after 3 minutes and says they're done",
        say: "The table rule is we stay until everyone is finished. You can sit quietly if you're done eating.",
        avoid: "Allowing early departure consistently, which teaches the child that table time is optional and disrupts family rhythm."
      }
    ],
    successIndicators: [
      "Family eats together at least 5 evenings per week.",
      "Child tries a new food at least once per week without physical distress.",
      "Mealtime tantrums decrease to fewer than 2 per week.",
      "Child completes a mealtime job at least 4 nights per week."
    ]
  },

  // ── ROUTINE 5: EMOTIONAL REGULATION TOOLKIT ─────────────────────────────────
  {
    id: "plan-5",
    title: "Emotional Regulation Toolkit",
    scholarBadge: "Bowlby · Vygotsky",
    issue: "Escalating meltdowns, emotional flooding, and lack of a personal toolkit to self-regulate without full adult co-regulation every time.",
    phases: [
      {
        name: "Phase 1: Build the Calm-Down Corner",
        description: "Create a physical regulation station the child owns and chooses. Vygotsky: the scaffold is a place before it is a skill.",
        steps: [
          { text: "Designate a small, low-stimulus corner of the home as the 'Calm Space' — cozy pillow, fidget tool, one comfort object.", completed: false },
          { text: "Introduce the space during a calm moment — never as punishment.", completed: false },
          { text: "Practice using it together during calm time so the child can access it independently during activation.", completed: false }
        ]
      },
      {
        name: "Phase 2: The Regulation Menu",
        description: "Give the child a personal toolkit of 3–4 regulation strategies they can call by name. Naming = ownership.",
        steps: [
          { text: "Teach 'Balloon Breathing': breathe in slowly for 4, hold 2, blow out for 6 — practice daily.", completed: false },
          { text: "Teach 'Shake It Out': 30-second full-body shake to discharge fight-or-flight cortisol.", completed: false },
          { text: "Build a personal 'Feelings Map' picture — child draws their face when mad, sad, scared, calm.", completed: false }
        ]
      },
      {
        name: "Phase 3: Co-Regulation to Self-Regulation Bridge",
        description: "Bowlby: the parent is the external regulation system. Gradually fade co-regulation over weeks as the child internalizes the skill.",
        steps: [
          { text: "During meltdown: stay close, lower your own voice and body, narrate calmly — 'I see you're really upset. I'm here.'", completed: false },
          { text: "After calm returns (not during): run the 3-question repair — 'What happened? What did your body feel? What could we do next time?'", completed: false },
          { text: "Track each week: count how many times the child used their toolkit independently vs. needed full adult support.", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Child is mid-meltdown, hitting or throwing",
        say: "Your body is really full right now. I am going to stay close. When you are ready, I am here.",
        avoid: "Attempting logical explanation or consequence-giving during activation — the cortex is offline and cannot receive information."
      },
      {
        scenario: "After the meltdown, child is calm and quiet",
        say: "That was a big one. I love you through the hard stuff. Can you tell me what your body felt like when it started?",
        avoid: "Jumping straight to consequences or 'you shouldn't have done that' — repair must precede correction."
      }
    ],
    successIndicators: [
      "Child can name at least 2 feelings in their body without prompting.",
      "Child uses a regulation strategy (breathing, shake, calm space) at least once per week independently.",
      "Meltdown duration decreases by 30% over 6 weeks.",
      "Child initiates repair conversation after incidents at least occasionally."
    ]
  },

  // ── ROUTINE 6: SCREEN TIME & DIGITAL TRANSITIONS ────────────────────────────
  {
    id: "plan-6",
    title: "Screen Time Limits & Digital Transitions",
    scholarBadge: "Piaget · Winnicott",
    issue: "Intense dysregulation when screens are removed, inability to transition back to physical reality, and digital over-reliance replacing boredom tolerance.",
    phases: [
      {
        name: "Phase 1: Predictable Screen Schedule",
        description: "Remove uncertainty from screen access. Piaget: the preoperational child cannot abstract 'later' — concrete time anchors are critical.",
        steps: [
          { text: "Establish fixed screen time slots posted on the visual schedule — 'after school snack' and/or 'after dinner' only.", completed: false },
          { text: "Use a visible physical timer (hourglass or clock) — the child watches time passing, not a parent removing access.", completed: false },
          { text: "Define a maximum daily limit appropriate to age: 1 hour for 3–5 year olds, 1.5 hours for 6–8 year olds.", completed: false }
        ]
      },
      {
        name: "Phase 2: 5-Minute Transition Warning Protocol",
        description: "The transition warning is the most important intervention. Abrupt removal is the single biggest trigger of screen-related dysregulation.",
        steps: [
          { text: "Give a 5-minute verbal + timer warning: 'Five minutes left. Timer is running. When it rings, screen goes off.'", completed: false },
          { text: "At zero: parent turns off screen (not child, initially) — calmly, without negotiation.", completed: false },
          { text: "Immediately offer a transition bridge activity: snack, outdoor play, physical game — fill the gap instantly.", completed: false }
        ]
      },
      {
        name: "Phase 3: Boredom Tolerance & Non-Screen Alternatives",
        description: "Winnicott: a child who can tolerate boredom is developing a rich inner world. Build the muscle.",
        steps: [
          { text: "Designate one 30-minute 'boredom slot' per day — parent does not entertain or suggest; child discovers their own play.", completed: false },
          { text: "Build an accessible 'yes shelf': low-shelf art supplies, building blocks, sensory bins — materials the child can self-initiate.", completed: false },
          { text: "Celebrate self-initiated play: 'I noticed you built that entire train track yourself. That was your idea.'", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Child screams and throws device when screen time ends",
        say: "I hear you — stopping is really hard. The timer said our time is up. The tablet is resting now. Let's have your snack.",
        avoid: "Giving 'just 5 more minutes' as a response to the tantrum — this teaches escalation as an effective strategy."
      },
      {
        scenario: "Child says 'I'm bored' immediately after screens are off",
        say: "Boredom is okay. Your brain is looking for what to do next. What's on the yes shelf that you haven't tried this week?",
        avoid: "Immediately suggesting activities or turning screens back on — sit with the discomfort together briefly first."
      }
    ],
    successIndicators: [
      "Child turns off screen with verbal warning in under 3 minutes without physical conflict.",
      "Child engages in self-initiated non-screen play for 20+ minutes at least 3 times per week.",
      "Screen transitions do not trigger meltdowns more than once per week.",
      "Child can describe when their screen time slots are without asking."
    ]
  },

  // ── ROUTINE 7: DAILY READING & LANGUAGE PRACTICE ────────────────────────────
  {
    id: "plan-7",
    title: "Daily Reading & Language Practice",
    scholarBadge: "Vygotsky · Piaget",
    issue: "Insufficient daily language input, bilingual code-switching hesitation, and inconsistent reading habits that slow vocabulary acquisition and pre-literacy skills.",
    phases: [
      {
        name: "Phase 1: Daily Reading Ritual",
        description: "Vygotsky: shared reading is the highest-quality ZPD language scaffold available. 15 minutes of daily read-aloud is more powerful than any app.",
        steps: [
          { text: "Lock in a daily reading slot — same time, same cozy location (bed, bean bag, reading nook).", completed: false },
          { text: "Read one physical book per session: alternate between the child's choice and the parent's choice.", completed: false },
          { text: "After reading, ask one open question: 'What do you think happened before this story started?'", completed: false }
        ]
      },
      {
        name: "Phase 2: Conversation-Based Vocabulary Building",
        description: "Piaget: language develops through interaction with objects and people — not passive consumption. Build vocabulary through conversation, not flashcards.",
        steps: [
          { text: "Use the 'word of the day' technique: introduce one interesting word at breakfast, use it 3 times during the day naturally.", completed: false },
          { text: "Narrate activities aloud together: 'We're chopping the carrots diagonally — diagonally means at an angle.'", completed: false },
          { text: "During play, extend the child's sentences: child says 'car go fast' → parent says 'yes, the red car is racing really fast down the ramp'.", completed: false }
        ]
      },
      {
        name: "Phase 3: Bilingual Support Practice",
        description: "For bilingual children: each language needs daily activation. Passive exposure is not enough — production practice is critical.",
        steps: [
          { text: "Designate a language-of-the-moment: dinner in Language A, bath in Language B — consistency anchors the switch.", completed: false },
          { text: "Play the 'translator game': child translates a sentence from Language A to B — celebrate attempts not perfection.", completed: false },
          { text: "Read one book per week in the minority language — make it a special ritual, not a chore.", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Child refuses to sit for a book and runs away",
        say: "Okay, I'm going to read to myself over here. You don't have to sit — but I bet you'll want to hear what happens.",
        avoid: "Forcing seated attention or skipping reading entirely — proximity listening is still beneficial."
      },
      {
        scenario: "Child switches to dominant language and refuses to speak in minority language",
        say: "I know it's easier in [language A]. Can you try to say just that one word in [language B]? Even one word counts.",
        avoid: "Refusing to respond unless the child speaks in the minority language — this creates shame and aversion to the language."
      }
    ],
    successIndicators: [
      "Parent reads aloud with child at least 5 evenings per week.",
      "Child requests books independently or asks to continue a story.",
      "Child uses at least one new vocabulary word per week in conversation.",
      "Bilingual child attempts responses in minority language without shutting down."
    ]
  },

  // ── ROUTINE 8: PHYSICAL PLAY & MOVEMENT ─────────────────────────────────────
  {
    id: "plan-8",
    title: "Physical Play & Daily Movement",
    scholarBadge: "Piaget · Bronfenbrenner",
    issue: "Sedentary default, sensory under-stimulation leading to dysregulation indoors, and insufficient proprioceptive input for gross motor development.",
    phases: [
      {
        name: "Phase 1: Daily Movement Minimum",
        description: "Piaget: sensorimotor-to-concrete operational children learn through the body first. Movement is not a break from learning — it is learning.",
        steps: [
          { text: "Guarantee 60 minutes of active outdoor play per day (WHO guidelines for under-5s).", completed: false },
          { text: "Schedule movement BEFORE sedentary tasks like homework or quiet activities — not as a reward after.", completed: false },
          { text: "Include one full-body proprioceptive activity daily: jumping, climbing, carrying, rolling, wrestling.", completed: false }
        ]
      },
      {
        name: "Phase 2: Sensory Regulation Through Movement",
        description: "Children with sensory sensitivities need heavy-work proprioceptive input to regulate their arousal baseline throughout the day.",
        steps: [
          { text: "Morning heavy-work routine: 5 minutes of jumping, pushing against a wall, or carrying a 'helper bag' with books.", completed: false },
          { text: "Post-school decompression: unstructured outdoor run or playground before entering the home or starting homework.", completed: false },
          { text: "Before high-demand transitions (dinner, bath, bed): a 3-minute gross motor discharge (dance, jump, spin).", completed: false }
        ]
      },
      {
        name: "Phase 3: Social Play & Community Ecosystem",
        description: "Bronfenbrenner: peer play in neighborhood ecosystems is a developmental right, not a luxury. Facilitate access to other children.",
        steps: [
          { text: "Arrange at least one unstructured peer play session per week — not structured classes, free play.", completed: false },
          { text: "Reduce structured activity overload: children need unscheduled outdoor time, not more clubs.", completed: false },
          { text: "Make park/playground visits a weekly ritual — same park, familiar environment, lower adaptation demand.", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Child says 'I don't want to go outside' and prefers screens or couch",
        say: "Your body needs to move — even when your brain doesn't feel like it yet. We're going for 15 minutes. You can choose: bike, ball, or run?",
        avoid: "Offering screens as an alternative to outdoor time or skipping outdoor play due to minor weather discomfort."
      },
      {
        scenario: "Child has a sensory meltdown from an over-stimulating environment (loud park, crowded birthday party)",
        say: "This place has a lot of noise. Let's move to the edge where it's quieter. You don't have to stay in the middle.",
        avoid: "Forcing the child to remain in the overwhelm zone or leaving immediately every time — graduated exposure builds tolerance over time."
      }
    ],
    successIndicators: [
      "Child gets 60 minutes of active outdoor play at least 5 days per week.",
      "Afternoon sensory dysregulation episodes decrease after post-school movement routine is established.",
      "Child initiates outdoor or physical play independently at least 3 times per week.",
      "Child plays with at least one peer in unstructured play weekly."
    ]
  },

  // ── ROUTINE 9: RESPONSIBILITY & CHORES ──────────────────────────────────────
  {
    id: "plan-9",
    title: "Responsibility & Age-Appropriate Chores",
    scholarBadge: "Montessori · Bronfenbrenner",
    issue: "Child has no consistent household responsibilities, leading to a low sense of contribution, learned helplessness, and missed opportunities for practical competence-building.",
    phases: [
      {
        name: "Phase 1: Identify & Assign Contribution Tasks",
        description: "Montessori: children are neurobiologically driven to contribute. Blocking this drive by doing everything for them increases dependence, not security.",
        steps: [
          { text: "Select 2–3 age-appropriate daily tasks: clearing plate, making bed, wiping spills, feeding a pet, sorting laundry.", completed: false },
          { text: "Create a visual chore chart at child height with icons — child marks tasks done with a magnet or sticker.", completed: false },
          { text: "Introduce tasks during a calm, joint practice session — do it together first, then fade support over 2 weeks.", completed: false }
        ]
      },
      {
        name: "Phase 2: Execution with Autonomy",
        description: "Resist the urge to redo or correct the task. A poorly made bed made by the child is more developmentally valuable than a perfect bed made by the parent.",
        steps: [
          { text: "Allow the child to complete the task without intervention unless there is a safety issue.", completed: false },
          { text: "If the task is done imperfectly, acknowledge the effort specifically: 'You folded that towel all by yourself — I noticed.'", completed: false },
          { text: "Link the task to family contribution: 'When you clear your plate, it helps our whole family keep the kitchen clean.'", completed: false }
        ]
      },
      {
        name: "Phase 3: Mastery Expansion & Natural Consequences",
        description: "Bronfenbrenner: family role and responsibility are the child's first microsystem governance training.",
        steps: [
          { text: "After 4 weeks of consistency on current tasks, add one new responsibility.", completed: false },
          { text: "Use natural consequences (not punishment) when tasks are skipped — 'Since the toys weren't tidied, we don't have floor space to play the game tonight.'", completed: false },
          { text: "Hold a short weekly family check-in: 'What did everyone contribute this week?'", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Child refuses to do their chore and says 'it's too hard' or 'I don't want to'",
        say: "This is your job in our family. I know it feels like a lot — let's start with just the first step together.",
        avoid: "Doing the task for the child to avoid conflict — this teaches that persistence is never required."
      },
      {
        scenario: "Child does the task poorly (e.g., half-made bed, plate still has food) and looks for approval",
        say: "You did it! I see you worked hard on that. The bed is made — it's your bed, and you made it.",
        avoid: "Re-making the bed or pointing out what was missed — this communicates that their effort is insufficient."
      }
    ],
    successIndicators: [
      "Child completes assigned daily chore without reminder at least 4 days per week.",
      "Child can describe their household role when asked: 'My job in this family is...'",
      "Child demonstrates task pride and identifies as a contributing family member.",
      "Parent refrains from redoing the child's completed tasks."
    ]
  },

  // ── ROUTINE 10: EVENING WIND-DOWN & FAMILY CONNECTION ───────────────────────
  {
    id: "plan-10",
    title: "Evening Wind-Down & Family Connection",
    scholarBadge: "Bowlby · Winnicott",
    issue: "Fragmented evenings with parallel screen use, missed co-regulation and debrief windows, and poor arousal-to-sleep transition leading to later sleep onset.",
    phases: [
      {
        name: "Phase 1: Unplug & Reconnect Window",
        description: "The one hour after the family reunites in the evening is the highest-value attachment co-regulation window of the day. Protect it.",
        steps: [
          { text: "Declare a 'phones-away' zone from dinner through bedtime — both parents included.", completed: false },
          { text: "Start the evening with 10 minutes of physical connection: tickle, pillow fight, cuddle, or dance — let the child lead.", completed: false },
          { text: "Ask the 'rose & thorn' question at dinner: one thing that felt good today, one thing that felt hard.", completed: false }
        ]
      },
      {
        name: "Phase 2: Debrief & Emotional Processing",
        description: "Bowlby: the child uses the parent as a 'safe haven' to process the day's stress. A brief debrief before sleep prevents nighttime rumination.",
        steps: [
          { text: "After bath, sit together for 5 minutes with no agenda — follow the child's narrative if they choose to share.", completed: false },
          { text: "If the child had a hard day, name it: 'It sounded like the playground was hard today. That makes sense that you feel grumpy.'", completed: false },
          { text: "End the debrief with a forward bridge: 'Tomorrow is a fresh start. What are you looking forward to?'", completed: false }
        ]
      },
      {
        name: "Phase 3: Arousal Ramp-Down & Sleep Handoff",
        description: "Winnicott: the 'holding environment' at sleep is the transition from external regulation to internal. The parent's calm presence is the scaffold the child internalizes.",
        steps: [
          { text: "Enforce a consistent lights-off time 7 days per week — including weekends (within 30 minutes).", completed: false },
          { text: "Complete the BBSB sequence (Bath, Brush, Story, Bed — see Sleep Routine plan).", completed: false },
          { text: "Final connection point: gratitude ritual — each person names one thing they are grateful for from today.", completed: false }
        ]
      }
    ],
    scripts: [
      {
        scenario: "Child says they don't want to talk about their day and shuts down",
        say: "That's okay. You don't have to talk. I'm just going to sit here with you for a bit.",
        avoid: "Pressing with questions or filling the silence immediately — presence without pressure is the most effective invitation to open up."
      },
      {
        scenario: "Parents are tired and want to skip the connection window and go straight to screens",
        say: "(to yourself and co-parent) 10 minutes of real connection now prevents 45 minutes of bedtime resistance later. The investment pays off tonight.",
        avoid: "Parallel screen evenings 5+ nights per week — this is the most common cause of child's nighttime anxiety and sleep-onset difficulty."
      }
    ],
    successIndicators: [
      "Family has at least 20 minutes of device-free shared time at least 5 evenings per week.",
      "Child shares at least one event from their day unprompted at least 3 times per week.",
      "Child transitions to the bedtime sequence within 5 minutes of the wind-down cue.",
      "Both parents report feeling genuinely reconnected with the child by the end of most evenings."
    ]
  }
];

export const sampleBedtimeStory: BedtimeStory = {
  title: "Alek the Bunny's Brave New Burrow",
  pages: [
    "Deep in the whispering forest of Glandor, Alek the Bunny lived in a cozy moss-covered burrow. Alek loved his home. It had the softest clover blankets, and his mother cooked the warmest pinecone tea. But soon, Alek would have to leave his burrow. He was starting at the Meadow Assembly School on the other side of the stream.",
    "Alek's ears felt floppy and heavy. He sat under a large oak leaf, feeling very small. 'What if they speak in the Squirrel language? What if I forget where to put my carrot bag?' he whispered. His mother hopped beside him. She gave Alek a small, smooth blue river pebble. 'This is the Courage Stone,' she whispered. 'Whenever you touch it, remember: bunnies can do hard things.'",
    "The next day, Alek arrived at the Meadow Assembly. The meadow was packed with hyperactive squirrels jumping and singing in different songs. He squeezed the pebble tight. A friendly badger teacher stepped forward. Alek cleared his throat, using his practiced words: 'My name is Alek. Can I show you my pebble?' The teacher smiled. 'Bunny ears are excellent listeners,' she said.",
    "By the solar sunset, Alek hopped back over the stream. His ears held high. He told his mother: Meadow school was busy, and he had used some new words. Mother laughed over the pinecone tea. Alek realized that leaving the burrow was scary, but burrows are always waiting for us to return. And Alek's courage stone remained sat on his bedtime shelf, shining under the moonlight."
  ],
  illustrationPrompt: "A beautiful, premium, minimalist children's book cover in warm watercolors, depicting a small bunny with floppy ears holding a smooth blue shining pebble in a golden glowing woods.",
  discussionQuestions: [
    "How did Alek's ears feel when he was worried? Where do you feel worries in your body?",
    "What was Alek's 'courage stone'? What tiny item makes you feel strong and safe?",
    "Why was Alek's burrow waiting for him? What is your favorite thing to do when we reconnect?"
  ],
  summary: "A supportive transition story designed to soothe kindergarten-starting worries using attachment reassurance."
};

export const scholarsInfo = [
  {
    name: "Lev Vygotsky",
    initial: "V",
    concept: "Next Best Challenge Engine",
    color: "from-amber-500/10 to-transparent",
    theory: "Zone of Proximal Development (ZPD) & Scaffolding",
    value: "Finds the edge of where the child can perform with parent modeling, then gradually fades support as mastery builds. Prevents both boredom and overwhelming anxiety.",
    examplePrompt: "Dylan wants to practice English school questions. Suggest a step-by-step scaffolding plan to practice introducing himself over 3 days.",
    slug: "vygotsky"
  },
  {
    name: "John Bowlby",
    initial: "B",
    concept: "Attachment & Repair Coach",
    color: "from-blue-500/10 to-transparent",
    theory: "Secure Base & Adaptive Attachment Behaviours",
    value: "Designs emotional interaction guidelines and rupture-repair scripts. Strengthens the child's relational security, viewing tantrums as dysregulated communication rather than misbehavior.",
    examplePrompt: "Give me a conflict-repair script for after Dylan screamed and threw toys, and we both got dysregulated.",
    slug: "bowlby"
  },
  {
    name: "Donald Winnicott",
    initial: "W",
    concept: "Good Enough Parent Guide",
    color: "from-purple-500/10 to-transparent",
    theory: "Good-Enough Mothering & Transitional Objects",
    value: "Reduces parent pathologizing and guilt. Explains the critical developmental role of transitional comfort objects (like pebbles or plushies) and safe boundaries.",
    examplePrompt: "Dylan is heavily attached to a pocket plush when leaving home. How can we respect this Winnicott style transitional object during school dropoffs?",
    slug: "winnicott"
  },
  {
    name: "Maria Montessori",
    initial: "M",
    concept: "Independence Planner",
    color: "from-green-500/10 to-transparent",
    theory: "Prepared Environments & Practical Autonomy",
    value: "Coaches parents on preparing home tasks and routines so the child can exercise self-governance. Swaps child-restraint with structured freedoms.",
    examplePrompt: "Create a prepared bedroom environment routine to help a 5-year-old learn to dress and select clothes independently in the morning.",
    slug: "montessori"
  },
  {
    name: "Urie Bronfenbrenner",
    initial: "Br",
    concept: "Child Ecosystem Builder",
    color: "from-red-500/10 to-transparent",
    theory: "Ecological Systems Framework",
    value: "Analyzes family-school-neighborhood stressors. Evaluates micro, meso, and macrosystems to pinpoint why a child acts up during times of high family stress or bilingual migration.",
    examplePrompt: "Analyze our bilingual school relocation transition journey. What Bronfenbrenner stressors should we modify to help Dylan calm down?",
    slug: "bronfenbrenner"
  },
  {
    name: "Jean Piaget",
    initial: "P",
    concept: "Stage-Aware Expectations",
    color: "from-teal-500/10 to-transparent",
    theory: "Cognitive Development Stages",
    value: "Keeps expectations grounded in biological reality. Reminds parents that a 5-year-old operates in the intuitive Preoperational stage (egocentric, magical thinking, struggles with abstract rules).",
    examplePrompt: "Explain Dylan's transition refusal through Piaget's Preoperational cognitive framework. What can we realistically expect?",
    slug: "piaget"
  },
  {
    name: "Erik Erikson",
    initial: "E",
    concept: "Psychosocial Stage Coach",
    color: "from-indigo-500/10 to-transparent",
    theory: "Eight Stages of Psychosocial Development",
    value: "Maps the child's core psychosocial task at each age — trust vs mistrust (0-1), autonomy vs shame (1-3), initiative vs guilt (3-6), industry vs inferiority (6-12). Aligns parent responses with the developmental task rather than just the symptom.",
    examplePrompt: "Dylan is 5 and in the Initiative vs Guilt stage. He feels ashamed when he makes a mistake at school. Give me 5 ways to support healthy initiative-taking without removing consequences.",
    slug: "erikson"
  },
  {
    name: "Diana Baumrind",
    initial: "Bm",
    concept: "Parenting Style Analyzer",
    color: "from-rose-500/10 to-transparent",
    theory: "Authoritative vs Permissive vs Authoritarian Parenting",
    value: "Diagnoses where the parent's style sits on the warmth/structure matrix and recommends calibrations. Authoritative (high warmth + high structure) is the research-validated gold standard. Detects drift toward permissive or authoritarian in high-stress moments.",
    examplePrompt: "I notice I swing between very lenient (no consequences) and very harsh (shouting) depending on my stress level. Help me build a more consistent authoritative response to Dylan's screen-time refusals.",
    slug: "baumrind"
  },
  {
    name: "Albert Bandura",
    initial: "Ba",
    concept: "Modeling Coach",
    color: "from-orange-500/10 to-transparent",
    theory: "Social Learning Theory & Self-Efficacy",
    value: "Helps parents recognize that children learn primarily through observation, not instruction. Designs explicit modeling sequences where the parent demonstrates the target behavior before expecting the child to do it. Builds child self-efficacy through mastery experiences.",
    examplePrompt: "Dylan avoids trying new things because he's afraid of failing. Using Bandura's self-efficacy model, give me a week-long plan of small mastery experiences to rebuild his confidence.",
    slug: "bandura"
  },
  {
    name: "B.F. Skinner",
    initial: "Sk",
    concept: "Behavior Design Studio",
    color: "from-cyan-500/10 to-transparent",
    theory: "Operant Conditioning & Habit Loops",
    value: "Designs reward schedules, token economies, habit stacks, and natural consequence plans. Identifies which behaviors are being inadvertently reinforced. Particularly effective for toilet training, chore compliance, and reducing attention-seeking behavior.",
    examplePrompt: "Dylan gets more attention after meltdowns than during calm behavior. Design a simple Skinner-style reinforcement plan that shifts our attention economy to reward regulation, not dysregulation.",
    slug: "skinner"
  },
  {
    name: "Howard Gardner",
    initial: "G",
    concept: "Strengths Discovery Dashboard",
    color: "from-lime-500/10 to-transparent",
    theory: "Multiple Intelligences (9 types)",
    value: "Identifies the child's dominant intelligence profile — linguistic, logical-mathematical, spatial, musical, bodily-kinesthetic, interpersonal, intrapersonal, naturalist, or existential. Adapts learning activities, stories, and routines to the child's natural entry points.",
    examplePrompt: "Dylan builds incredibly detailed imaginary worlds and asks deep physics questions. Which of Gardner's multiple intelligences are strongest and how should we structure his learning environment to match?",
    slug: "gardner"
  },
  {
    name: "Reggio Emilia",
    initial: "Re",
    concept: "Curiosity Project Generator",
    color: "from-yellow-500/10 to-transparent",
    theory: "Child as Protagonist & Hundred Languages",
    value: "Turns the child's current obsessions into structured inquiry projects. Reggio treats play as research and the child as an active knowledge-builder. Generates project-based learning sequences from real child interests (bugs, dinosaurs, water, space, vehicles).",
    examplePrompt: "Dylan is obsessed with how gravity works and keeps asking why things fall. Design a 2-week Reggio-style inquiry project around his gravity fascination using household materials.",
    slug: "reggio"
  },
  {
    name: "Harvard Serve & Return",
    initial: "SR",
    concept: "Interaction Trainer",
    color: "from-sky-500/10 to-transparent",
    theory: "Serve & Return Neural Architecture (Center on the Developing Child)",
    value: "Coaches the quality and frequency of back-and-forth caregiver-child interaction — the primary driver of early brain architecture. Each serve (child's bid for attention) and return (caregiver's response) builds neural connections faster than any app or curriculum.",
    examplePrompt: "I often miss Dylan's conversational bids because I'm distracted. Give me a daily serve-and-return practice routine to do during meals, bath, and bedtime over the next week.",
    slug: "serve-return"
  },
  {
    name: "Executive Function Science",
    initial: "EF",
    concept: "Self-Regulation Builder",
    color: "from-violet-500/10 to-transparent",
    theory: "Working Memory, Inhibitory Control & Cognitive Flexibility",
    value: "Targets the three core executive function pillars: working memory (hold rules in mind), inhibitory control (resist impulses), and cognitive flexibility (switch tasks). Designs games and routines that build each pillar in age-appropriate increments.",
    examplePrompt: "Dylan struggles to switch tasks and remember multi-step instructions. Design a 10-minute daily executive function workout using games for a 5-year-old that targets working memory and cognitive flexibility.",
    slug: "exec-function"
  },
  {
    name: "Trauma-Informed Development",
    initial: "Ti",
    concept: "Family Stress & Resilience Monitor",
    color: "from-stone-500/10 to-transparent",
    theory: "ACEs, Window of Tolerance & Polyvagal Theory",
    value: "Tracks cumulative family stressors (ACEs), identifies when the child's window of tolerance is exceeded, and designs stabilizing routines and co-regulation sequences. Distinguishes trauma responses from behavioral choice. Guides sensory-informed, predictability-based recovery plans.",
    examplePrompt: "Our family went through a major relocation and language change this year. Dylan is showing signs of chronic stress — sleep disruption, clinginess, regression. Using a trauma-informed framework, what stabilizing routines should we prioritize?",
    slug: "trauma-informed"
  }
];
