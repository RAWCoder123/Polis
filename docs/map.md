# The Polis map

September 28, 2026. Locally verified; not yet published to Sites.

The civic map (`#explore`, and the Home preview) and the event venue map (`#explore/events?mode=map`) share one basemap and one marker system. The aim is a map people enjoy opening, closer to Snap Map than to a navigation app: bright, spacious and a little playful, with the civic places on top.

## What people see

- **A simplified 3D basemap.** Pastel land, bright parks and water, hill shading for the landscape, and soft lavender buildings that rise as you zoom in. Labels are limited to what helps people place themselves: neighbourhoods, streets (major streets first, minor ones closer in), water, and named civic buildings at street level. No shop icons, route shields or one-way arrows.
- **A tilted, framed first view.** The map opens tilted and turned slightly so buildings read as 3D, framed on the places within about three miles of the community's center, so an outlying office does not zoom the whole town out.
- **Bubbles, not piles.** Nearby places share a count bubble with a dot for each kind of place inside; tapping a bubble zooms in until places stand alone (from zoom 16). A bubble's accessible name lists what it holds. Places sharing one exact spot (several offices in one city hall) fan out. On a tilted map, markers toward the horizon draw a little smaller.
- **Friends' plans.** Initials appear on a venue, or on the bubble that holds it, only for friends who chose to share a plan with you. Never a live location.
- **Use my location.** Glides down to street level in 3D, puts a dot where you are and names the street and neighbourhood ("Near College Avenue · Collegetown"). Places in the list are sorted by distance. If you are more than 25 miles away, distances use the community center and the map offers to find the commons where you are.
- **Only useful layers.** Layer chips appear only for kinds of places the community has.

## How it works

| Piece | File |
| --- | --- |
| Basemap style (pure, validated in tests) | `lib/map-style.ts` |
| Street naming, fan-out and bubble names (pure, tested) | `lib/map-geometry.ts` |
| Map creation, tile fallback, clustered markers and anchored previews | `components/polis/polis-map.ts` |
| Civic map | `components/polis/civic-map.tsx` |
| Event venue map | `components/polis/venue-map.tsx` |
| Styles | `components/polis/civic.css`, `components/polis/motion.css` (pin drop) |

MapLibre GL JS is loaded on demand in its own chunk (about 1 MB, 280 KB gzipped) only when a map is on screen. Markers are React-rendered buttons inside MapLibre markers, so they are keyboard-focusable and carry names; the side list keeps full map/list parity. Clusters come from a GeoJSON source with per-layer counts; an invisible circle layer makes the source load so markers can be read from it.

## Data sources and privacy

| Source | Used for | Notes |
| --- | --- | --- |
| [OpenFreeMap](https://openfreemap.org) vector tiles and fonts | Basemap | Free, no key, OpenMapTiles schema. Attribution: OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors. |
| [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium) | Hill shading | Attribution: © Mapzen and others. |
| `public/maps/*.geojson` | Fallback outline for Ithaca and Gainesville | ODbL extracts; see `public/maps/README.md`. |

Loading tiles tells those hosts which area is on screen, as with any web map. The device location itself is rounded to about 100 m, kept in the tab's session storage and never sent to Polis or a tile host; street names come from tiles the browser already loaded.

## When things fail

- **No WebGL:** the map says it could not load; the list keeps every place.
- **Tiles blocked or failing:** after errors, or 12 seconds of visible loading, pilot towns switch to the bundled outline and others show the list. If tiles arrive later the full map takes over. Time in a hidden tab does not count.
- **Reduced motion:** the camera jumps instead of gliding; pins do not drop in; the location pulse stops.

## Decisions

- **Full 3D terrain is off.** It was tried: it lifted markers and the location dot off-center, hid pins behind hills and costs phones more GPU and downloads. Hill shading shows the landscape. `polisMapStyle({ terrain: true })` still produces a valid style if this is revisited.
- **Leaflet was removed.** It cannot draw 3D buildings or tilt, which the map now relies on.
- **Zoom with the page.** Scrolling the page never zooms the map; use pinch, +/−, double-click or ⌘/Ctrl + scroll. The Home preview uses cooperative gestures.

## Testing

`tests/map.test.ts` validates the style against the MapLibre spec in every mode, checks fonts and the absence of sprite icons, and covers street naming, fan-out and bubble names. Browser suites launch Chromium with its software WebGL renderer through `scripts/browser.mjs`; `clickMapPlace` opens bubbles until a named place stands alone.

Not yet verified: real phones (pinch, two-finger tilt, performance on older devices), a screen-reader pass over markers and bubbles, and OpenFreeMap availability from every pilot network.
