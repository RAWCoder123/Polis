import type { Campus, Locality } from "./types.ts";
// Invitation destinations are configuration, not claims of enrollment or content coverage.
// A campus entry drives map position, local catalog and email-domain association;
// adding a university means adding one entry and its civic catalog, not new pages.
export type PilotCommunity = {
  id: string;
  name: string;
  slug: string;
  locationLabel: string;
  campus?: Campus;
  // Set for city and town communities created by members.
  locality?: Locality;
  // True for communities stored in the database rather than configuration.
  dynamic?: boolean;
};
export const pilotCommunities: PilotCommunity[] = [
  { id: "polis", name: "Polis commons", slug: "polis", locationLabel: "Open community" },
  {
    // The stable ID predates multi-campus support; existing rows reference it.
    id: "ithaca",
    name: "Cornell / Ithaca",
    slug: "cornell-ithaca",
    locationLabel: "Ithaca, NY",
    campus: {
      university: "Cornell University",
      shortName: "Cornell",
      domains: ["cornell.edu"],
      city: "Ithaca",
      country: "US",
      state: "NY",
      center: [42.447, -76.488],
      zoom: 14,
      timezone: "America/New_York",
      accent: "#b31b1b",
      monogram: "C",
    },
  },
  {
    id: "uf",
    name: "UF / Gainesville",
    slug: "uf-gainesville",
    locationLabel: "Gainesville, FL",
    campus: {
      university: "University of Florida",
      shortName: "UF",
      domains: ["ufl.edu"],
      city: "Gainesville",
      country: "US",
      state: "FL",
      center: [29.6485, -82.3375],
      zoom: 14,
      timezone: "America/New_York",
      accent: "#0021a5",
      monogram: "UF",
    },
  },
  {
    id: "emory",
    name: "Emory University",
    slug: "emory",
    locationLabel: "Emory community",
    campus: {
      university: "Emory University",
      shortName: "Emory",
      // Invitation-only until its organizer chooses email-domain association.
      domains: [],
      city: "Atlanta",
      country: "US",
      state: "GA",
      center: [33.7925, -84.324],
      zoom: 15,
      timezone: "America/New_York",
      accent: "#012169",
      monogram: "E",
    },
  },
];
export const defaultCommunityId = "ithaca";
// Open signup never grants access to an existing invitation-only community.
export const openCommunityId = "polis";
export const communityFor = (id: string) => pilotCommunities.find(c => c.id === id);

// Approximate city centers for orientation, never a person's device location.
export const cityCenters: Record<string, [number, number]> = {
  ithaca: [42.444, -76.498],
  gainesville: [29.6516, -82.3248],
};

export function emailDomain(email: string) {
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).trim().toLowerCase().replace(/\.$/, "") : "";
}
// Only the trusted, authenticated sign-in email may be passed here. Matching is
// exact, so `alumni.cornell.edu` or `cornell.edu.example` never match. A match is
// community association, not proof of current student status.
export function communityForEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain) return undefined;
  return pilotCommunities.find(c => c.campus?.domains.includes(domain));
}

// One shape for "where is this community" whether it is a configured campus,
// a campus founded by its students, or a city or town.
export type Locale = {
  label: string;
  shortName: string;
  city: string;
  region: string;
  country: string;
  center: [number, number];
  zoom: number;
  timezone: string;
  university?: string;
};
export function localeOf(c?: PilotCommunity | null): Locale | undefined {
  if (c?.campus)
    return {
      label: c.campus.university,
      shortName: c.campus.shortName,
      city: c.campus.city,
      region: c.campus.state,
      country: c.campus.country ?? "",
      center: c.campus.center,
      zoom: c.campus.zoom,
      timezone: c.campus.timezone,
      university: c.campus.university,
    };
  if (c?.locality)
    return {
      label: c.name,
      shortName: c.locality.city,
      city: c.locality.city,
      region: c.locality.region,
      country: c.locality.country,
      center: c.locality.center,
      zoom: c.locality.zoom,
      timezone: c.locality.timezone,
    };
  return undefined;
}
// Founding a campus community requires a plain institutional domain such as
// umich.edu or ox.ac.uk. Subdomains (alumni., g., mail.) are excluded so a
// forwarding or alumni address cannot found or join a student community.
export function campusDomainOf(email: string) {
  const domain = emailDomain(email);
  const parts = domain.split(".");
  if (parts.length === 2 && parts[1] === "edu" && /^[a-z0-9-]{2,63}$/.test(parts[0])) return domain;
  if (parts.length === 3 && ["ac", "edu"].includes(parts[1]) && /^[a-z]{2}$/.test(parts[2]) && /^[a-z0-9-]{2,63}$/.test(parts[0]))
    return domain;
  return null;
}
export type PlaceCommunityRow = {
  id: string;
  kind: string;
  name: string;
  locationLabel: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  domain: string | null;
  university: string | null;
};
export function communityFromRow(row: PlaceCommunityRow): PilotCommunity {
  const center: [number, number] = [row.latitude, row.longitude];
  if (row.kind === "campus")
    return {
      id: row.id,
      name: row.name,
      slug: row.id,
      locationLabel: row.locationLabel,
      dynamic: true,
      campus: {
        university: row.university ?? row.name,
        shortName: shortNameFor(row.university ?? row.name),
        domains: row.domain ? [row.domain] : [],
        city: row.city,
        state: row.region,
        country: row.country,
        center,
        zoom: 15,
        timezone: row.timezone,
        accent: "#3659e3",
        monogram: shortNameFor(row.university ?? row.name).slice(0, 3),
      },
    };
  return {
    id: row.id,
    name: row.name,
    slug: row.id,
    locationLabel: row.locationLabel,
    dynamic: true,
    locality: { city: row.city, region: row.region, country: row.country, center, zoom: 13, timezone: row.timezone },
  };
}
// "University of Michigan" -> "Michigan"; "Boston College" -> "Boston College".
export function shortNameFor(name: string) {
  const trimmed = name.trim();
  const m = /^(?:The\s+)?University of (?:the\s+)?(.+)$/i.exec(trimmed);
  if (m) return m[1].split(/[,–-]/)[0].trim();
  return trimmed.length > 24 ? trimmed.split(/\s+/).map((w) => (/^[A-Z]/.test(w) ? w[0] : "")).join("") || trimmed.slice(0, 24) : trimmed;
}
