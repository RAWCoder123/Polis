import type { CommunityPlace, EntityKind, PlaceSuggestion } from "./types.ts";

// Server-side lookups against OpenStreetMap services. Requests carry only a
// typed place name or a community center (or a member's rounded coordinates
// when they explicitly ask "use my location"), identify Polis in the
// User-Agent, and are made on demand, never in bulk.
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const nominatim = "https://nominatim.openstreetmap.org";
// Public Overpass instances, tried in order; each has its own fair-use policy.
const overpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const headers = (contact: string) => ({
  "User-Agent": "Polis civic community pilot (" + contact + ")",
  Accept: "application/json",
});

type NominatimResult = {
  lat: string;
  lon: string;
  addresstype?: string;
  name?: string;
  address?: Record<string, string>;
};
const settlementKeys = ["city", "town", "village", "municipality", "hamlet", "borough", "suburb", "county"];
function suggestion(r: NominatimResult): PlaceSuggestion | null {
  const a = r.address ?? {};
  const city = settlementKeys.map((k) => a[k]).find(Boolean) ?? r.name ?? "";
  const lat = Number(r.lat), lon = Number(r.lon);
  if (!city || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const region = a.state ?? a.province ?? a.region ?? "";
  const country = (a.country_code ?? "").toUpperCase();
  return {
    label: [city, region, a.country].filter(Boolean).join(", "),
    city: city.slice(0, 80),
    region: region.slice(0, 80),
    country: /^[A-Z]{2}$/.test(country) ? country : "",
    latitude: Math.round(lat * 10000) / 10000,
    longitude: Math.round(lon * 10000) / 10000,
  };
}

export async function searchPlaces(query: string, fetcher: Fetcher, contact: string): Promise<PlaceSuggestion[]> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const url = nominatim + "/search?format=jsonv2&addressdetails=1&limit=8&q=" + encodeURIComponent(q);
  const r = await fetcher(url, { headers: headers(contact), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("Place search is unavailable right now.");
  const seen = new Set<string>();
  return ((await r.json()) as NominatimResult[])
    .filter((x) => !x.addresstype || settlementKeys.includes(x.addresstype) || x.addresstype === "state_district")
    .map(suggestion)
    .filter((s): s is PlaceSuggestion => !!s && !seen.has(s.label) && !!seen.add(s.label))
    .slice(0, 6);
}

export async function reversePlace(latitude: number, longitude: number, fetcher: Fetcher, contact: string) {
  // About 1 km precision is enough to name a town.
  const lat = Math.round(latitude * 100) / 100, lon = Math.round(longitude * 100) / 100;
  const url = nominatim + "/reverse?format=jsonv2&addressdetails=1&zoom=10&lat=" + lat + "&lon=" + lon;
  const r = await fetcher(url, { headers: headers(contact), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("Place lookup is unavailable right now.");
  return suggestion((await r.json()) as NominatimResult);
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
// Civic places only: government, justice, libraries, public gathering places,
// campuses and parks. Commercial places are deliberately excluded.
const civicTypes: { match: (t: Record<string, string>) => boolean; kind: EntityKind; subtitle: string }[] = [
  { match: (t) => t.amenity === "townhall", kind: "institution", subtitle: "City or town hall" },
  { match: (t) => t.office === "government", kind: "institution", subtitle: "Government office" },
  { match: (t) => t.amenity === "courthouse", kind: "institution", subtitle: "Courthouse" },
  { match: (t) => t.amenity === "library", kind: "institution", subtitle: "Library" },
  { match: (t) => t.amenity === "university" || t.amenity === "college", kind: "building", subtitle: "University or college" },
  { match: (t) => t.amenity === "community_centre", kind: "place", subtitle: "Community center" },
  { match: (t) => t.amenity === "marketplace", kind: "place", subtitle: "Market" },
  { match: (t) => t.amenity === "arts_centre", kind: "place", subtitle: "Arts center" },
  { match: (t) => t.leisure === "park", kind: "place", subtitle: "Park" },
  { match: (t) => t.amenity === "fire_station", kind: "institution", subtitle: "Fire station" },
  { match: (t) => t.amenity === "police", kind: "institution", subtitle: "Police station" },
  { match: (t) => t.amenity === "post_office", kind: "institution", subtitle: "Post office" },
];
// A bounding box and exact tag matches keep the query cheap for the public
// Overpass service (regular expressions with "around" time out).
export function civicQuery(center: [number, number], radiusKm = 3.5) {
  const dLat = radiusKm / 111;
  const dLng = dLat / Math.max(0.2, Math.cos((center[0] * Math.PI) / 180));
  const box = [center[0] - dLat, center[1] - dLng, center[0] + dLat, center[1] + dLng].map((n) => n.toFixed(5)).join(",");
  const tags = [
    ...["townhall", "courthouse", "library", "community_centre", "police", "fire_station", "marketplace", "arts_centre", "university", "college", "post_office"].map(
      (v) => `nwr["amenity"="${v}"]["name"];`,
    ),
    `nwr["office"="government"]["name"];`,
    `nwr["leisure"="park"]["name"];`,
  ].join("");
  return `[out:json][timeout:20][bbox:${box}];(${tags});out tags center 200;`;
}
export function placesFromOverpass(
  communityId: string,
  center: [number, number],
  elements: OverpassElement[],
  limit = 60,
): CommunityPlace[] {
  const seen = new Set<string>();
  const places: (CommunityPlace & { rank: number; distance: number })[] = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const name = (t.name ?? "").trim().slice(0, 120);
    const rank = civicTypes.findIndex((c) => c.match(t));
    if (rank < 0 || !name || lat === undefined || lon === undefined) continue;
    const type = civicTypes[rank];
    const key = type.subtitle + "|" + name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const site = t.website ?? t["contact:website"] ?? "";
    places.push({
      id: "osm-" + e.type + "-" + e.id,
      communityId,
      kind: type.kind,
      name,
      subtitle: type.subtitle,
      latitude: Math.round(lat * 100000) / 100000,
      longitude: Math.round(lon * 100000) / 100000,
      source: "openstreetmap",
      sourceRef: e.type + "/" + e.id,
      website: /^https:\/\/[^\s]+$/.test(site) && site.length <= 300 ? site : null,
      rank,
      distance: Math.hypot(lat - center[0], (lon - center[1]) * Math.cos((center[0] * Math.PI) / 180)),
    });
  }
  return places
    .sort((a, b) => a.rank - b.rank || a.distance - b.distance)
    .slice(0, limit)
    .map((p) => {
      const place: Partial<typeof p> = { ...p };
      delete place.rank;
      delete place.distance;
      return place as CommunityPlace;
    });
}
export async function civicPlacesNear(
  communityId: string,
  center: [number, number],
  fetcher: Fetcher,
  contact: string,
  retryDelayMs = 2500,
): Promise<CommunityPlace[]> {
  const busy = "Public place data is busy right now. Try again in a few minutes.";
  let lastError = "Public place data is unavailable right now. Try again later.";
  const deadline = Date.now() + 50000;
  for (const endpoint of overpassEndpoints) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 3000) throw new Error(lastError);
      let status = 0;
      try {
        const r = await fetcher(endpoint, {
          method: "POST",
          headers: { ...headers(contact), "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(civicQuery(center)),
          signal: AbortSignal.timeout(Math.min(20000, left)),
        });
        status = r.status;
        // Rate limits and overloads can arrive as XML or HTML pages, or as a
        // JSON "remark" with no elements; none of them mean "no places".
        const body = parse(await r.text());
        if (r.ok && body && !/runtime error|timed out|rate_limited/i.test(body.remark ?? ""))
          return placesFromOverpass(communityId, center, body.elements ?? []);
        lastError = busy;
        if (body?.remark) status = 429;
      } catch {
        // Unreachable or too slow: try the next public instance.
        break;
      }
      // Per-client slot limits and gateway timeouts usually clear in seconds.
      if (status !== 429 && status !== 504) break;
      if (retryDelayMs) await new Promise((done) => setTimeout(done, retryDelayMs));
    }
  }
  throw new Error(lastError);
}
function parse(text: string): { elements?: OverpassElement[]; remark?: string } | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}
