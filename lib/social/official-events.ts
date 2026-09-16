import type { CommunityEvent } from "./types.ts";

// Reviewed organizer catalog, not synthetic social activity. Stable occurrence IDs
// make curator imports additive and repeatable. Recheck sources before later imports.
const checkedAt = "2026-09-16T13:00:00.000Z";
const base = {
  checkedAt,
  city: "Ithaca",
  timezone: "America/New_York",
  latitude: null,
  longitude: null,
  imageUrl: "",
  cost: "unknown",
  costDetails: "",
  accessibility: "",
  registration: "",
  registrationUrl: "",
  issueId: "",
  status: "published",
  sample: false,
} as const;
const occurrence = (
  e: Omit<CommunityEvent, keyof typeof base> & Partial<CommunityEvent>,
): CommunityEvent => ({ ...base, ...e });
const market = {
  title: "Ithaca Farmers Market",
  seriesId: "ithaca-farmers-market",
  description:
    "Farm products, prepared food and handmade goods at Steamboat Landing.",
  organizer: "Ithaca Farmers Market",
  venue: "Steamboat Landing pavilion",
  address: "545 Third Street, Ithaca, NY 14850",
  category: "food_markets" as const,
  // The organizer's Get Directions link supplies this approximate venue location.
  latitude: 42.4510128,
  longitude: -76.5093048,
};
const festival = {
  seriesId: "apple-harvest-2026",
  title: "Apple Harvest Festival",
  description:
    "A downtown harvest celebration with local vendors, food, crafts and performances.",
  organizer: "Downtown Ithaca Alliance",
  venue: "Ithaca Commons and surrounding streets",
  address: "Downtown Ithaca, NY",
  sourceUrl: "https://www.downtownithaca.com/apple-harvest-festival/",
  category: "festivals_parades" as const,
  cost: "free" as const,
  costDetails: "Free festival admission; purchases are separate.",
  imageUrl:
    "https://www.downtownithaca.com/wp-content/uploads/Apple-Harvest-Festival-Performance-scaled.jpg",
};
const arts = {
  organizer: "Downtown Ithaca Alliance",
  venue: "Sound on Sound Mini Mobile Stage",
  address: "W. State Street at Geneva Street, Ithaca, NY",
  sourceUrl: "https://www.downtownithaca.com/welcome-students-apple-harvest/",
  category: "arts_culture" as const,
  cost: "free" as const,
  costDetails: "Free performance during Apple Harvest.",
};
const garden = {
  title: "Sunday Botanic Gardens Highlights Tour",
  seriesId: "cornell-sunday-garden-tour",
  description:
    "A guided walk around the cultivated gardens. Severe weather may cancel the tour.",
  organizer: "Cornell Botanic Gardens",
  venue: "Brian C. Nevin Welcome Center",
  address: "124 Comstock Knoll Road, Ithaca, NY 14850",
  sourceUrl:
    "https://events.cornell.edu/event/sunday-botanic-gardens-highlights-tour",
  latitude: 42.449335,
  longitude: -76.472658,
  imageUrl:
    "https://localist-images.azureedge.net/photos/52649389346979/huge/714b145b4812d07c570b4744863542d2fdf0695b.jpg",
  category: "outdoors" as const,
  cost: "free" as const,
  costDetails: "Free; donations welcome.",
  registration: "No advance registration required, according to the organizer.",
};
const volunteer = {
  seriesId: "apple-harvest-volunteer-2026",
  title: "Help prepare Apple Harvest",
  description:
    "Help mark vendor spaces and organize signage and festival materials.",
  organizer: "Downtown Ithaca Alliance",
  venue: "Downtown Ithaca · meeting point to be confirmed",
  address: "Ithaca Commons area, Ithaca, NY",
  category: "volunteering" as const,
  sourceUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLScHTJud9qGOdq1P95K2MVIv3vhaq-Cf0WMW3117u3Lyp7BsSw/viewform",
  registrationUrl:
    "https://docs.google.com/forms/d/e/1FAIpQLScHTJud9qGOdq1P95K2MVIv3vhaq-Cf0WMW3117u3Lyp7BsSw/viewform",
  registration:
    "Submit the organizer signup and required waiver. The organizer confirms your shift and meeting point; a Polis plan does not reserve a place.",
};
export const officialEvents: CommunityEvent[] = [
  ...["2026-09-19", "2026-09-26", "2026-10-03"].map((day) =>
    occurrence({
      ...market,
      id: `market-saturday-${day}`,
      sourceUrl: "https://ithacamarket.com/home/",
      startsAt: day + "T13:00:00.000Z",
      endsAt: day + "T19:00:00.000Z",
    }),
  ),
  ...["2026-09-20", "2026-09-27"].map((day) =>
    occurrence({
      ...market,
      id: `market-sunday-${day}`,
      sourceUrl: "https://ithacamarket.com/markets/sunday-at-the-pavilion/",
      startsAt: day + "T14:00:00.000Z",
      endsAt: day + "T19:00:00.000Z",
    }),
  ),
  occurrence({
    ...festival,
    id: "apple-harvest-2026-09-25",
    startsAt: "2026-09-25T16:00:00.000Z",
    endsAt: "2026-09-26T00:00:00.000Z",
  }),
  ...["2026-09-26", "2026-09-27"].map((day) =>
    occurrence({
      ...festival,
      id: `apple-harvest-${day}`,
      startsAt: day + "T14:00:00.000Z",
      endsAt: day + "T22:00:00.000Z",
    }),
  ),
  occurrence({
    ...arts,
    id: "student-showcase-2026-09-25",
    seriesId: "apple-harvest-student-showcase",
    title: "Apple Harvest Student Showcase",
    description:
      "Student performers from Cornell and Ithaca College take the stage.",
    startsAt: "2026-09-25T20:00:00.000Z",
    endsAt: "2026-09-25T22:00:00.000Z",
  }),
  occurrence({
    ...arts,
    id: "double-tiger-2026-09-25",
    seriesId: "apple-harvest-double-tiger",
    title: "Double Tiger at Apple Harvest",
    description: "A roots-reggae and dub performance during Apple Harvest.",
    startsAt: "2026-09-25T22:30:00.000Z",
    endsAt: "2026-09-26T00:00:00.000Z",
  }),
  ...["2026-09-20", "2026-09-27", "2026-10-04"].map((day) =>
    occurrence({
      ...garden,
      id: `cornell-garden-tour-${day}`,
      startsAt: day + "T14:00:00.000Z",
      endsAt: day + "T15:00:00.000Z",
    }),
  ),
  occurrence({
    ...volunteer,
    id: "apple-harvest-volunteer-2026-09-24-noon",
    startsAt: "2026-09-24T16:00:00.000Z",
    endsAt: "2026-09-24T19:00:00.000Z",
  }),
  occurrence({
    ...volunteer,
    id: "apple-harvest-volunteer-2026-09-24-afternoon",
    startsAt: "2026-09-24T19:00:00.000Z",
    endsAt: "2026-09-24T22:00:00.000Z",
  }),
  occurrence({
    id: "ithaca-council-2026-09-16",
    seriesId: "ithaca-council-session-b",
    title: "Common Council · Committee of the Whole B",
    description:
      "A City of Ithaca committee meeting. The official calendar links to its agenda.",
    organizer: "City of Ithaca",
    venue: "City Hall · third-floor Council Chambers",
    address: "108 E Green Street, Ithaca, NY 14850",
    category: "civic_meetings",
    sourceUrl:
      "https://www.cityofithacany.gov/Calendar.aspx?EID=5761&calType=0&day=16&month=9&year=2026",
    startsAt: "2026-09-16T22:00:00.000Z",
    endsAt: "2026-09-17T01:00:00.000Z",
  }),
  occurrence({
    id: "ithaca-planning-2026-09-22",
    seriesId: "ithaca-planning-board",
    title: "Planning and Development Board",
    description:
      "A City of Ithaca board meeting. Check the official calendar for agenda and updates.",
    organizer: "City of Ithaca",
    venue: "City Hall · third-floor Council Chambers",
    address: "108 E Green Street, Ithaca, NY 14850",
    category: "civic_meetings",
    sourceUrl:
      "https://www.cityofithacany.gov/Calendar.aspx?EID=6571&calType=0&day=16&month=9&year=2026",
    startsAt: "2026-09-22T22:00:00.000Z",
    endsAt: "2026-09-23T02:00:00.000Z",
  }),
];
