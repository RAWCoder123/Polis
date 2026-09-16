"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CommunityEvent } from "@/lib/social/types";

export default function VenueMap({
  events,
  selected,
  onSelect,
}: {
  events: CommunityEvent[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    layer = useRef<LayerGroup | null>(null),
    fitted = useRef("");
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [tilesLoaded, setTilesLoaded] = useState(false);
  useEffect(() => {
    let canceled = false;
    void import("leaflet")
      .then((L) => {
        if (canceled || !element.current) return;
        map.current = L.map(element.current, {
          scrollWheelZoom: false,
          // A route can remove this map before Leaflet's zoom-end timeout.
          // Instant zoom also respects reduced-motion preferences.
          zoomAnimation: false,
          markerZoomAnimation: false,
          fadeAnimation: false,
        }).setView([42.444, -76.498], 13);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .on("tileerror", () => setFailed(true))
          .on("load", () => setTilesLoaded(true))
          .addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      canceled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let canceled = false;
    void import("leaflet").then((L) => {
      if (canceled || !map.current || !layer.current) return;
      layer.current.clearLayers();
      const points = events.filter(
        (e) => e.latitude !== null && e.longitude !== null,
      );
      const venues = new Map<string, CommunityEvent[]>();
      for (const e of points) {
        const key = `${e.latitude},${e.longitude}`;
        venues.set(key, [...(venues.get(key) ?? []), e]);
      }
      for (const occurrences of venues.values()) {
        const e = occurrences.find((e) => e.id === selected) ?? occurrences[0];
        const label = document.createElement("span");
        label.textContent =
          e.venue + " · " + occurrences.length + " upcoming occurrence(s)";
        L.marker([e.latitude!, e.longitude!], {
          title: label.textContent,
          alt: label.textContent,
          keyboard: true,
          icon: L.divIcon({
            className:
              "polis-venue-pin " + (e.id === selected ? "selected" : ""),
            html: '<span aria-hidden="true">✦</span>',
            iconSize: [36, 40],
            iconAnchor: [18, 36],
          }),
        })
          .bindTooltip(label)
          .on("click", () => onSelect(e.id))
          .addTo(layer.current);
      }
      const key = points.map((e) => e.id).join("|");
      if (key !== fitted.current && points.length) {
        map.current.fitBounds(
          L.latLngBounds(points.map((e) => [e.latitude!, e.longitude!])),
          { padding: [42, 42], maxZoom: 15, animate: false },
        );
        fitted.current = key;
      }
      const active = points.find((e) => e.id === selected);
      if (
        active &&
        !map.current.getBounds().contains([active.latitude!, active.longitude!])
      )
        map.current.panTo([active.latitude!, active.longitude!], { animate: false });
    });
    return () => {
      canceled = true;
    };
  }, [ready, events, selected, onSelect]);
  return (
    <section className="venue-map-shell" aria-label="Event venues map">
      <div ref={element} className="venue-map" />
      {failed && (
        <p role="status">
          Map tiles could not load. All events remain available in the list.
        </p>
      )}
      {!tilesLoaded && !failed && (
        <p role="status">
          Loading the basemap… Venue pins and the event list remain available.
        </p>
      )}
      <p className="map-caption">
        Pins show supplied venue coordinates. Events without mapped venues
        remain in the list. Use +/− and arrow keys when the map is focused.
      </p>
    </section>
  );
}
