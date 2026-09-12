# Polis

An invite-only Ithaca/Cornell social pilot: discover an issue, express a view, hear from a friend, and follow what happens next.

The recovered MVP's React/Vinext framework, white/cobalt/navy design, original assets, pairwise comparisons, manual ranking order, and schematic event map are preserved. The original fictional browser-only experience is available at `/demo`; it cannot create social records.

## Run locally

Use Node 24 (the test adapter uses `node:sqlite`) and the checked-in lockfile.

```sh
npm ci
cp .env.example .dev.vars
npm run db:migrate:local
npm run dev
```

Open `http://localhost:5173/`. Local “Sign in with ChatGPT” uses the starter's development identity, Seedy. Create a profile to enter the local community. This is a local simulation, not a real ChatGPT OAuth test. `.dev.vars` and `.wrangler/state` are ignored and must never be published.

```sh
npm test
npm run typecheck
npm run lint
node scripts/verify-local-http.mjs
npm run build
```

The HTTP check requires the local server. Tests apply the real migrations to isolated SQLite fixtures and call the real service with A/B/C identities. See [verification](docs/VERIFICATION.md) for evidence and limits, and [pilot setup](docs/PILOT_SETUP.md) for hosting, invitations, and migration instructions.

## Product and implementation

- `components/polis/social-app.tsx`: Home, Explore, Rankings, Friends, Profile, connected detail/conversation routes, supporting rail, and mobile navigation.
- `components/polis/social-*.tsx`: composing, shallow replies, post actions, profiles, events, notifications, and owner community tools.
- `lib/social/service.ts`: authenticated membership, centralized visibility, validated/idempotent commands, transactional write guards, and cursor reads.
- `db/schema.ts` and `drizzle/`: durable D1 models and versioned migrations.
- `app/api/polis/route.ts`: same-origin JSON API using trusted Sites authentication.
- `lib/social/catalog.ts`: explicitly labeled sample civic records and issue connections. These are not verified current local policies, officials, news, or events.
- `lib/polis-state.ts`: isolated browser-only demo state.

Posts default to Friends. Rankings, notes, saved items, daily responses, and event plans stay private until deliberately shared. Published ranking lists are selected snapshots; future private edits never update them. Conversation audiences are fixed; broader publication creates a new post with its own replies. One active reaction is allowed per user/post. Unfriending and blocking revoke visibility on subsequent authorized reads; visible clients revalidate on focus and every 30 seconds.

Client writes wait for persistence rather than displaying speculative success. Failed submissions retain drafts and reuse the request key on retry. Refreshes revalidate all loaded pages, removing newly inaccessible records while retaining pagination. No external notifications, contact uploads, public registration, inferred political labels, continuous location tracking, or third-party analytics are included.
