import type { Campus } from "./types.ts";
// Invitation destinations are configuration, not claims of enrollment or content coverage.
// A campus entry drives map position, local catalog and email-domain association;
// adding a university means adding one entry and its civic catalog, not new pages.
export type PilotCommunity = {
  id: string;
  name: string;
  slug: string;
  locationLabel: string;
  campus?: Campus;
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
