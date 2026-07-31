/**
 * The Ripple Effect — client-side consequence engine.
 *
 * Pure functions, zero backend. A layered regex dataset + fuzzy key-phrase
 * dictionary turns a short human action into a chain of 6–7 consequences.
 */

export type Horizon = "Now" | "Days" | "Weeks" | "Months" | "Years" | "Decades" | "Generations";

export interface RippleNode {
  id: string;
  horizon: Horizon;
  title: string;
  detail: string;
  magnitude: number; // 0..1, drives ripple radius
}

export interface RippleResult {
  ok: true;
  action: string;
  domain: string;
  domainLabel: string;
  confidence: number;
  nodes: RippleNode[];
}

export interface RippleRejection {
  ok: false;
  reason: string;
  suggestion: string;
  matched: string;
}

export type RippleOutcome = RippleResult | RippleRejection;

const HORIZONS: Horizon[] = ["Now", "Days", "Weeks", "Months", "Years", "Decades", "Generations"];

/* ------------------------------------------------------------------ */
/* 1. Harm filter — irresponsible / harmful / unpleasant actions        */
/* ------------------------------------------------------------------ */

interface HarmRule {
  id: string;
  pattern: RegExp;
  reason: string;
  suggestion: string;
}

export const HARM_RULES: HarmRule[] = [
  {
    id: "violence",
    pattern:
      /\b(kill|murder|stab|shoot|assault|attack|punch|beat\s+up|strangle|maim|torture|behead|bomb|explode|massacre)\w*\b/i,
    reason: "That action hurts a living being.",
    suggestion: "Give an action that protects a person. Example: “volunteer at a shelter”.",
  },
  {
    id: "self-harm",
    pattern:
      /\b(suicide|self[-\s]?harm|cut\s+myself|hurt\s+myself|end\s+my\s+life|starve\s+myself|overdose)\b/i,
    reason: "This app cannot show that. If you feel bad, speak to a person that you trust.",
    suggestion: "Try “call a friend” or “take a long walk outside”.",
  },
  {
    id: "ecocide",
    pattern:
      /\b(burn|torch|clear[-\s]?cut|chop\s+down|deforest|poison|frack|strip[-\s]?mine|bulldoze)\b.{0,24}\b(forest|tree|trees|woods|rainforest|wetland|reef|river|lake|habitat)\b/i,
    reason: "That action destroys a habitat that other people and animals need.",
    suggestion: "Change the direction. Try “plant a tree” or “restore a wetland”.",
  },
  {
    id: "littering",
    pattern:
      /\b(litter|dump|throw|toss|pour|flush)\w*\b.{0,24}\b(trash|garbage|rubbish|plastic|waste|oil|chemicals?|sewage|paint)\b|\blitter(ing)?\b/i,
    reason: "That action moves your waste and its cost to other people.",
    suggestion: "Try “pick up litter on my street” or “compost food waste”.",
  },
  {
    id: "cruelty",
    pattern: /\b(kick|hit|abuse|neglect|abandon|drown|poach|trap)\w*\b.{0,20}\b(dog|cat|animal|pet|bird|puppy|kitten|whale|elephant)\b/i,
    reason: "That action hurts an animal that cannot escape.",
    suggestion: "Try “foster a rescue animal” or “build a bird feeder”.",
  },
  {
    id: "theft-fraud",
    pattern: /\b(steal|rob|shoplift|embezzle|scam|defraud|launder|bribe|extort|counterfeit|hack\s+into|phish)\w*\b/i,
    reason: "That action takes property from a person without permission.",
    suggestion: "Try “donate to a local fund” or “mentor someone”.",
  },
  {
    id: "hate",
    pattern: /\b(bully|harass|dox|humiliate|threaten|intimidate|racist|slur|discriminate|exclude\s+people)\w*\b/i,
    reason: "That action decreases the dignity of another person.",
    suggestion: "Try “learn a neighbour's language” or “welcome a newcomer”.",
  },
  {
    id: "substance",
    pattern: /\b(drunk\s+driv|drink\s+and\s+driv|smoke\s+meth|inject\s+heroin|sell\s+drugs|deal\s+drugs)\w*/i,
    reason: "That action puts you and the people near you in danger.",
    suggestion: "Try “walk home”, “cycle to work”, or “call a cab”.",
  },
  {
    id: "waste",
    pattern:
      /\b(waste|leave\s+running|idle|leave\s+on)\b.{0,24}\b(water|electricity|power|energy|engine|fuel|food|lights?)\b|\bleave\s+the\s+(tap|faucet|engine|lights?)\s+(running|on)\b/i,
    reason: "That action uses a shared resource and gives no result.",
    suggestion: "Try “fix a dripping tap” or “switch to LED bulbs”.",
  },
  {
    id: "misinformation",
    pattern: /\b(spread|post|share)\b.{0,20}\b(lies|misinformation|disinformation|fake\s+news|rumou?rs?|hoax)\b/i,
    reason: "False information moves faster than the correction.",
    suggestion: "Try “fact-check before sharing” or “teach someone to read sources”.",

  },
];

