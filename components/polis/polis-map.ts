"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import type { GeoJSONSource, LngLatLike, Map as MapLibreMap, MapOptions, Marker, Popup } from "maplibre-gl";
import { fanOffsets } from "@/lib/map-geometry";
import { outlineLayers, polisMapStyle } from "@/lib/map-style";
import { reducedMotion } from "@/lib/motion";

// Shared set-up for the civic map and the event venue map. MapLibre is large,
// so it loads only when a map is on screen.
export type MapLibre = typeof import("maplibre-gl");
let loading: Promise<MapLibre> | null = null;
export function loadMapLibre() {
  loading ??= import("maplibre-gl").then((m) => (m as unknown as { default?: MapLibre }).default ?? m);
  return loading;
}

export type BasemapState = "loading" | "loaded" | "outline" | "failed";
// Pilot towns with a bundled OSM outline (public/maps) for when tiles fail.
const outlines: Record<string, string> = { ithaca: "ithaca", uf: "gainesville" };

export async function createBasemap(
  container: HTMLElement,
  {
    center,
    zoom,
    pitch = 0,
    bearing = 0,
    communityId = "",
    preview = false,
    onState,
  }: {
    center: [number, number]; // [lat, lng], as used across Polis
    zoom: number;
    pitch?: number;
    bearing?: number;
    communityId?: string;
    preview?: boolean;
    onState: (state: BasemapState) => void;
  },
) {
  const maplibregl = await loadMapLibre();
  const options: MapOptions = {
    container,
    // Hill shading shows the landscape; full 3D terrain is left off because it
    // lifts markers off-center, hides pins behind hills and costs phones more.
    style: polisMapStyle(),
    center: [center[1], center[0]],
    zoom,
    pitch,
    bearing,
    maxPitch: 70,
    minZoom: 3,
    maxZoom: 18.5,
    renderWorldCopies: false,
    // Pages scroll past the map; zoom with pinch, +/−, double-click or ⌘/Ctrl + scroll.
    cooperativeGestures: preview,
    scrollZoom: !preview,
    attributionControl: { compact: true },
    fadeDuration: reducedMotion() ? 0 : 280,
  };
  const map = new maplibregl.Map(options);
  if (!preview) {
    map.scrollZoom.disable();
    container.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || e.metaKey) map.scrollZoom.enable();
        else map.scrollZoom.disable();
      },
      { capture: true, passive: true },
    );
  }
  let state: BasemapState = "loading";
  const set = (next: BasemapState) => {
    if (state === next) return;
    state = next;
    onState(next);
  };
  const outline = outlines[communityId];
  let fallback = false;
  const useOutline = async () => {
    if (fallback) return;
    fallback = true;
    if (!outline) return set("failed");
    try {
      const response = await fetch("/maps/" + outline + ".geojson");
      if (!response.ok) throw new Error("Outline unavailable");
      const data = (await response.json()) as FeatureCollection;
      const add = () => {
        if (map.getSource("outline")) return;
        map.addSource("outline", {
          type: "geojson",
          data,
          attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors · ODbL</a>',
        });
        for (const layer of outlineLayers("outline")) map.addLayer(layer, "building-flat");
        set("outline");
      };
      if (map.isStyleLoaded()) add();
      else map.once("load", add);
    } catch {
      set("failed");
    }
  };
  map.on("error", (event) => {
    const source = (event as { sourceId?: string }).sourceId;
    if (state !== "loaded" && (source === "openmaptiles" || /openfreemap/i.test(String(event.error?.message))))
      void useOutline();
  });
  // The first real tile means the map works, even after a slow start fell
  // back to the outline.
  map.on("sourcedata", (event) => {
    if (event.sourceId !== "openmaptiles" || !(event as { tile?: unknown }).tile || state === "loaded") return;
    if (map.getSource("outline")) {
      for (const layer of outlineLayers("outline")) map.removeLayer(layer.id);
      map.removeSource("outline");
    }
    set("loaded");
  });
  // A network that silently drops tile requests never errors: give it a
  // while, counting only time on screen (hidden tabs do not draw maps).
  let timer = 0;
  const wait = (ms: number) => {
    timer = window.setTimeout(() => {
      if (state !== "loading") return;
      if (document.hidden) wait(3000);
      else void useOutline();
    }, ms);
  };
  wait(12000);
  map.once("remove", () => window.clearTimeout(timer));
  if (!preview) map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  // Credits show first; on phones they then fold into the ⓘ button so the
  // map stays visible. They remain one tap away.
  if (container.clientWidth < 640)
    window.setTimeout(() => container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"), 6000);
  return { maplibregl, map };
}

