// Invitation destinations are configuration, not claims of enrollment or content coverage.
export const pilotCommunities = [
  { id: "polis", name: "Polis commons", slug: "polis", locationLabel: "Open community" },
  { id: "ithaca", name: "Cornell / Ithaca", slug: "cornell-ithaca", locationLabel: "Ithaca, NY" },
  { id: "emory", name: "Emory University", slug: "emory", locationLabel: "Emory community" },
] as const;
export type PilotCommunity = { id: string; name: string; slug: string; locationLabel: string };
export const defaultCommunityId = "ithaca";
// Open signup never grants access to an existing invitation-only community.
export const openCommunityId = "polis";
export const communityFor = (id: string) => pilotCommunities.find(c => c.id === id);