/* ------------------------------------------------------------------ */
/* 2. Domain dataset — regex + fuzzy key phrases + consequence chain    */
/* ------------------------------------------------------------------ */

interface DomainRule {
  id: string;
  label: string;
  pattern: RegExp;
  /** fuzzy dictionary: single tokens scored by overlap */
  keys: string[];
  /** 7 stage templates; {a} is replaced with the user's action phrase */
  chain: Array<{ title: string; detail: string; magnitude: number }>;
}

export const DOMAIN_RULES: DomainRule[] = [
  {
    id: "planting",
    label: "Roots and New Growth",
    pattern: /\b(plant|sow|seed|grow|garden|reforest|rewild|sapling|orchard|meadow|hedge|shrub|tree)\w*\b/i,
    keys: ["plant", "tree", "seed", "garden", "grow", "soil", "forest", "flower", "meadow", "native"],
    chain: [
      { title: "You open the soil", detail: "You {a}. You move about two litres of soil. Air and water go into the ground again.", magnitude: 0.18 },
      { title: "Roots find fungi", detail: "In a few days, soil fungi attach to the new roots. The fungi give minerals. The plant gives sugars.", magnitude: 0.3 },
      { title: "Insects arrive", detail: "Bees and other insects change their flight paths. Several hundred bees can learn the position of one new plant.", magnitude: 0.42 },
      { title: "The local climate changes", detail: "Shade makes the surface 2 to 8 °C cooler. Water stays in the soil. The soil holds more carbon.", magnitude: 0.56 },
      { title: "Neighbours do the same", detail: "People see the new plants. Homes on a green street plant more in the next two seasons.", magnitude: 0.7 },
      { title: "The canopy has value", detail: "A large canopy decreases cooling costs. It absorbs storm water. It also increases the value of nearby homes.", magnitude: 0.85 },
      { title: "Others get the shade", detail: "A person who is not yet born sits below this tree. That person thinks the tree was always there.", magnitude: 1 },
    ],
  },
  {
    id: "waste",
    label: "Materials in a Loop",
    pattern: /\b(compost|recycl|reuse|repair|mend|refill|upcycl|salvage|donate\s+clothes|zero[-\s]?waste|thrift|second[-\s]?hand)\w*\b/i,
    keys: ["compost", "recycle", "reuse", "repair", "waste", "trash", "plastic", "food", "scraps", "thrift"],
    chain: [
      { title: "Material leaves the waste line", detail: "You {a}. A few hundred grams of material do not go to the landfill.", magnitude: 0.18 },
      { title: "No methane forms", detail: "Buried food waste makes methane. Methane heats the air much more than carbon dioxide. Open breakdown prevents this.", magnitude: 0.32 },
      { title: "The soil gets nutrients", detail: "The finished compost returns nitrogen, potassium and live microbes to the ground.", magnitude: 0.45 },
      { title: "The council sees the change", detail: "Less waste changes what the council must buy. It needs fewer trucks and smaller landfill contracts.", magnitude: 0.58 },
      { title: "A habit becomes a service", detail: "When many homes do this, the council starts kerbside collection. The correct choice then becomes easy.", magnitude: 0.72 },
      { title: "Less new material is necessary", detail: "Each kilogram that you use again is a kilogram that no company must mine, cut or drill.", magnitude: 0.87 },
      { title: "Waste stops being normal", detail: "Children grow up with reuse as the usual method. They do not think that waste is necessary.", magnitude: 1 },
    ],
  },
  {
    id: "mobility",
    label: "A Different Way to Travel",
    pattern: /\b(walk|cycle|bike|bicycle|bus|train|tram|metro|carpool|transit|scooter|commute)\w*\b/i,
    keys: ["walk", "cycle", "bike", "bus", "train", "car", "drive", "commute", "transit", "travel"],
    chain: [
      { title: "One engine stays cold", detail: "You {a}. A car engine pollutes most in the first minutes. Those minutes do not occur.", magnitude: 0.18 },
      { title: "The air is cleaner", detail: "Exhaust particles are worst at the height of a small child. One less car helps at that height.", magnitude: 0.3 },
      { title: "Your body changes", detail: "Twenty active minutes each day decreases your resting heart rate. Mood also improves in about six weeks.", magnitude: 0.44 },
      { title: "The street feels safer", detail: "People on foot watch the street. Regular foot traffic prevents crime at almost no cost.", magnitude: 0.58 },
      { title: "Local shops continue", detail: "People on foot spend less money each visit. But they come much more frequently. Local shops stay open.", magnitude: 0.72 },
      { title: "The street is rebuilt", detail: "The council counts the people on foot. Then it adds a lane, a crossing and a budget.", magnitude: 0.86 },
      { title: "The city needs fewer cars", detail: "Children can move through their own area alone again. This shows that the design of the city is correct.", magnitude: 1 },
    ],
  },
  {
    id: "energy",
    label: "Power and Heat",
    pattern: /\b(solar|insulat|led|thermostat|unplug|switch\s+off|heat\s+pump|draught|draft[-\s]?proof|energy|electric|panel)\w*\b/i,
    keys: ["solar", "energy", "power", "electric", "insulate", "heat", "led", "panel", "grid", "bill"],
    chain: [
      { title: "The grid load decreases", detail: "You {a}. The demand on the grid decreases by a very small quantity. The total is made of small quantities.", magnitude: 0.18 },
      { title: "The dirtiest plant stays off", detail: "Power companies use their worst plant for the last part of demand. Your saving removes that part first.", magnitude: 0.32 },
      { title: "The cost decreases each month", detail: "The saving continues every month. You do not have to think about it again.", magnitude: 0.46 },
      { title: "Local trades get work", detail: "Local demand makes local jobs. Trained people, not subsidies, keep the change permanent.", magnitude: 0.6 },
      { title: "Equipment becomes cheaper", detail: "Each time the installed capacity doubles, the unit cost usually decreases by about 20 per cent.", magnitude: 0.75 },
      { title: "Fuel becomes optional", detail: "A home that makes and stores its own power is safe from the next fuel price increase.", magnitude: 0.88 },
      { title: "Power without extraction", detail: "Later, people find it strange that light one time needed a fire.", magnitude: 1 },
    ],
  },
  {
    id: "water",
    label: "Water Supply",
    pattern: /\b(water|tap|faucet|shower|rain|rainwater|drip|leak|irrigat|aquifer|well|river|drought)\w*\b/i,
    keys: ["water", "tap", "shower", "rain", "leak", "drip", "river", "drought", "irrigate", "save"],
    chain: [
      { title: "The water stays in the system", detail: "You {a}. Nobody must clean, pump or heat that water. It stays available.", magnitude: 0.2 },
      { title: "You also save power", detail: "Cities use much electricity to move and heat water. Less water means less electricity.", magnitude: 0.33 },
      { title: "Treatment plants work better", detail: "Less flow gives the plant more time to clean the water. The water that goes to the river is cleaner.", magnitude: 0.47 },
      { title: "Groundwater increases", detail: "Groundwater fills again very slowly. Each litre that you do not use stays for a dry year.", magnitude: 0.61 },
      { title: "Reservoirs keep a margin", detail: "Water limits start later and stop sooner. Farms, hospitals and gardens use the same reserve.", magnitude: 0.76 },
      { title: "There is less conflict", detail: "Most water disputes start when the margin is too small. A reserve of water helps to keep peace.", magnitude: 0.89 },
      { title: "The river continues to flow", detail: "A channel downstream still has water in the dry month. The animals and plants there stay alive.", magnitude: 1 },
    ],
  },
  {
    id: "food",
    label: "Food Choices",
    pattern: /\b(eat|meal|vegan|vegetarian|plant[-\s]?based|meat|local\s+food|farmers?\s+market|cook|bake|forag|grow\s+food|allotment)\w*\b/i,
    keys: ["eat", "food", "meal", "cook", "vegan", "meat", "market", "farm", "local", "diet"],
    chain: [
      { title: "You select one meal", detail: "You {a}. One meal looks small. But you eat about 1,100 meals each year.", magnitude: 0.18 },
      { title: "Land use changes", detail: "Land, not transport, causes most of the effect of food. Your choice changes how farmers use land.", magnitude: 0.32 },
      { title: "Shops read the data", detail: "Buyers examine sales data each week. Your purchases are a fast and clear signal to them.", magnitude: 0.46 },
      { title: "Other people copy you", detail: "People eat what their friends eat. Taste moves through groups better than arguments do.", magnitude: 0.6 },
      { title: "Farms grow more crop types", detail: "Steady demand for different crops brings back crop rotation, hedges and insect habitat.", magnitude: 0.75 },
      { title: "Supply is more stable", detail: "Short and varied supply chains continue during a drought or a price increase. Long thin chains break.", magnitude: 0.88 },
      { title: "Good food, low cost to the planet", detail: "A regional style of cooking develops. It is generous, cheap and easy for the planet.", magnitude: 1 },
    ],
  },
  {
    id: "community",
    label: "People and Contact",
    pattern: /\b(volunteer|help|mentor|teach|donate|neighbou?r|community|befriend|listen|visit|check\s+in|share|host|welcome|thank)\w*\b/i,
    keys: ["help", "volunteer", "teach", "mentor", "neighbour", "friend", "community", "donate", "listen", "kind"],
    chain: [
      { title: "One contact occurs", detail: "You {a}. Two people relax a little. The stress level of both persons decreases.", magnitude: 0.2 },
      { title: "Help moves on", detail: "A person who receives help wants to give help. Usually that person helps somebody else.", magnitude: 0.33 },
      { title: "The effect goes three steps", detail: "Helpful behaviour moves to friends, and then to their friends. You do not meet most of these people.", magnitude: 0.47 },
      { title: "Loose contacts get stronger", detail: "Loose contacts, not close friends, usually supply jobs, homes and urgent help. You made one more.", magnitude: 0.61 },
      { title: "The street becomes a network", detail: "Areas with many loose contacts recover faster after a flood, a power cut or a death.", magnitude: 0.76 },
      { title: "Groups become organisations", detail: "Almost all co-ops, libraries and aid funds started with a small group of people who trusted each other.", magnitude: 0.89 },
      { title: "People expect help", detail: "The next generation learns one rule: when something breaks, people come to help.", magnitude: 1 },
    ],
  },
  {
    id: "learning",
    label: "Knowledge and Skill",
    pattern: /\b(read|learn|study|write|research|fact[-\s]?check|book|library|course|practice|language|skill|journal)\w*\b/i,
    keys: ["read", "learn", "study", "book", "write", "skill", "practice", "language", "library", "course"],
    chain: [
      { title: "You use your attention", detail: "You {a}. Twenty minutes of full attention is rare. Many companies try to take that time.", magnitude: 0.18 },
      { title: "The brain adapts", detail: "When you practise, the brain makes the related paths faster. Skill is a physical change.", magnitude: 0.31 },
      { title: "You ask better questions", detail: "New words let you see new things. More knowledge increases what you can observe.", magnitude: 0.45 },
      { title: "People ask you", detail: "People send their questions to the person who knows. Your new skill changes your position in the group.", magnitude: 0.6 },
      { title: "Fewer errors move on", detail: "One person who examines the sources decreases how much bad information the group sends.", magnitude: 0.74 },
      { title: "The skill increases each year", detail: "Ten years of practice gives much more than ten times one year. The early results are small.", magnitude: 0.88 },
      { title: "The knowledge continues", detail: "A person who does not know your name teaches what you learned.", magnitude: 1 },
    ],
  },
  {
    id: "wellbeing",
    label: "Body and Mind",
    pattern: /\b(sleep|rest|meditat|breathe|exercise|run|swim|stretch|yoga|therapy|quit\s+smoking|hydrate|unplug\s+from|digital\s+detox)\w*\b/i,
    keys: ["sleep", "rest", "meditate", "exercise", "run", "health", "calm", "breathe", "quit", "therapy"],
    chain: [
      { title: "The body resets", detail: "You {a}. The body stops its alarm response. Heart rate and breathing become slow and regular.", magnitude: 0.18 },
      { title: "Decisions are clearer", detail: "A rested brain controls impulses better. That control changes many later choices in the day.", magnitude: 0.32 },
      { title: "You are more patient", detail: "Most avoidable arguments start when a person is tired. Calm people are easier to live with.", magnitude: 0.46 },
      { title: "You can continue", detail: "You keep long-term promises only if you have sufficient energy for them.", magnitude: 0.6 },
      { title: "You can help others", detail: "People with spare energy help other people. Exhaustion removes a person from the group.", magnitude: 0.75 },
      { title: "More good years", detail: "You add years, and also add health in those years. You can still carry things and help people.", magnitude: 0.88 },
      { title: "Children learn the same", detail: "Children copy the calm behaviour that they see. They do not copy the advice that they hear.", magnitude: 1 },
    ],
  },
  {
    id: "civic",
    label: "Shared Decisions",
    pattern: /\b(vote|petition|council|protest|campaign|organi[sz]e|union|advocate|write\s+to|attend\s+meeting|survey|census)\w*\b/i,
    keys: ["vote", "council", "petition", "campaign", "organise", "union", "protest", "policy", "meeting", "civic"],
    chain: [
      { title: "Your name is on the record", detail: "You {a}. Officials record who takes part. They then give attention to those groups.", magnitude: 0.2 },
      { title: "Turnout controls money", detail: "Areas with high turnout receive more money for roads, schools and services than quiet areas.", magnitude: 0.34 },
      { title: "Neighbours see you", detail: "Visible civic action increases participation more than any letter through the door.", magnitude: 0.48 },
      { title: "The agenda changes", detail: "Small regular groups control agendas, because most seats in most rooms are empty.", magnitude: 0.62 },
      { title: "The rules change", detail: "One line in one local rule can do more than ten years of individual effort.", magnitude: 0.77 },
      { title: "The correct choice is the default", detail: "Good rules make the correct action automatic. Nobody must make a special effort.", magnitude: 0.9 },
      { title: "The system still responds", detail: "The next generation receives institutions that react to people. Persons must maintain that condition.", magnitude: 1 },
    ],
  },
];