export type CameraMove = { center?: LngLatLike; zoom?: number; pitch?: number; bearing?: number; offset?: [number, number] };
// Glide the camera, or jump when motion is reduced.
export function moveCamera(map: MapLibreMap, { offset, ...camera }: CameraMove, duration = 1100) {
  if (reducedMotion()) map.jumpTo(camera);
  else map.easeTo({ ...camera, ...(offset ? { offset } : {}), duration, easing: (t) => 1 - Math.pow(1 - t, 3) });
}

// Places as HTML markers that group into count bubbles when they sit close
// together, like Snap Map. React renders each face into the returned hosts.
export type Basemap = { map: MapLibreMap; maplibregl: MapLibre };
// Effects can briefly outlive their map (a community change, or React's
// development re-mounts), so every use checks the map is still attached.
export const alive = (basemap: Basemap | null): basemap is Basemap =>
  !!basemap && !(basemap.map as unknown as { _removed?: boolean })._removed;
export type MarkerItem = { id: string; lat: number; lng: number; group: string };
export type ShownMarker =
  | { key: string; host: HTMLElement; kind: "pin"; id: string }
  | { key: string; host: HTMLElement; kind: "cluster"; clusterId: number; count: number; groups: string[]; lngLat: [number, number]; ids?: string[] };
const markerSource = "markers";
// At zoom 16 and closer every place stands on its own.
export const clusterMaxZoom = 15;

export function addMarkerSource(map: MapLibreMap, groups: string[]) {
  map.addSource(markerSource, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterRadius: 62,
    clusterMaxZoom,
    clusterProperties: Object.fromEntries(groups.map((g) => [g, ["+", ["case", ["==", ["get", "group"], g], 1, 0]]])),
  });
  // Invisible: it makes the source load so markers can be read from it.
  map.addLayer({ id: "markers-index", type: "circle", source: markerSource, paint: { "circle-radius": 0, "circle-opacity": 0 } });
}

