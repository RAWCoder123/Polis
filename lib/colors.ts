import type { EntityKind } from "./social/types.ts";
import type { NewsCategory } from "./social/local-news.ts";

// Color that tells things apart at a glance: kinds of news, kinds of places
// and offices, and a politician's party. Cobalt stays the color of actions.
// Members' perspectives never use party colors, and no one is assigned one.

export const categoryColors: Record<NewsCategory, string> = {
  safety: "#e03131",
  housing: "#f76707",
  money: "#2b8a3e",
  rights: "#7048e8",
  health: "#d6336c",
  campus: "#3659e3",
  transit: "#0ca678",
  government: "#364fc7",
  weather: "#1c7ed6",
  culture: "#f59f00",
  other: "#5c6b82",
};

export const kindColors: Record<EntityKind, string> = {
  official: "#17233b",
  institution: "#475d85",
  elections: "#1c7ed6",
  meeting: "#e8590c",
  building: "#5f3dc4",
  place: "#2b8a3e",
  organization: "#ae3ec9",
  issue: "#3659e3",
  policy: "#f76707",
  project: "#f59f00",
  news: "#e03131",
  guide: "#0ca678",
  question: "#3659e3",
};

// Only for officials whose party comes from a checked source.
export function partyColor(party?: string | null) {
  if (!party) return null;
  if (/^republican/i.test(party)) return { label: "Republican", color: "#d9363e", tint: "#fde8e8" };
  if (/^democrat/i.test(party)) return { label: "Democrat", color: "#2563eb", tint: "#e6eeff" };
  return { label: party, color: "#7c5cbf", tint: "#f1ecfb" };
}
