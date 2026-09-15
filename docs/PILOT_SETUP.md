# Pilot setup and operation

## Hosting and authentication

Use the existing Sites project recorded in `.openai/hosting.json`; do not register another site. The manifest declares logical D1 binding `DB`. The starter builds a Cloudflare Worker with the static client and Drizzle migrations.

Set runtime `POLIS_OWNER_EMAIL` in Sites to the owner's exact trusted ChatGPT account email before deploying. The local example email must never be used as production configuration. This setting permits that identity to create the initial owner profile; subsequent members require an unexpired email-bound invitation. Once created, membership roles are durable database records. Editing a profile location or sending a `role` property cannot grant access.

Sites owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, and `/callback`. `app/chatgpt-auth.ts` reads dispatcher-authenticated identity headers. Do not expose the Worker through a separate origin that accepts arbitrary client identity headers. Do not deploy the development auth shim as an authentication mechanism. No OpenAI API key is required.

The hosting access list and the Polis membership list are separate gates. Keep the site's existing owner-only audience during initial delivery. For the pilot, the owner must deliberately grant the selected testers Sites viewing access, then create an email-bound Polis invitation for each one in **Profile → Community tools**. Copy and deliver each link through an approved channel. Creating the invitation does not send a message or grant Sites access. Invite links expire after seven days and can be consumed once by the matching trusted email. Do not place links or tokens in logs or this repository.

## Migrations

Checked-in migrations run in order:

1. `0000_robust_captain_britain.sql` creates the domain tables and indexes.
2. `0001_lowly_ted_forrester.sql` adds the transactional write-guard table.
3. `0002_majestic_trish_tilby.sql` adds private `issue_priorities` and the persisted `onboardingComplete` flag without replacing existing activity.

For local development, `npm run db:migrate:local` applies pending migrations to `.wrangler/state` using `wrangler.local.jsonc`. It is safe to rerun and does not seed fictional people. Production migrations are included under `dist/.openai/drizzle` by the Sites package workflow and applied during hosting. Confirm deployment success before testing authenticated reads. There is no request-time schema creation or destructive reset endpoint.

For future schema changes, update `db/schema.ts`, run `npm run db:generate`, inspect generated SQL, test from an empty database and against a representative prior schema, then package source and migrations. Never rewrite an applied migration. Back up production data before a potentially destructive migration; reverting a Worker version does not undo a schema migration.

## Content and daily operation

The civic catalog, dates, officials, events, map placements, and initial question are labeled samples. General municipal references do not verify those fictional records. Replace catalog records with sourced local content before a real participation campaign. No registration or attendance is confirmed for sample events.

Owners can create, edit, schedule, and withdraw daily questions, publish significant issue updates with a source URL, generate invitations, and resolve reports in Community tools. Editing answer options is prohibited once responses exist. Withdrawal stops new responses transactionally. Existing deliberately shared answer posts remain under their original audiences. Report evidence is restricted to the owner; resolving with removal clears the targeted public-facing content.

Interested and Planning to attend are different plan statuses. Their default audience is Only me. Sharing or changing a shared plan synchronizes the feed, profile, event detail, and map/list views. Changing to private withdraws earlier plan activity. The map is illustrative and has an equivalent event list.

## Minimal first-party metrics

The `metrics` table records only an opaque user ID, event name, object ID, and timestamp. Events are `joined`, `friend_accepted` (both participants), `post_created` (shared posts, including selected lists/daily answers/event activity), `reply_created` (shared conversations), and `active_day` (at most once per UTC day). Private text, notes, political positions, scores, and precise location are excluded. Browser activity is recorded on entering the signed-in experience and on later visible interaction, focus, or return to the tab; idle open tabs do not generate periodic visits.

Definitions for an owner-only analysis:

- Activation: a user has both `friend_accepted` and a first shared contribution (`post_created` or `reply_created`). Count each user once; activation time is the later of the two first events.
- Reciprocal conversation: at least two distinct contributors have a post/reply event for the same discussion. Post `objectId` is the post ID; reply `objectId` is the containing post ID. Exclude Only me work.
- Return: a user has `active_day` in a UTC week after their first active week. This measures activity, not an inferred political preference.

No metrics are exposed through the community API. No retention/deletion scheduler or automated reporting dashboard is configured; agree an operational retention period before inviting real members.
