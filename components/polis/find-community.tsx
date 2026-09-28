"use client";
import "./civic.css";
import { useState } from "react";
import { ArrowRight, GraduationCap, LocateFixed, MapPin, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import type { CommunitySearchResult, PlaceSuggestion, Snapshot } from "@/lib/social/types";
import { localeOf } from "@/lib/social/communities";
import { readResponse } from "@/lib/social/read-response";
import { useDeviceLocation } from "@/lib/social/use-device-location";
import type { Navigate, Run } from "./social-post";

const zone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
async function get<T>(query: string) {
  const r = await fetch("/api/polis?" + query, { cache: "no-store" });
  const value = await readResponse<T & { error?: string }>(r);
  if (!r.ok) throw new Error(value.error ?? "Search is unavailable right now.");
  return value;
}

// Find or start the commons for a real place: any town, or your campus.
export function FindCommunity({
  data,
  run,
  refresh,
  navigate,
  busy,
}: {
  data: Snapshot;
  run: Run;
  refresh: () => Promise<unknown>;
  navigate: Navigate;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunitySearchResult[] | null>(null);
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const [university, setUniversity] = useState("");
  const [campusPlace, setCampusPlace] = useState<PlaceSuggestion | null>(null);
  const [campusQuery, setCampusQuery] = useState("");
  const [campusPlaces, setCampusPlaces] = useState<PlaceSuggestion[]>([]);
  const location = useDeviceLocation();
  const member = new Set(data.communities.map((c) => c.id));

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setWorking(true);
    setStatus("Searching…");
    try {
      const [found, suggested] = await Promise.all([
        get<{ communities: CommunitySearchResult[] }>("communities=" + encodeURIComponent(q)),
        get<{ places: PlaceSuggestion[] }>("places=" + encodeURIComponent(q)).catch(() => ({ places: [] as PlaceSuggestion[] })),
      ]);
      setResults(found.communities);
      setPlaces(suggested.places);
      setStatus(found.communities.length || suggested.places.length ? "" : "No matches. Try the town's full name, or add the state or country.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Search is unavailable right now.");
    } finally {
      setWorking(false);
    }
  }
  async function nearMe() {
    if (location.status !== "granted" || !location.coords) {
      location.locate();
      setStatus("Allow location once to see communities near you. It is rounded and only used for this search.");
      return;
    }
    setWorking(true);
    setStatus("Looking near you…");
    try {
      const [lat, lng] = location.coords;
      const [found, here] = await Promise.all([
        get<{ communities: CommunitySearchResult[] }>("communities=&near=" + lat + "," + lng),
        get<{ place: PlaceSuggestion | null }>("reverse=" + lat + "," + lng).catch(() => ({ place: null })),
      ]);
      setResults(found.communities);
      setPlaces(here.place ? [here.place] : []);
      setStatus(found.communities.length ? "" : "No communities within about 60 miles yet. Start the first one.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Search is unavailable right now.");
    } finally {
      setWorking(false);
    }
  }
  async function afterJoin(communityId: string, created: boolean) {
    navigate("home");
    if (!created) {
      toast.success("You’re in. Welcome to your community.");
      return;
    }
    toast.success("Your community is ready. Adding public places to its map…");
    // The public-place import can take a while when OpenStreetMap services are
    // busy, so it runs in the background and Home reloads when it finishes.
    void fetch("/api/polis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), communityId, data: { action: "places.import" } }),
    })
      .then((r) => readResponse<{ imported?: number; error?: string }>(r).then((v) => ({ ok: r.ok, v })))
      .then(({ ok, v }) => {
        if (ok && v.imported) {
          toast.success(v.imported + " public places added to the map.");
          void refresh();
        } else if (!ok) toast.message("Public places couldn’t be added right now. Try again from the map.");
      })
      .catch(() => toast.message("Public places couldn’t be added right now. Try again from the map."));
  }
  async function join(r: CommunitySearchResult) {
    const c = r.community;
    if (member.has(c.id)) {
      await run({ action: "community.select", communityId: c.id }).catch(() => {});
      navigate("home");
      return;
    }
    if (c.campus && data.eligibleCommunity?.id !== c.id) {
      navigate("join/" + c.id);
      return;
    }
    try {
      const result = await run({ action: "community.join", communityId: c.id });
      await afterJoin(result.communityId ?? c.id, false);
    } catch {
      /* The shared error banner explains the failure. */
    }
  }
  async function start(place: PlaceSuggestion) {
    try {
      const result = await run({
        action: "community.create",
        kind: "city",
        city: place.city,
        region: place.region,
        country: place.country,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: zone(),
      });
      await afterJoin(result.communityId!, !!result.created);
    } catch {
      /* The shared error banner explains the failure. */
    }
  }
  async function startCampus(e: React.FormEvent) {
    e.preventDefault();
    if (!campusPlace) return;
    try {
      const result = await run({
        action: "community.create",
        kind: "campus",
        university: university.trim(),
        city: campusPlace.city,
        region: campusPlace.region,
        country: campusPlace.country,
        latitude: campusPlace.latitude,
        longitude: campusPlace.longitude,
        timezone: zone(),
      });
      await afterJoin(result.communityId!, !!result.created);
    } catch {
      /* The shared error banner explains the failure. */
    }
  }
  const covered = (p: PlaceSuggestion) =>
    (results ?? []).some((r) => {
      const l = localeOf(r.community);
      return l && !r.community.campus && l.city.toLowerCase() === p.city.toLowerCase() && (!p.region || l.region.toLowerCase() === p.region.toLowerCase());
    });
  return (
    <section className="find-community">
      <p className="social-section-label">FIND YOUR COMMUNITY</p>
      <h1>Polis is a commons for a real place.</h1>
      <p className="find-lead">
        Find your town or campus, or start the first commons there. Every community gets a map of public places, its local
        offices with official lookups, starter questions and a place to talk with neighbors.
      </p>

      {data.eligibleCommunity && (
        <div className="campus-eligible">
          <GraduationCap size={20} aria-hidden="true" />
          <p>
            <strong>Your university email is associated with {data.eligibleCommunity.name}.</strong> Community membership,
            not verification of student status.
          </p>
          <button className="btn primary small-btn" disabled={busy} onClick={() => void run({ action: "community.join", communityId: data.eligibleCommunity!.id }).then(() => navigate("home")).catch(() => {})}>
            Join {data.eligibleCommunity.name}
          </button>
        </div>
      )}

      <form className="find-search" onSubmit={search} role="search">
        <label className="sr-only" htmlFor="community-search">
          Town, city or university
        </label>
        <Search size={18} aria-hidden="true" />
        <input
          id="community-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Town, city or university — e.g. Burlington, Vermont"
          maxLength={100}
        />
        <button className="btn primary small-btn" disabled={working || query.trim().length < 2}>
          Search
        </button>
      </form>
      <div className="find-actions">
        <button className="text-button" onClick={() => void nearMe()} disabled={working || location.status === "locating"}>
          <LocateFixed size={16} /> {location.status === "granted" ? "Show communities near me" : "Use my location"}
        </button>
        <button className="text-button" onClick={() => navigate("join")}>
          Have a community code?
        </button>
      </div>
      {status && (
        <p className="metadata find-status" role="status">
          {status}
        </p>
      )}

      {results && results.length > 0 && (
        <section className="find-results" aria-label="Communities">
          <h2>Communities</h2>
          {results.map((r) => {
            const c = r.community;
            const joined = member.has(c.id);
            const inviteOnly = !!c.campus && !joined && data.eligibleCommunity?.id !== c.id;
            return (
              <div key={c.id} className="find-row">
                <span className={"entity-visual tile md " + (c.campus ? "tone-cobalt" : "tone-green")} aria-hidden="true">
                  {c.campus ? <GraduationCap size={21} /> : <MapPin size={21} />}
                </span>
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.campus ? "Campus · " : "Town · "}
                    {c.locationLabel}
                    {" · "}
                    <Users size={12} aria-hidden="true" /> {r.members} {r.members === 1 ? "member" : "members"}
                    {r.miles !== null ? " · " + r.miles + " mi" : ""}
                  </small>
                </span>
                <button className={"btn small-btn " + (joined ? "secondary" : "primary")} disabled={busy} onClick={() => void join(r)}>
                  {joined ? "Open" : inviteOnly ? "Use a code" : "Join"} <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
        </section>
      )}

      {places.filter((p) => !covered(p)).length > 0 && (
        <section className="find-results" aria-label="Start a community">
          <h2>Start a new commons</h2>
          {places
            .filter((p) => !covered(p))
            .map((p) => (
              <div key={p.label + p.latitude} className="find-row">
                <span className="entity-visual tile md tone-slate" aria-hidden="true">
                  <Plus size={21} />
                </span>
                <span>
                  <strong>{p.city}</strong>
                  <small>{p.label}</small>
                </span>
                <button className="btn secondary small-btn" disabled={busy} onClick={() => void start(p)}>
                  Start {p.city} <ArrowRight size={14} />
                </button>
              </div>
            ))}
          <p className="metadata">
            Joining a town community doesn’t verify that you live there. If a nearby community with the same name exists,
            you’ll join it instead of creating a duplicate.
          </p>
        </section>
      )}

      {data.unclaimedCampusDomain && (
        <section className="find-campus">
          <h2>
            <GraduationCap size={18} aria-hidden="true" /> Start the campus commons for {data.unclaimedCampusDomain}
          </h2>
          <p>
            You signed in with a {data.unclaimedCampusDomain} address, and no campus community uses it yet. Students who sign in
            with the same domain will join automatically. This is community membership, not verification of student status.
          </p>
          <form onSubmit={startCampus}>
            <label className="social-field">
              University name
              <input required minLength={3} maxLength={120} value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="e.g. University of Michigan" />
            </label>
            <label className="social-field">
              Campus town
              <span className="find-inline">
                <input value={campusQuery} onChange={(e) => setCampusQuery(e.target.value)} placeholder="e.g. Ann Arbor, Michigan" maxLength={100} />
                <button
                  type="button"
                  className="btn secondary small-btn"
                  disabled={working || campusQuery.trim().length < 2}
                  onClick={() =>
                    void get<{ places: PlaceSuggestion[] }>("places=" + encodeURIComponent(campusQuery.trim()))
                      .then((r) => setCampusPlaces(r.places))
                      .catch((err) => setStatus(err.message))
                  }
                >
                  Find
                </button>
              </span>
            </label>
            {campusPlaces.length > 0 && (
              <div className="find-choices" role="radiogroup" aria-label="Campus town">
                {campusPlaces.map((p) => (
                  <label key={p.label + p.latitude} className={campusPlace === p ? "chosen" : ""}>
                    <input type="radio" name="campus-place" checked={campusPlace === p} onChange={() => setCampusPlace(p)} />
                    {p.label}
                  </label>
                ))}
              </div>
            )}
            <button className="btn primary" disabled={busy || !campusPlace || university.trim().length < 3}>
              Start the campus commons <ArrowRight size={15} />
            </button>
          </form>
        </section>
      )}

      <p className="metadata find-privacy">
        Place searches go to OpenStreetMap’s Nominatim service through Polis; your location is used only when you ask, rounded,
        and never stored. Public places come from OpenStreetMap contributors.
      </p>
    </section>
  );
}
