# Architecture

## Runtime and source

React 19 on Next.js 16 (App Router), TypeScript, Tailwind 4 and existing shadcn/Radix components, hosted on Vercel with a Turso (libSQL) database and Clerk sign-in. npm's committed lockfile is authoritative for dependencies. Node 24.14.0 is the development, test and production runtime.

| Area | Source | Responsibility |
| --- | --- | --- |
| App entry | `app/page.tsx`, `app/layout.tsx` | Social shell, metadata, styles |
| Social interface | `components/polis/social-app.tsx`, `social-*.tsx` | Hash navigation, feeds, composer, conversations, rankings, profiles, friends, inbox, owner tools |
| Events | `event-explorer.tsx`, `community-events.tsx`, `venue-map.tsx`, `event-plan.tsx` | Route filters, matching map/list, selection and shared plan editor |
| Maps | `lib/map-style.ts`, `lib/map-geometry.ts`, `components/polis/polis-map.ts`, `civic-map.tsx`, `venue-map.tsx` | MapLibre basemap style, clustered markers, anchored previews, on-device location and tile fallback; see [map](map.md) |
| Browser data | `lib/social/use-social.ts`, `types.ts`, `confirmed-plans.ts` | Snapshots, idempotent mutations, pagination, refresh, acknowledged own-plan state |
| HTTP boundary | `app/api/polis/route.ts`, `proxy.ts` | Same-origin JSON writes, errors, no-store responses; Clerk middleware on every request |
| Sign-in | `lib/auth/`, `app/sign-in/`, `app/sign-out/` | Verified identity from Clerk; the loopback-only development sign-in; safe return paths. See [authentication](authentication-path.md) |
| Domain service | `lib/social/service.ts` | Membership, ownership, audience and relationships; transactional commands and receipts |
| Storage | `db/schema.ts`, `drizzle/`, `db/index.ts`, `scripts/migrate.mjs` | SQLite schema, versioned migrations, the libSQL connection, and the migrator that runs before each build |
| Campus & civic | `lib/social/communities.ts`, `lib/social/civic/`, `lib/social/campus-events.ts`, `civic-map.tsx`, `civic-cards.tsx`, `entity-page.tsx`, `home-dashboard.tsx`, `commons.tsx` | Campus configuration, email-domain association (only for verified sign-in emails), per-community civic catalog (curated or generic scaffold), typed map, entity cards/pages, Commons tabs and summaries |
| Communities anywhere | `lib/social/geo.ts`, `lib/social/civic/generic.ts`, `find-community.tsx`, `place_communities`/`community_places` tables | Member-founded town and campus communities, OpenStreetMap place search and civic-place import, find/near-me UI |
| Samples/demo | `lib/polis-data.ts`, `lib/social/catalog.ts`, `lib/polis-state.ts`, `app/demo/page.tsx` | Labeled civic samples; isolated fictional localStorage demo with its own schematic map (`community-map.tsx`, `lib/map-camera.ts`) |
| Build/hosting | `next.config.ts`, `vercel.json`, `scripts/` | Next.js build, function region, legacy sign-in redirects, migrations and verification suites. See [deployment](deployment.md) |

The main shell uses hash routes such as `#home`, `#explore/events`, `#rankings`, `#friends`, `#profile`, and detail routes for issues, civic items, posts, and profiles. Event filters and selection stay in the hash URL. `/demo` is a separate page; `/api/polis` is the social API. Preserve these routes.

## Data flow and access

1. Clerk authenticates the request; `lib/auth/session.ts` accepts the identity only when its primary email is verified. Request headers never carry identity. Under `next dev`, a loopback-only synthetic sign-in replaces Clerk; it is not production authentication.
2. The API constructs the service with the database, trusted identity, and the server-only owner setting. It rejects cross-origin or non-JSON writes before command execution.
3. Reads enforce invited membership, audience, friendship, blocking, and muting across feeds, profiles, search, counts, links, and notification previews. Cursor pages are revalidated on refresh.
4. Validated commands use a per-user receipt for idempotency and transactional batches. Guard rows abort the whole batch if access or a question changes during an operation.
5. The client refreshes after writes, on focus, and while visible. It retains drafts after failed writes. Acknowledged own-plan changes survive transient refresh failures; successful reads replace that confirmation. No private activity goes to external notification services.

Tables separate profiles/memberships/invitations, friendships/blocks/mutes, private scored rankings and issue priorities, published lists, posts/comments/reactions, follows/saves, plans, daily questions/responses, notifications, reports, preferences, receipts, and minimal metrics. Sample civic content is code-defined, not a live ingestion pipeline. Server-side external data comes from OpenStreetMap, queried on demand, and from local news feeds and the GDELT index ([local news](local-news.md)). Browsers load map tiles from OpenFreeMap and hill-shading tiles from the public AWS terrain tiles; device location never leaves the browser. Nominatim resolves a typed place or a rounded location, and Overpass imports public civic places into `community_places` at most weekly per community.

Posts default to Friends. Private rankings and notes stay private; publishing creates a selected snapshot. Support, priority, and reactions are independent. Conversation audience is fixed; wider publication creates a new conversation. Plans start private; unchanged saves retain shared conversation history.

## Environments

`npm run dev` applies migrations to a local libSQL file (`.data/polis-local.db`) and serves on `127.0.0.1:5173` with the synthetic sign-in. Tests run the real migrations and service code on `node:sqlite` and on libSQL (`tests/libsql.test.ts`) with isolated identities. Neither proves hosted identity isolation.

Production is Vercel functions in `iad1` next to Turso, with Clerk sessions. See [deployment](deployment.md) and [verification](VERIFICATION.md).
