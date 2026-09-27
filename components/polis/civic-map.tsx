"use client";
import "leaflet/dist/leaflet.css";
import "./civic.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LayerGroup, Map as LeafletMap, Marker, Popup } from "leaflet";
import { CalendarDays, LocateFixed, MapPin } from "lucide-react";
import type { CivicEntity, CommunityEvent, EntityKind, Snapshot } from "@/lib/social/types";
import { entitiesFor } from "@/lib/social/civic";
import { distanceMiles, eventExpired, eventCategories } from "@/lib/social/events";
import { addMapOutline } from "@/lib/social/map-outline";
import { communityFor } from "@/lib/social/communities";
import { useDeviceLocation } from "@/lib/social/use-device-location";
import {
  categoryIcons,
  EntitySummaryCard,
  EventSummaryCard,
  initialsFor,
  kindIcons,
} from "./civic-cards";
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
  const communityId = data.community?.id ?? "";
  const pins: MapPinData[] = entitiesFor(communityId).flatMap((e) =>
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
// Pins closer than a marker's width fan out in a small ring so every place
// stays visible and tappable. Positions are approximate to begin with.
function declutterPins(map: LeafletMap, markers: Map<string, Marker>, hosts: Map<string, HTMLElement>) {
  const points = [...markers].map(([id, m]) => ({ id, p: map.latLngToLayerPoint(m.getLatLng()) }));
  const placed = new Set<string>();
  for (const a of points) {
    if (placed.has(a.id)) continue;
    const group = points.filter((b) => !placed.has(b.id) && a.p.distanceTo(b.p) < 30);
    group.forEach((b, i) => {
      placed.add(b.id);
      const host = hosts.get(b.id);
      if (!host) return;
      if (group.length === 1) {
        host.style.transform = "";
        return;
      }
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / group.length;
      const radius = 18 + group.length * 3;
      host.style.transform = `translate(${Math.round(Math.cos(angle) * radius)}px, ${Math.round(Math.sin(angle) * radius)}px)`;
    });
  }
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
  const campus = communityFor(data.community?.id ?? "")?.campus;
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const group = useRef<LayerGroup | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const hostEls = useRef(new Map<string, HTMLElement>());
  const you = useRef<Marker | null>(null);
  const popup = useRef<Popup | null>(null);
  const [popupHost, setPopupHost] = useState<HTMLElement | null>(null);
  const selectRef = useRef(onSelect);
  const fitted = useRef("");
  const [ready, setReady] = useState(false);
  const [tiles, setTiles] = useState<"loading" | "loaded" | "failed">("loading");
  const [hosts, setHosts] = useState<[string, HTMLElement][]>([]);
  const location = useDeviceLocation();
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  const allPins = useMemo(() => mapPins(data), [data]);
  const pins = useMemo(
    () => allPins.filter((p) => layer === "all" || p.layer === layer),
    [allPins, layer],
  );
  const pinKey = pins.map(p => p.id + ":" + p.lat + ":" + p.lng).join("|");
  const near = location.coords && campus && distanceMiles(location.coords, campus.center) < 25 ? location.coords : undefined;
  const origin: [number, number] | undefined = near ?? campus?.center;

  useEffect(() => {
    let canceled = false;
    const controller = new AbortController();
    void import("leaflet")
      .then((L) => {
        if (canceled || !element.current) return;
        map.current = L.map(element.current, {
          scrollWheelZoom: false,
          minZoom: 11, maxZoom: 17,
          zoomAnimation: false,
          markerZoomAnimation: false,
          fadeAnimation: false,
          zoomControl: variant === "full",
          attributionControl: true,
        }).setView(campus?.center ?? [42.4475, -76.4885], campus?.zoom ?? 14);
        const instance = map.current;
        void addMapOutline(L, instance, data.community?.id ?? "", controller.signal)
          .then(loaded => { if (!canceled) setTiles(loaded ? "loaded" : "failed"); })
          .catch(() => { if (!canceled) setTiles("failed"); });
        group.current = L.layerGroup().addTo(map.current);
        setReady(true);
      })
      .catch(() => setTiles("failed"));
    return () => {
      canceled = true;
      controller.abort();
      map.current?.remove();
      map.current = null;
    };
    // The map is created once per community; pins update separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.community?.id]);

  useEffect(() => {
    if (!ready) return;
    let canceled = false;
    void import("leaflet").then((L) => {
      if (canceled || !map.current || !group.current) return;
      group.current.clearLayers();
      markers.current.clear();
      hostEls.current.clear();
      const next: [string, HTMLElement][] = [];
      for (const pin of pins) {
        const host = document.createElement("span");
        host.className = "civic-pin-root";
        const marker = L.marker([pin.lat, pin.lng], {
          icon: L.divIcon({ html: host, className: "civic-pin-host", iconSize: [40, 46], iconAnchor: [20, 44] }),
          keyboard: true,
          title: pin.label,
          alt: pin.label,
          riseOnHover: true,
        })
          .on("click", () => selectRef.current(pin.id))
          .addTo(group.current);
        markers.current.set(pin.id, marker);
        hostEls.current.set(pin.id, host);
        next.push([pin.id, host]);
      }
      setHosts(next);
      if (pins.length && fitted.current !== pinKey) {
        fitted.current = pinKey;
        map.current.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), {
          padding: variant === "preview" ? [26, 26] : [46, 46],
          maxZoom: 16,
          animate: false,
        });
      }
      declutterPins(map.current, markers.current, hostEls.current);
    });
    return () => {
      canceled = true;
    };
    // pinKey captures the pin set; `pins` identity changes on every snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinKey, variant]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const current = map.current;
    const declutter = () => declutterPins(current, markers.current, hostEls.current);
    current.on("zoomend", declutter);
    return () => {
      current.off("zoomend", declutter);
    };
  }, [ready]);
  useEffect(() => {
    for (const [id, m] of markers.current) m.setZIndexOffset(id === selected ? 1000 : 0);
    const pin = pins.find((p) => p.id === selected);
    if (pin && map.current && !map.current.getBounds().contains([pin.lat, pin.lng]))
      map.current.panTo([pin.lat, pin.lng], { animate: false });
  }, [selected, pins]);

  useEffect(() => {
    let canceled = false;
    const pin = pins.find(p => p.id === selected);
    if (!ready || !map.current || !pin) {
      popup.current?.remove();
      return;
    }
    void import("leaflet").then(L => {
      if (canceled || !map.current) return;
      popup.current?.remove();
      const host = document.createElement("div");
      const next = L.popup({ closeButton: false, maxWidth: 270, minWidth: 180, maxHeight: variant === "preview" ? 145 : 230, offset: [0, -35], autoPan: true })
        .setLatLng([pin.lat, pin.lng]).setContent(host).openOn(map.current);
      popup.current = next;
      setPopupHost(host);
    });
    return () => { canceled = true; popup.current?.remove(); };
    // Marker geometry is encoded in pinKey; snapshot refreshes keep the popup in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected, pinKey]);
  useEffect(() => { popup.current?.update(); }, [popupHost, selected, data.venuePlans]);

  useEffect(() => {
    if (!ready) return;
    void import("leaflet").then((L) => {
      if (!map.current) return;
      you.current?.remove();
      you.current = null;
      if (near)
        you.current = L.marker(near, {
          icon: L.divIcon({ className: "civic-you", html: "<span></span>", iconSize: [18, 18], iconAnchor: [9, 9] }),
          interactive: false,
          keyboard: false,
        }).addTo(map.current);
    });
  }, [ready, near]);

  const active = pins.find((p) => p.id === selected);
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
        event={active.events![0]}
        data={data}
        navigate={navigate}
        discuss={discussEvent}
        onClose={() => onSelect("")}
      />
    )
  ) : null;
  return (
    <div className={"civic-map " + variant}>
      <div className="civic-map-frame">
        <div
          ref={element}
          className="civic-map-canvas"
          role="region"
          aria-label={"Map of " + (campus?.university ?? "your community") + ". Use Tab to reach places and Enter to open one."}
        />
        {hosts.map(([id, host]) => {
          const pin = pins.find((p) => p.id === id);
          return pin ? createPortal(<PinFace pin={pin} selected={id === selected} plans={data.venuePlans} />, host, id) : null;
        })}
        {tiles !== "loaded" && (
          <p className="civic-map-status" role="status">
            {tiles === "failed"
              ? "The local outline could not load. Places remain available in the list."
              : "Loading the local outline…"}
          </p>
        )}
        {active && popupHost && createPortal(<div className="venue-preview">
          <strong>{active.events?.[0].title ?? active.entity?.name}</strong>
          <p>{active.events?.[0].venue ?? active.entity?.subtitle}</p>
          {(data.venuePlans ?? []).filter(p => active.events?.some(e => e.id === p.eventId)).map(p => <p key={p.userId + p.eventId}>{p.name} · {p.status === "attending" ? "Going" : "Interested"}{active.events!.length > 1 ? " at " + active.events!.find(e => e.id === p.eventId)?.title : ""}</p>)}
          <button className="text-button" onClick={() => navigate(active.events ? "event/" + active.events[0].id : "entity/" + active.entity!.id)}>{active.events ? "View event" : "View details"}</button>
          <button className="text-button" onClick={() => onSelect("")}>Close preview</button>
        </div>, popupHost)}
        <p className="map-caption">Simplified local outline · Venue plans are shared intentions, never a person’s current location.</p>
      </div>
      {variant === "full" && (
        <aside className="civic-map-side">
          <div className="civic-map-locate">
            <button className="text-button" onClick={location.locate} disabled={location.status === "locating"}>
              <LocateFixed size={16} />
              {near ? "Using your location" : "Use my location"}
            </button>
            <p role="status">
              {location.status === "locating"
                ? "Finding your location…"
                : near
                  ? "Sorted by distance from you. Your location stays on this device."
                  : location.status === "granted"
                    ? "You seem to be away from campus, so distances use " + (campus?.shortName ?? "the campus") + "."
                    : location.status === "denied" || location.status === "unavailable"
                      ? "Location is off. Distances use the center of " + (campus?.shortName ?? "campus") + "."
                      : "Distances use the center of " + (campus?.shortName ?? "campus") + ". Location is optional."}
            </p>
          </div>
          {card && <div className="civic-map-card">{card}</div>}
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
