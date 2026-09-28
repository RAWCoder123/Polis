import type * as Leaflet from "leaflet";
import type { Feature, GeoJsonObject } from "geojson";

// Local OSM-derived geometry only: no tile provider, API key or device position.
// Keep source IDs and the ODbL notice in public/maps when updating the extracts.
export async function addMapOutline(L: typeof Leaflet, map: Leaflet.Map, communityId: string, signal: AbortSignal) {
  const city = communityId === "uf" ? "gainesville" : communityId === "ithaca" ? "ithaca" : null;
  if (!city) return false;
  const response = await fetch("/maps/" + city + ".geojson", { signal });
  if (!response.ok) throw new Error("Outline unavailable");
  const geometry = await response.json() as GeoJsonObject;
  if (signal.aborted) return false;
  L.geoJSON(geometry, {
    interactive: false,
    style: (feature?: Feature) => {
      const kind = feature?.properties?.kind;
      return kind === "road" ? { color: "#ffffff", weight: 5, opacity: 1 }
        : kind === "water" ? { color: "#b9d9ed", fillColor: "#c5e1ef", weight: 2, fillOpacity: 1 }
        : kind === "campus" ? { color: "#dce4f4", fillColor: "#e8edfa", weight: 1, fillOpacity: 0.85 }
        : { color: "#d3e3d3", fillColor: "#d8e8d8", weight: 1, fillOpacity: 0.9 };
    },
  }).addTo(map);
  map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors · ODbL</a>');
  return true;
}
