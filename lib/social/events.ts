import { z } from "zod";
import type {
  CommunityEvent,
  EventCategory,
  EventPreferences,
} from "./types.ts";

export const eventCategories: Record<EventCategory, string> = {
  food_markets: "Food & markets",
  arts_culture: "Arts & culture",
  festivals_parades: "Festivals & parades",
  outdoors: "Outdoors",
  volunteering: "Volunteering",
  civic_meetings: "Civic meetings",
};
const category = z.enum([
  "food_markets",
  "arts_culture",
  "festivals_parades",
  "outdoors",
  "volunteering",
  "civic_meetings",
]);
const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]{2,119}$/);
const https = z
  .string()
  .max(2000)
  .url()
  .refine((s) => {
    try {
      // URL() silently normalizes controls; reject them before parsing.
      if ([...s].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
        return false;
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use an HTTPS link without credentials.");
const optionalLink = z.union([https, z.literal("")]).default("");
export const eventRecord = z.object({
  id: slug,
  seriesId: slug,
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().min(10).max(5000),
  organizer: z.string().trim().min(2).max(180),
  sourceUrl: https,
  checkedAt: z.string().datetime(),
  venue: z.string().trim().min(2).max(200),
  address: z.string().trim().max(300),
  city: z.string().trim().min(2).max(80),
  latitude: z.number().min(-85).max(85).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  imageUrl: optionalLink,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable(),
  timezone: z.string().refine((s) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: s });
      return true;
    } catch {
      return false;
    }
  }, "Choose an IANA timezone."),
  category,
  cost: z.enum(["free", "paid", "unknown"]),
  costDetails: z.string().max(300),
  accessibility: z.string().max(1000),
  registration: z.string().max(1000),
  registrationUrl: optionalLink,
  issueId: z.string().max(100).default(""),
  status: z.enum(["draft", "published", "canceled", "archived"]),
  sample: z.boolean().default(false),
});
export const eventActions = [
  z.object({
    action: z.literal("event.save"),
    event: eventRecord,
    createOnly: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("event.status"),
    eventId: slug,
    status: z.enum(["draft", "published", "canceled", "archived"]),
  }),
  z.object({
    action: z.literal("event.preferences"),
    city: z.string().trim().min(2).max(80),
    interests: z.array(category).max(6),
    complete: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("event.suggest"),
    title: z.string().trim().min(3).max(180),
    sourceUrl: https,
    note: z.string().trim().max(1000),
  }),
  z.object({
    action: z.literal("event.review"),
    suggestionId: z.string().max(180),
    status: z.enum(["reviewed", "declined"]),
  }),
  z.object({
    action: z.literal("event.metric"),
    eventId: slug,
    kind: z.enum(["event_open", "event_share"]),
  }),
] as const;

export function eventDay(iso: string, timezone = "America/New_York") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
export function eventExpired(e: CommunityEvent, now = new Date()) {
  return e.endsAt
    ? Date.parse(e.endsAt) <= +now
    : eventDay(e.startsAt, e.timezone) <
        eventDay(now.toISOString(), e.timezone);
}
export function distanceMiles(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180,
    dLat = (b[0] - a[0]) * rad,
    dLng = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export type EventFilters = {
  q?: string;
  city?: string;
  period?: string;
  from?: string;
  to?: string;
  category?: string;
  free?: boolean;
  miles?: number;
  sort?: string;
  origin?: [number, number];
};
export function discoverEvents(
  events: CommunityEvent[],
  preferences: EventPreferences,
  filters: EventFilters = {},
  now = new Date(),
) {
  const today = eventDay(now.toISOString());
  const date = new Date(today + "T12:00:00Z"),
    weekday = date.getUTCDay();
  const saturday = new Date(
    +date + (weekday === 0 ? -1 : 6 - weekday) * 86400000,
  );
  const sunday = new Date(+saturday + 86400000);
  const from =
    filters.period === "today"
      ? today
      : filters.period === "weekend"
        ? saturday.toISOString().slice(0, 10)
        : filters.period === "range"
          ? filters.from
          : undefined;
  const to =
    filters.period === "today"
      ? today
      : filters.period === "weekend"
        ? sunday.toISOString().slice(0, 10)
        : filters.period === "range"
          ? filters.to
          : undefined;
  const city = (filters.city ?? preferences.city).trim().toLowerCase();
  const result = events
    .filter((e) => e.status === "published" && !eventExpired(e, now))
    .map((e) => ({
      event: e,
      distance:
        filters.origin && e.latitude !== null && e.longitude !== null
          ? distanceMiles(filters.origin, [e.latitude, e.longitude])
          : null,
      match: preferences.interests.includes(e.category),
    }))
    .filter(({ event: e, distance }) => {
      const day = eventDay(e.startsAt, e.timezone);
      return (
        (!city || e.city.toLowerCase() === city) &&
        (!filters.q ||
          [e.title, e.description, e.venue, e.organizer]
            .join(" ")
            .toLowerCase()
            .includes(filters.q.toLowerCase())) &&
        (!from || day >= from) &&
        (!to || day <= to) &&
        (!filters.category || filters.category === e.category) &&
        (!filters.free || e.cost === "free") &&
        (!filters.miles || (distance !== null && distance <= filters.miles))
      );
    });
  result.sort((a, b) => {
    if (
      filters.sort === "date" ||
      (!preferences.interests.length && filters.sort !== "distance")
    )
      return (
        a.event.startsAt.localeCompare(b.event.startsAt) ||
        a.event.id.localeCompare(b.event.id)
      );
    if (filters.sort !== "distance" && a.match !== b.match)
      return a.match ? -1 : 1;
    return (
      (a.distance ?? Infinity) - (b.distance ?? Infinity) ||
      a.event.startsAt.localeCompare(b.event.startsAt) ||
      a.event.id.localeCompare(b.event.id)
    );
  });
  // A discovery slot adds variety without changing explicit date/distance sorting.
  if (
    (!filters.sort || filters.sort === "recommended") &&
    preferences.interests.length &&
    result.length > 3
  ) {
    const other = result.findIndex((r, i) => i >= 3 && !r.match);
    if (other > 3) result.splice(3, 0, result.splice(other, 1)[0]);
  }
  return result;
}
export function eventTime(e: CommunityEvent) {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: e.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(e.startsAt));
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: e.timezone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${date} · ${time.format(new Date(e.startsAt))}${e.endsAt ? " – " + time.format(new Date(e.endsAt)) : " · End time not supplied"}`;
}