/* Generic fallback chains for benign actions with no domain match.
   Several sentence paths; one is selected at random for variety. */
const GENERIC_CHAINS: Array<{ label: string; chain: DomainRule["chain"] }> = [
  {
    label: "Open Water",
    chain: [
      { title: "The first move", detail: "You {a}. The action is small and specific. More important, you did it.", magnitude: 0.18 },
      { title: "The second time is easier", detail: "You pay most of the cost of a new action one time only.", magnitude: 0.32 },
      { title: "Somebody sees it", detail: "People read behaviour before they read words. Your action is a clear signal.", magnitude: 0.46 },
      { title: "It becomes a habit", detail: "After many repeats, the action becomes part of you. Then it needs almost no effort.", magnitude: 0.6 },
      { title: "It moves sideways", detail: "People copy the persons who are near them. You are near a small number of people.", magnitude: 0.75 },
      { title: "Systems adjust", detail: "When sufficient people do the same thing, the systems around them change to agree with it.", magnitude: 0.88 },
      { title: "The new normal", detail: "Later, nobody remembers that this was a choice.", magnitude: 1 },
    ],
  },
  {
    label: "Small Start",
    chain: [
      { title: "One action, today", detail: "You {a}. Nothing large occurs yet. A chain starts.", magnitude: 0.18 },
      { title: "You learn the steps", detail: "You now know the sequence. Next time you do not have to plan it.", magnitude: 0.32 },
      { title: "The result is visible", detail: "A small result appears. Visible results keep an action in operation.", magnitude: 0.46 },
      { title: "One person asks about it", detail: "Somebody asks you what you did. That question is the start of the second copy.", magnitude: 0.6 },
      { title: "A small group forms", detail: "Two or three people do the same thing. The group makes the action normal.", magnitude: 0.75 },
      { title: "The place changes", detail: "The street, the office or the home is different because the group continues.", magnitude: 0.88 },
      { title: "The change stays", detail: "The action continues after you stop. Other persons keep it in operation.", magnitude: 1 },
    ],
  },
  {
    label: "Quiet Chain",
    chain: [
      { title: "You start the chain", detail: "You {a}. One event now controls the events that come after it.", magnitude: 0.18 },
      { title: "The cost decreases", detail: "The tools are ready and the method is known. The next attempt takes less time.", magnitude: 0.32 },
      { title: "The effect leaves you", detail: "The result touches a person that you do not know. You do not see this step.", magnitude: 0.46 },
      { title: "Time makes it larger", detail: "A small effect each week becomes a large effect in a year.", magnitude: 0.6 },
      { title: "Others use it", detail: "People use what is already there. Your action becomes their start position.", magnitude: 0.75 },
      { title: "The rules follow", detail: "Rules and budgets usually come after the behaviour, not before it.", magnitude: 0.88 },
      { title: "The far shore", detail: "The last wave arrives in a year that you will not see.", magnitude: 1 },
    ],
  },
  {
    label: "Steady Work",
    chain: [
      { title: "You do the work", detail: "You {a}. This is a real action, not a plan.", magnitude: 0.18 },
      { title: "Nothing looks different", detail: "The first result is too small to measure. This is normal and correct.", magnitude: 0.32 },
      { title: "The count increases", detail: "Each repeat adds to a total. Totals, not single events, cause change.", magnitude: 0.46 },
      { title: "You become reliable", detail: "People trust an action that occurs again and again. Trust makes cooperation possible.", magnitude: 0.6 },
      { title: "Help arrives", detail: "Other persons join work that is already in operation. They rarely start it.", magnitude: 0.75 },
      { title: "The work is shared", detail: "The task no longer needs you. Many persons hold it.", magnitude: 0.88 },
      { title: "The result stays", detail: "What many people hold together does not fall down when one person stops.", magnitude: 1 },
    ],
  },
];


