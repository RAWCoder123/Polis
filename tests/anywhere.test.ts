import test from "node:test";
import assert from "node:assert/strict";
import { fixture, denied } from "./fixture.ts";
import { campusDomainOf, communityFromRow, localeOf, shortNameFor } from "../lib/social/communities.ts";
import { genericCatalog } from "../lib/social/civic/generic.ts";
import { catalogFor } from "../lib/social/civic/index.ts";
import { civicPlacesNear, placesFromOverpass, searchPlaces } from "../lib/social/geo.ts";
import type { Fetcher } from "../lib/social/geo.ts";

const burlington = { action: "community.create" as const, kind: "city" as const, city: "Burlington", region: "Vermont", country: "US", latitude: 44.4759, longitude: -73.2121, timezone: "America/New_York" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("campus founding domains are plain institutional domains only", () => {
  assert.equal(campusDomainOf("a@umich.edu"), "umich.edu");
  assert.equal(campusDomainOf("A@UMICH.EDU"), "umich.edu");
  assert.equal(campusDomainOf("a@ox.ac.uk"), "ox.ac.uk");
  assert.equal(campusDomainOf("a@unsw.edu.au"), "unsw.edu.au");
  for (const email of ["a@alumni.umich.edu", "a@cs.ox.ac.uk", "a@gmail.com", "a@umich.edu.example.test", "a@edu", "no-at-sign"])
    assert.equal(campusDomainOf(email), null, email);
  assert.equal(shortNameFor("University of Michigan"), "Michigan");
  assert.equal(shortNameFor("Boston College"), "Boston College");
});

test("anyone can start or find a city community, and a nearby duplicate joins the existing one", async () => {
  const f = fixture();
  for (const id of ["x", "y", "z", "far"]) await f.act(id, { action: "account.create", name: "Person " + id, username: "person_" + id });
  const made = await f.act("x", burlington);
  assert.equal(made.created, true);
  const x = await f.snap("x");
  assert.equal(x.community!.id, made.communityId);
  assert.equal(x.community!.locality!.city, "Burlington");
  assert.equal(x.me!.role, "curator");
  assert.deepEqual(x.communities.map((c) => c.id).sort(), [made.communityId, "polis"].sort());

  // Five miles away, same town name: joins rather than duplicating.
  const again = await f.act("y", { ...burlington, latitude: 44.49, longitude: -73.11 });
  assert.equal(again.created, false);
  assert.equal(again.communityId, made.communityId);
  assert.equal((await f.snap("y")).me!.role, "member");
  // A different town, or the same name far away, is a separate community.
  const other = await f.act("far", { ...burlington, region: "North Carolina", latitude: 36.0957, longitude: -79.4378 });
  assert.equal(other.created, true);
  assert.notEqual(other.communityId, made.communityId);

  // City communities are open to join by ID; membership never asserts residence.
  await f.act("z", { action: "community.join", communityId: made.communityId! });
  assert.equal((await f.snap("z")).community!.id, made.communityId);

  const found = await f.service("x").searchCommunities("burl", null);
  const hit = found.find((r) => r.community.id === made.communityId)!;
  assert.equal(hit.members, 3);
  const near = await f.service("x").searchCommunities("", [44.48, -73.21]);
  assert.equal(near[0].community.id, made.communityId);
  assert.ok(near[0].miles! < 1);
  assert.ok(!near.some((r) => r.community.id === other.communityId));
});

test("every community gets an honest civic scaffold the service accepts as subjects", async () => {
  const f = fixture();
  await f.act("x", { action: "account.create", name: "Person x", username: "person_x" });
  const { communityId } = await f.act("x", burlington);
  const id = (s: string) => communityId + "." + s;
  const post = await f.act("x", { action: "post", kind: "debate", subjectId: id("q-homes"), position: "support", title: "More homes downtown?", text: "", audience: "community" });
  const [p] = (await f.snap("x", { post: post.postId! })).posts;
  assert.equal(p.issueId, id("housing"));
  await denied(f.act("x", { action: "post", kind: "opinion", subjectId: id("q-getting-around"), position: "support", text: "Open question", audience: "community" }), 400);
  await denied(f.act("x", { action: "post", kind: "opinion", subjectId: "cu-north-campus", text: "Other campus", audience: "community" }), 400);
  await f.act("x", { action: "follow", issueId: id("transit"), enabled: true, notify: false });
  await f.act("x", { action: "priority.save", issueId: id("housing") });
  const s = await f.snap("x");
  assert.deepEqual(s.follows.map((x) => x.issueId), [id("transit")]);
  assert.deepEqual(s.priorities.map((x) => x.issueId), [id("housing")]);

  const us = genericCatalog(s.community!);
  for (const e of us.filter((e) => e.kind === "official")) assert.ok(!e.office?.officeholder && !e.office?.party, e.id);
  assert.ok(us.some((e) => e.kind === "elections" && e.sourceUrl === "https://vote.gov/"));
  assert.ok(us.every((e) => e.kind !== "question" || e.sample));
  assert.ok(!us.some((e) => e.kind === "news" || e.kind === "policy"), "no invented news or proposals");
  const abroad = genericCatalog(communityFromRow({ id: "c-lyon", kind: "city", name: "Lyon", locationLabel: "Lyon, FR", city: "Lyon", region: "Auvergne-Rhône-Alpes", country: "FR", latitude: 45.76, longitude: 4.83, timezone: "Europe/Paris", domain: null, university: null }));
  assert.ok(!abroad.some((e) => e.kind === "elections" || e.id.endsWith(".congress")));
  assert.equal(localeOf(communityFromRow({ id: "c-lyon", kind: "city", name: "Lyon", locationLabel: "Lyon", city: "Lyon", region: "", country: "FR", latitude: 45.76, longitude: 4.83, timezone: "Europe/Paris", domain: null, university: null }))!.timezone, "Europe/Paris");
  // Curated campuses keep their catalogs.
  assert.ok(catalogFor(s.communities.find((c) => c.id === "polis")).length === 0);
});

test("students found a campus community with their own domain; later students join it automatically", async () => {
  const f = fixture({ founder: "fixture.a@umich.edu", classmate: "fixture.b@umich.edu", alum: "fixture@alumni.umich.edu", other: "fixture@gmail.com" });
  const before = await f.snap("founder");
  assert.equal(before.unclaimedCampusDomain, "umich.edu");
  assert.equal(before.eligibleCommunity, null);
  await f.act("founder", { action: "account.create", name: "Founder", username: "founder_fx" });
  assert.equal((await f.snap("founder")).community!.id, "polis");
  const campus = { action: "community.create" as const, kind: "campus" as const, university: "University of Michigan", city: "Ann Arbor", region: "Michigan", country: "US", latitude: 42.278, longitude: -83.7382, timezone: "America/Detroit" };
  await denied(f.act("founder", { ...campus, university: undefined }), 400);
  const made = await f.act("founder", campus);
  assert.equal(made.created, true);
  const s = await f.snap("founder");
  assert.equal(s.community!.campus!.university, "University of Michigan");
  assert.equal(s.community!.campus!.shortName, "Michigan");
  assert.equal(s.unclaimedCampusDomain, null);

  await f.act("classmate", { action: "account.create", name: "Classmate", username: "classmate_fx" });
  assert.equal((await f.snap("classmate")).community!.id, made.communityId);
  // A second founding attempt joins the existing campus instead.
  assert.equal((await f.act("classmate", campus)).created, false);

  for (const id of ["alum", "other"]) {
    await f.act(id, { action: "account.create", name: id, username: id + "_fx" });
    await denied(f.act(id, { action: "community.join", communityId: made.communityId! }), 403);
    await denied(f.act(id, campus), 403);
  }
});

test("a member can start at most three communities a day", async () => {
  const f = fixture();
  await f.act("x", { action: "account.create", name: "Person x", username: "person_x" });
  for (let i = 0; i < 3; i++) await f.act("x", { ...burlington, city: "Town " + i, latitude: 40 + i, longitude: -80 });
  await denied(f.act("x", { ...burlington, city: "Town 4", latitude: 45, longitude: -80 }), 429);
});

test("public places import from OpenStreetMap once a week and become discussable subjects", async () => {
  const calls: string[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push(url);
    assert.match(String(init?.body), /townhall/);
    return json({
      elements: [
        { type: "node", id: 1, lat: 44.4764, lon: -73.2129, tags: { amenity: "townhall", name: "City Hall", website: "https://example.org/city" } },
        { type: "way", id: 2, center: { lat: 44.47, lon: -73.21 }, tags: { leisure: "park", name: "Waterfront Park" } },
        { type: "way", id: 3, center: { lat: 44.471, lon: -73.211 }, tags: { leisure: "park", name: "Waterfront Park" } },
        { type: "node", id: 4, lat: 44.47, lon: -73.21, tags: { amenity: "restaurant", name: "Diner" } },
        { type: "node", id: 5, lat: 44.47, lon: -73.21, tags: { amenity: "library" } },
      ],
    });
  };
  const f = fixture({}, { fetch: fetcher, contact: "https://polis.example" });
  await f.act("x", { action: "account.create", name: "Person x", username: "person_x" });
  const { communityId } = await f.act("x", burlington);
  const first = await f.act("x", { action: "places.import" });
  assert.equal(first.imported, 2);
  const s = await f.snap("x");
  assert.deepEqual(s.places!.map((p) => p.name).sort(), ["City Hall", "Waterfront Park"]);
  assert.equal(s.places!.find((p) => p.name === "City Hall")!.website, "https://example.org/city");
  const post = await f.act("x", { action: "post", kind: "question", subjectId: "osm-node-1", title: "Council meeting times?", text: "", audience: "community" });
  assert.ok(post.postId);
  assert.equal((await f.act("x", { action: "places.import" })).recent, true);
  assert.equal(calls.length, 1);
  // Curated campuses do not import; a service without network access reports it.
  await f.act("x", { action: "community.joinOpen" });
  await denied(f.act("x", { action: "places.import" }), 400);
  const offline = fixture();
  await offline.act("y", { action: "account.create", name: "Person y", username: "person_y" });
  await offline.act("y", burlington);
  await denied(offline.act("y", { action: "places.import" }), 503);
  void communityId;
});

test("OpenStreetMap parsing keeps civic places, drops commercial ones and ranks civic first", () => {
  const places = placesFromOverpass("c-x", [0, 0], [
    { type: "node", id: 9, lat: 0.01, lon: 0.01, tags: { leisure: "park", name: "Near Park" } },
    { type: "node", id: 8, lat: 0.03, lon: 0.03, tags: { amenity: "townhall", name: "Hall" } },
    { type: "node", id: 7, lat: 0.02, lon: 0.02, tags: { shop: "supermarket", name: "Market Co" } },
    { type: "relation", id: 6, center: { lat: 0.02, lon: 0.02 }, tags: { amenity: "university", name: "State U", website: "http://insecure.example" } },
  ]);
  assert.deepEqual(places.map((p) => p.id), ["osm-node-8", "osm-relation-6", "osm-node-9"]);
  assert.equal(places.find((p) => p.id === "osm-relation-6")!.website, null);
});

test("busy or unreachable OpenStreetMap services are retried, then reported instead of mistaken for no places", async () => {
  const hall = { type: "node", id: 1, lat: 44.4764, lon: -73.2129, tags: { amenity: "townhall", name: "City Hall" } };
  const xml = (status: number) => new Response("<?xml version='1.0'?><html>busy</html>", { status });
  // A gateway timeout is retried on the same instance.
  let calls: string[] = [];
  let places = await civicPlacesNear("c-x", [44.47, -73.21], async (url) => (calls.push(url), calls.length === 1 ? xml(504) : json({ elements: [hall] })), "t", 0);
  assert.deepEqual(places.map((p) => p.name), ["City Hall"]);
  assert.equal(new Set(calls).size, 1);
  // An unreachable instance and a rate-limit remark move on to the next instance.
  calls = [];
  places = await civicPlacesNear(
    "c-x",
    [44.47, -73.21],
    async (url) => {
      calls.push(url);
      if (calls.length === 1) throw new TypeError("network");
      if (calls.length <= 3) return json({ elements: [], remark: "runtime error: rate_limited" });
      return json({ elements: [hall] });
    },
    "t",
    0,
  );
  assert.equal(places.length, 1);
  assert.equal(new Set(calls).size, 3);
  // When every instance is busy the import fails with an explanation.
  await assert.rejects(civicPlacesNear("c-x", [44.47, -73.21], async () => xml(429), "t", 0), /busy/);
});

test("place search returns settlements only and never runs without sign-in", async () => {
  const fetcher: Fetcher = async (url) => {
    assert.match(url, /nominatim\.openstreetmap\.org\/search/);
    return json([
      { lat: "44.4759", lon: "-73.2121", addresstype: "city", address: { city: "Burlington", state: "Vermont", country: "United States", country_code: "us" } },
      { lat: "44.47", lon: "-73.21", addresstype: "amenity", name: "Some Cafe", address: { city: "Burlington" } },
    ]);
  };
  const results = await searchPlaces("Burlington", fetcher, "test");
  assert.deepEqual(results.map((r) => [r.city, r.region, r.country]), [["Burlington", "Vermont", "US"]]);
  const f = fixture({}, { fetch: fetcher });
  await assert.rejects(f.service(null).lookupPlaces("Burlington"), { status: 401 });
  await assert.rejects(f.service(null).searchCommunities("burl", null), { status: 401 });
});

test("configured campuses without a curated catalog get the same scaffold and public places", async () => {
  const fetcher: Fetcher = async () => json({ elements: [{ type: "node", id: 11, lat: 33.79, lon: -84.32, tags: { amenity: "library", name: "Campus Library" } }] });
  const f = fixture({}, { fetch: fetcher });
  await f.act("owner", { action: "account.create", name: "Owner", username: "owner_fx" });
  await f.act("owner", { action: "community.manage", communityId: "emory" });
  const s = await f.snap("owner");
  const catalog = catalogFor(s.community);
  assert.ok(catalog.some((e) => e.id === "emory.student-government"));
  assert.ok(catalog.some((e) => e.id === "emory.q-student-priorities"));
  assert.equal((await f.act("owner", { action: "places.import" })).imported, 1);
  assert.deepEqual((await f.snap("owner")).places!.map((p) => p.name), ["Campus Library"]);
  // Curated Cornell keeps its own map.
  await f.act("owner", { action: "community.manage", communityId: "ithaca" });
  await denied(f.act("owner", { action: "places.import" }), 400);
});
