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
  { id: "m-1", domain: "attachment_regulation", ageGroup: "Age 4-5", title: "Regulates with Prompting", description: "Can calm down within 15 minutes with warm adult co-regulation.", checked: true },
  { id: "m-2", domain: "language_communication", ageGroup: "Age 4-5", title: "Uses Full Sentences", description: "Speaks in sentences of 5-6 words, sharing clear thoughts on what they did during the day.", checked: true },
  { id: "m-3", domain: "social_development", ageGroup: "Age 4-5", title: "Imaginative Cooperative Play", description: "Plays 'makeup' games with other children, successfully negotiating simple rules.", checked: true },
  { id: "m-4", domain: "independence_adaptive_skills", ageGroup: "Age 4-5", title: "Dresses Independently", description: "Can button shirts, pull up pants, and arrange shoes with minimal direction.", checked: true },
  { id: "m-5", domain: "sensory_motor_patterns", ageGroup: "Age 4-5", title: "Hops on One Foot", description: "Balances and hops comfortably on one foot for 3-4 consecutive bounds.", checked: true },
  
  // Age 5-6 Milestones
  { id: "m-6", domain: "attachment_regulation", ageGroup: "Age 5-6", title: "Articulates Specific Feelings", description: "Can verbally name complex feelings: e.g., 'I am lonely,' 'I feel disappointed.'", checked: false },
  { id: "m-7", domain: "language_communication", ageGroup: "Age 5-6", title: "Handles Code-Switching", description: "Can comfortably shift phrases between Hebrew and English depending on the listener.", checked: false },
  { id: "m-8", domain: "social_development", ageGroup: "Age 5-6", title: "Conflict Resolution Process", description: "Suggests simple compromises when a toy dispute arises ('You play 5 mins, then me').", checked: false },
  { id: "m-9", domain: "cognition_executive_function", ageGroup: "Age 5-6", title: "Time Sequencing", description: "Correctly sequences days, understand 'tomorrow vs yesterday', and basic morning schedule.", checked: true },
  { id: "m-10", domain: "sensory_motor_patterns", ageGroup: "Age 5-6", title: "Manages Senses Pre-emptively", description: "Can say 'It is too loud here' and requests headphones or leaving space.", checked: false }
];

export const defaultActionPlans: ActionPlan[] = [
  {
    id: "plan-1",
    title: "Preschool Transition & Morning Arrival Plan",
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
    examplePrompt: "Give me an conflict-repair script for after Dylan screamed and threw toys, and we both got dysregulated.",
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
    concept: "Developmental Arc",
    color: "from-rose-500/10 to-transparent",
    theory: "Psychosocial Stages (Autonomy, Initiative)",
    value: "Frames the moment within the child's current psychosocial task — autonomy vs. shame in toddlers, initiative vs. guilt in preschoolers — and supports its healthy resolution with encouragement and age-appropriate independence.",
    examplePrompt: "Frame Dylan's bids for independence through Erikson's Initiative vs. Guilt stage and how to support it.",
    slug: "erikson"
  }
];