export function useClusteredMarkers(basemap: Basemap | null, items: MarkerItem[], groups: string[], selected: string) {
  const [shown, setShown] = useState<ShownMarker[]>([]);
  // What each bubble holds, so it can be named and show friends' plans.
  const [leaves, setLeaves] = useState<{ key: string; ids: Record<string, string[]> }>({ key: "", ids: {} });
  const markers = useRef(new Map<string, Marker>());
  const selectedRef = useRef(selected);
  const itemKey = items.map((i) => i.id + ":" + i.lat + ":" + i.lng + ":" + i.group).join("|");
  const offsets = useMemo(() => fanOffsets(items), [items]);
  useEffect(() => {
    selectedRef.current = selected;
    for (const [key, marker] of markers.current)
      if (key.startsWith("p:")) marker.getElement().style.zIndex = key === "p:" + selected ? "3" : "";
  }, [selected]);
  useEffect(() => {
    if (!alive(basemap)) return;
    const { map, maplibregl } = basemap;
    const source = map.getSource(markerSource) as GeoJSONSource | undefined;
    if (!source) return;
    const byId = new Map(items.map((i) => [i.id, i]));
    const fan = fanOffsets(items);
    void source.setData({
      type: "FeatureCollection",
      features: items.map((i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [i.lng, i.lat] },
        properties: { id: i.id, group: i.group },
      })),
    });
    let frame = 0;
    let signature = "";
    const requested = new Set<string>();
    const sync = () => {
      frame = 0;
      type Item = Omit<Extract<ShownMarker, { kind: "pin" }>, "host"> | Omit<Extract<ShownMarker, { kind: "cluster" }>, "host">;
      const next = new Map<string, Item>();
      for (const f of map.querySourceFeatures(markerSource)) {
        const props = f.properties ?? {};
        if (props.cluster) {
          const key = "c:" + props.cluster_id;
          if (!next.has(key))
            next.set(key, {
              key,
              kind: "cluster",
              clusterId: props.cluster_id,
              count: props.point_count,
              groups: groups.filter((g) => props[g] > 0).sort((a, b) => props[b] - props[a]),
              lngLat: (f.geometry as unknown as { coordinates: [number, number] }).coordinates,
            });
        } else if (byId.has(props.id)) next.set("p:" + props.id, { key: "p:" + props.id, kind: "pin", id: props.id });
      }
      for (const [key, marker] of markers.current)
        if (!next.has(key)) {
          marker.remove();
          markers.current.delete(key);
        }
      const list: ShownMarker[] = [];
      for (const [key, item] of next) {
        let marker = markers.current.get(key);
        if (!marker) {
          const host = document.createElement("div");
          host.className = item.kind === "pin" ? "polis-marker-root" : "polis-cluster-root";
          const at: [number, number] = item.kind === "pin" ? [byId.get(item.id)!.lng, byId.get(item.id)!.lat] : item.lngLat;
          marker = new maplibregl.Marker({ element: host, anchor: item.kind === "pin" ? "bottom" : "center" }).setLngLat(at).addTo(map);
          markers.current.set(key, marker);
        }
        if (item.kind === "cluster" && !requested.has(key)) {
          requested.add(key);
          source
            .getClusterLeaves(item.clusterId, 500, 0)
            .then((features) =>
              setLeaves((current) => ({
                key: itemKey,
                ids: { ...(current.key === itemKey ? current.ids : {}), [key]: features.map((f) => String(f.properties?.id)) },
              })),
            )
            .catch(() => {});
        }
        if (item.kind === "pin") {
          marker.setOffset(fan.get(item.id) ?? [0, 0]);
          marker.getElement().style.zIndex = item.id === selectedRef.current ? "3" : "";
        }
        list.push({ ...item, host: marker.getElement() } as ShownMarker);
      }
      // Depth: on a tilted map, places toward the horizon draw a little
      // smaller, which reads as 3D and keeps distant pins from crowding.
      const tilt = Math.min(1, map.getPitch() / 60);
      const height = map.getContainer().clientHeight || 1;
      for (const marker of markers.current.values()) {
        const y = map.project(marker.getLngLat()).y / height;
        const depth = 1 - tilt * 0.34 * (1 - Math.max(0, Math.min(1, y)));
        marker.getElement().style.setProperty("--depth", depth.toFixed(3));
      }
      const nextSignature = list.map((s) => s.key + (s.kind === "cluster" ? "/" + s.count : "")).join("|");
      if (nextSignature !== signature) {
        signature = nextSignature;
        setShown(list);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    map.on("render", schedule);
    schedule();
    return () => {
      map.off("render", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
    // itemKey captures the items; their array identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, itemKey]);
  useEffect(() => {
    const current = markers.current;
    return () => {
      current.forEach((m) => m.remove());
      current.clear();
    };
  }, [basemap]);
  const zoomInto = (cluster: Extract<ShownMarker, { kind: "cluster" }>) => {
    if (!alive(basemap)) return;
    const source = basemap.map.getSource(markerSource) as GeoJSONSource | undefined;
    void source?.getClusterExpansionZoom(cluster.clusterId).then((zoom) => {
      if (alive(basemap)) moveCamera(basemap.map, { center: cluster.lngLat, zoom: Math.min(zoom + 0.4, 17) }, 800);
    });
  };
  // Whether a place currently stands alone on screen, outside any bubble.
  const standing = (id: string) => markers.current.has("p:" + id);
  const held = leaves.key === itemKey ? leaves.ids : {};
  const withLeaves = basemap ? shown.map((s) => (s.kind === "cluster" ? { ...s, ids: held[s.key] } : s)) : [];
  return { shown: withLeaves, offsets, zoomInto, standing };
}

// A preview anchored to a place, filled by React through the returned host.
// Brings the place into view at street level when it is inside a bubble.
export function useAnchoredPopup(
  basemap: Basemap | null,
  at: { id: string; lat: number; lng: number } | undefined,
  { offset = [0, 0], standing, className = "polis-popup", lift = 46 }: { offset?: [number, number]; standing: (id: string) => boolean; className?: string; lift?: number },
) {
  const [host] = useState(() => (typeof document === "undefined" ? null : document.createElement("div")));
  const popup = useRef<Popup | null>(null);
  const [dx, dy] = offset;
  useEffect(() => {
    if (!alive(basemap) || !host) return;
    const { map, maplibregl } = basemap;
    if (!at) {
      popup.current?.remove();
      return;
    }
    popup.current ??= new maplibregl.Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, maxWidth: "280px", className });
    popup.current.setOffset([dx, dy - lift]).setLngLat([at.lng, at.lat]).setDOMContent(host).addTo(map);
    if (!standing(at.id) || !map.getBounds().contains([at.lng, at.lat]))
      moveCamera(map, { center: [at.lng, at.lat], zoom: Math.max(map.getZoom(), clusterMaxZoom + 1.2), offset: [0, 70] }, 1000);
    // Only a new place or map moves the camera; standing is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, host, at?.id, at?.lat, at?.lng, dx, dy]);
  useEffect(() => {
    const current = popup.current;
    return () => {
      current?.remove();
      popup.current = null;
    };
  }, [basemap]);
  // Anchoring measures the preview; measure again once React has filled it.
  const remeasure = () => {
    const current = popup.current;
    if (current?.isOpen()) current.setLngLat(current.getLngLat());
  };
  return { host: basemap && at ? host : null, remeasure };
}
