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
  // ── CDC/AAP-2022 75th-percentile checklists (birth–3y) + ASHA-2023 communication.
  //    Non-diagnostic surveillance milestones; checked defaults reflect a typically
  //    developing child and are edited per child. CDC domains map onto Arbor's six.
  // 2 months
  { id: "cdc-2m-1", domain: "social_development", ageGroup: "2 months", title: "Smiles at people", description: "Smiles on their own to get your attention; calms when spoken to or picked up.", checked: true },
  { id: "cdc-2m-2", domain: "language_communication", ageGroup: "2 months", title: "Coos and makes sounds", description: "Makes sounds other than crying; reacts to loud sounds.", checked: true },
  { id: "cdc-2m-3", domain: "cognition_executive_function", ageGroup: "2 months", title: "Watches and follows", description: "Watches you as you move; looks at a toy for several seconds.", checked: true },
  { id: "cdc-2m-4", domain: "sensory_motor_patterns", ageGroup: "2 months", title: "Lifts head in tummy time", description: "Holds head up during tummy time; moves both arms and both legs.", checked: true },
  // 6 months
  { id: "cdc-6m-1", domain: "social_development", ageGroup: "6 months", title: "Knows familiar people", description: "Recognises familiar faces; likes to look at themselves in a mirror.", checked: true },
  { id: "cdc-6m-2", domain: "language_communication", ageGroup: "6 months", title: "Takes turns with sounds", description: "Takes turns making sounds with you; blows raspberries.", checked: true },
  { id: "cdc-6m-3", domain: "cognition_executive_function", ageGroup: "6 months", title: "Explores by reaching and mouthing", description: "Reaches to grab a toy; puts things in their mouth to explore them.", checked: true },
  { id: "cdc-6m-4", domain: "sensory_motor_patterns", ageGroup: "6 months", title: "Rolls over", description: "Rolls from tummy to back; pushes up on straight arms; leans on hands when sitting.", checked: true },
  // 9 months
  { id: "cdc-9m-1", domain: "attachment_regulation", ageGroup: "9 months", title: "Shows stranger awareness", description: "Is shy, clingy or fearful around strangers; shows several facial expressions.", checked: true },
  { id: "cdc-9m-2", domain: "language_communication", ageGroup: "9 months", title: "Babbles long strings", description: "Makes many different sounds like 'mamama' and 'babababa'; lifts arms to be picked up.", checked: true },
  { id: "cdc-9m-3", domain: "cognition_executive_function", ageGroup: "9 months", title: "Looks for dropped things", description: "Looks for objects when dropped out of sight; bangs two things together.", checked: true },
  { id: "cdc-9m-4", domain: "sensory_motor_patterns", ageGroup: "9 months", title: "Sits without support", description: "Sits without support; moves things from one hand to the other.", checked: true },
  // 12 months
  { id: "cdc-12m-1", domain: "social_development", ageGroup: "12 months", title: "Plays games with you", description: "Plays back-and-forth games like pat-a-cake.", checked: true },
  { id: "cdc-12m-2", domain: "language_communication", ageGroup: "12 months", title: "Waves and says mama/dada", description: "Waves bye-bye; calls a parent 'mama' or 'dada'; understands 'no'.", checked: true },
  { id: "cdc-12m-3", domain: "cognition_executive_function", ageGroup: "12 months", title: "Finds hidden things", description: "Puts something in a container; looks for things they see you hide.", checked: true },
  { id: "cdc-12m-4", domain: "sensory_motor_patterns", ageGroup: "12 months", title: "Pulls to stand", description: "Pulls up to stand; walks holding on to furniture (cruising).", checked: true },
  // 15 months (CDC-2022 added checkpoint)
  { id: "cdc-15m-1", domain: "social_development", ageGroup: "15 months", title: "Copies other children", description: "Copies other children while playing; claps when excited.", checked: true },
  { id: "cdc-15m-2", domain: "language_communication", ageGroup: "15 months", title: "Says a few words", description: "Tries to say one or two words besides mama/dada; looks at a familiar object when named.", checked: true },
  { id: "cdc-15m-3", domain: "cognition_executive_function", ageGroup: "15 months", title: "Uses objects the right way", description: "Tries to use things the right way (a phone, cup or book); stacks at least two small objects.", checked: true },
  { id: "cdc-15m-4", domain: "sensory_motor_patterns", ageGroup: "15 months", title: "Takes first steps", description: "Takes a few steps on their own; uses fingers to feed themselves.", checked: true },
  // 18 months
  { id: "cdc-18m-1", domain: "social_development", ageGroup: "18 months", title: "Points to show you things", description: "Points to show you something interesting; moves away but checks you are close.", checked: true },
  { id: "cdc-18m-2", domain: "language_communication", ageGroup: "18 months", title: "Says three or more words", description: "Tries to say three or more words besides mama/dada; follows one-step directions.", checked: true },
  { id: "cdc-18m-3", domain: "independence_adaptive_skills", ageGroup: "18 months", title: "Tries a spoon and cup", description: "Drinks from an open cup; tries to use a spoon; helps with getting dressed.", checked: true },
  { id: "cdc-18m-4", domain: "sensory_motor_patterns", ageGroup: "18 months", title: "Walks independently", description: "Walks without holding on; climbs on and off a low couch or chair.", checked: true },
  // 2 years
  { id: "cdc-2y-1", domain: "social_development", ageGroup: "2 years", title: "Notices others' feelings", description: "Notices when others are hurt or upset; looks at your face to see how to react.", checked: true },
  { id: "cdc-2y-2", domain: "language_communication", ageGroup: "2 years", title: "Two-word phrases", description: "Says at least two words together ('more milk'); points to things in a book.", checked: true },
  { id: "cdc-2y-3", domain: "cognition_executive_function", ageGroup: "2 years", title: "Uses both hands together", description: "Holds something in one hand while using the other; tries switches, knobs and buttons.", checked: true },
  { id: "cdc-2y-4", domain: "sensory_motor_patterns", ageGroup: "2 years", title: "Kicks and runs", description: "Kicks a ball; runs; walks up a few stairs with or without help.", checked: true },
  // 30 months (CDC-2022 added checkpoint)
  { id: "cdc-30m-1", domain: "social_development", ageGroup: "30 months", title: "Plays alongside others", description: "Plays next to, and sometimes with, other children; follows simple routines.", checked: true },
  { id: "cdc-30m-2", domain: "language_communication", ageGroup: "30 months", title: "Says about 50 words", description: "Says around 50 words; uses two-or-more-word phrases with an action word ('doggie run').", checked: true },
  { id: "cdc-30m-3", domain: "cognition_executive_function", ageGroup: "30 months", title: "Pretend play", description: "Uses things to pretend, like feeding a doll; shows simple problem-solving.", checked: true },
  { id: "cdc-30m-4", domain: "sensory_motor_patterns", ageGroup: "30 months", title: "Jumps with both feet", description: "Jumps off the ground with both feet; twists things like doorknobs and lids.", checked: true },
  // 3 years
  { id: "cdc-3y-1", domain: "attachment_regulation", ageGroup: "3 years", title: "Calms after goodbyes", description: "Calms within about 10 minutes after you leave, e.g. at a daycare drop-off.", checked: true },
  { id: "cdc-3y-2", domain: "language_communication", ageGroup: "3 years", title: "Understandable speech", description: "Talks well enough for others to understand most of the time; asks 'who/what/where/why'.", checked: true },
  { id: "cdc-3y-3", domain: "cognition_executive_function", ageGroup: "3 years", title: "Draws a circle", description: "Draws a circle when shown how; avoids touching hot things when warned.", checked: true },
  { id: "cdc-3y-4", domain: "independence_adaptive_skills", ageGroup: "3 years", title: "Dresses and feeds with a fork", description: "Puts on some clothes by themselves; eats with a fork; strings large beads.", checked: true },

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
    useWhen: "Use this lens when your child is learning a new skill — speech, school routines, self-care — and you're unsure how much to help versus step back.",
    examplePrompt: "My child wants to practice introducing themselves at school. Suggest a step-by-step scaffolding plan to practice over 3 days.",
    slug: "vygotsky"
  },
  {
    name: "John Bowlby",
    initial: "B",
    concept: "Attachment & Repair Coach",
    color: "from-blue-500/10 to-transparent",
    theory: "Secure Base & Adaptive Attachment Behaviours",
    value: "Designs emotional interaction guidelines and rupture-repair scripts. Strengthens the child's relational security, viewing tantrums as dysregulated communication rather than misbehavior.",
    useWhen: "Use this lens after meltdowns, clinginess, separation struggles, or any moment where the relationship itself feels strained and needs repair.",
    examplePrompt: "Give me a conflict-repair script for after my child screamed and threw toys, and we both got dysregulated.",
    slug: "bowlby"
  },
  {
    name: "Donald Winnicott",
    initial: "W",
    concept: "Good Enough Parent Guide",
    color: "from-purple-500/10 to-transparent",
    theory: "Good-Enough Mothering & Transitional Objects",
    value: "Reduces parent pathologizing and guilt. Explains the critical developmental role of transitional comfort objects (like pebbles or plushies) and safe boundaries.",
    useWhen: "Use this lens when you're feeling guilt or self-doubt as a parent, or when comfort objects and security rituals are in play (drop-offs, bedtime).",
    examplePrompt: "My child is heavily attached to a pocket plush when leaving home. How can we respect this transitional object during school dropoffs?",
    slug: "winnicott"
  },
  {
    name: "Maria Montessori",
    initial: "M",
    concept: "Independence Planner",
    color: "from-green-500/10 to-transparent",
    theory: "Prepared Environments & Practical Autonomy",
    value: "Coaches parents on preparing home tasks and routines so the child can exercise self-governance. Swaps child-restraint with structured freedoms.",
    useWhen: "Use this lens when daily routines (dressing, eating, tidying) turn into battles — the fix is usually the environment, not the child.",
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
    useWhen: "Use this lens during big life changes — a move, new school, new sibling, family stress — when behavior shifts and the cause sits around the child, not in them.",
    examplePrompt: "Analyze our bilingual school relocation transition. What environmental stressors should we modify to help my child settle?",
    slug: "bronfenbrenner"
  },
  {
    name: "Jean Piaget",
    initial: "P",
    concept: "Stage-Aware Expectations",
    color: "from-teal-500/10 to-transparent",
    theory: "Cognitive Development Stages",
    value: "Keeps expectations grounded in biological reality. Reminds parents that a 5-year-old operates in the intuitive Preoperational stage (egocentric, magical thinking, struggles with abstract rules).",
    useWhen: "Use this lens when you wonder whether an expectation is fair for the age — lying, sharing, abstract rules, 'why won't they just understand?'.",
    examplePrompt: "Explain my child's transition refusal through Piaget's Preoperational cognitive framework. What can we realistically expect?",
    slug: "piaget"
  },
  {
    name: "Erik Erikson",
    initial: "E",
    concept: "Developmental Arc",
    color: "from-rose-500/10 to-transparent",
    theory: "Psychosocial Stages (Autonomy, Initiative)",
    value: "Frames the moment within the child's current psychosocial task — autonomy vs. shame in toddlers, initiative vs. guilt in preschoolers — and supports its healthy resolution with encouragement and age-appropriate independence.",
    useWhen: "Use this lens when your child pushes for independence ('I do it myself!') or seems ashamed after failing — the stage explains the stakes.",
    examplePrompt: "Frame my child's bids for independence through Erikson's Initiative vs. Guilt stage and how to support it.",
    slug: "erikson"
  }
];
