// Invitation destinations are configuration, not claims of enrollment or content coverage.
export const pilotCommunities = [
  { id: "polis", name: "Polis commons", slug: "polis", locationLabel: "Open community" },
  { id: "ithaca", name: "Cornell / Ithaca", slug: "cornell-ithaca", locationLabel: "Ithaca, NY" },
  { id: "uf", name: "UF / Gainesville", slug: "uf-gainesville", locationLabel: "Gainesville, FL" },
  { id: "emory", name: "Emory University", slug: "emory", locationLabel: "Emory community" },
] as const;
export type PilotCommunity = { id: string; name: string; slug: string; locationLabel: string };
export const defaultCommunityId = "ithaca";
// Open signup never grants access to an existing invitation-only community.
export const openCommunityId = "polis";
export const communityFor = (id: string) => pilotCommunities.find(c => c.id === id);

// Approximate city centers for orientation, never a person's device location.
export const cityCenters: Record<string, [number, number]> = {
  ithaca: [42.444, -76.498],
  gainesville: [29.6516, -82.3248],
};
