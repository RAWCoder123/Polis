// Small geometry helpers for the Polis map. They run on data the map has
// already loaded for the screen, so naming "the street you're on" never sends
// the device location anywhere.

export type LngLat = [number, number];
type Line = LngLat[];
export type NamedGeometry = {
  properties?: Record<string, unknown> | null;
  geometry: { type: string; coordinates: unknown };
};

// Metres between two points, flat-earth approximation (fine within a town).
function metres([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const k = Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot((lng2 - lng1) * k, lat2 - lat1) * 111_320;
}
function toSegment(p: LngLat, a: LngLat, b: LngLat) {
  const k = Math.cos(p[1] * (Math.PI / 180));
  const [ax, ay, bx, by, px, py] = [a[0] * k, a[1], b[0] * k, b[1], p[0] * k, p[1]];
  const dx = bx - ax,
    dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return metres(p, [(ax + t * dx) / k, ay + t * dy]);
}
function linesOf(geometry: NamedGeometry["geometry"]): Line[] {
  if (geometry.type === "LineString") return [geometry.coordinates as Line];
  if (geometry.type === "MultiLineString") return geometry.coordinates as Line[];
  if (geometry.type === "Point") return [[geometry.coordinates as LngLat]];
  if (geometry.type === "MultiPoint") return (geometry.coordinates as LngLat[]).map((c) => [c]);
  return [];
}
const nameOf = (f: NamedGeometry) => {
  const p = f.properties ?? {};
  const value = p["name:latin"] ?? p.name_en ?? p.name;
  return typeof value === "string" && value.trim() ? value.trim() : "";
};

// The closest named feature (street line or place point) within `withinMetres`.
export function nearestNamed(point: LngLat, features: NamedGeometry[], withinMetres = 250) {
  let best: { name: string; metres: number } | null = null;
  for (const f of features) {
    const name = nameOf(f);
    if (!name) continue;
    for (const line of linesOf(f.geometry)) {
      const d =
        line.length === 1 ? metres(point, line[0]) : Math.min(...line.slice(1).map((b, i) => toSegment(point, line[i], b)));
      if (d <= withinMetres && (!best || d < best.metres)) best = { name, metres: d };
    }
  }
  return best;
}

// Places that share one exact spot (several offices in one city hall) never
// separate by zooming, so they fan out in a small ring of pixel offsets.
export function fanOffsets<T extends { id: string; lat: number; lng: number }>(pins: T[], radius = 26) {
  const groups = new Map<string, T[]>();
  for (const p of pins) {
    const key = p.lat.toFixed(5) + "," + p.lng.toFixed(5);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const offsets = new Map<string, [number, number]>();
  for (const group of groups.values())
    group.forEach((p, i) => {
      if (group.length === 1) return offsets.set(p.id, [0, 0]);
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / group.length;
      const r = radius + Math.max(0, group.length - 4) * 5;
      offsets.set(p.id, [Math.round(Math.cos(angle) * r), Math.round(Math.sin(angle) * r)]);
    });
  return offsets;
}

// "3 places: A, B and C" — what a bubble holds, for its accessible name.
export function listPlaces(labels: string[], noun = "places") {
  const names = labels.slice(0, 5);
  const rest = labels.length - names.length;
  const joined = names.length > 1 ? names.slice(0, -1).join(", ") + (rest ? ", " + names.at(-1) : " and " + names.at(-1)) : names[0] ?? "";
  return labels.length + " " + noun + (joined ? ": " + joined + (rest ? " and " + rest + " more" : "") : "");
}
