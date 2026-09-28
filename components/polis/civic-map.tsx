"use client";
import "./civic.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Marker } from "maplibre-gl";
import { CalendarDays, LocateFixed, MapPin } from "lucide-react";
import type { CivicEntity, CommunityEvent, EntityKind, Snapshot } from "@/lib/social/types";
import { catalogOf } from "@/lib/social/civic";
import { distanceMiles, eventExpired, eventCategories, eventTime } from "@/lib/social/events";
import { localeOf } from "@/lib/social/communities";
import { useDeviceLocation } from "@/lib/social/use-device-location";
import { listPlaces, nearestNamed, type NamedGeometry } from "@/lib/map-geometry";
import { reducedMotion } from "@/lib/motion";
import {
  categoryIcons,
  EntitySummaryCard,
  EventSummaryCard,
  initialsFor,
  kindIcons,
} from "./civic-cards";
import {
  addMarkerSource,
  alive,
  createBasemap,
  moveCamera,
  useAnchoredPopup,
  useClusteredMarkers,
  type Basemap,
  type BasemapState,
} from "./polis-map";
import type { Navigate, Run } from "./social-post";

export type MapLayer = "all" | "people" | "government" | "campus" | "issues" | "community" | "events";
export const mapLayers: { id: MapLayer; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "people", label: "People & offices" },
  { id: "government", label: "Government & voting" },
  { id: "campus", label: "Campus" },
  { id: "issues", label: "Issues & projects" },
  { id: "community", label: "Community" },
  { id: "events", label: "Events" },
];
const layerForKind: Record<EntityKind, MapLayer> = {
  official: "people",
  institution: "government",
  elections: "government",
  meeting: "government",
  building: "campus",
  place: "community",
  organization: "community",
  issue: "issues",
  policy: "issues",
  project: "issues",
  news: "issues",
  question: "issues",
};
export type MapPinData = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  layer: MapLayer;
  entity?: CivicEntity;
  events?: CommunityEvent[];
};
// Campus places, offices and upcoming listings in one set. Occurrences at the
// same venue share a pin so repeated markets do not stack on top of each other.
export function mapPins(data: Snapshot, now = new Date()): MapPinData[] {
  const pins: MapPinData[] = catalogOf(data).flatMap((e) =>
    e.location
      ? [{
          id: e.id,
          lat: e.location.lat,
          lng: e.location.lng,
          label: e.name,
          layer: e.kind === "place" && e.scope === "campus" ? "campus" : layerForKind[e.kind],
          entity: e,
        }]
      : [],
  );
  const venues = new Map<string, CommunityEvent[]>();
  for (const ev of data.events)
    if (ev.status === "published" && !eventExpired(ev, now) && ev.latitude !== null && ev.longitude !== null) {
      const key = ev.latitude.toFixed(4) + "," + ev.longitude.toFixed(4);
      venues.set(key, [...(venues.get(key) ?? []), ev]);
    }
  for (const [key, events] of venues) {
    events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    pins.push({
      id: "venue:" + key,
      lat: events[0].latitude!,
      lng: events[0].longitude!,
      label: events[0].title + (events.length > 1 ? " and " + (events.length - 1) + " more" : ""),
      layer: "events",
      events,
    });
  }
  return pins;
}
function PinFace({ pin, selected, plans = [] }: { pin: MapPinData; selected: boolean; plans?: Snapshot["venuePlans"] }) {
  if (pin.events) {
    const friends = (plans ?? []).filter(p => pin.events!.some(e => e.id === p.eventId));
    const Icon = categoryIcons[pin.events[0].category] ?? CalendarDays;
    return (
      <span className={"civic-pin layer-events cat-" + pin.events[0].category + (selected ? " selected" : "")}>
        <span className="pin-disc">
          <Icon size={17} />
        </span>
        {friends.length > 0 && <span className="map-plan-faces" aria-label="Friends’ shared plans">{friends.slice(0, 3).map(p => <b key={p.userId + p.eventId} title={p.name + " · " + (p.status === "attending" ? "Going" : "Interested")}>{initialsFor(p.name)}</b>)}</span>}
        {pin.events.length > 1 && <span className="pin-count">{pin.events.length}</span>}
      </span>
    );
  }
  const e = pin.entity!;
  const Icon = kindIcons[e.kind];
  return (
    <span className={"civic-pin layer-" + pin.layer + " kind-" + e.kind + (selected ? " selected" : "")}>
      <span className="pin-disc">
        {e.kind === "official" ? <b>{e.monogram ?? initialsFor(e.name)}</b> : <Icon size={17} />}
      </span>
      {e.sample && <span className="pin-sample" title="Sample" />}
    </span>
  );
}
type ClusterLayer = Exclude<MapLayer, "all">;
const layerColors: Record<ClusterLayer, string> = {
  people: "#17233b",
  government: "#334861",
  campus: "#3659e3",
  issues: "#a86222",
  community: "#3f7a58",
  events: "#c05a28",
};
const clusterLayers = Object.keys(layerColors) as ClusterLayer[];
// A bubble for places that sit close together at this zoom, like Snap Map's
// groups: the count, and a dot for each kind of place inside.
function ClusterFace({ count, layers, friends = [] }: { count: number; layers: ClusterLayer[]; friends?: string[] }) {
  return (
    <span className="civic-cluster">
      <b>{count}</b>
      <span className="cluster-dots" aria-hidden="true">
        {layers.slice(0, 4).map((l) => (
          <i key={l} style={{ background: layerColors[l] }} />
        ))}
      </span>
      {friends.length > 0 && (
        <span className="map-plan-faces" aria-hidden="true">
          {friends.slice(0, 2).map((name) => (
            <b key={name}>{initialsFor(name)}</b>
          ))}
        </span>
      )}
    </span>
  );
}
type Camera = { center: [number, number]; zoom: number; pitch: number; bearing: number };
// Tilted and turned a little so buildings read as 3D; flat for a whole country.
function cameraFor(center: [number, number] | undefined, zoom: number | undefined, variant: "full" | "preview"): Camera {
  if (!center) return { center: [-98.35, 39.5], zoom: 3.4, pitch: 0, bearing: 0 };
  return variant === "full"
    ? { center: [center[1], center[0]], zoom: Math.max(zoom ?? 14, 15), pitch: 60, bearing: -18 }
    : { center: [center[1], center[0]], zoom: Math.max(zoom ?? 14, 14.6), pitch: 52, bearing: -12 };
}
const street = { zoom: 16.4, pitch: 60 };
// Fit the places within a few miles of the camera's center (outliers such as
// an airport office would zoom the whole town out), keeping tilt and turn.
function frameCore(basemap: Basemap, pins: MapPinData[], camera: Camera): Camera {
  const [lng, lat] = camera.center;
  const core = pins.filter((p) => distanceMiles([lat, lng], [p.lat, p.lng]) < 3);
  if (core.length < 2) return camera;
  const bounds = new basemap.maplibregl.LngLatBounds();
  for (const p of core) bounds.extend([p.lng, p.lat]);
  const fit = basemap.map.cameraForBounds(bounds, { padding: 50, maxZoom: camera.zoom + 0.6 });
  if (!fit?.center || fit.zoom === undefined) return camera;
  const center = basemap.maplibregl.LngLat.convert(fit.center).toArray() as [number, number];
  return { ...camera, center, zoom: Math.max(fit.zoom, camera.zoom - 1.6) };
}

