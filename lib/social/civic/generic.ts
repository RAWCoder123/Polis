import type { CivicEntity, CommunityPlace } from "../types.ts";
import type { PilotCommunity } from "../communities.ts";
import { localeOf } from "../communities.ts";
import { localDecisionsGuide } from "./explainers.ts";

// A civic starting point for any community without a curated catalog. Offices
// are described by role with official lookup links; Polis never guesses who
// holds them. Starter questions are templates labeled Sample. Public places come
// from OpenStreetMap. No news, proposals or events are invented.
const usa = {
  officials: "https://www.usa.gov/elected-officials",
  house: "https://www.house.gov/representatives/find-your-representative",
  senate: "https://www.senate.gov/senators/senators-contact.htm",
  vote: "https://vote.gov/",
};

export function genericCatalog(community: PilotCommunity, places: CommunityPlace[] = []): CivicEntity[] {
  const locale = localeOf(community);
  if (!locale) return [];
  const cid = community.id;
  const city = locale.city;
  const us = locale.country === "US";
  const campus = locale.university;
  const id = (suffix: string) => cid + "." + suffix;
  const base = { communityId: cid, related: [] as string[], topics: [] as string[], sample: false };
  const issue = (suffix: string, name: string, summary: string, scope: CivicEntity["scope"] = "local"): CivicEntity => ({
    ...base,
    id: id(suffix),
    kind: "issue",
    name,
    subtitle: city + " · Local issue",
    summary,
    scope,
  });
  const entities: CivicEntity[] = [
    issue("housing", "Housing & rent in " + city, "Homes, rents, leases and how neighborhoods grow."),
    issue("transit", "Getting around " + city, "Buses, walking, biking, parking and everyday trips."),
    issue("streets", "Safe streets", "Crossings, lighting, speeds and how people feel getting around at night."),
    issue("spaces", "Parks & public spaces", "Parks, libraries, plazas and places to gather."),
    issue("learning", "Schools & libraries", "Learning, study space and public libraries."),
    issue("economy", "Local jobs & businesses", "Work, small businesses and the cost of living."),
    ...(campus
      ? [issue("student-voice", "Student voice at " + locale.shortName, "How students are represented and how student fees are spent.", "campus")]
      : []),
    {
      ...base,
      id: id("mayor"),
      kind: "official",
      name: "Mayor or local executive",
      subtitle: city + " · Elected or appointed office",
      summary: "The office that leads " + city + "'s local government. Titles and powers differ from place to place.",
      scope: "local",
      topics: [id("housing"), id("economy")],
      monogram: "M",
      office: { title: "Local executive", jurisdiction: city, ...(us ? { directoryUrl: usa.officials } : {}) },
      ...(us ? { sourceUrl: usa.officials, sourceLabel: "USA.gov elected officials" } : {}),
    },
    {
      ...base,
      id: id("council"),
      kind: "official",
      name: "Local council",
      subtitle: city + " · Legislative body",
      summary: "The elected body that adopts local laws and the local budget. Its meetings are usually open to the public.",
      scope: "local",
      topics: [id("housing"), id("transit"), id("spaces")],
      monogram: "LC",
      office: { title: "Council or commission", jurisdiction: city, ...(us ? { directoryUrl: usa.officials } : {}) },
      ...(us ? { sourceUrl: usa.officials, sourceLabel: "USA.gov elected officials" } : {}),
    },
    {
      ...base,
      id: id("region"),
      kind: "official",
      name: us ? "County government" : "Regional government",
      subtitle: (locale.region || city) + " · Governing body",
      summary: "The next level of local government, often responsible for courts, health services, roads and elections.",
      scope: "local",
      topics: [id("transit")],
      monogram: us ? "CO" : "RG",
      office: { title: us ? "County government" : "Regional government", jurisdiction: locale.region || city, ...(us ? { directoryUrl: usa.officials } : {}) },
      ...(us ? { sourceUrl: usa.officials, sourceLabel: "USA.gov elected officials" } : {}),
    },
    {
      ...base,
      id: id("legislators"),
      kind: "official",
      name: us ? "State legislators for " + city : "Legislators for " + city,
      subtitle: (locale.region || "Regional") + " · Elected offices",
      summary: "The legislators who represent " + city + " and vote on laws and budgets beyond the local level.",
      scope: "local",
      monogram: us ? "ST" : "LG",
      office: { title: us ? "State legislators" : "Legislators", jurisdiction: city, ...(us ? { directoryUrl: usa.officials } : {}) },
      ...(us ? { sourceUrl: usa.officials, sourceLabel: "USA.gov elected officials" } : {}),
    },
    ...(us
      ? [
          {
            ...base,
            id: id("congress"),
            kind: "official" as const,
            name: "Members of Congress for " + city,
            subtitle: "United States · Elected offices",
            summary: "The U.S. Representative and Senators who represent " + city + ". Find them with the official lookups.",
            scope: "local" as const,
            monogram: "US",
            office: { title: "U.S. Congress", jurisdiction: city, directoryUrl: usa.house },
            sourceUrl: usa.senate,
            sourceLabel: "U.S. Senate directory",
          },
          {
            ...base,
            id: id("elections"),
            kind: "elections" as const,
            name: "Register and find your polling place",
            subtitle: "Official U.S. election information",
            summary: "Your polling place and deadlines depend on your registered address. Check the official site for your state.",
            scope: "local" as const,
            sourceUrl: usa.vote,
            sourceLabel: "Vote.gov",
          },
        ]
      : []),
    ...(campus
      ? [
          {
            ...base,
            id: id("student-government"),
            kind: "official" as const,
            name: locale.shortName + " student government",
            subtitle: campus + " · Student government",
            summary: "The elected student body that represents students to the administration. Check the university's site for current officers.",
            scope: "campus" as const,
            topics: [id("student-voice")],
            monogram: "SG",
            office: { title: "Student government", jurisdiction: campus },
          },
          {
            ...base,
            id: id("administration"),
            kind: "official" as const,
            name: campus + " administration",
            subtitle: campus + " · University leadership",
            summary: "University leadership responsible for campus-wide policies and budgets.",
            scope: "campus" as const,
            topics: [id("student-voice")],
            monogram: "AD",
            office: { title: "University administration", jurisdiction: campus },
          },
        ]
      : []),
    question("q-getting-around", "What would make getting around " + city + " easier?", "Share the trips that are hardest today and what would change them.", [id("transit")], true),
    question(
      "q-homes",
      "Should " + city + " allow more homes near jobs, campuses and transit?",
      "More homes near daily destinations could ease rents but change neighborhoods. What trade-offs matter to you?",
      [id("housing")],
      false,
    ),
    question("q-public-space", "Which public space in " + city + " needs the most care?", "Name a park, library, street or plaza and what would make it better.", [id("spaces")], true),
    ...(campus
      ? [question("q-student-priorities", "What should " + locale.shortName + " student government focus on this semester?", "Share one priority and why it matters to you.", [id("student-voice")], true, "campus")]
      : []),
    ...places.map(
      (p): CivicEntity => ({
        ...base,
        id: p.id,
        kind: p.kind,
        name: p.name,
        subtitle: p.subtitle,
        summary: p.subtitle + " in " + city + ", listed in OpenStreetMap.",
        scope: p.kind === "building" && campus ? "campus" : "local",
        location: { lat: p.latitude, lng: p.longitude, label: p.subtitle, approximate: false },
        sourceUrl: p.website ?? "https://www.openstreetmap.org/" + p.sourceRef,
        sourceLabel: p.website ? "Official website" : "OpenStreetMap",
      }),
    ),
    localDecisionsGuide(cid, city, "local council", us),
  ];
  return entities;

  function question(
    suffix: string,
    name: string,
    summary: string,
    topics: string[],
    openEnded: boolean,
    scope: CivicEntity["scope"] = "local",
  ): CivicEntity {
    return {
      ...base,
      id: id(suffix),
      kind: "question",
      name,
      subtitle: "Starter question",
      summary,
      scope,
      topics,
      sample: true,
      debate: {
        openEnded,
        context: "A Polis starter question for any community. Share what you know from your own experience here.",
        perspectives: openEnded
          ? [
              { label: "Ideas people share", points: ["Specific places and times are more useful than general complaints.", "Small fixes can matter as much as big projects."] },
              { label: "Things to weigh", points: ["Who benefits and who carries the cost?", "What could be tried first and measured?"] },
            ]
          : [
              { label: "Reasons people support it", points: ["More supply can ease competition for homes.", "Living closer to daily trips cuts time and cost."] },
              { label: "Concerns people raise", points: ["Neighborhood character, traffic and infrastructure.", "New homes may not be affordable without requirements."] },
            ],
        documents: [],
        openedAt: "2026-09-27T00:00:00.000Z",
      },
    };
  }
}
