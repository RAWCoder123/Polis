import type {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from "maplibre-gl";

// The Polis basemap: a bright, simplified map in the spirit of Snap Map rather
// than a navigation map. Pastel land, parks and water, soft 3D buildings that
// rise as you zoom in, and only the labels that help people place themselves:
// neighbourhoods, streets, water and a few civic buildings. No shop icons,
// route shields or one-way arrows.
//
// Vector tiles come from OpenFreeMap (OpenMapTiles schema, free, no key) and
// hill shading from the public AWS terrain tiles. Loading tiles tells those
// hosts which area is on screen; the device location itself is never sent.

export const vectorTiles = "https://tiles.openfreemap.org/planet";
export const glyphs = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const terrainTiles = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
// OpenFreeMap serves exactly these font stacks.
export const fonts = {
  regular: ["Noto Sans Regular"],
  bold: ["Noto Sans Bold"],
  italic: ["Noto Sans Italic"],
};
export const attribution =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> · ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>';
export const terrainAttribution =
  'Terrain <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">© Mapzen and others</a>';

export const palette = {
  land: "#f6f3ec",
  residential: "#f1ede5",
  commercial: "#f8eee6",
  campus: "#ece8fb",
  hospital: "#fbe7ea",
  park: "#c6ecb0",
  grass: "#d3efbf",
  wood: "#b7e2a1",
  farmland: "#eef2dc",
  wetland: "#d3eee3",
  sand: "#fbf0cf",
  water: "#8ecff5",
  waterLabel: "#2b6fae",
  road: "#ffffff",
  roadCasing: "#e3ddd1",
  major: "#fff2c2",
  majorCasing: "#ecd690",
  highway: "#ffe089",
  highwayCasing: "#e6bf62",
  path: "#d8cfbf",
  rail: "#d6d2cc",
  label: "#1f2d4a",
  street: "#4c5a74",
  neighbourhood: "#6a7792",
  civic: "#6d5fa3",
  halo: "#ffffff",
};

const name: ExpressionSpecification = ["coalesce", ["get", "name:latin"], ["get", "name_en"], ["get", "name"]];
const zoom = (...stops: number[]): ExpressionSpecification =>
  ["interpolate", ["exponential", 1.4], ["zoom"], ...stops] as ExpressionSpecification;
const classIs = (...classes: string[]): ExpressionSpecification =>
  ["match", ["get", "class"], classes, true, false] as ExpressionSpecification;
const surface = ["match", ["get", "brunnel"], ["tunnel"], false, true] as ExpressionSpecification;
const lines = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false] as ExpressionSpecification;

function road(id: string, classes: string[], color: string, casing: string, widths: number[], minzoom = 0): LayerSpecification[] {
  const filter: ExpressionSpecification = ["all", lines, surface, classIs(...classes)];
  const casingWidths = widths.map((w, i) => (i % 2 ? w * 1.35 + 1.5 : w));
  return [
    {
      id: id + "-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom,
      filter,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": casing, "line-width": zoom(...casingWidths) },
    },
    {
      id,
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom,
      filter,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": color, "line-width": zoom(...widths) },
    },
  ];
}

function streetNames(id: string, classes: string[], minzoom: number): LayerSpecification[] {
  return [
    {
      id,
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom,
      filter: ["all", lines, classIs(...classes)],
      layout: {
        "text-field": name,
        "text-font": fonts.regular,
        "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 16, 13.5, 19, 16],
        "symbol-placement": "line",
        "text-rotation-alignment": "map",
        "text-pitch-alignment": "viewport",
        "symbol-spacing": 320,
      },
      paint: { "text-color": palette.street, "text-halo-color": palette.halo, "text-halo-width": 1.8 },
    },
  ];
}

export type PolisStyleOptions = { terrain?: boolean; hillshade?: boolean };

