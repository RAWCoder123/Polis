import type { CivicEntity } from "../types.ts";

// Names and photographs checked on official government profiles. These are new
// records, with no imported sample ratings or claim of image licensing.
export const verifiedPeople: CivicEntity[] = [
  {
    "id": "official-robert-cantelmo",
    "communityId": "ithaca",
    "kind": "official",
    "name": "Robert G. Cantelmo",
    "subtitle": "Mayor · Ithaca, New York",
    "summary": "Robert G. Cantelmo serves as Mayor for Ithaca, New York. Read the government profile for office information and contact details.",
    "scope": "local",
    "topics": [],
    "related": [],
    "sourceUrl": "https://www.cityofithacany.gov/131/Mayors-Office",
    "sourceLabel": "City of Ithaca",
    "sample": false,
    "imageUrl": "/images/officials/official-robert-cantelmo.jpg",
    "imageAlt": "Official portrait of Robert G. Cantelmo",
    "imageCredit": "City of Ithaca",
    "imageSourceUrl": "https://www.cityofithacany.gov/ImageRepository/Document?documentID=16454",
    "imagePosition": "left center",
    "checkedAt": "2026-09-26",
    "office": {
      "title": "Mayor",
      "jurisdiction": "Ithaca, New York",
      "officeholder": "Robert G. Cantelmo",
      "directoryUrl": "https://www.cityofithacany.gov/131/Mayors-Office"
    }
  },
  {
    "id": "official-harvey-ward",
    "communityId": "uf",
    "kind": "official",
    "name": "Harvey Ward",
    "subtitle": "Mayor · Gainesville, Florida",
    "summary": "Harvey Ward serves as Mayor for Gainesville, Florida. Read the government profile for office information and contact details.",
    "scope": "local",
    "topics": [],
    "related": [],
    "sourceUrl": "https://www.gainesvillefl.gov/City-Commission/Mayor-Harvey-Ward",
    "sourceLabel": "City of Gainesville",
    "sample": false,
    "imageUrl": "/images/officials/official-harvey-ward.jpg",
    "imageAlt": "Official portrait of Harvey Ward",
    "imageCredit": "City of Gainesville",
    "imageSourceUrl": "https://www.gainesvillefl.gov/files/assets/public/v/1/city-commission/images/harvey-ward-2025-sq.jpg?dimension=pageimage&w=480",
    "imagePosition": "center",
    "checkedAt": "2026-09-26",
    "office": {
      "title": "Mayor",
      "jurisdiction": "Gainesville, Florida",
      "officeholder": "Harvey Ward",
      "directoryUrl": "https://www.gainesvillefl.gov/City-Commission/Mayor-Harvey-Ward"
    }
  },
  {
    "id": "official-josh-riley",
    "communityId": "ithaca",
    "kind": "official",
    "name": "Josh Riley",
    "subtitle": "U.S. Representative · New York’s 19th Congressional District",
    "summary": "Josh Riley serves as U.S. Representative for New York’s 19th Congressional District. Read the government profile for office information and contact details.",
    "scope": "local",
    "topics": [],
    "related": [],
    "sourceUrl": "https://clerk.house.gov/members/R000622",
    "sourceLabel": "Office of the Clerk, U.S. House of Representatives",
    "sample": false,
    "imageUrl": "/images/officials/official-josh-riley.jpg",
    "imageAlt": "Official portrait of Josh Riley",
    "imageCredit": "Office of the Clerk, U.S. House of Representatives",
    "imageSourceUrl": "https://clerk.house.gov/images/members/R000622.jpg",
    "imagePosition": "center",
    "checkedAt": "2026-09-26",
    "office": {
      "title": "U.S. Representative",
      "jurisdiction": "New York’s 19th Congressional District",
      "officeholder": "Josh Riley",
      "party": "Democrat",
      "directoryUrl": "https://clerk.house.gov/members/R000622"
    }
  },
  {
    "id": "official-kat-cammack",
    "communityId": "uf",
    "kind": "official",
    "name": "Kat Cammack",
    "subtitle": "U.S. Representative · Florida’s 3rd Congressional District",
    "summary": "Kat Cammack serves as U.S. Representative for Florida’s 3rd Congressional District. Read the government profile for office information and contact details.",
    "scope": "local",
    "topics": [],
    "related": [],
    "sourceUrl": "https://clerk.house.gov/members/C001039",
    "sourceLabel": "Office of the Clerk, U.S. House of Representatives",
    "sample": false,
    "imageUrl": "/images/officials/official-kat-cammack.jpg",
    "imageAlt": "Official portrait of Kat Cammack",
    "imageCredit": "Office of the Clerk, U.S. House of Representatives",
    "imageSourceUrl": "https://clerk.house.gov/images/members/C001039.jpg",
    "imagePosition": "center",
    "checkedAt": "2026-09-26",
    "office": {
      "title": "U.S. Representative",
      "jurisdiction": "Florida’s 3rd Congressional District",
      "officeholder": "Kat Cammack",
      "party": "Republican",
      "directoryUrl": "https://clerk.house.gov/members/C001039"
    }
  },
  ...nationalOfficials(),
];

// The President and each campus state's two U.S. senators. Parties are from
// the Senate's state listings and the FEC's candidate record, checked
// September 29, 2026; no portraits are shown without a checked image source.
function nationalOfficials(): CivicEntity[] {
  const person = (communityId: string, slug: string, name: string, title: string, jurisdiction: string, party: string, sourceUrl: string, sourceLabel: string): CivicEntity => ({
    id: "official-" + slug + "-" + communityId,
    communityId,
    kind: "official",
    name,
    subtitle: title + " · " + jurisdiction,
    summary: name + " serves as " + title + " for " + jurisdiction + ". Read the official listing for contact details.",
    scope: "national",
    topics: [],
    related: [],
    sourceUrl,
    sourceLabel,
    sample: false,
    checkedAt: "2026-09-29",
    office: { title, jurisdiction, officeholder: name, party, directoryUrl: sourceUrl },
  });
  const president = (communityId: string) =>
    person(communityId, "president", "Donald J. Trump", "President of the United States", "United States", "Republican", "https://www.whitehouse.gov/administration/donald-j-trump/", "The White House · party per FEC candidate record P80001571");
  const ny = "https://www.senate.gov/states/NY/intro.htm";
  const fl = "https://www.senate.gov/states/FL/intro.htm";
  return [
    president("ithaca"),
    person("ithaca", "chuck-schumer", "Charles E. Schumer", "U.S. Senator", "New York", "Democrat", ny, "U.S. Senate"),
    person("ithaca", "kirsten-gillibrand", "Kirsten E. Gillibrand", "U.S. Senator", "New York", "Democrat", ny, "U.S. Senate"),
    president("uf"),
    person("uf", "rick-scott", "Rick Scott", "U.S. Senator", "Florida", "Republican", fl, "U.S. Senate"),
    person("uf", "ashley-moody", "Ashley Moody", "U.S. Senator", "Florida", "Republican", fl, "U.S. Senate"),
  ];
}
