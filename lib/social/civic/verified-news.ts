import type { CivicEntity } from "../types.ts";
const url = "https://riley.house.gov/2026/09/19/riley-helps-pass-bipartisan-bill-to-hold-data-centers-accountable-lower-utility-bills-for-upstate-new-yorkers/";
// An attributed office statement, not independent reporting or a popularity score.
export const verifiedNews: CivicEntity[] = ["ithaca", "uf"].map(communityId => ({
  id: "news-data-center-costs-" + communityId,
  communityId, kind: "news", scope: "national", name: "Who pays for data centers’ grid upgrades?",
  subtitle: "National · Congressional office statement",
  summary: "Representative Josh Riley’s office describes a House bill concerning the cost of grid upgrades for large data centers. Read the original statement and its linked bill text before forming a view.",
  details: ["This is an attributed congressional press release. It is not independent reporting, proof that the bill became law, or an endorsement by Polis."],
  sourceUrl: url, sourceLabel: "Office of Rep. Josh Riley", checkedAt: "2026-09-26",
  news: { source: "Office of Rep. Josh Riley · Press release", publishedAt: "2026-09-19T12:00:00.000Z", url },
  topics: [], related: communityId === "ithaca" ? ["official-josh-riley"] : [], sample: false,
}));