/* ------------------------------------------------------------------ */
/* 3. Parsing                                                           */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "at", "my", "your", "our", "i", "we",
  "and", "or", "for", "with", "some", "more", "every", "day", "daily", "will", "would",
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Cheap Levenshtein-bounded similarity for fuzzy key matching. */
function similar(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  let dist = 0;
  const m = Math.min(a.length, b.length);
  for (let i = 0; i < m; i++) if (a[i] !== b[i]) dist++;
  dist += Math.abs(a.length - b.length);
  return dist <= 2;
}

function normalizeAction(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

export function checkHarm(input: string): RippleRejection | null {
  for (const rule of HARM_RULES) {
    if (rule.pattern.test(input)) {
      return { ok: false, reason: rule.reason, suggestion: rule.suggestion, matched: rule.id };
    }
  }
  return null;
}

export function parseAction(raw: string): RippleOutcome {
  const input = raw.trim();

  if (input.length < 3) {
    return {
      ok: false,
      matched: "too-short",
      reason: "That's a little too short to ripple.",
      suggestion: "Try something like “plant a tree” or “walk to work”.",
    };
  }
  if (input.length > 120) {
    return {
      ok: false,
      matched: "too-long",
      reason: "Keep it to a single concrete action.",
      suggestion: "Try “compost food waste” rather than a whole paragraph.",
    };
  }
  if (!/[a-z]{3}/i.test(input)) {
    return {
      ok: false,
      matched: "no-words",
      reason: "I couldn't find an action in there.",
      suggestion: "Describe something you could actually do today.",
    };
  }

  const harm = checkHarm(input);
  if (harm) return harm;

  const tokens = tokenize(input);
  let best: { rule: DomainRule; score: number } | null = null;

  for (const rule of DOMAIN_RULES) {
    let score = 0;
    if (rule.pattern.test(input)) score += 6;
    for (const token of tokens) {
      for (const key of rule.keys) {
        if (token === key) score += 3;
        else if (similar(token, key)) score += 1.5;
      }
    }
    if (!best || score > best.score) best = { rule, score };
  }

  const matched = best && best.score >= 3 ? best.rule : null;
  const fallback = GENERIC_CHAINS[Math.floor(Math.random() * GENERIC_CHAINS.length)];
  const chain: DomainRule["chain"] = matched ? matched.chain : fallback.chain;
  const action = normalizeAction(input);
  const count = 6 + (tokens.length % 2); // 6 or 7 nodes

  const nodes: RippleNode[] = chain.slice(0, count).map((stage, i) => ({
    id: `${matched?.id ?? "generic"}-${i}`,
    horizon: HORIZONS[i] ?? "Generations",
    title: stage.title,
    detail: stage.detail.replace("{a}", action),
    magnitude: stage.magnitude,
  }));

  return {
    ok: true,
    action,
    domain: matched?.id ?? "generic",
    domainLabel: matched?.label ?? fallback.label,
    confidence: matched ? Math.min(1, (best?.score ?? 0) / 12) : 0.25,
    nodes,
  };

}

export const EXAMPLE_ACTIONS = [
  "Plant a tree",
  "Compost food waste",
  "Cycle to work",
  "Check in on a neighbour",
  "Fix a dripping tap",
  "Read for twenty minutes",
];
