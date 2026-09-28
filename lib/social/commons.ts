// Editorial background, not seeded people, posts, attendance or public sentiment.
export const commonsTopics = [
  { id: "cornell-transit", communityId: "ithaca", name: "Getting to campus", description: "How do bus routes, walking and cycling fit your everyday journeys?", source: "https://tcatbus.com/tcats-2026-fall-service/", publisher: "TCAT", sourceDate: "2026-08-07", checkedAt: "2026-09-25", update: "TCAT published its fall service changes, including added campus service. Check the operator’s current schedules and alerts before traveling.", documentTitle: "Fall 2026 service announcement" },
  { id: "cornell-climate", communityId: "ithaca", name: "Campus climate choices", description: "Discuss the choices involved in reducing campus emissions and improving shared spaces.", source: "https://sustainable.cornell.edu/climate-action/climate-action-plan", publisher: "Sustainable Cornell", sourceDate: null, checkedAt: "2026-09-25", update: "Cornell’s Climate Action Plan page describes strategies for buildings, transportation and energy. This is background, not a new decision or a claim of progress.", documentTitle: "Cornell Climate Action Plan" },
  { id: "uf-transit", communityId: "uf", name: "Getting around Gainesville", description: "Share your experience of commuting and moving between campus and the city.", source: "https://taps.ufl.edu/fall2026transit/", publisher: "UF Transportation and Parking Services", sourceDate: null, checkedAt: "2026-09-25", update: "UF’s fall 2026 transit notice describes three Campus Connector routes and changes to RTS service, including weekend routes. Consult the source for current route details.", documentTitle: "Fall 2026 transit updates" },
  { id: "uf-climate", communityId: "uf", name: "Campus sustainability", description: "What would make sustainable choices easier in everyday campus life?", source: "https://sustainable.ufl.edu/campus-initiatives/uf-climate-action/history-of-climate-action-at-uf/", publisher: "UF Office of Sustainability", sourceDate: null, checkedAt: "2026-09-25", update: "UF’s history page explains its climate planning process. It is historical context, not evidence of a newly adopted plan or completed action.", documentTitle: "History of climate action at UF" },
] as const;
export type CommonsTopic = (typeof commonsTopics)[number];
export const topicsFor = (communityId: string) => commonsTopics.filter(t => t.communityId === communityId);
export const topicFor = (id: string) => commonsTopics.find(t => t.id === id);
export const discussionLabels: Record<string, string> = { question: "Question", debate: "Debate", update: "Update" };

// Polis-run pilot spaces; neither represents nor claims university endorsement.
export const pilotOrganizations = [
  { id: "cornell-circle", communityId: "ithaca", name: "Cornell pilot circle", description: "A small Polis tester space for Cornell/Ithaca. Independent of the university." },
  { id: "uf-circle", communityId: "uf", name: "UF pilot circle", description: "A small Polis tester space for UF/Gainesville. Independent of the university." },
] as const;
export const organizationFor = (id: string) => pilotOrganizations.find(o => o.id === id);