export function CivicMap({
  data,
  run,
  navigate,
  discuss,
  discussEvent,
  layer = "all",
  selected = "",
  onSelect,
  variant = "full",
}: {
  data: Snapshot;
  run: Run;
  navigate: Navigate;
  discuss: (e: CivicEntity) => void;
  discussEvent: (e: CommunityEvent) => void;
  layer?: MapLayer;
  selected?: string;
  onSelect: (id: string) => void;
  variant?: "full" | "preview";
}) {
  const locale = localeOf(data.community);
  const element = useRef<HTMLDivElement>(null);
  const [basemap, setBasemap] = useState<Basemap | null>(null);
  const [tiles, setTiles] = useState<BasemapState>("loading");
  const [occurrence, setOccurrence] = useState("");
  const [here, setHere] = useState("");
  const you = useRef<Marker | null>(null);
  const flyToFix = useRef(false);
  const selectRef = useRef(onSelect);
  const selectedRef = useRef(selected);
  const location = useDeviceLocation();
  useEffect(() => {
    selectRef.current = onSelect;
    selectedRef.current = selected;
  }, [onSelect, selected]);
  const allPins = useMemo(() => mapPins(data), [data]);
  const pins = useMemo(() => allPins.filter((p) => layer === "all" || p.layer === layer), [allPins, layer]);
  const byId = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);
  const items = useMemo(() => pins.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, group: p.layer })), [pins]);
  const { shown, offsets, zoomInto, standing } = useClusteredMarkers(basemap, items, clusterLayers, selected);
  const active = byId.get(selected);
  const preview = useAnchoredPopup(basemap, active, { offset: active ? offsets.get(active.id) : undefined, standing, className: "civic-popup" });
  const near = location.coords && locale && distanceMiles(location.coords, locale.center) < 25 ? location.coords : undefined;
  const origin: [number, number] | undefined = near ?? locale?.center;
  const nearKey = near ? near.join(",") : "";
  const live = useRef({ pins });
  useEffect(() => {
    live.current = { pins };
  }, [pins]);

  // One map per community; places, selection and location update it in place.
  useEffect(() => {
    let canceled = false;
    let created: Basemap | null = null;
    const container = element.current;
    if (!container) return;
    const target = cameraFor(locale?.center, locale?.zoom, variant);
    const intro = variant === "full" && !!locale && !reducedMotion();
    void createBasemap(container, {
      center: [target.center[1], target.center[0]],
      zoom: intro ? target.zoom - 1.4 : target.zoom,
      pitch: intro ? 10 : target.pitch,
      bearing: intro ? 0 : target.bearing,
      communityId: data.community?.id,
      preview: variant === "preview",
      onState: (state) => {
        if (!canceled) setTiles(state);
      },
    })
      .then((next) => {
        created = next;
        if (canceled) return next.map.remove();
        next.map.on("load", () => {
          if (canceled) return;
          addMarkerSource(next.map, clusterLayers);
          setBasemap(next);
          // Open framed on the places near the center, tilted for 3D.
          const framed = frameCore(next, live.current.pins, target);
          if (intro) moveCamera(next.map, framed, 1800);
          else next.map.jumpTo(framed);
        });
        // Tapping the map itself closes a preview, as in Snap Map.
        next.map.on("click", () => {
          if (selectedRef.current) selectRef.current("");
        });
      })
      .catch(() => {
        if (!canceled) setTiles("failed");
      });
    return () => {
      canceled = true;
      setBasemap(null);
      created?.map.remove();
    };
    // The map is created once per community; everything else updates in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.community?.id]);

  // Changing layers frames the places of that kind closest to the center.
  const framedLayer = useRef(layer);
  useEffect(() => {
    if (!alive(basemap) || framedLayer.current === layer) return;
    framedLayer.current = layer;
    if (!pins.length) return;
    const { map } = basemap;
    moveCamera(map, frameCore(basemap, pins, { center: map.getCenter().toArray() as [number, number], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() }), 900);
    // Only a change of layer reframes the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, layer]);

  // Your position: a dot on this device only, the street you're on, and a
  // glide down to street level when you ask for it.
  useEffect(() => {
    if (!alive(basemap)) return;
    const { map, maplibregl } = basemap;
    you.current?.remove();
    you.current = null;
    if (!near) return;
    const point: [number, number] = [near[1], near[0]];
    const dot = document.createElement("div");
    dot.className = "civic-you";
    dot.innerHTML = "<span></span>";
    you.current = new maplibregl.Marker({ element: dot, anchor: "center" }).setLngLat(point).addTo(map);
    const describe = () => {
      const road = nearestNamed(point, map.querySourceFeatures("openmaptiles", { sourceLayer: "transportation_name" }) as NamedGeometry[], 150);
      const area = nearestNamed(
        point,
        map.querySourceFeatures("openmaptiles", {
          sourceLayer: "place",
          filter: ["match", ["get", "class"], ["neighbourhood", "suburb", "quarter"], true, false],
        }) as NamedGeometry[],
        2000,
      );
      setHere([road?.name, area?.name].filter(Boolean).join(" · "));
    };
    if (flyToFix.current) {
      flyToFix.current = false;
      moveCamera(map, { center: point, zoom: street.zoom, pitch: street.pitch, bearing: map.getBearing() - 25 }, 2400);
    }
    map.once("idle", describe);
    return () => {
      map.off("idle", describe);
    };
    // nearKey captures the rounded coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, nearKey]);
  function locate() {
    if (near && alive(basemap)) moveCamera(basemap.map, { center: [near[1], near[0]], zoom: street.zoom, pitch: street.pitch }, 1800);
    else {
      flyToFix.current = true;
      location.locate();
    }
  }
  const { remeasure } = preview;
  useEffect(remeasure, [preview.host, selected, occurrence, data.venuePlans, shown, remeasure]);

  const activeEvent = active?.events?.find((e) => e.id === occurrence) ?? active?.events?.[0];
  const listed = [...pins]
    .map((p) => ({ pin: p, miles: origin ? distanceMiles(origin, [p.lat, p.lng]) : null }))
    .sort((a, b) => (a.miles ?? 0) - (b.miles ?? 0));
  const card = active ? (
    active.entity ? (
      <EntitySummaryCard
        entity={active.entity}
        data={data}
        run={run}
        navigate={navigate}
        discuss={discuss}
        onClose={() => onSelect("")}
      />
    ) : (
      <EventSummaryCard
        event={activeEvent!}
        data={data}
        navigate={navigate}
        discuss={discussEvent}
        onClose={() => onSelect("")}
      />
    )
  ) : null;
  return (
    <div className={"civic-map " + variant}>
      <div className="civic-map-main">
      <div className="civic-map-frame">
        <div
          ref={element}
          className="civic-map-canvas"
          role="region"
          aria-label={"Map of " + (locale?.label ?? "your community") + ". Use Tab to reach places and Enter to open one."}
        />
        {shown.map((s) => {
          if (s.kind === "cluster") {
            const inside = (s.ids ?? []).map((id) => byId.get(id)).filter((p) => !!p);
            const friends = [
              ...new Set(
                (data.venuePlans ?? [])
                  .filter((plan) => inside.some((p) => p.events?.some((e) => e.id === plan.eventId)))
                  .map((plan) => plan.name),
              ),
            ];
            const name = inside.length ? listPlaces(inside.map((p) => p.label)) : s.count + " places";
            return createPortal(
              <button
                type="button"
                className="civic-cluster-button"
                title={name}
                aria-label={name + ". Zoom in to see them."}
                onClick={(e) => {
                  e.stopPropagation();
                  zoomInto(s);
                }}
              >
                <ClusterFace count={s.count} layers={s.groups as ClusterLayer[]} friends={friends} />
              </button>,
              s.host,
              s.key,
            );
          }
          const pin = byId.get(s.id);
          return pin
            ? createPortal(
                <button
                  type="button"
                  className="civic-pin-button"
                  title={pin.label}
                  aria-label={pin.label}
                  aria-pressed={pin.id === selected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(pin.id === selected ? "" : pin.id);
                  }}
                >
                  <PinFace pin={pin} selected={pin.id === selected} plans={data.venuePlans} />
                </button>,
                s.host,
                s.key,
              )
            : null;
        })}
        {tiles !== "loaded" && (
          <p className="civic-map-status" role="status">
            {tiles === "failed"
              ? "The map could not load. Places remain available in the list."
              : tiles === "outline"
                ? "Showing a simplified outline; the detailed map could not load."
                : "Loading the map…"}
          </p>
        )}
        {near && here && (
          <p className="civic-map-here">
            <LocateFixed size={13} aria-hidden="true" /> Near {here}
          </p>
        )}
        {variant === "full" && (
          <button type="button" className="civic-map-locate-button" onClick={locate} disabled={location.status === "locating"} aria-label="Show my location on the map" title="Show my location on the map">
            <LocateFixed size={18} />
          </button>
        )}
        {active && preview.host && createPortal(<div className="venue-preview">
          <strong>{activeEvent?.title ?? active.entity?.name}</strong>
          <p>{activeEvent?.venue ?? active.entity?.subtitle}</p>
          {activeEvent && <p>{eventTime(activeEvent)}</p>}
          {activeEvent && active.events!.length > 1 && <label className="social-field">Occurrence at this venue<select value={activeEvent.id} onChange={e => setOccurrence(e.target.value)}>{active.events!.map(e => <option key={e.id} value={e.id}>{e.title} · {eventTime(e)}</option>)}</select></label>}
          {(data.venuePlans ?? []).filter(p => p.eventId === activeEvent?.id).map(p => <p className="map-shared-plan" key={p.userId + p.eventId}>{p.name} · {p.status === "attending" ? "Going" : "Interested"}</p>)}
          {(data.venuePlans ?? []).filter(p => p.eventId !== activeEvent?.id && active.events?.some(e => e.id === p.eventId)).map(p => <button className="text-button" key={p.userId + p.eventId} onClick={() => setOccurrence(p.eventId)}>{p.name} · {p.status === "attending" ? "Going" : "Interested"} · {eventTime(active.events!.find(e => e.id === p.eventId)!)}</button>)}
          <button className="text-button" onClick={() => navigate(activeEvent ? "event/" + activeEvent.id : "entity/" + active.entity!.id)}>{activeEvent ? "View event" : "View details"}</button>
          <button className="text-button" onClick={() => onSelect("")}>Close preview</button>
        </div>, preview.host)}
      </div>
      <p className="map-caption">
        {variant === "full" && (
          <>
            <span className="hint-pointer">Drag to move · right-drag to tilt and turn · ⌘/Ctrl + scroll to zoom. </span>
            <span className="hint-touch">Drag to move · pinch to zoom · two fingers to tilt and turn. </span>
          </>
        )}
        Venue plans are shared intentions, never a person’s current location.
      </p>
      </div>
      {variant === "full" && (
        <aside className="civic-map-side">
          <div className="civic-map-locate">
            <button className="text-button" onClick={locate} disabled={location.status === "locating"}>
              <LocateFixed size={16} />
              {near ? "Using your location" : "Use my location"}
            </button>
            <p role="status">
              {location.status === "locating"
                ? "Finding your location…"
                : near
                  ? (here ? "You’re near " + here + ". " : "") +
                    "Sorted by distance from you. Your location stays on this device; map tiles load from OpenFreeMap."
                  : location.status === "granted"
                    ? "You seem to be away from " + (locale?.shortName ?? "here") + ", so distances use its center."
                    : location.status === "denied" || location.status === "unavailable"
                      ? "Location is off. Distances use the center of " + (locale?.shortName ?? "your community") + "."
                      : "Distances use the center of " + (locale?.shortName ?? "your community") + ". Location is optional."}
            </p>
            {location.status === "granted" && !near && (
              <button className="text-button" onClick={() => navigate("communities")}>
                Find the commons where you are
              </button>
            )}
          </div>
          {card && <div className="civic-map-card" key={selected}>{card}</div>}
          <h2 className="sr-only">Places on the map</h2>
          <ul className="civic-map-list">
            {listed.map(({ pin, miles }) => (
              <li key={pin.id}>
                <button aria-pressed={pin.id === selected} onClick={() => onSelect(pin.id === selected ? "" : pin.id)}>
                  <PinFace pin={pin} selected={pin.id === selected} plans={data.venuePlans} />
                  <span>
                    <strong>{pin.label}</strong>
                    <small>
                      {pin.events
                        ? eventCategories[pin.events[0].category] + " · " + pin.events[0].venue
                        : pin.entity!.subtitle}
                    </small>
                  </span>
                  {miles !== null && <em>{miles < 0.1 ? "<0.1" : miles.toFixed(1)} mi</em>}
                </button>
              </li>
            ))}
            {!listed.length && (
              <li className="civic-map-empty">
                <MapPin size={18} /> Nothing mapped in this layer yet.
              </li>
            )}
          </ul>
        </aside>
      )}
    </div>
  );
}
