"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as LeafletMap, LayerGroup, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CommunityEvent, Snapshot } from "@/lib/social/types";
import { cityCenters } from "@/lib/social/communities";
import { addMapOutline } from "@/lib/social/map-outline";
import { eventTime } from "@/lib/social/events";
import { ArrowUpRight, Maximize2 } from "lucide-react";

export default function VenueMap({ events, selected, onSelect, onView, plans = [], communityId, center = cityCenters.ithaca }: {
  events: CommunityEvent[]; selected: string; onSelect: (id: string) => void; onView: (id: string) => void;
  plans?: NonNullable<Snapshot["venuePlans"]>; communityId: string; center?: [number, number];
}) {
  const element = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), layer = useRef<LayerGroup | null>(null);
  const markers = useRef(new Map<string, Marker>()), fitted = useRef("");
  const select = useRef(onSelect);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const [popup, setPopup] = useState<HTMLElement | null>(null);
  const active = events.find(e => e.id === selected);
  const occurrences = active ? events.filter(e => e.latitude === active.latitude && e.longitude === active.longitude).sort((a,b) => a.startsAt.localeCompare(b.startsAt)) : [];
  useEffect(() => {
    const controller = new AbortController();
    void import("leaflet").then(async L => {
      if (controller.signal.aborted || !element.current) return;
      const instance = L.map(element.current, { scrollWheelZoom: false, minZoom: 11, maxZoom: 17, zoomAnimation: false, markerZoomAnimation: false, fadeAnimation: false }).setView(center, 13);
      map.current = instance;
      layer.current = L.layerGroup().addTo(instance);
      setReady(true);
      try { if (!await addMapOutline(L, instance, communityId, controller.signal)) setFailed(true); }
      catch { if (!controller.signal.aborted) setFailed(true); }
    });
    return () => { controller.abort(); map.current?.remove(); map.current = null; };
    // Community recreates the map; snapshots only update the pins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);
  useEffect(() => {
    if (!ready) return;
    let canceled = false;
    void import("leaflet").then(L => {
      if (canceled || !map.current || !layer.current) return;
      layer.current.clearLayers(); markers.current.clear();
      const points = events.filter(e => e.latitude !== null && e.longitude !== null);
      const venues = new Map<string, CommunityEvent[]>();
      for (const e of points) { const key = `${e.latitude},${e.longitude}`; venues.set(key, [...(venues.get(key) ?? []), e]); }
      for (const occurrences of venues.values()) {
        const e = occurrences.find(e => e.id === selected) ?? occurrences[0];
        const friends = plans.filter(p => occurrences.some(o => o.id === p.eventId));
        const title = e.venue + " · " + occurrences.length + " upcoming occurrence(s)" + (friends.length ? " · " + friends.map(p => p.name + ": " + (p.status === "attending" ? "Going" : "Interested")).join(", ") : "");
        const icon = document.createElement("span"); icon.className = "venue-pin-face"; icon.textContent = "✦";
        if (friends.length) {
          const group = document.createElement("span"); group.className = "map-plan-faces";
          for (const friend of friends.slice(0, 3)) { const avatar = document.createElement("b"); avatar.textContent = friend.name.split(/\s+/).map(s => s[0]).slice(0, 2).join(""); avatar.title = friend.name + " · " + (friend.status === "attending" ? "Going" : "Interested"); group.appendChild(avatar); }
          icon.appendChild(group);
        }
        const marker = L.marker([e.latitude!, e.longitude!], { title, alt: title, keyboard: true, icon: L.divIcon({ className: "polis-venue-pin " + (e.id === selected ? "selected" : ""), html: icon, iconSize: [40, 44], iconAnchor: [20, 40] }) }).on("click", () => select.current(e.id)).addTo(layer.current);
        for (const occurrence of occurrences) markers.current.set(occurrence.id, marker);
      }
      const key = points.map(e => e.id + ":" + e.latitude + ":" + e.longitude).join("|");
      if (key !== fitted.current && points.length) { map.current.fitBounds(L.latLngBounds(points.map(e => [e.latitude!, e.longitude!])), { padding: [50, 50], maxZoom: 15, animate: false }); fitted.current = key; }
      if (active) {
        const host = document.createElement("div");
        const marker = markers.current.get(active.id);
        if (marker) { marker.bindPopup(host, { maxWidth: 270, minWidth: 180, maxHeight: 230, autoPan: true, autoPanPadding: [20, 20] }).openPopup(); setPopup(host); }
      } else setPopup(null);
    });
    return () => { canceled = true; };
  }, [ready, events, plans, selected, active]);
  // Leaflet measures an empty host before React fills the portal. Measure again
  // after rendering so the preview stays anchored and inside the map viewport.
  useEffect(() => { markers.current.get(selected)?.getPopup()?.update(); }, [popup, selected]);
  return <section className="venue-map-shell" aria-label="Event venues map">
    <div className="venue-map-frame"><div ref={element} className="venue-map" />
      <button className="map-fit btn secondary" onClick={() => { const points = [...new Set(markers.current.values())].map(m => m.getLatLng()); if (points.length) map.current?.fitBounds(points.map(p => [p.lat, p.lng] as [number, number]), { padding: [48, 48], maxZoom: 15, animate: false }); }}><Maximize2 size={14}/>Fit venues</button>
    </div>
    {active && popup && createPortal(<div className="venue-preview">
      <p className="metadata">{active.scope === "campus" ? "CAMPUS" : "TOWN"} · EVENT VENUE</p>
      <h3>{active.title}</h3><p>{eventTime(active)}</p>
      {plans.filter(p => p.eventId === active.id).map(p => <p className="map-shared-plan" key={p.userId}>{p.name} · {p.status === "attending" ? "Going" : "Interested"}</p>)}
      {plans.filter(p => p.eventId !== active.id && occurrences.some(e => e.id === p.eventId)).map(p => <button key={p.userId + p.eventId} className="text-button" onClick={() => onSelect(p.eventId)}>{p.name} · {p.status === "attending" ? "Going" : "Interested"} at {events.find(e => e.id === p.eventId)?.title}</button>)}
      <button className="btn primary" onClick={() => onView(active.id)}>View event <ArrowUpRight size={14}/></button>
      {occurrences.length > 1 && <label className="social-field">Occurrence at this venue<select value={active.id} onChange={e => onSelect(e.target.value)}>{occurrences.map(e => <option key={e.id} value={e.id}>{e.title} · {eventTime(e)}</option>)}</select></label>}
    </div>, popup)}
    {failed && <p role="status">The local outline could not load. Venues and the complete event list remain available.</p>}
    <p className="map-caption">Shared plans, never live locations. Initials appear only for friends who shared a plan with you. Unmapped events remain in the list. Use +/− and arrow keys on the map.</p>
  </section>;
}
