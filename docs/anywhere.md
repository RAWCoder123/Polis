# Polis anywhere: communities for any town or campus

Verification date: September 27, 2026. Branch: `codex/polis-anywhere`, on top of `codex/polis-main-stack` ([PR #8](https://github.com/RAWCoder123/Polis/pull/8)). Locally verified candidate; **not deployed**.

Until this change Polis only worked where a community was written into `lib/social/communities.ts` (Polis commons, Cornell/Ithaca, UF/Gainesville, Emory). A member anywhere else landed in a commons with no map, no local offices and nothing to discuss. Now any signed-in member can find or start the commons for their own town, and a student at any university can found its campus community with their university email.

## What members see

- **Find your community** (`#communities`, also "Find or start a community…" in the community selector). New accounts without a campus land here; Home shows the same entry point while the active community has no location.
  - Search a town, city or university, or **Use my location** to list communities within about 60 miles with distances.
  - Results show kind (Town / Campus), location, member count, and **Join**, **Open** or **Use a code** (campuses you are not eligible for).
  - **Start a new commons** lists matching places from OpenStreetMap that don't have a community yet. Starting one makes you its first member and opens its Home right away; public places are added to the map in the background.
  - **Start the campus commons for _school.edu_** appears when you signed in with a plain institutional domain that no campus uses yet. Name the university, pick the campus town, and later students with the same domain are associated automatically.
- **Every located community gets an honest civic scaffold** (`lib/social/civic/generic.ts`) instead of empty pages:
  - Six local issues: housing, getting around, safe streets, parks & public spaces, schools & libraries, local jobs; campuses add student voice.
  - Offices described by role, never by officeholder: mayor or local executive, local council, county (US) or regional government, legislators; in the US also Members of Congress and Vote.gov. US offices link to the official USA.gov, House and Senate lookups. Campuses add student government and administration.
  - Starter questions labeled **Sample** (getting around, more homes near jobs and transit, a public space that needs care; campuses add student-government priorities).
  - Up to 60 **public places from OpenStreetMap**: town halls, government offices, courthouses, libraries, universities, community centers, markets, arts centers, parks, fire and police stations, post offices. Commercial places are excluded. Each links to its HTTPS website or its OpenStreetMap record.
- Home, the map, Commons tabs, entity pages, search, the composer and priorities all work against this scaffold exactly as they do for the curated Cornell and UF catalogs. The **Campus** Commons tab appears only in campus communities; **Local** appears in any located community. Home's header reads "University · City, Region" or "City, Region".
- Configured communities without a curated catalog (Emory) get the same scaffold and public places.

## Rules enforced by the server

All reads and writes go through `app/api/polis/route.ts` and `lib/social/service.ts`.

| Action | Rule |
| --- | --- |
| `community.create` (`kind: "city"`) | Requires a profile. If an active town community with the same name exists in the same country within 25 miles, you join it instead of creating a duplicate. |
| `community.create` (`kind: "campus"`) | The domain always comes from the trusted sign-in email, never from the request. Only plain institutional domains qualify (`name@school.edu`, `ac.uk`/`edu.au`-style); subdomains such as `alumni.school.edu` and non-academic domains do not. If the domain already has a campus, you join it. |
| Rate limit | A member can create at most three communities per 24 hours (429). Joining existing ones is unlimited. |
| Founder role | Curator of the new community (can manage listings). Moderation of reports stays with the pilot owner. |
| `community.join` | Town communities are open to any signed-in member. Campuses still require a matching email domain or an invitation code. |
| `places.import` | Only for communities without a curated catalog (400 otherwise). At most once a week per community (later calls return `recent: true`). |
| Search (`?communities=`, `?places=`, `?reverse=`) | Sign-in required. OpenStreetMap lookups are throttled to about one per second per Worker isolate. |

Membership in a town community **does not verify residence**, and campus association **does not verify student status**. The UI says so where members join.

## Privacy and external services

- **Place search** sends only the typed text to OpenStreetMap's Nominatim service, from the Worker, with a User-Agent that identifies Polis and the site origin. Results are limited to settlements.
- **Use my location** is opt-in and never stored. The browser rounds coordinates to about 100 m and sends them to Polis only for that nearby search. The Nominatim reverse lookup further rounds them to about 1 km. The existing map "Use my location" is unchanged and still stays in the tab.
- **Public places** come from the public Overpass API, queried by a small bounding box around the community center. Three public instances are tried in order (overpass-api.de, kumi.systems, VK Maps). A rate limit or gateway timeout is retried once, and the whole import is capped at about 50 seconds. Data © OpenStreetMap contributors (ODbL), credited on the map and on every place.
- Communities store only their public place name, region, country, rounded center (4 decimals), timezone and, for campuses, the email domain and university name. The founder is recorded for rate limiting and curation.
- Both services are free, shared infrastructure with fair-use policies. Imports are on demand and cached for a week; nothing is fetched in bulk. If either service is busy, founding still succeeds and the map offers **Add public places** later.

## Data and migrations

Additive only: **0011_cultured_tinkerer.sql** creates `place_communities` (unique campus domain, index on country/region/city) and `community_places` (primary key community + OSM id). Earlier migrations are unchanged. A SQLite database built through 0010 with an existing profile upgraded through 0011 with the profile intact, and `PRAGMA foreign_key_check` and `integrity_check` passed.

Code map:

- `lib/social/communities.ts`: `localeOf` (one location shape for campuses and towns), `campusDomainOf`, `communityFromRow`.
- `lib/social/geo.ts`: Nominatim search/reverse, Overpass query and civic-place parsing.
- `lib/social/civic/generic.ts` and `civic/index.ts`: `catalogFor(community, places)`; the client uses `catalogOf(snapshot)`.
- `components/polis/find-community.tsx`: find, near me, start town and campus.

Curated Cornell and UF catalogs are unchanged and still take precedence.

## Verification record

- `npm run lint`: 0 errors, the 7 inherited warnings. `npm run typecheck` and `npm run build` pass.
- `npm test`: **77** pass (67 before, plus 10 in `tests/anywhere.test.ts`):
  - campus founding domains;
  - town creation and duplicate joining;
  - the generic scaffold accepted as post subjects;
  - campus founding and later auto-association;
  - the three-a-day limit;
  - weekly place import (with a stubbed fetcher) and discussable places;
  - OpenStreetMap parsing and civic ranking;
  - busy or unreachable Overpass instances retried, then reported as busy (never as "no places");
  - place search requiring sign-in;
  - Emory receiving the scaffold.
- New `npm run test:anywhere-browser` (`scripts/verify-anywhere-browser.mjs`) uses the **real** Nominatim and Overpass services through the local Worker. Set `POLIS_SKIP_OSM=1` where they are blocked. Journeys:
  - **F:** a member without a campus email starts Burlington, Vermont; Home opens immediately; public places arrive in the background, or through the map's **Add public places** if OpenStreetMap was busy; they post a discussion tied to the local council; the map lists places.
  - **G:** a second member at 390 px finds the same Burlington (no duplicate) and sees the discussion under Local.
  - **H:** an `example.edu` student founds "Example University"; the Campus tab appears.
  - **I:** "Use my location" near Burlington lists it with a distance.
- Several suites share synthetic accounts, so each needs the right starting state. `verify-signup-browser` needs `beta_b`/`beta_c` without profiles or campus memberships. `test:browser` needs the profiles created by the social and events HTTP fixtures, and must run before the commons suite moves owner `1` between campuses. On fresh, migrated, isolated worktree databases (port 5181), everything passes in two runs:
  - Database 1, in order: signup, invitations, local HTTP, social HTTP, events HTTP, commons, civic, anywhere.
  - Database 2, the documented social-cycle order: social HTTP, events HTTP, `test:browser`.

  The suites covered are:
  - `test:invitations-browser`, `test:http`, `test:social-http`, `test:events-http`;
  - `verify-signup-browser.mjs` (updated: new accounts now land on Find your community);
  - `verify-commons-browser.mjs`, `verify-social-browser.mjs`, `test:civic-browser` (journeys A–E);
  - `test:anywhere-browser` (journeys F–I). In the final run the background place import succeeded without the map fallback.
- Desktop 1440 px and mobile 390 px pages were checked for horizontal overflow (none).
- Verification found and fixed:
  - posts about generic subjects were misread as event posts;
  - the original Overpass query timed out and a rate-limit page broke parsing;
  - founding waited on the place import;
  - the public Overpass service intermittently returned 429/504 pages, and its fallback instance was unreachable from this network;
  - the Home header lost its "City, ST" format;
  - an order-dependent Commons test.

## Not verified / next

- Hosted deployment and multi-identity acceptance (Sites publication remains blocked from this network; see [Commons pilot](commons-pilot.md)).
- Whether the Sites Worker can reach Nominatim and Overpass in production, and whether their fair-use limits suffice. A pilot with real traffic should cache place search or use a keyed geocoder.
- Moderation for founder-created communities: reports still go to the pilot owner. Community-level moderators, renaming, merging duplicates across countries and archiving (`status`) have no UI yet.
- Officeholder names, local meeting calendars and events for new communities need checked sources. The scaffold only links to official lookups.
- Non-US civic structure is generic (regional government, legislators). Country-specific offices and election links are future work.
- The OSM basemap tiles were blocked in local headless testing, so pins render on a blank background there.
