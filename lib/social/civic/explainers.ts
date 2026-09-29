import type { CivicEntity, Explainer } from "../types.ts";

// Plain-language explainers: what a law, proposal or document does, who it
// affects, where it stands and how to take part. Each is written only from
// the sources it lists and dated when Polis last checked them. Explainers for
// Sample proposals describe illustrations, never real pending decisions.
// Keep sentences short and terms defined; link the original for every claim.

const senators = "https://www.senate.gov/senators/senators-contact.htm";

const ratepayerProtectionAct: Explainer = {
  title: "The Ratepayer Protection Act, explained",
  changesLabel: "What it would do",
  inShort:
    "A bill the U.S. House passed in September 2026 would push states to make very large power users, such as data centers, pay the full cost of the power plants and grid upgrades built for them, instead of spreading those costs onto household electric bills.",
  changes: [
    "Every state's utility regulator would have to consider a new rule for customers that use more than 100 megawatts of power.",
    "Under that rule, those customers pay the full extra cost of the generation, transmission and distribution upgrades built to serve them.",
    "They would also put up financial guarantees before upgrades are built, and still cover the costs if they leave early.",
    "States decide whether to adopt the rule. They must begin considering it within a year of the law passing and decide within two years.",
  ],
  affects: [
    "Households and small businesses that pay electric bills",
    "Data centers and other very large power users (over 100 megawatts)",
    "State utility regulators, such as the New York and Florida Public Service Commissions",
  ],
  stage: "Passed the U.S. House 417–3 on September 16, 2026. It becomes law only if the Senate passes it and the President signs it.",
  next: {
    what: "The Senate would need to take it up.",
    when: "Not scheduled. Utility Dive reported it is unlikely to pass the Senate before the November 2026 elections.",
    how: "Tell your two U.S. senators what you think, by phone or through their websites.",
    url: senators,
    urlLabel: "Find your senators",
  },
  terms: [
    { term: "Ratepayer", meaning: "Anyone who pays a utility bill." },
    { term: "Megawatt (MW)", meaning: "A measure of electric power. 100 MW is roughly what tens of thousands of homes use at once." },
    { term: "Transmission and distribution", meaning: "Transmission lines carry power long distances; distribution lines bring it to buildings." },
    { term: "Utility regulator", meaning: "The state agency, often called a Public Service Commission, that approves what utilities charge." },
  ],
  sources: [
    {
      title: "Riley helps pass bipartisan bill to hold data centers accountable",
      url: "https://riley.house.gov/2026/09/19/riley-helps-pass-bipartisan-bill-to-hold-data-centers-accountable-lower-utility-bills-for-upstate-new-yorkers/",
      publisher: "Office of Rep. Josh Riley",
      date: "2026-09-19",
    },
    {
      title: "House passes ratepayer protection bill to limit data center cost shifts",
      url: "https://www.utilitydive.com/news/house-passes-ratepayer-protection-bill-data-centers/830658/",
      publisher: "Utility Dive",
      date: "2026-09-17",
    },
  ],
  checkedAt: "2026-09-28",
};

const ufFallTransit: Explainer = {
  title: "UF's fall 2026 bus changes, explained",
  changesLabel: "What changed",
  inShort:
    "UF's Campus Connector now runs three loop routes instead of two, some RTS routes get extra buses at busy times, and Routes 9 and 38 no longer run on weekends.",
  changes: [
    "Campus Connector: East-West loop about every 10–15 minutes at peak times (9am–5:30pm), Central loop about every 20–25 minutes, North-South loop about every 30 minutes.",
    "RTS Routes 9, 33 and 37 add buses at peak times to reduce crowding.",
    "Route 21 keeps running Monday–Thursday, 7:30am–6pm.",
    "Routes 9 and 38 no longer run on Saturdays or Sundays because few people rode them. Routes 12, 37 and 1 are the alternatives, depending on where you are going.",
  ],
  affects: ["Students, faculty and staff who ride campus buses", "Weekend riders on Routes 9 and 38"],
  stage: "In effect for the fall 2026 semester, August 17, 2026 to January 3, 2027.",
  next: {
    what: "Plan weekend trips around the route changes.",
    how: "Check live bus times in the NaviGator or Passio Go apps, or ask UF Transportation and Parking Services at parking@ufl.edu or (352) 392-PARK.",
    url: "https://taps.ufl.edu/fall2026transit/",
    urlLabel: "Fall 2026 transit updates",
  },
  terms: [
    { term: "Circulator", meaning: "A bus that loops around one area instead of running between two places." },
    { term: "Peak hours", meaning: "The busiest travel times of the day." },
    { term: "Ridership", meaning: "How many people ride a route." },
  ],
  sources: [
    { title: "Fall 2026 transit updates", url: "https://taps.ufl.edu/fall2026transit/", publisher: "UF Transportation and Parking Services" },
  ],
  checkedAt: "2026-09-28",
};

