import test from "node:test";
import assert from "node:assert/strict";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { fonts, outlineLayers, polisMapStyle } from "../lib/map-style.ts";
import { fanOffsets, listPlaces, nearestNamed } from "../lib/map-geometry.ts";

test("the Polis basemap is a valid MapLibre style in every mode, including the offline outline", () => {
  for (const options of [{}, { terrain: true }, { hillshade: false }])
    assert.deepEqual(validateStyleMin(polisMapStyle(options)).map((e) => e.message), [], JSON.stringify(options));
  const outline = {
    ...polisMapStyle({ hillshade: false }),
    sources: { outline: { type: "geojson" as const, data: { type: "FeatureCollection" as const, features: [] } } },
    layers: outlineLayers("outline"),
  };
  assert.deepEqual(validateStyleMin(outline).map((e) => e.message), []);
});

test("labels only use fonts the tile host serves, and the map carries no icon sprite to fail", () => {
  const style = polisMapStyle({ terrain: true });
  const served = new Set(Object.values(fonts).map((f) => f[0]));
  for (const layer of style.layers)
    if (layer.type === "symbol") {
      for (const font of (layer.layout?.["text-font"] as string[]) ?? []) assert.ok(served.has(font), layer.id + " uses " + font);
      assert.equal(layer.layout?.["icon-image"], undefined, layer.id + " needs a sprite");
    }
  assert.equal(style.sprite, undefined);
  assert.ok(style.layers.some((l) => l.type === "fill-extrusion"), "3D buildings");
  assert.ok(style.terrain, "terrain when requested");
  assert.equal(polisMapStyle().terrain, undefined);
});

test("the nearest named street is found from loaded map data, ignoring unnamed and distant lines", () => {
  const here: [number, number] = [-76.4852, 42.4418];
  const street = (name: string | undefined, coordinates: [number, number][]) => ({
    properties: name ? { name } : {},
    geometry: { type: "LineString", coordinates },
  });
  const features = [
    street(undefined, [[-76.4853, 42.4417], [-76.4851, 42.4419]]), // unnamed service road on top of us
    street("College Avenue", [[-76.4856, 42.4410], [-76.4856, 42.4430]]), // ~33 m west
    street("Dryden Road", [[-76.4870, 42.4420], [-76.4800, 42.4421]]), // ~22 m north
    { properties: { name: "Far Street" }, geometry: { type: "MultiLineString", coordinates: [[[-76.50, 42.45], [-76.51, 42.45]]] } },
  ];
  assert.equal(nearestNamed(here, features)?.name, "Dryden Road");
  assert.equal(nearestNamed(here, features.slice(0, 2))?.name, "College Avenue");
  assert.equal(nearestNamed(here, features.slice(3)), null);
  assert.equal(nearestNamed(here, [{ properties: { name: "Collegetown" }, geometry: { type: "Point", coordinates: [-76.4852, 42.4412] } }])?.name, "Collegetown");
});

test("places sharing one spot fan out, others stay put", () => {
  const offsets = fanOffsets([
    { id: "mayor", lat: 42.4396, lng: -76.4969 },
    { id: "clerk", lat: 42.4396, lng: -76.4969 },
    { id: "council", lat: 42.4396, lng: -76.4969 },
    { id: "library", lat: 42.4402, lng: -76.4978 },
  ]);
  assert.deepEqual(offsets.get("library"), [0, 0]);
  const ring = ["mayor", "clerk", "council"].map((id) => offsets.get(id)!);
  assert.equal(new Set(ring.map((o) => o.join())).size, 3);
  for (const [x, y] of ring) assert.ok(Math.hypot(x, y) >= 20);
});

test("a bubble names what it holds, briefly", () => {
  assert.equal(listPlaces(["City Hall", "Library", "Court"]), "3 places: City Hall, Library and Court");
  assert.equal(
    listPlaces(["A", "B", "C", "D", "E", "F", "G"], "venues"),
    "7 venues: A, B, C, D, E and 2 more",
  );
});
