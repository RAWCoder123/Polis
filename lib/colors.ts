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
  // `text` is the readable shade used for the badge label on its tint.
  if (/^republican/i.test(party)) return { label: "Republican", color: "#d9363e", tint: "#fde8e8", text: "#a51d24" };
  if (/^democrat/i.test(party)) return { label: "Democrat", color: "#2563eb", tint: "#e6eeff", text: "#1a4bbf" };
  return { label: party, color: "#7c5cbf", tint: "#f1ecfb", text: "#5b3d9c" };
}

// Readable shades of a color for white text on top of it: `mid` meets WCAG AA
// for small text (4.5:1), `deep` a little more. Backgrounds with text use
// these; the bright color itself only decorates.
const channel = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
const luminance = (h: string) =>
  [0, 1, 2]
    .map((i) => channel(h, i) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
export const contrastWithWhite = (h: string) => 1.05 / (luminance(h) + 0.05);
const darken = (h: string, t: number) =>
  "#" + [0, 1, 2].map((i) => Math.round(channel(h, i) * (1 - t)).toString(16).padStart(2, "0")).join("");
function shadeFor(h: string, target: number) {
  for (let t = 0; t <= 0.9; t += 0.02) if (contrastWithWhite(darken(h, t)) >= target) return darken(h, t);
  return darken(h, 0.9);
}
export function toneVars(color: string) {
  return { "--tone": color, "--tone-mid": shadeFor(color, 4.6), "--tone-deep": shadeFor(color, 5.6) } as Record<string, string>;
}
