"use client";
import "./civic.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, CalendarDays, Maximize2 } from "lucide-react";
import type { CommunityEvent, Snapshot } from "@/lib/social/types";
import { cityCenters } from "@/lib/social/communities";
import { eventTime } from "@/lib/social/events";
import { categoryIcons, initialsFor } from "./civic-cards";
import { listPlaces } from "@/lib/map-geometry";
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

type Venue = { id: string; lat: number; lng: number; events: CommunityEvent[] };

export default function VenueMap({ events, selected, onSelect, onView, plans = [], communityId, center = cityCenters.ithaca }: {
  events: CommunityEvent[]; selected: string; onSelect: (id: string) => void; onView: (id: string) => void;
  plans?: NonNullable<Snapshot["venuePlans"]>; communityId: string; center?: [number, number];
}) {
  const element = useRef<HTMLDivElement>(null);
  const [basemap, setBasemap] = useState<Basemap | null>(null);
  const [tiles, setTiles] = useState<BasemapState>("loading");
  // Occurrences at one venue share a pin; the preview chooses between them.
  const venues = useMemo(() => {
    const byPlace = new Map<string, Venue>();
    for (const e of events)
      if (e.latitude !== null && e.longitude !== null) {
        const id = e.latitude + "," + e.longitude;
        const venue = byPlace.get(id) ?? { id, lat: e.latitude, lng: e.longitude, events: [] };
        venue.events.push(e);
        byPlace.set(id, venue);
      }
    for (const v of byPlace.values()) v.events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return [...byPlace.values()];
  }, [events]);
  const items = useMemo(() => venues.map((v) => ({ id: v.id, lat: v.lat, lng: v.lng, group: "events" })), [venues]);
  const active = events.find((e) => e.id === selected);
  const activeVenue = active ? venues.find((v) => v.events.some((e) => e.id === active.id)) : undefined;
  const occurrences = activeVenue?.events ?? [];
  const { shown, offsets, zoomInto, standing } = useClusteredMarkers(basemap, items, ["events"], activeVenue?.id ?? "");
  const preview = useAnchoredPopup(basemap, activeVenue, { offset: activeVenue ? offsets.get(activeVenue.id) : undefined, standing, className: "civic-popup" });

  useEffect(() => {
    let canceled = false;
    let created: Basemap | null = null;
    const container = element.current;
    if (!container) return;
    void createBasemap(container, {
      center,
      zoom: 14.4,
      pitch: 50,
      bearing: -12,
      communityId,
      onState: (state) => {
        if (!canceled) setTiles(state);
      },
    })
      .then((next) => {
        created = next;
        if (canceled) return next.map.remove();
        next.map.on("load", () => {
          if (canceled) return;
          addMarkerSource(next.map, ["events"]);
          setBasemap(next);
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
    // Community recreates the map; snapshots only update the pins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  const fit = (animate: boolean) => {
    if (!alive(basemap) || !venues.length) return;
    const bounds = new basemap.maplibregl.LngLatBounds();
    for (const v of venues) bounds.extend([v.lng, v.lat]);
    const camera = basemap.map.cameraForBounds(bounds, { padding: 60, maxZoom: 15.5 });
    if (!camera) return;
    const target = { ...camera, pitch: basemap.map.getPitch(), bearing: basemap.map.getBearing() };
    if (animate) moveCamera(basemap.map, target, 900);
    else basemap.map.jumpTo(target);
  };
  // Frame the venues once they first arrive, then leave the camera to people.
  const venueKey = items.map((i) => i.id).join("|");
  const framed = useRef("");
  useEffect(() => {
    if (!alive(basemap) || !venueKey || framed.current === venueKey) return;
    framed.current = venueKey;
    fit(false);
    // fit reads the current venues; venueKey says when they changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, venueKey]);
  const { remeasure } = preview;
  useEffect(remeasure, [preview.host, selected, plans, remeasure]);

  return <section className="venue-map-shell" aria-label="Event venues map">
    <div className="venue-map-frame civic-map">
      <div ref={element} className="venue-map" role="region" aria-label="Map of event venues. Use Tab to reach venues and Enter to open one." />
      {shown.map((s) => {
        if (s.kind === "cluster") {
          const inside = venues.filter((v) => s.ids?.includes(v.id));
          const friends = [...new Set(plans.filter((p) => inside.some((v) => v.events.some((e) => e.id === p.eventId))).map((p) => p.name))];
          const name = inside.length ? listPlaces(inside.map((v) => v.events[0].venue), "venues") : s.count + " venues";
          return createPortal(
            <button type="button" className="civic-cluster-button" title={name} aria-label={name + ". Zoom in to see them."} onClick={() => zoomInto(s)}>
              <span className="civic-cluster">
                <b>{s.count}</b>
                {friends.length > 0 && <span className="map-plan-faces" aria-hidden="true">{friends.slice(0, 2).map((n) => <b key={n}>{initialsFor(n)}</b>)}</span>}
              </span>
            </button>,
            s.host,
            s.key,
          );
        }
        const venue = venues.find((v) => v.id === s.id);
        if (!venue) return null;
        const first = venue.events[0];
        const Icon = categoryIcons[first.category] ?? CalendarDays;
        const friends = plans.filter((p) => venue.events.some((e) => e.id === p.eventId));
        const title = first.venue + " · " + venue.events.length + " upcoming occurrence(s)" + (friends.length ? " · " + friends.map((p) => p.name + ": " + (p.status === "attending" ? "Going" : "Interested")).join(", ") : "");
        const isSelected = venue.id === activeVenue?.id;
        return createPortal(
          <button type="button" className="civic-pin-button venue-pin-button" title={title} aria-label={title} aria-pressed={isSelected} onClick={() => onSelect(isSelected ? "" : first.id)}>
            <span className={"civic-pin layer-events cat-" + first.category + (isSelected ? " selected" : "")}>
              <span className="pin-disc"><Icon size={17} /></span>
              {friends.length > 0 && <span className="map-plan-faces" aria-hidden="true">{friends.slice(0, 3).map((p) => <b key={p.userId + p.eventId}>{initialsFor(p.name)}</b>)}</span>}
              {venue.events.length > 1 && <span className="pin-count">{venue.events.length}</span>}
            </span>
          </button>,
          s.host,
          s.key,
        );
      })}
      <button className="map-fit btn secondary" onClick={() => fit(true)}><Maximize2 size={14}/>Fit venues</button>
      {tiles !== "loaded" && (
        <p className="civic-map-status" role="status">
          {tiles === "failed"
            ? "The map could not load. Venues and the complete event list remain available."
            : tiles === "outline"
              ? "Showing a simplified outline; the detailed map could not load."
              : "Loading the map…"}
        </p>
      )}
    </div>
    {active && preview.host && createPortal(<div className="venue-preview">
      <p className="metadata">{active.scope === "campus" ? "CAMPUS" : "TOWN"} · EVENT VENUE</p>
      <h3>{active.title}</h3><p>{eventTime(active)}</p>
      {plans.filter(p => p.eventId === active.id).map(p => <p className="map-shared-plan" key={p.userId}>{p.name} · {p.status === "attending" ? "Going" : "Interested"}</p>)}
      {plans.filter(p => p.eventId !== active.id && occurrences.some(e => e.id === p.eventId)).map(p => <button key={p.userId + p.eventId} className="text-button" onClick={() => onSelect(p.eventId)}>{p.name} · {p.status === "attending" ? "Going" : "Interested"} at {events.find(e => e.id === p.eventId)?.title}</button>)}
      <button className="btn primary" onClick={() => onView(active.id)}>View event <ArrowUpRight size={14}/></button>
      {occurrences.length > 1 && <label className="social-field">Occurrence at this venue<select value={active.id} onChange={e => onSelect(e.target.value)}>{occurrences.map(e => <option key={e.id} value={e.id}>{e.title} · {eventTime(e)}</option>)}</select></label>}
    </div>, preview.host)}
    <p className="map-caption">Shared plans, never live locations. Initials appear only for friends who shared a plan with you. Unmapped events remain in the list. Drag to move, two fingers or right-drag to tilt, +/− to zoom.</p>
  </section>;
}
