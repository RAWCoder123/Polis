import { items } from "../polis-data.ts";
export const communityId = "ithaca";
export const issues = [
  {
    id: "housing",
    name: "Housing affordability",
    description: "Homes, affordability, and how our neighborhoods grow.",
    items: ["homes", "housing-news", "priya", "housing-meeting"],
    source: "https://www.cityofithaca.org/",
  },
  {
    id: "transit",
    name: "Getting around Ithaca",
    description: "Bus access, reliable service, and everyday journeys.",
    items: ["buses", "transit-news", "daniel", "transit-walk"],
    source: "https://tcatbus.com/",
  },
  {
    id: "spaces",
    name: "Our shared spaces",
    description: "Public paths, green spaces, and places to gather.",
    items: ["parks", "parks-news", "elise", "creek-cleanup"],
    source: "https://www.cityofithaca.org/",
  },
  {
    id: "learning",
    name: "Learning & libraries",
    description: "Access to learning and welcoming community spaces.",
    items: ["school", "library-forum"],
    source: "https://www.tcpl.org/",
  },
];
export const issueFor = (subjectId: string) =>
  issues.find((i) => i.id === subjectId || i.items.includes(subjectId));
export const subjectTitle = (id: string) =>
  items.find((i) => i.id === id)?.title ??
  issues.find((i) => i.id === id)?.name ??
  "Local conversation";
export const eventStart = (id: string) =>
  ({
    "housing-meeting": "2026-09-12T22:00:00.000Z",
    "creek-cleanup": "2026-09-14T13:00:00.000Z",
    "transit-walk": "2026-09-13T19:00:00.000Z",
    "library-forum": "2026-09-15T21:30:00.000Z",
  })[id];