// Samples: explanations of the illustrative proposals already in the catalog.
function lateBusSample(operator: string, places: string, url: string): Explainer {
  return {
    inShort: "Sample: a one-semester trial of later buses between " + places + ", judged by how many people ride and what it costs.",
    changes: [
      "Later bus trips on weeknights during the semester.",
      "Ridership and cost numbers published after the trial.",
      "The trial compared against other options, such as on-demand rides.",
    ],
    affects: ["Students who travel late between " + places, operator + " drivers and schedules"],
    stage: "An illustration for discussion, not a real pending decision.",
    next: {
      what: "A real proposal would start by collecting rider input and estimating costs and driver availability before any trial.",
      how: "Say which late trips you need in The Commons.",
    },
    terms: [
      { term: "Pilot", meaning: "A short trial that tests an idea before anyone commits to it." },
      { term: "Ridership", meaning: "How many people ride a route." },
    ],
    sources: [{ title: operator + " routes and schedules", url, publisher: operator }],
    checkedAt: "2026-09-28",
  };
}
function zoningSample(place: string, body: string, url: string, publisher: string): Explainer {
  return {
    inShort:
      "Sample: a zoning change that would let taller apartment buildings go up in " + place + ", so more people could live close to campus and frequent buses.",
    changes: [
      "Taller apartment buildings allowed on the blocks the change covers.",
      "More homes could be built there; the change itself builds nothing.",
      "Each new building would still need its own review and permits.",
    ],
    affects: ["Renters looking for housing near campus", "Current neighbors and property owners", "Anyone who might build there"],
    stage: "An illustration for discussion, not a real pending decision.",
    next: {
      what: "A real zoning change usually goes to the planning board, then a public hearing, then a vote by the " + body + ".",
      how: "At the public hearing anyone can speak or send written comments. Say where you stand in The Commons.",
    },
    terms: [
      { term: "Zoning", meaning: "Local rules for what can be built where, and how big." },
      { term: "Planning board", meaning: "Appointed residents who review building and zoning proposals and advise elected officials." },
      { term: "Public hearing", meaning: "A meeting where anyone can speak about a proposal before a vote." },
    ],
    sources: [{ title: publisher, url, publisher }],
    checkedAt: "2026-09-28",
  };
}

export const explainers: Record<string, Explainer> = {
  "news-data-center-costs-ithaca": ratepayerProtectionAct,
  "news-data-center-costs-uf": ratepayerProtectionAct,
  "uf-transit": ufFallTransit,
  "cu-late-night-bus": lateBusSample("TCAT", "central campus, Collegetown and North Campus", "https://tcatbus.com/"),
  "uf-later-gator": lateBusSample("Gainesville RTS", "campus, Midtown and downtown", "https://go-rts.com/"),
  "ith-collegetown-homes": zoningSample("Collegetown", "Ithaca Common Council", "https://www.cityofithacany.gov/", "City of Ithaca"),
  "gnv-midtown-housing": zoningSample("Midtown Gainesville", "Gainesville City Commission", "https://www.gainesvillefl.gov/", "City of Gainesville"),
};

// A guide every located community gets: how a local decision is usually made
// and where to take part. General civic education; names and steps vary.
export function localDecisionsGuide(communityId: string, city: string, council: string, us: boolean): CivicEntity {
  return {
    id: communityId + ".how-decisions-work",
    communityId,
    kind: "guide",
    name: "How a local decision gets made in " + city,
    subtitle: "Guide · How it works",
    summary: "From proposal to vote, and the moments when residents can weigh in.",
    scope: "local",
    topics: [],
    related: [],
    sample: false,
    explainer: {
      inShort:
        "Most local laws start as a proposal, get reviewed by staff or a committee, appear on a public agenda where residents can comment, and then face a vote by the " + council + ".",
      changesLabel: "How it usually works",
      changes: [
        "A proposal is written, often by staff, an elected member or a committee.",
        "It appears on a public agenda, usually posted a few days before the meeting.",
        "A public hearing or comment period lets anyone speak or send written comments.",
        "The " + council + " votes. In some places the mayor can then sign or veto it.",
      ],
      affects: ["Everyone who lives, works or studies in " + city],
      stage: "This is a general guide. Names and steps differ from place to place, so check how " + city + " does it.",
      next: {
        what: "Find the next " + council + " meeting and its agenda.",
        how: "Agendas list what will be decided. You can usually speak during public comment, email members, or watch a recording.",
        ...(us ? { url: "https://www.usa.gov/local-governments", urlLabel: "Find your local government" } : {}),
      },
      terms: [
        { term: "Agenda", meaning: "The list of what a meeting will discuss and decide, published in advance." },
        { term: "Ordinance", meaning: "A local law." },
        { term: "Resolution", meaning: "A formal statement or decision that is not a law, such as approving a plan." },
        { term: "Public comment", meaning: "Time set aside for residents to speak or send written views." },
      ],
      sources: us ? [{ title: "Local governments", url: "https://www.usa.gov/local-governments", publisher: "USA.gov" }] : [],
      checkedAt: "2026-09-28",
    },
  };
}

// The explainers a community has, and one to feature each day on Home.
export const explained = (catalog: CivicEntity[]) => catalog.filter((e) => e.explainer);
export function explainedToday(catalog: CivicEntity[], day: Date) {
  // Real explainers rotate; Samples are featured only when there is nothing real.
  const all = explained(catalog).sort((a, b) => a.id.localeCompare(b.id));
  const real = all.filter((e) => !e.sample);
  const list = real.length ? real : all;
  if (!list.length) return undefined;
  return list[Math.floor(day.getTime() / 86400000) % list.length];
}
