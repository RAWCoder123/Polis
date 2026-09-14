# Architecture

## Runtime and source

Polis retains the recovered Sites stack: React 19, Next.js 16 App Router conventions, Vinext 1 beta over Vite 8, TypeScript, Tailwind 4 and existing shadcn/Radix components. npm's committed lockfile is authoritative for dependencies. Node 24.14.0 is the development/test runtime; production runs a Cloudflare Worker, not a Node server.

| Area | Source | Responsibility |
| --- | --- | --- |
| App entry | `app/page.tsx`, `app/layout.tsx` | Social shell, metadata, styles |
| Social interface | `components/polis/social-app.tsx`, `social-*.tsx` | Hash navigation, feeds, composer, conversations, rankings, profiles, friends, inbox, owner tools |
| Events | `event-explorer.tsx`, `community-map.tsx`, `event-plan.tsx`, `lib/map-camera.ts` | Route filters, matching map/list, pan/zoom, selection and shared plan editor |
| Browser data | `lib/social/use-social.ts`, `types.ts`, `confirmed-plans.ts` | Snapshots, idempotent mutations, pagination, refresh, acknowledged own-plan state |
| HTTP boundary | `app/api/polis/route.ts`, `app/chatgpt-auth.ts` | Trusted identity, same-origin JSON writes, errors, no-store responses |
| Domain service | `lib/social/service.ts` | Membership, ownership, audience and relationships; transactional commands and receipts |
| Storage | `db/schema.ts`, `drizzle/`, `db/index.ts` | D1 schema, versioned migrations, Drizzle helper |
| Samples/demo | `lib/polis-data.ts`, `lib/social/catalog.ts`, `lib/polis-state.ts`, `app/demo/page.tsx` | Labeled civic samples; isolated fictional localStorage demo |
| Build/hosting | `vite.config.ts`, `build/sites-vite-plugin.ts`, `scripts/`, `.openai/hosting.json` | Worker/client build and Sites integration |

The main shell uses hash routes such as `#home`, `#explore/events`, `#rankings`, `#friends`, `#profile`, and detail routes for issues, civic items, posts, and profiles. Event filters and selection stay in the hash URL. `/demo` is a separate page; `/api/polis` is the social API. Preserve these routes.

## Data flow and access

1. Sites authenticates the request and supplies trusted user headers. The local plugin strips caller-supplied identity headers and uses a visibly synthetic sign-in cookie; that shim is not production authentication.
2. The API constructs the service with D1, trusted identity, and the server-only owner setting. It rejects cross-origin or non-JSON writes before command execution.
3. Reads enforce invited membership, audience, friendship, blocking, and muting across feeds, profiles, search, counts, links, and notification previews. Cursor pages are revalidated on refresh.
4. Validated commands use a per-user receipt for idempotency and D1 transactional batches. Guard rows abort the whole batch if access or a question changes during an operation.
5. The client refreshes after writes, on focus, and while visible. It retains drafts after failed writes. Acknowledged own-plan changes survive transient refresh failures; successful reads replace that confirmation. No private activity goes to external notification services.

Tables separate profiles/memberships/invitations, friendships/blocks/mutes, private rankings, published lists, posts/comments/reactions, follows/saves, plans, daily questions/responses, notifications, reports, preferences, receipts, and minimal metrics. Sample civic content is code-defined, not a live ingestion pipeline.

Posts default to Friends. Private rankings and notes stay private; publishing creates a selected snapshot. Support, priority, and reactions are independent. Conversation audience is fixed; wider publication creates a new conversation. Plans start private; unchanged saves retain shared conversation history.

## Environments

Local development uses a Worker emulator and persistent local D1 in `.wrangler/state`, with synthetic authentication. Tests use real migrations and service code through a SQLite D1 transport adapter and isolated identities. Neither proves hosted ChatGPT identity isolation.

The build emits `dist/client` and `dist/server/index.js`. Sites packaging includes the manifest and migrations. Production depends on the trusted dispatcher and managed D1; exposing the Worker with arbitrary identity headers is unsupported. See [deployment](deployment.md) and [verification](VERIFICATION.md).