export function polisMapStyle({ terrain = false, hillshade = true }: PolisStyleOptions = {}): StyleSpecification {
  const relief = terrain || hillshade;
  const layers: LayerSpecification[] = [
    { id: "land", type: "background", paint: { "background-color": palette.land } },
    {
      id: "landcover",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood", palette.wood,
          "grass", palette.grass,
          "farmland", palette.farmland,
          "wetland", palette.wetland,
          "sand", palette.sand,
          "ice", "#f3f8fd",
          palette.grass,
        ],
        "fill-opacity": 0.85,
      },
    },
    {
      id: "landuse",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: classIs("residential", "commercial", "retail", "university", "college", "school", "hospital", "cemetery", "stadium", "pitch", "playground"),
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "residential", palette.residential,
          ["commercial", "retail"], palette.commercial,
          ["university", "college", "school"], palette.campus,
          "hospital", palette.hospital,
          "cemetery", palette.grass,
          palette.park,
        ],
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 16, 1],
      },
    },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: { "fill-color": palette.park, "fill-opacity": 0.9 } },
  ];
  if (relief)
    layers.push({
      id: "hillshade",
      type: "hillshade",
      source: "hillshade-dem",
      paint: {
        "hillshade-exaggeration": 0.28,
        "hillshade-shadow-color": "#5d6c85",
        "hillshade-highlight-color": "#ffffff",
        "hillshade-accent-color": "#8c9ab0",
      },
    });
  layers.push(
    {
      id: "waterway",
      type: "line",
      source: "openmaptiles",
      "source-layer": "waterway",
      filter: surface,
      layout: { "line-cap": "round" },
      paint: { "line-color": palette.water, "line-width": zoom(10, 0.8, 18, 6) },
    },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", filter: surface, paint: { "fill-color": palette.water } },
    {
      id: "paths",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 15,
      filter: ["all", lines, classIs("path", "track")],
      paint: { "line-color": palette.path, "line-width": zoom(15, 1, 19, 3), "line-dasharray": [2, 1.5] },
    },
    {
      id: "rail",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["all", lines, surface, classIs("rail", "transit")],
      paint: { "line-color": palette.rail, "line-width": zoom(12, 1, 18, 3) },
    },
    ...road("road-minor", ["minor", "service", "street", "street_limited"], palette.road, palette.roadCasing, [13, 0.6, 15, 4, 19, 22], 12.5),
    ...road("road-local", ["secondary", "tertiary"], palette.road, palette.roadCasing, [10, 0.8, 14, 4.5, 19, 26], 8),
    ...road("road-major", ["primary", "trunk"], palette.major, palette.majorCasing, [7, 0.8, 14, 6, 19, 30], 6),
    ...road("road-highway", ["motorway"], palette.highway, palette.highwayCasing, [5, 0.8, 14, 7, 19, 32], 5),
    // Buildings appear flat first, then rise into soft pastel blocks.
    {
      id: "building-flat",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 12.5,
      maxzoom: 13.6,
      paint: { "fill-color": "#e8e3ee", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13.2, 1] },
    },
    {
      id: "building-3d",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 13.5,
      filter: ["!=", ["get", "hide_3d"], true],
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], 6],
          0, "#efeaf5",
          10, "#e6e4f8",
          25, "#d9ddf8",
          60, "#c8d2f5",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13.5, 0,
          14.8, ["max", ["coalesce", ["get", "render_height"], 6], 4],
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.94,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    {
      id: "water-name",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
      layout: { "text-field": name, "text-font": fonts.italic, "text-size": 14, "text-letter-spacing": 0.08, "text-max-width": 8 },
      paint: { "text-color": palette.waterLabel, "text-halo-color": "rgba(255,255,255,0.8)", "text-halo-width": 1.4 },
    },
    {
      id: "water-name-line",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "water_name",
      filter: lines,
      layout: { "text-field": name, "text-font": fonts.italic, "text-size": 14, "text-letter-spacing": 0.08, "symbol-placement": "line", "symbol-spacing": 400 },
      paint: { "text-color": palette.waterLabel, "text-halo-color": "rgba(255,255,255,0.8)", "text-halo-width": 1.4 },
    },
    {
      id: "waterway-name",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "waterway",
      minzoom: 13,
      filter: lines,
      layout: { "text-field": name, "text-font": fonts.italic, "text-size": 12.5, "symbol-placement": "line", "symbol-spacing": 400 },
      paint: { "text-color": palette.waterLabel, "text-halo-color": "rgba(255,255,255,0.8)", "text-halo-width": 1.4 },
    },
    ...streetNames("street-name-major", ["primary", "secondary", "tertiary", "trunk"], 13),
    ...streetNames("street-name", ["minor", "service", "street", "street_limited"], 15.6),
    // Named civic buildings and landmarks near street level, as quiet text.
    {
      id: "civic-name",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "poi",
      minzoom: 15.8,
      filter: [
        "all",
        ["has", "name"],
        classIs("town_hall", "library", "college", "school", "hospital", "museum", "theatre", "stadium", "attraction", "place_of_worship", "art_gallery", "post", "police", "fire_station"),
      ],
      layout: {
        "text-field": name,
        "text-font": fonts.regular,
        "text-size": 11.5,
        "text-max-width": 9,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
        "text-padding": 6,
      },
      paint: { "text-color": palette.civic, "text-halo-color": palette.halo, "text-halo-width": 1.6 },
    },
    {
      id: "neighbourhood-name",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 11.5,
      maxzoom: 17,
      filter: classIs("suburb", "neighbourhood", "quarter"),
      layout: {
        "text-field": name,
        "text-font": fonts.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 12, 10.5, 16, 13],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.14,
        "text-max-width": 8,
      },
      paint: { "text-color": palette.neighbourhood, "text-halo-color": palette.halo, "text-halo-width": 1.6 },
    },
    {
      id: "place-name",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      maxzoom: 15,
      filter: classIs("city", "town", "village", "hamlet"),
      layout: {
        "text-field": name,
        "text-font": fonts.bold,
        "text-size": ["interpolate", ["linear"], ["zoom"], 6, ["match", ["get", "class"], "city", 14, 11], 13, ["match", ["get", "class"], "city", 21, 16]],
        "text-max-width": 8,
        "symbol-sort-key": ["coalesce", ["get", "rank"], 99],
      },
      paint: { "text-color": palette.label, "text-halo-color": palette.halo, "text-halo-width": 2 },
    },
  );
  const style: StyleSpecification = {
    version: 8,
    name: "Polis",
    glyphs,
    sources: {
      openmaptiles: { type: "vector", url: vectorTiles, attribution },
      ...(relief
        ? {
            "hillshade-dem": {
              type: "raster-dem" as const,
              tiles: [terrainTiles],
              encoding: "terrarium" as const,
              tileSize: 256,
              maxzoom: 14,
              attribution: terrainAttribution,
            },
          }
        : {}),
      ...(terrain
        ? {
            "terrain-dem": {
              type: "raster-dem" as const,
              tiles: [terrainTiles],
              encoding: "terrarium" as const,
              tileSize: 256,
              maxzoom: 14,
            },
          }
        : {}),
    },
    sky: {
      "sky-color": "#a8d8ff",
      "horizon-color": "#e6f3ff",
      "fog-color": "#f4f7fb",
      "sky-horizon-blend": 0.7,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.6,
    },
    light: { anchor: "viewport", color: "#ffffff", intensity: 0.32, position: [1.3, 210, 35] },
    layers,
  };
  if (terrain) style.terrain = { source: "terrain-dem", exaggeration: 1.15 };
  return style;
}

// A simplified local outline for when the vector tiles cannot load: the
// bundled OSM extracts in public/maps, drawn in the same palette.
export function outlineLayers(source: string): LayerSpecification[] {
  return [
    {
      id: "outline-area",
      type: "fill",
      source,
      filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      paint: {
        "fill-color": ["match", ["get", "kind"], "water", palette.water, "campus", palette.campus, palette.park],
      },
    },
    {
      id: "outline-line",
      type: "line",
      source,
      filter: lines,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["match", ["get", "kind"], "water", palette.water, "road", palette.road, palette.park],
        "line-width": ["match", ["get", "kind"], "road", 4, 2],
      },
    },
  ];
}
