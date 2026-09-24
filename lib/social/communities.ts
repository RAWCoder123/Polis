// Invitation destinations are configuration, not claims of enrollment or content coverage.
export const pilotCommunities = [
  { id: "ithaca", name: "Cornell / Ithaca", slug: "cornell-ithaca", locationLabel: "Ithaca, NY" },
  { id: "emory", name: "Emory University", slug: "emory", locationLabel: "Emory community" },
] as const;
export type PilotCommunity = { id: string; name: string; slug: string; locationLabel: string };
export const defaultCommunityId = "ithaca";
export const communityFor = (id: string) => pilotCommunities.find(c => c.id === id);
